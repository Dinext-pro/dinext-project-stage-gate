import unittest
from unittest.mock import patch

from dinext_project_stage_gate.stage_gate import portfolio_pl_rollup


def make_root_row(value, root_type, dimension_data):
	return {
		"value": value,
		"type": root_type,
		"parent_account": None,
		"dimension_data": dimension_data,
	}


class TestPortfolioPlRollup(unittest.TestCase):
	def test_calc_column_total_sums_all_top_level_roots(self):
		period = (2026, 1)
		roots = [
			make_root_row("Income A", "Income", [{"plan_2026_1": 30, "forecast_2026_1": 25}]),
			make_root_row("Income B", "Income", [{"plan_2026_1": 40, "forecast_2026_1": 35}]),
			make_root_row("Expense A", "Expense", [{"plan_2026_1": 10, "forecast_2026_1": 8}]),
			make_root_row("Expense B", "Expense", [{"plan_2026_1": 20, "forecast_2026_1": 16}]),
		]
		aggregated = {f"root-{index}": row for index, row in enumerate(roots)}
		budget_index = portfolio_pl_rollup.build_pl_budget_index(aggregated)
		sum_cache = {}

		plan_col = portfolio_pl_rollup.calc_pl_column_total(
			aggregated,
			roots,
			period[0],
			period[1],
			"plan",
			budget_index,
			sum_cache,
		)
		forecast_col = portfolio_pl_rollup.calc_pl_column_total(
			aggregated,
			roots,
			period[0],
			period[1],
			"forecast",
			budget_index,
			sum_cache,
		)

		self.assertEqual(plan_col.plan_income, 70)
		self.assertEqual(plan_col.plan_expenses, 30)
		self.assertEqual(plan_col.plan_net, 40)
		self.assertEqual(forecast_col.forecast_income, 60)
		self.assertEqual(forecast_col.forecast_expenses, 24)
		self.assertEqual(forecast_col.forecast_net, 36)

	def test_get_row_period_total_falls_back_to_child_totals(self):
		root = make_root_row("Expense Root", "Expense", [{"plan_2026_1": 0, "forecast_2026_1": 0}])
		child = {
			"value": "Expense Child",
			"type": "Expense",
			"parent_account": "Expense Root",
			"dimension_data": [{"plan_2026_1": 12, "forecast_2026_1": 9}],
		}
		aggregated = {"root": root, "child": child}
		budget_index = portfolio_pl_rollup.build_pl_budget_index(aggregated)
		sum_cache = {}

		plan_total = portfolio_pl_rollup.get_row_period_total(
			aggregated,
			root,
			2026,
			1,
			"plan",
			budget_index,
			sum_cache,
		)
		forecast_total = portfolio_pl_rollup.get_row_period_total(
			aggregated,
			root,
			2026,
			1,
			"forecast",
			budget_index,
			sum_cache,
		)

		self.assertEqual(plan_total, 12)
		self.assertEqual(forecast_total, 9)

	def test_apply_pl_task_dimensions_merges_disallowed_task_buckets(self):
		account_row = {
			"value": "Подрядчики (МиП)",
			"type": "Expense",
			"parent_account": None,
			"indent": 0,
			"allowed_dimensions": [],
			"dimension_data": [
				{"dimensions": [{"doc": "Task", "docname": "TASK-001"}], "forecast_2026_4": 7000},
				{"dimensions": [{"doc": "Task", "docname": "TASK-002"}], "forecast_2026_5": 15000},
			],
		}
		aggregated = {"account": account_row}
		tasks = {
			"TASK-001": {"value": "TASK-001", "subject": "Task 1", "parent_task": None, "indent": 0},
			"TASK-002": {"value": "TASK-002", "subject": "Task 2", "parent_task": None, "indent": 0},
		}

		portfolio_pl_rollup.apply_pl_task_dimensions(aggregated, tasks)

		self.assertEqual(list(aggregated.keys()), ["Подрядчики (МиП)"])
		self.assertEqual(len(aggregated["Подрядчики (МиП)"]["dimension_data"]), 1)
		self.assertEqual(aggregated["Подрядчики (МиП)"]["dimension_data"][0].get("dimensions"), [])
		self.assertEqual(aggregated["Подрядчики (МиП)"]["dimension_data"][0]["forecast_2026_4"], 7000)
		self.assertEqual(aggregated["Подрядчики (МиП)"]["dimension_data"][0]["forecast_2026_5"], 15000)

	def test_pl_dim_signature_is_order_independent(self):
		dims_a = [{"doc": "Task", "docname": "TASK-001"}, {"doc": "Department", "docname": "DEP-001"}]
		dims_b = [{"doc": "Department", "docname": "DEP-001"}, {"doc": "Task", "docname": "TASK-001"}]

		self.assertEqual(
			portfolio_pl_rollup.pl_dim_signature(dims_a),
			portfolio_pl_rollup.pl_dim_signature(dims_b),
		)

	def test_get_financial_root_rows_excludes_risk_rows(self):
		aggregated = {
			"income": make_root_row("Income Root", "Income", [{"plan_2026_1": 10}]),
			"expense": make_root_row("Expense Root", "Expense", [{"plan_2026_1": 5}]),
			"Expense Root|risk|RISK-001": {
				"value": "Expense Root",
				"type": "Expense",
				"_parentKey": "Expense Root",
				"risk": {"value": "RISK-001"},
				"dimension_data": [{"dimensions": [{"doc": "Project Risk", "docname": "RISK-001"}], "forecast_2026_1": 200}],
			},
		}

		roots = portfolio_pl_rollup.get_financial_root_rows(aggregated)

		self.assertEqual(len(roots), 2)
		self.assertEqual({row["value"] for row in roots}, {"Income Root", "Expense Root"})

	@patch("dinext_project_stage_gate.stage_gate.portfolio_pl_rollup.frappe.get_all")
	def test_load_pl_aggregated_tasks_treats_empty_parent_as_root(self, mock_get_all):
		mock_get_all.return_value = [
			{"name": "TASK-ROOT", "subject": "Root Task", "parent_task": ""},
			{"name": "TASK-CHILD", "subject": "Child Task", "parent_task": "TASK-ROOT"},
		]

		tasks = portfolio_pl_rollup.load_pl_aggregated_tasks("PROJ-1")

		self.assertIn("TASK-ROOT", tasks)
		self.assertIn("TASK-CHILD", tasks)
		self.assertIsNone(tasks["TASK-ROOT"]["parent_task"])
		self.assertEqual(tasks["TASK-CHILD"]["parent_task"], "TASK-ROOT")

	def test_apply_pl_task_dimensions_creates_nested_task_rows_with_forecast(self):
		account_row = {
			"value": "Внутренняя команда",
			"type": "Expense",
			"parent_account": "Expense Root",
			"indent": 1,
			"allowed_dimensions": [{"document_type": "Task", "is_mandatory": False}],
			"dimension_data": [],
		}
		expense_root = make_root_row("Expense Root", "Expense", [])
		aggregated = {"Expense Root": expense_root, "Внутренняя команда": account_row}
		# Tasks as returned after normalizing parent_task='' to None in load_pl_aggregated_tasks.
		tasks = {
			"TASK-ROOT": {"value": "TASK-ROOT", "subject": "Root Task", "parent_task": None, "indent": 0},
			"TASK-CHILD-A": {
				"value": "TASK-CHILD-A",
				"subject": "Child A",
				"parent_task": "TASK-ROOT",
				"indent": 1,
			},
			"TASK-CHILD-B": {
				"value": "TASK-CHILD-B",
				"subject": "Child B",
				"parent_task": "TASK-ROOT",
				"indent": 1,
			},
		}
		budget_docs = [
			{
				"pb_account": "Внутренняя команда",
				"project_budget_dimension": [{"doc": "Task", "docname": "TASK-CHILD-A"}],
				"project_budget_amount": [
					{"pba_year": 2026, "pba_month": 7, "pba_plan": 0, "pba_expected": 30000}
				],
			},
			{
				"pb_account": "Внутренняя команда",
				"project_budget_dimension": [{"doc": "Task", "docname": "TASK-CHILD-B"}],
				"project_budget_amount": [
					{"pba_year": 2026, "pba_month": 7, "pba_plan": 0, "pba_expected": 40000}
				],
			},
		]

		portfolio_pl_rollup.merge_pl_budget_docs(aggregated, budget_docs)
		portfolio_pl_rollup.apply_pl_task_dimensions(aggregated, tasks)

		child_a = aggregated["Внутренняя командаTASK-CHILD-A"]
		child_b = aggregated["Внутренняя командаTASK-CHILD-B"]

		self.assertEqual(
			portfolio_pl_rollup.get_direct_budget_value(child_a, 2026, 7, "forecast"),
			30000,
		)
		self.assertEqual(
			portfolio_pl_rollup.get_direct_budget_value(child_b, 2026, 7, "forecast"),
			40000,
		)

