from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from importlib import import_module
from typing import Any

import frappe
from frappe.query_builder import DocType
from frappe.query_builder.functions import IfNull, Sum
from frappe.utils import add_months, flt, get_last_day, getdate, today

from dinext_project_stage_gate.stage_gate import query

DINEXT_UTP_STATUS_CONTEXT = "Dinext.UserTimesheetStatus"
CANONICAL_UTP_APPROVED_STATUS = "Approved"
_FALLBACK_UTP_APPROVED_STATUSES = frozenset({"Approved", "Согласовано"})
_MILESTONE_CLOSED_STATUSES = frozenset({"Completed", "Cancelled"})

PROJECT_FIELDS = [
	"name",
	"project_name",
	"project_type",
	"priority",
	"status",
	"company",
	"customer",
	"department",
	"expected_start_date",
	"expected_end_date",
	"percent_complete",
	"custom_project_portfolio",
	"current_stage",
	"stage_gate_status",
	"custom_сроки_проекта",
	"custom_бюджет_проекта",
	"custom_ресурсы",
	"custom_статус_по_рискам",
	"gross_margin",
]


@dataclass
class ProjectLaborSummary:
	plan_total: float = 0.0
	actual_total: float = 0.0
	forecast_total: float = 0.0
	plan_today: float = 0.0


@dataclass
class ProjectPlSummary:
	plan_total: float = 0.0
	actual_total: float = 0.0
	forecast_total: float = 0.0
	plan_today: float = 0.0
	has_data: bool = False


def get_portfolio_project_rows(portfolio: str | Any) -> list[dict[str, Any]]:
	portfolio_doc = _get_portfolio_doc(portfolio)
	_ensure_portfolio_permission(portfolio_doc, "read")

	project_rows = query._get_permission_aware_list(  # noqa: SLF001
		"Project",
		filters={"custom_project_portfolio": portfolio_doc.name},
		fields=PROJECT_FIELDS,
		order_by="project_name asc, name asc",
	)
	if not project_rows:
		return []

	project_names = [row["name"] for row in project_rows if row.get("name")]
	project_rows_by_name = {row["name"]: row for row in project_rows if row.get("name")}

	_attach_project_managers(project_rows)
	milestones_by_project = _get_nearest_milestones(project_names)
	labor_by_project = _get_labor_summaries(project_rows)
	pl_by_project = _get_pl_summaries(project_rows)

	out = []
	for project_row in project_rows:
		project_name = project_row["name"]
		labor = labor_by_project.get(project_name, ProjectLaborSummary())
		pl_summary = pl_by_project.get(project_name, ProjectPlSummary())
		milestone = milestones_by_project.get(project_name)
		progress_actual = flt(project_row.get("percent_complete"))
		progress_planned = _planned_progress_percent(
			project_row.get("expected_start_date"),
			project_row.get("expected_end_date"),
		)
		out.append(
			{
				"project": project_name,
				"project_name": project_row.get("project_name") or project_name,
				"project_type": project_row.get("project_type"),
				"priority": project_row.get("priority"),
				"status_overall": project_row.get("status"),
				"status_schedule": project_row.get("custom_сроки_проекта"),
				"status_budget": project_row.get("custom_бюджет_проекта"),
				"status_resources": project_row.get("custom_ресурсы"),
				"status_risks": project_row.get("custom_статус_по_рискам"),
				"active_stage": project_row.get("current_stage"),
				"stage_gate_status": project_row.get("stage_gate_status"),
				"customer": project_row.get("customer"),
				"department": project_row.get("department"),
				"project_manager": project_row.get("project_manager"),
				"expected_start_date": project_row.get("expected_start_date"),
				"expected_end_date": project_row.get("expected_end_date"),
				"progress_current_percent": progress_actual,
				"work_plan_percent": progress_planned,
				"work_actual_percent": progress_actual,
				"labor_plan_total": labor.plan_total,
				"labor_actual_total": labor.actual_total,
				"labor_forecast_total": labor.forecast_total,
				"labor_plan_today": labor.plan_today,
				"pl_plan_total": pl_summary.plan_total,
				"pl_actual_total": pl_summary.actual_total,
				"pl_forecast_total": pl_summary.forecast_total,
				"pl_plan_today": pl_summary.plan_today,
				"pl_has_data": pl_summary.has_data,
				"nearest_milestone_name": milestone.get("name") if milestone else None,
				"nearest_milestone_subject": milestone.get("subject") if milestone else None,
				"nearest_milestone_date": milestone.get("milestone_date") if milestone else None,
				"can_write": _has_project_write_permission(project_name),
				"portfolio": project_rows_by_name[project_name].get("custom_project_portfolio"),
			}
		)
	return out


def get_unassigned_projects() -> list[dict[str, Any]]:
	project_rows = query._get_permission_aware_list(  # noqa: SLF001
		"Project",
		filters={"custom_project_portfolio": ["is", "not set"]},
		fields=["name", "project_name", "project_type", "customer", "priority"],
		order_by="project_name asc, name asc",
		limit_page_length=500,
	)
	return [
		{
			"name": row["name"],
			"project_name": row.get("project_name") or row["name"],
			"project_type": row.get("project_type"),
			"customer": row.get("customer"),
			"priority": row.get("priority"),
		}
		for row in project_rows
	]


def add_projects_to_portfolio(portfolio: str, projects: list[str]) -> dict[str, Any]:
	portfolio_doc = _get_portfolio_doc(portfolio)
	_ensure_portfolio_permission(portfolio_doc, "write")
	return _update_projects_portfolio_link(portfolio_doc.name, projects, mode="add")


def remove_projects_from_portfolio(portfolio: str, projects: list[str]) -> dict[str, Any]:
	portfolio_doc = _get_portfolio_doc(portfolio)
	_ensure_portfolio_permission(portfolio_doc, "write")
	return _update_projects_portfolio_link(portfolio_doc.name, projects, mode="remove")


def _update_projects_portfolio_link(
	portfolio_name: str, projects: list[str], mode: str
) -> dict[str, list[dict[str, str]] | list[str]]:
	updated: list[str] = []
	skipped: list[dict[str, str]] = []
	for project_name in _normalize_project_names(projects):
		if not _has_project_write_permission(project_name):
			skipped.append({"project": project_name, "reason": "no_project_write_permission"})
			continue

		project_doc = frappe.get_doc("Project", project_name)
		current_portfolio = project_doc.get("custom_project_portfolio")
		if mode == "add":
			if current_portfolio and current_portfolio != portfolio_name:
				skipped.append({"project": project_name, "reason": "already_assigned"})
				continue
			if current_portfolio == portfolio_name:
				skipped.append({"project": project_name, "reason": "already_in_portfolio"})
				continue
			project_doc.custom_project_portfolio = portfolio_name
		else:
			if current_portfolio != portfolio_name:
				skipped.append({"project": project_name, "reason": "not_in_portfolio"})
				continue
			project_doc.custom_project_portfolio = None

		project_doc.save()
		updated.append(project_name)

	return {"updated": updated, "skipped": skipped}


def _get_portfolio_doc(portfolio: str | Any):
	if hasattr(portfolio, "doctype") and getattr(portfolio, "doctype", None) == "Project Portfolio":
		return portfolio
	return frappe.get_doc("Project Portfolio", portfolio)


def _ensure_portfolio_permission(portfolio_doc, ptype: str) -> None:
	if not portfolio_doc.has_permission(ptype):
		frappe.throw(
			frappe._("Not permitted to {0} {1}").format(ptype, portfolio_doc.doctype),
			frappe.PermissionError,
		)


def _normalize_project_names(projects: list[str] | str | None) -> list[str]:
	if not projects:
		return []
	if isinstance(projects, str):
		parsed = frappe.parse_json(projects)
		if isinstance(parsed, list):
			return [item for item in parsed if item]
		return [projects]
	return [item for item in projects if item]


def _has_project_write_permission(project_name: str) -> bool:
	return bool(frappe.has_permission("Project", "write", doc=project_name))


def _attach_project_managers(project_rows: list[dict[str, Any]]) -> None:
	project_names = [row["name"] for row in project_rows if row.get("name")]
	if not project_names:
		return
	current_day = getdate(today())
	project_managers, _project_manager_users = query._resolve_project_managers(  # noqa: SLF001
		project_names,
		current_day,
		current_day,
	)
	for row in project_rows:
		labels = project_managers.get(row.get("name"), [])
		row["project_manager"] = ", ".join(labels) if labels else None


def _get_nearest_milestones(project_names: list[str]) -> dict[str, dict[str, Any]]:
	if not project_names:
		return {}

	task_rows = query._get_permission_aware_list(  # noqa: SLF001
		"Task",
		filters={
			"project": ["in", project_names],
			"is_milestone": 1,
			"status": ["not in", list(_MILESTONE_CLOSED_STATUSES)],
		},
		fields=["name", "project", "subject", "exp_start_date", "exp_end_date"],
		order_by="project asc, exp_end_date asc, exp_start_date asc, modified asc",
		limit_page_length=0,
	)
	result: dict[str, dict[str, Any]] = {}
	current_day = getdate(today())
	for row in task_rows:
		project_name = row.get("project")
		if not project_name or project_name in result:
			continue
		milestone_date = row.get("exp_end_date") or row.get("exp_start_date")
		if not milestone_date or getdate(milestone_date) < current_day:
			continue
		enriched = dict(row)
		enriched["milestone_date"] = milestone_date
		result[project_name] = enriched
	return result


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


def _planned_progress_percent(start_value: Any, end_value: Any) -> float:
	if not start_value or not end_value:
		return 0.0
	start_date = getdate(start_value)
	end_date = getdate(end_value)
	if end_date < start_date:
		start_date, end_date = end_date, start_date
	current_day = getdate(today())
	if current_day <= start_date:
		return 0.0
	if current_day >= end_date:
		return 100.0
	total_days = max((end_date - start_date).days, 1)
	completed_days = max((current_day - start_date).days, 0)
	return round(min(completed_days / total_days * 100.0, 100.0), 1)


def _load_project_task_rows(project_names: list[str]) -> list[dict[str, Any]]:
	if not project_names:
		return []
	return query._get_permission_aware_list(  # noqa: SLF001
		"Task",
		filters={"project": ["in", project_names]},
		fields=["name", "project", "parent_task", "is_milestone"],
		order_by="project asc, lft asc, creation asc, name asc",
		limit_page_length=0,
	)


def _load_labor_plan_rows(project_names: list[str]) -> list[dict[str, Any]]:
	if not project_names:
		return []

	pwe = DocType("Project Work Efforts")
	amount = DocType("Project Work Efforts Amount")
	return (
		frappe.qb.from_(pwe)
		.inner_join(amount)
		.on(amount.parent == pwe.name)
		.select(
			pwe.pwe_project.as_("project"),
			pwe.pwe_task.as_("task"),
			pwe.pwe_project_role.as_("project_role"),
			amount.pwea_year.as_("year"),
			amount.pwea_month.as_("month"),
			Sum(IfNull(amount.pwea_plan, 0)).as_("plan_hours"),
			Sum(IfNull(amount.pwea_expected, 0)).as_("forecast_hours"),
		)
		.where(pwe.pwe_project.isin(project_names))
		.groupby(pwe.pwe_project)
		.groupby(pwe.pwe_task)
		.groupby(pwe.pwe_project_role)
		.groupby(amount.pwea_year)
		.groupby(amount.pwea_month)
		.run(as_dict=True)
	)


def _approved_utp_status_values() -> list[str]:
	values = set(_FALLBACK_UTP_APPROVED_STATUSES)
	translated = frappe._(CANONICAL_UTP_APPROVED_STATUS, context=DINEXT_UTP_STATUS_CONTEXT)
	if translated:
		values.add(translated)

	approved_markers = {value.casefold() for value in values}
	meta = frappe.get_meta("User Timesheet Position")
	status_field = meta.get_field("status")
	if status_field and status_field.options:
		for option in status_field.options.split("\n"):
			option = option.strip()
			if option and option.casefold() in approved_markers:
				values.add(option)

	return sorted(values)


def _load_labor_actual_rows(project_names: list[str], current_day: date) -> list[dict[str, Any]]:
	if not project_names:
		return []

	actual_doc = DocType("User Timesheet Position")
	actual_detail = DocType("User Timesheet Position Details")
	return (
		frappe.qb.from_(actual_doc)
		.inner_join(actual_detail)
		.on(actual_detail.parent == actual_doc.name)
		.select(
			actual_doc.project.as_("project"),
			Sum(IfNull(actual_detail.hours, 0)).as_("actual_hours"),
		)
		.where(actual_doc.project.isin(project_names))
		.where(actual_doc.status.isin(_approved_utp_status_values()))
		.where(IfNull(actual_doc.document_type, "") == "Task")
		.where(actual_detail.date <= current_day)
		.groupby(actual_doc.project)
		.run(as_dict=True)
	)


def _labor_role_key(row: dict[str, Any]) -> str:
	return str(row.get("project_role") or "").strip()


def _get_labor_display_periods(project_row: dict[str, Any], current_day: date) -> list[tuple[int, int]]:
	month_start = current_day.replace(day=1)
	start_date = (
		getdate(project_row.get("expected_start_date"))
		if project_row.get("expected_start_date")
		else month_start
	)
	end_date = (
		getdate(project_row.get("expected_end_date"))
		if project_row.get("expected_end_date")
		else add_months(start_date, 12)
	)
	if end_date < start_date:
		start_date, end_date = end_date, start_date

	periods: list[tuple[int, int]] = []
	current = getdate(start_date)
	end = getdate(end_date)
	while current <= end:
		periods.append((current.year, current.month))
		current = add_months(current, 1)
	return periods


def _is_task_milestone(row: dict[str, Any]) -> bool:
	return bool(int(row.get("is_milestone") or 0))


def _build_task_children_map(
	task_rows: list[dict[str, Any]], project_name: str
) -> tuple[set[str], dict[str, list[str]], list[str]]:
	"""Mirror Project card v5 work-efforts tree: non-milestone tasks only, no orphan promotion."""
	project_tasks = [
		row
		for row in task_rows
		if row.get("project") == project_name and row.get("name") and not _is_task_milestone(row)
	]
	task_by_name = {row["name"]: row for row in project_tasks}

	eligible_tasks: set[str] = set()
	children_by_task: dict[str, list[str]] = {}
	queue: list[str] = []

	for row in project_tasks:
		if not row.get("parent_task"):
			queue.append(row["name"])
			eligible_tasks.add(row["name"])

	while queue:
		parent_name = queue.pop(0)
		for task_name, row in task_by_name.items():
			if task_name in eligible_tasks or row.get("parent_task") != parent_name:
				continue
			eligible_tasks.add(task_name)
			children_by_task.setdefault(parent_name, []).append(task_name)
			queue.append(task_name)

	root_tasks = [task_name for task_name in eligible_tasks if not task_by_name[task_name].get("parent_task")]
	return eligible_tasks, children_by_task, root_tasks


def _build_labor_index(
	plan_rows: list[dict[str, Any]],
	project_name: str,
	periods: set[tuple[int, int]],
) -> dict[str, dict[str, dict[tuple[int, int], dict[str, float]]]]:
	index: dict[str, dict[str, dict[tuple[int, int], dict[str, float]]]] = {}
	for row in plan_rows:
		if row.get("project") != project_name:
			continue
		task_name = row.get("task")
		if not task_name:
			continue
		period_key = (int(row.get("year") or 0), int(row.get("month") or 0))
		if period_key not in periods:
			continue
		role_key = _labor_role_key(row)
		cell = index.setdefault(task_name, {}).setdefault(role_key, {}).setdefault(
			period_key, {"plan": 0.0, "forecast": 0.0}
		)
		cell["plan"] += flt(row.get("plan_hours"))
		cell["forecast"] += flt(row.get("forecast_hours"))
	return index


def _collect_labor_roles(labor_index: dict[str, dict[str, dict[tuple[int, int], dict[str, float]]]]) -> set[str]:
	roles: set[str] = set()
	for task_roles in labor_index.values():
		roles.update(task_roles.keys())
	return roles


def _load_project_labor_roles(
	project_name: str,
	labor_index: dict[str, dict[str, dict[tuple[int, int], dict[str, float]]]],
) -> list[str]:
	role_rows = frappe.get_all(
		"Project Team Details",
		filters={"parent": project_name},
		fields=["pt_role"],
		pluck="pt_role",
	)
	roles: list[str] = []
	seen: set[str] = set()
	for role in role_rows or []:
		role_key = str(role or "").strip()
		if role_key and role_key not in seen:
			roles.append(role_key)
			seen.add(role_key)
	if roles:
		return roles
	return sorted(_collect_labor_roles(labor_index))


def _monthly_labor_value(
	role: str,
	task_name: str,
	children_by_task: dict[str, list[str]],
	labor_index: dict[str, dict[str, dict[tuple[int, int], dict[str, float]]]],
	year: int,
	month: int,
	value_key: str,
	visited: set[str] | None = None,
) -> float:
	visited = visited or set()
	if task_name in visited:
		return 0.0
	visited.add(task_name)

	cell = labor_index.get(task_name, {}).get(role, {}).get((year, month), {})
	value = flt(cell.get(value_key, 0))
	if value > 0:
		return value

	child_total = 0.0
	for child_name in children_by_task.get(task_name, []):
		child_total += _monthly_labor_value(
			role,
			child_name,
			children_by_task,
			labor_index,
			year,
			month,
			value_key,
			visited,
		)
	return child_total


def _calc_we_column_total_month(
	roles: list[str],
	root_tasks: list[str],
	children_by_task: dict[str, list[str]],
	labor_index: dict[str, dict[str, dict[tuple[int, int], dict[str, float]]]],
	year: int,
	month: int,
) -> tuple[float, float]:
	plan_total = 0.0
	forecast_total = 0.0
	for role in roles:
		if not role.strip():
			continue
		for root_task in root_tasks:
			plan_total += _monthly_labor_value(
				role, root_task, children_by_task, labor_index, year, month, "plan"
			)
			forecast_total += _monthly_labor_value(
				role, root_task, children_by_task, labor_index, year, month, "forecast"
			)
	return plan_total, forecast_total


def _summarize_project_labor(
	project_row: dict[str, Any],
	task_rows: list[dict[str, Any]],
	plan_rows: list[dict[str, Any]],
	current_day: date,
) -> ProjectLaborSummary:
	project_name = project_row.get("name")
	if not project_name:
		return ProjectLaborSummary()

	periods = _get_labor_display_periods(project_row, current_day)
	period_set = set(periods)
	eligible_tasks, children_by_task, root_tasks = _build_task_children_map(task_rows, project_name)
	labor_index = _build_labor_index(plan_rows, project_name, period_set)
	labor_index = {
		task_name: role_data
		for task_name, role_data in labor_index.items()
		if task_name in eligible_tasks
	}
	roles = _load_project_labor_roles(project_name, labor_index)

	summary = ProjectLaborSummary()
	for year, month in periods:
		month_plan, month_forecast = _calc_we_column_total_month(
			roles,
			root_tasks,
			children_by_task,
			labor_index,
			year,
			month,
		)
		summary.plan_total += month_plan
		summary.forecast_total += month_forecast
		summary.plan_today += month_plan * _month_progress_ratio(year, month, current_day)

	return summary


def _get_labor_summaries(project_rows: list[dict[str, Any]]) -> dict[str, ProjectLaborSummary]:
	if not project_rows:
		return {}

	current_day = getdate(today())
	project_names = [row["name"] for row in project_rows if row.get("name")]
	task_rows = _load_project_task_rows(project_names)
	plan_rows = _load_labor_plan_rows(project_names)
	actual_rows = _load_labor_actual_rows(project_names, current_day)

	out = {
		project_row["name"]: _summarize_project_labor(project_row, task_rows, plan_rows, current_day)
		for project_row in project_rows
		if project_row.get("name")
	}
	for row in actual_rows:
		project_name = row.get("project")
		if not project_name:
			continue
		summary = out.setdefault(project_name, ProjectLaborSummary())
		summary.actual_total = flt(row.get("actual_hours"))

	for summary in out.values():
		summary.plan_total = round(summary.plan_total, 1)
		summary.actual_total = round(summary.actual_total, 1)
		summary.forecast_total = round(summary.forecast_total, 1)
		summary.plan_today = round(summary.plan_today, 1)
	return out


def _get_pl_summaries(project_rows: list[dict[str, Any]]) -> dict[str, ProjectPlSummary]:
	project_names = [row["name"] for row in project_rows if row.get("name")]
	out = {project_name: ProjectPlSummary() for project_name in project_names}
	if not project_names:
		return out

	if not _is_app_installed("dinext_projects_pl"):
		for row in project_rows:
			project_name = row["name"]
			out[project_name] = ProjectPlSummary(
				actual_total=flt(row.get("gross_margin")),
				has_data=bool(row.get("gross_margin")),
			)
		return out

	budget = DocType("Project Budget")
	budget_amount = DocType("Project Budget Amount")
	account = DocType("Account")
	current_day = getdate(today())

	budget_rows = (
		frappe.qb.from_(budget)
		.inner_join(budget_amount)
		.on(budget_amount.parent == budget.name)
		.inner_join(account)
		.on(account.name == budget.pb_account)
		.select(
			budget.pb_project.as_("project"),
			account.root_type.as_("root_type"),
			budget_amount.pba_year.as_("year"),
			budget_amount.pba_month.as_("month"),
			Sum(IfNull(budget_amount.pba_plan, 0)).as_("plan_amount"),
			Sum(IfNull(budget_amount.pba_expected, 0)).as_("forecast_amount"),
		)
		.where(budget.pb_project.isin(project_names))
		.groupby(budget.pb_project)
		.groupby(account.root_type)
		.groupby(budget_amount.pba_year)
		.groupby(budget_amount.pba_month)
		.run(as_dict=True)
	)
	actual_rows = _load_pl_actual_rows(project_names)

	for row in budget_rows:
		project_name = row.get("project")
		if not project_name:
			continue
		sign = _root_type_sign(row.get("root_type"))
		summary = out.setdefault(project_name, ProjectPlSummary())
		plan_amount = sign * flt(row.get("plan_amount"))
		forecast_amount = sign * flt(row.get("forecast_amount"))
		summary.plan_total += plan_amount
		summary.forecast_total += forecast_amount
		summary.plan_today += plan_amount * _month_progress_ratio(
			int(row.get("year") or 0), int(row.get("month") or 0), current_day
		)
		summary.has_data = True

	for row in actual_rows:
		project_name = row.get("project")
		if not project_name:
			continue
		summary = out.setdefault(project_name, ProjectPlSummary())
		summary.actual_total = flt(row.get("actual_net"))
		summary.has_data = True

	for row in project_rows:
		project_name = row["name"]
		summary = out.setdefault(project_name, ProjectPlSummary())
		if not summary.has_data and row.get("gross_margin") is not None:
			summary.actual_total = flt(row.get("gross_margin"))
			summary.has_data = bool(summary.actual_total)
		summary.plan_total = round(summary.plan_total, 2)
		summary.actual_total = round(summary.actual_total, 2)
		summary.forecast_total = round(summary.forecast_total, 2)
		summary.plan_today = round(summary.plan_today, 2)
	return out


def _load_pl_actual_rows(project_names: list[str]) -> list[dict[str, Any]]:
	if not project_names:
		return []

	return frappe.db.sql(
		"""
		SELECT
			gle.project AS project,
			SUM(
				CASE
					WHEN a.root_type = 'Income' THEN IFNULL(gle.credit, 0) - IFNULL(gle.debit, 0)
					WHEN a.root_type = 'Expense' THEN - (IFNULL(gle.debit, 0) - IFNULL(gle.credit, 0))
					ELSE 0
				END
			) AS actual_net
		FROM `tabGL Entry` gle
		INNER JOIN `tabAccount` a ON a.name = gle.account
		WHERE gle.project IN %(projects)s
			AND gle.is_cancelled = 0
		GROUP BY gle.project
		""",
		{"projects": project_names},
		as_dict=True,
	)


def _signed_gl_pl_line_amount(root_type: str | None, debit: Any, credit: Any) -> float:
	sign = _root_type_sign(root_type)
	if sign == 0:
		return 0.0
	debit_amount = flt(debit)
	credit_amount = flt(credit)
	if root_type == "Income":
		return sign * (credit_amount - debit_amount)
	return sign * (debit_amount - credit_amount)


def _root_type_sign(root_type: str | None) -> int:
	if root_type == "Income":
		return 1
	if root_type == "Expense":
		return -1
	return 0


def _is_app_installed(app_name: str) -> bool:
	get_installed_apps = getattr(frappe, "get_installed_apps", None)
	if not callable(get_installed_apps):
		return False
	try:
		return app_name in get_installed_apps()
	except Exception:
		return False


def load_optional_module(module_path: str):
	try:
		return import_module(module_path)
	except Exception:
		return None
