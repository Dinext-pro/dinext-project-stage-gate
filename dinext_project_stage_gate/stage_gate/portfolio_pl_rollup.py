from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import frappe
from frappe.utils import flt, get_last_day, getdate

PL_EXCLUDED_DIMENSIONS = frozenset({"Project", "Cost Center", "Project Portfolio"})
PL_RISK_KEY_SEP = "|risk|"


@dataclass
class PlRollupTotals:
	plan_income: float = 0.0
	plan_expenses: float = 0.0
	forecast_income: float = 0.0
	forecast_expenses: float = 0.0

	@property
	def plan_net(self) -> float:
		return self.plan_income - self.plan_expenses

	@property
	def forecast_net(self) -> float:
		return self.forecast_income - self.forecast_expenses


@dataclass
class PlBudgetIndex:
	by_value_map: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
	by_parent_account_map: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
	sum_cache: dict[str, float] = field(default_factory=dict)


def summarize_project_pl_plan_forecast(
	project_row: dict[str, Any],
	periods: list[tuple[int, int]],
	budget_docs: list[dict[str, Any]] | None = None,
	current_day: date | None = None,
) -> tuple[float, float, float, bool]:
	company = project_row.get("company")
	project_name = project_row.get("name")
	if not company or not project_name:
		return 0.0, 0.0, 0.0, False

	aggregated = build_project_pl_aggregated_budget(
		project_name,
		company,
		budget_docs=budget_docs,
	)
	if not aggregated:
		return 0.0, 0.0, 0.0, False

	budget_index = build_pl_budget_index(aggregated)
	sum_cache: dict[str, float] = {}
	roots = get_financial_root_rows(aggregated)
	has_data = False
	plan_total = 0.0
	forecast_total = 0.0
	plan_today_total = 0.0

	for year, month in periods:
		plan_col = calc_pl_column_total(
			aggregated,
			roots,
			year,
			month,
			value_key="plan",
			budget_index=budget_index,
			sum_cache=sum_cache,
		)
		forecast_col = calc_pl_column_total(
			aggregated,
			roots,
			year,
			month,
			value_key="forecast",
			budget_index=budget_index,
			sum_cache=sum_cache,
		)
		month_plan = plan_col.plan_net
		month_forecast = forecast_col.forecast_net
		if month_plan or month_forecast:
			has_data = True
		plan_total += month_plan
		forecast_total += month_forecast
		if current_day is not None:
			plan_today_total += month_plan * _month_progress_ratio(year, month, current_day)
		else:
			plan_today_total += month_plan

	return plan_total, forecast_total, plan_today_total, has_data


def build_project_pl_aggregated_budget(
	project_name: str,
	company: str,
	budget_docs: list[dict[str, Any]] | None = None,
) -> dict[str, dict[str, Any]]:
	accounts = load_pl_accounts(company)
	if not accounts:
		return {}

	aggregated = build_pl_account_shell(accounts)
	load_pl_allowed_dimensions(company, aggregated)
	docs = budget_docs if budget_docs is not None else load_pl_budget_documents([project_name]).get(project_name, [])
	merge_pl_budget_docs(aggregated, docs)

	tasks = load_pl_aggregated_tasks(project_name)
	if tasks:
		apply_pl_task_dimensions(aggregated, tasks)
	apply_pl_risk_dimension_rows(aggregated)
	return aggregated


def load_pl_accounts(company: str) -> list[dict[str, Any]]:
	return frappe.get_all(
		"Account",
		filters={
			"disabled": 0,
			"report_type": "Profit and Loss",
			"company": company,
		},
		fields=["name", "account_name", "is_group", "parent_account", "root_type"],
		order_by="root_type desc, lft asc",
		limit=0,
	)


def build_pl_account_shell(accounts: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
	aggregated: dict[str, dict[str, Any]] = {}
	nodes = [
		{
			"value": row["name"],
			"account": row.get("account_name") or row["name"],
			"expandable": bool(row.get("is_group")),
			"parent_account": row.get("parent_account"),
			"type": row.get("root_type"),
		}
		for row in accounts
	]

	def save_aggregated(parent: str | None, level: int) -> None:
		for node in [item for item in nodes if item.get("parent_account") == parent]:
			account_name = node["value"]
			if account_name in aggregated:
				continue
			aggregated[account_name] = {
				**node,
				"indent": level,
				"dimension_data": [{"dimensions": []}],
				"allowed_dimensions": [],
			}
			save_aggregated(account_name, level + 1)

	save_aggregated(None, 0)
	return aggregated


def load_pl_allowed_dimensions(company: str, aggregated: dict[str, dict[str, Any]]) -> None:
	filter_names = frappe.get_all(
		"Accounting Dimension Filter",
		filters={"company": company, "disabled": 0},
		pluck="name",
		limit=0,
	)
	if not filter_names:
		return

	document_type_by_dimension: dict[str, str] = {}
	for filter_name in filter_names:
		filter_doc = frappe.get_doc("Accounting Dimension Filter", filter_name)
		dimension_name = filter_doc.accounting_dimension
		if not dimension_name or dimension_name in PL_EXCLUDED_DIMENSIONS:
			continue

		document_type = document_type_by_dimension.get(dimension_name)
		if not document_type:
			meta = frappe.get_doc("Accounting Dimension", dimension_name)
			document_type = meta.document_type
			document_type_by_dimension[dimension_name] = document_type

		for account_row in filter_doc.accounts or []:
			account_name = account_row.applicable_on_account
			if account_name not in aggregated:
				continue
			aggregated[account_name]["allowed_dimensions"].append(
				{
					"document_type": document_type,
					"is_mandatory": bool(account_row.is_mandatory),
				}
			)


def load_pl_budget_documents(project_names: list[str]) -> dict[str, list[dict[str, Any]]]:
	if not project_names:
		return {}

	budget_rows = frappe.get_all(
		"Project Budget",
		filters={"pb_project": ["in", project_names]},
		fields=["name", "pb_project", "pb_account"],
		limit=0,
	)
	if not budget_rows:
		return {}

	budget_names = [row["name"] for row in budget_rows]
	dimension_rows = frappe.get_all(
		"Project Budget Dimension",
		filters={"parent": ["in", budget_names]},
		fields=["parent", "doc", "docname"],
		limit=0,
	)
	amount_rows = frappe.get_all(
		"Project Budget Amount",
		filters={"parent": ["in", budget_names]},
		fields=["parent", "pba_year", "pba_month", "pba_plan", "pba_expected"],
		limit=0,
	)

	dimensions_by_parent: dict[str, list[dict[str, str]]] = defaultdict(list)
	amounts_by_parent: dict[str, list[dict[str, Any]]] = defaultdict(list)
	for row in dimension_rows:
		dimensions_by_parent[row["parent"]].append({"doc": row["doc"], "docname": row["docname"]})
	for row in amount_rows:
		amounts_by_parent[row["parent"]].append(row)

	by_project: dict[str, list[dict[str, Any]]] = defaultdict(list)
	for budget_row in budget_rows:
		by_project[budget_row["pb_project"]].append(
			{
				"name": budget_row["name"],
				"pb_account": budget_row["pb_account"],
				"project_budget_dimension": dimensions_by_parent.get(budget_row["name"], []),
				"project_budget_amount": amounts_by_parent.get(budget_row["name"], []),
			}
		)
	return dict(by_project)


def merge_pl_budget_docs(
	aggregated: dict[str, dict[str, Any]],
	budget_docs: list[dict[str, Any]],
) -> None:
	for doc in budget_docs:
		account_name = doc.get("pb_account")
		if account_name not in aggregated:
			continue

		dimensions = doc.get("project_budget_dimension") or []
		bucket = _find_dimension_bucket(aggregated[account_name]["dimension_data"], dimensions)
		if bucket is None:
			bucket = {"dimensions": list(dimensions)}
			aggregated[account_name]["dimension_data"].append(bucket)

		for amount_row in doc.get("project_budget_amount") or []:
			year = int(amount_row.get("pba_year") or 0)
			month = int(amount_row.get("pba_month") or 0)
			if not year or not month:
				continue
			bucket[f"plan_{year}_{month}"] = flt(amount_row.get("pba_plan"))
			bucket[f"forecast_{year}_{month}"] = flt(amount_row.get("pba_expected"))


def load_pl_aggregated_tasks(project_name: str) -> dict[str, dict[str, Any]]:
	task_rows = frappe.get_all(
		"Task",
		filters={"project": project_name, "is_milestone": 0},
		fields=["name", "subject", "parent_task"],
		limit=0,
	)
	if not task_rows:
		return {}

	children_by_parent: dict[str | None, list[dict[str, Any]]] = defaultdict(list)
	for row in task_rows:
		# Mirror client isChildOf: empty parent_task is a root task, same as NULL.
		parent = row.get("parent_task") or None
		children_by_parent[parent].append(row)

	def walk(parent_task: str | None, indent: int) -> dict[str, dict[str, Any]]:
		out: dict[str, dict[str, Any]] = {}
		for row in children_by_parent.get(parent_task, []):
			parent = row.get("parent_task") or None
			task_entry = {
				"value": row["name"],
				"subject": row.get("subject") or row["name"],
				"parent_task": parent,
				"indent": indent,
			}
			out[row["name"]] = task_entry
			out.update(walk(row["name"], indent + 1))
		return out

	return walk(None, 0)


def apply_pl_task_dimensions(
	aggregated: dict[str, dict[str, Any]],
	tasks: dict[str, dict[str, Any]],
) -> None:
	budgets_with_tasks: dict[str, dict[str, Any]] = {}

	for budget in aggregated.values():
		base_budget_copy = dict(budget)
		allowed = budget.get("allowed_dimensions") or []
		allows_task = any(item.get("document_type") == "Task" for item in allowed)

		dimension_data = budget.get("dimension_data") or []
		sig_to_buckets: dict[str, list[dict[str, Any]]] = {}
		non_task_buckets: list[dict[str, Any]] = []

		for bucket in dimension_data:
			dims = bucket.get("dimensions") or []
			if not dims:
				non_task_buckets.append(bucket)
				continue
			if not any(dim.get("doc") == "Task" for dim in dims):
				non_task_buckets.append(bucket)
				continue
			sig = pl_dim_signature(dims)
			sig_to_buckets.setdefault(sig, []).append(bucket)

		if not allows_task:
			merged_buckets = [{**bucket, "dimensions": list(bucket.get("dimensions") or [])} for bucket in non_task_buckets]
			merged_by_sig = {pl_dim_signature(bucket.get("dimensions") or []): bucket for bucket in merged_buckets}

			for buckets in sig_to_buckets.values():
				for bucket in buckets:
					dims_without_task = [
						dim for dim in (bucket.get("dimensions") or []) if dim.get("doc") != "Task"
					]
					target_sig = pl_dim_signature(dims_without_task)
					target_bucket = merged_by_sig.get(target_sig)
					if target_bucket is None:
						target_bucket = {"dimensions": dims_without_task}
						merged_by_sig[target_sig] = target_bucket
						merged_buckets.append(target_bucket)
					_merge_period_bucket_values(target_bucket, bucket)

			base_budget_copy["dimension_data"] = merged_buckets
			budgets_with_tasks[str(budget["value"])] = base_budget_copy
			continue

		base_budget_copy["dimension_data"] = non_task_buckets
		budgets_with_tasks[str(budget["value"])] = base_budget_copy

		for task in tasks.values():
			task_budget = dict(base_budget_copy)
			task_budget["account"] = task.get("subject")
			task_budget["indent"] = (base_budget_copy.get("indent") or 0) + (task.get("indent") or 0) + 1
			task_budget["task"] = task

			buckets_for_task = []
			for buckets in sig_to_buckets.values():
				for bucket in buckets:
					dims = bucket.get("dimensions") or []
					if any(dim.get("doc") == "Task" and dim.get("docname") == task["value"] for dim in dims):
						buckets_for_task.append(bucket)

			task_budget["dimension_data"] = buckets_for_task or [{"dimensions": [{"doc": "Task", "docname": task["value"]}]}]
			budgets_with_tasks[f"{budget['value']}{task['value']}"] = task_budget

	aggregated.clear()
	aggregated.update(budgets_with_tasks)


def apply_pl_risk_dimension_rows(aggregated: dict[str, dict[str, Any]]) -> None:
	to_add: list[tuple[str, dict[str, Any]]] = []
	for parent_key, row in list(aggregated.items()):
		if PL_RISK_KEY_SEP in parent_key:
			continue
		dimension_data = row.get("dimension_data") or []
		for bucket in list(dimension_data):
			dims = bucket.get("dimensions") or []
			risk_docname = next(
				(dim.get("docname") for dim in dims if dim.get("doc") == "Project Risk"),
				None,
			)
			if not risk_docname:
				continue

			risk_row_key = f"{parent_key}{PL_RISK_KEY_SEP}{risk_docname}"
			if risk_row_key in aggregated:
				continue

			risk_row = dict(row)
			risk_row.update(
				{
					"indent": (row.get("indent") or 0) + 1,
					"_parentKey": parent_key,
					"risk": {"value": risk_docname},
					"dimension_data": [bucket],
				}
			)
			risk_row.pop("account", None)
			to_add.append((risk_row_key, risk_row))
			row["dimension_data"] = [
				item
				for item in dimension_data
				if not any(
					dim.get("doc") == "Project Risk" and dim.get("docname") == risk_docname
					for dim in (item.get("dimensions") or [])
				)
			]

	for key, row in to_add:
		aggregated[key] = row


def build_pl_budget_index(aggregated: dict[str, dict[str, Any]]) -> PlBudgetIndex:
	index = PlBudgetIndex()
	for child in aggregated.values():
		account_name = child.get("value") or ""
		parent_account = child.get("parent_account") or ""
		index.by_value_map.setdefault(account_name, []).append(child)
		if parent_account:
			index.by_parent_account_map.setdefault(parent_account, []).append(child)

		child["_dimMap"] = {}
		for entry in child.get("dimension_data") or []:
			child["_dimMap"][pl_dim_signature(entry.get("dimensions") or [])] = entry
	return index


def get_financial_root_rows(aggregated: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
	return [
		row
		for row in aggregated.values()
		if not row.get("parent_account") and not row.get("task") and not row.get("_parentKey") and not row.get("risk")
	]


def calc_pl_column_total(
	aggregated: dict[str, dict[str, Any]],
	roots: list[dict[str, Any]],
	year: int,
	month: int,
	value_key: str,
	budget_index: PlBudgetIndex,
	sum_cache: dict[str, float],
) -> PlRollupTotals:
	totals = PlRollupTotals()
	for row in roots:
		amount = get_row_period_total(
			aggregated,
			row,
			year,
			month,
			value_key,
			budget_index,
			sum_cache,
		)
		if row.get("type") == "Expense":
			if value_key == "plan":
				totals.plan_expenses += amount
			else:
				totals.forecast_expenses += amount
		elif row.get("type") == "Income":
			if value_key == "plan":
				totals.plan_income += amount
			else:
				totals.forecast_income += amount
	return totals


def get_row_period_total(
	aggregated: dict[str, dict[str, Any]],
	row: dict[str, Any],
	year: int,
	month: int,
	value_key: str,
	budget_index: PlBudgetIndex,
	sum_cache: dict[str, float],
) -> float:
	direct_value = get_direct_budget_value(row, year, month, value_key)
	if direct_value:
		return direct_value
	return get_child_budget_sum(
		row.get("value") or "",
		(row.get("task") or {}).get("value"),
		[],
		year,
		month,
		aggregated,
		value_key,
		budget_index,
		sum_cache,
	)


def get_direct_budget_value(row: dict[str, Any], year: int, month: int, value_key: str) -> float:
	if not row or not row.get("dimension_data"):
		return 0.0
	fieldname = f"{value_key}_{year}_{month}"
	return sum(flt(bucket.get(fieldname)) for bucket in row.get("dimension_data") or [])


def get_child_budget_sum(
	account: str,
	task: str | None,
	dimension: list[dict[str, str]],
	year: int,
	month: int,
	aggregated: dict[str, dict[str, Any]],
	value_key: str,
	budget_index: PlBudgetIndex,
	sum_cache: dict[str, float],
) -> float:
	field_key = f"{value_key}_{year}_{month}"
	dim_sig_base = pl_dim_signature(dimension)
	cache_key = f"{account}::{task or ''}::{dim_sig_base}::{field_key}"
	if cache_key in sum_cache:
		return sum_cache[cache_key]

	total = 0.0
	processed: set[int] = set()
	stack: list[tuple[str, str | None, list[dict[str, str]]]] = [(account, task, list(dimension))]

	while stack:
		cur_account, cur_task, dim_arr = stack.pop()
		candidates = list(budget_index.by_value_map.get(cur_account, []))
		candidates.extend(budget_index.by_parent_account_map.get(cur_account, []))

		for child in candidates:
			child_id = id(child)
			if child_id in processed:
				continue
			if not is_child_of(child, cur_account, cur_task):
				continue
			processed.add(child_id)

			dim_for_child = list(dim_arr)
			if cur_task:
				dim_for_child = [
					item for item in dim_for_child if not (item.get("doc") == "Task" and item.get("docname") == cur_task)
				]
			if child.get("task"):
				dim_for_child = [*dim_for_child, {"doc": "Task", "docname": child["task"]["value"]}]
			if child.get("risk"):
				dim_for_child = [*dim_for_child, {"doc": "Project Risk", "docname": child["risk"]["value"]}]

			sig = pl_dim_signature(dim_for_child)
			entry = (child.get("_dimMap") or {}).get(sig)
			if entry is None:
				for candidate in child.get("dimension_data") or []:
					if pl_dim_signature(candidate.get("dimensions") or []) == sig:
						entry = candidate
						break

			if bucket_has_period_value(entry, field_key):
				total += flt(entry.get(field_key))
			else:
				stack.append(
					(
						child.get("value") or "",
						(child.get("task") or {}).get("value"),
						dim_for_child,
					)
				)

	sum_cache[cache_key] = total
	return total


def pl_dim_signature(dimensions: list[dict[str, Any]] | None) -> str:
	if not dimensions:
		return "__EMPTY__"
	normalized = sorted(
		(f"{dim.get('doc')}:{dim.get('docname')}" for dim in dimensions if dim.get("doc")),
	)
	return "|".join(normalized) if normalized else "__EMPTY__"


def is_child_of(child: dict[str, Any], account: str, task: str | None, risk: str | None = None) -> bool:
	matches_nested_task = child.get("value") == account and task and (child.get("task") or {}).get("parent_task") == task
	matches_root_task = (
		child.get("value") == account
		and not task
		and child.get("task")
		and not (child.get("task") or {}).get("parent_task")
	)
	matches_child_account = (
		child.get("parent_account") == account and not task and not child.get("task") and not child.get("risk")
	)
	matches_risk_row = child.get("_parentKey") == f"{account}{task or ''}" and not risk
	return matches_nested_task or matches_root_task or matches_child_account or matches_risk_row


def bucket_has_period_value(entry: dict[str, Any] | None, field_key: str) -> bool:
	return bool(entry) and field_key in entry


def _find_dimension_bucket(
	dimension_data: list[dict[str, Any]],
	dimensions: list[dict[str, str]],
) -> dict[str, Any] | None:
	for bucket in dimension_data:
		if dimensions_equal(bucket.get("dimensions") or [], dimensions):
			return bucket
	return None


def dimensions_equal(dim1: list[dict[str, Any]], dim2: list[dict[str, Any]]) -> bool:
	if len(dim1) != len(dim2):
		return False
	for left, right in zip(dim1, dim2):
		if left.get("doc") != right.get("doc") or left.get("docname") != right.get("docname"):
			return False
	return True


def _merge_period_bucket_values(target_bucket: dict[str, Any], source_bucket: dict[str, Any]) -> None:
	for key, value in source_bucket.items():
		if key == "dimensions":
			continue
		if not (key.startswith("plan_") or key.startswith("forecast_") or key.startswith("fact_")):
			continue
		target_bucket[key] = flt(target_bucket.get(key)) + flt(value)


def _month_progress_ratio(target_year: int, target_month: int, current_day: date) -> float:
	if target_year < current_day.year or (
		target_year == current_day.year and target_month < current_day.month
	):
		return 1.0
	if target_year > current_day.year or (
		target_year == current_day.year and target_month > current_day.month
	):
		return 0.0
	month_start = current_day.replace(day=1)
	month_end = getdate(get_last_day(current_day))
	total_days = max((month_end - month_start).days + 1, 1)
	completed_days = min(max(current_day.day, 0), total_days)
	return completed_days / total_days
