import sys
import types
import unittest
from datetime import date
from unittest.mock import Mock, patch

try:
	import frappe  # noqa: F401
except ModuleNotFoundError:
	_frappe_stub = types.ModuleType("frappe")
	_frappe_stub._ = lambda value, *args, **kwargs: value
	_frappe_stub.throw = Mock(side_effect=Exception)
	_frappe_stub.PermissionError = Exception
	_frappe_stub.get_doc = Mock()
	_frappe_stub.has_permission = Mock(return_value=True)
	_frappe_stub.parse_json = lambda value: value
	_frappe_stub.get_all = lambda *args, **kwargs: []
	_frappe_stub.get_meta = Mock(return_value=types.SimpleNamespace(get_field=lambda name: None))
	sys.modules["frappe"] = _frappe_stub
	_frappe_utils_stub = types.ModuleType("frappe.utils")

	def _add_months(value, months):
		current = date.fromisoformat(value) if isinstance(value, str) else value
		month_index = current.month - 1 + months
		year = current.year + month_index // 12
		month = month_index % 12 + 1
		return date(year, month, 1)

	_frappe_utils_stub.add_months = _add_months
	_frappe_utils_stub.flt = float
	_frappe_utils_stub.get_last_day = lambda value: value
	_frappe_utils_stub.getdate = lambda value=None: (
		value
		if isinstance(value, date)
		else date.fromisoformat(value) if value else value
	)
	_frappe_utils_stub.today = lambda: "2026-03-16"
	sys.modules["frappe.utils"] = _frappe_utils_stub
	_frappe_qb_stub = types.ModuleType("frappe.query_builder")
	_frappe_qb_stub.DocType = lambda value: value
	sys.modules["frappe.query_builder"] = _frappe_qb_stub
	_frappe_qb_functions_stub = types.ModuleType("frappe.query_builder.functions")
	_frappe_qb_functions_stub.IfNull = lambda value, default: value
	_frappe_qb_functions_stub.Sum = lambda value: value
	sys.modules["frappe.query_builder.functions"] = _frappe_qb_functions_stub
else:
	if not hasattr(frappe, "_"):
		frappe._ = lambda value, *args, **kwargs: value

from dinext_project_stage_gate.stage_gate import portfolio_grid


class FakeQBField:
	def __init__(self, name):
		self._name = name

	def as_(self, alias):
		return self

	def isin(self, values):
		return self


class FakeQBTable:
	def __init__(self, name):
		self._table_name = name

	def __getattr__(self, item):
		return FakeQBField(f"{self._table_name}.{item}")


class FakePortfolioDoc:
	doctype = "Project Portfolio"

	def __init__(self, name="PORT-001", permissions=None):
		self.name = name
		self._permissions = permissions or {"read": True, "write": True}

	def has_permission(self, ptype):
		return self._permissions.get(ptype, False)


class FakeProjectDoc:
	def __init__(self, name, current_portfolio=None):
		self.name = name
		self.custom_project_portfolio = current_portfolio
		self.saved = False

	def get(self, fieldname):
		return getattr(self, fieldname, None)

	def save(self):
		self.saved = True


class TestPortfolioGrid(unittest.TestCase):
	@patch.object(portfolio_grid, "today", return_value="2026-03-16")
	@patch.object(portfolio_grid, "_has_project_write_permission", return_value=True)
	@patch.object(portfolio_grid, "_get_pl_summaries")
	@patch.object(portfolio_grid, "_get_labor_summaries")
	@patch.object(portfolio_grid, "_get_nearest_milestones")
	@patch.object(portfolio_grid, "_attach_project_managers")
	@patch.object(portfolio_grid, "_get_portfolio_doc")
	@patch("dinext_project_stage_gate.stage_gate.portfolio_grid.query._get_permission_aware_list")
	def test_get_portfolio_project_rows_shapes_grid_row(
		self,
		get_permission_aware_list,
		get_portfolio_doc,
		_attach_project_managers,
		get_nearest_milestones,
		get_labor_summaries,
		get_pl_summaries,
		_has_project_write_permission,
		_mock_today,
	):
		get_portfolio_doc.return_value = FakePortfolioDoc()
		get_permission_aware_list.return_value = [
			{
				"name": "PROJ-001",
				"project_name": "Alpha",
				"project_type": "Implementation",
				"priority": "High",
				"status": "Open",
				"company": "Dinext",
				"customer": "Customer A",
				"department": "Consulting",
				"expected_start_date": "2026-03-01",
				"expected_end_date": "2026-03-31",
				"percent_complete": 40,
				"custom_project_portfolio": "PORT-001",
				"current_stage": "Discovery",
				"stage_gate_status": "Active",
				"custom_сроки_проекта": "Green",
				"custom_бюджет_проекта": "Amber",
				"custom_ресурсы": "Green",
				"custom_статус_по_рискам": "Red",
				"gross_margin": 2500,
				"project_manager": "Jane Manager",
			}
		]
		get_nearest_milestones.return_value = {
			"PROJ-001": {
				"name": "TASK-001",
				"subject": "Go Live",
				"milestone_date": "2026-03-20",
			}
		}
		get_labor_summaries.return_value = {
			"PROJ-001": portfolio_grid.ProjectLaborSummary(
				plan_total=120,
				actual_total=35,
				forecast_total=140,
				plan_today=62,
			)
		}
		get_pl_summaries.return_value = {
			"PROJ-001": portfolio_grid.ProjectPlSummary(
				plan_total=10000,
				actual_total=3200,
				forecast_total=11800,
				plan_today=5100,
				has_data=True,
			)
		}

		rows = portfolio_grid.get_portfolio_project_rows("PORT-001")

		self.assertEqual(len(rows), 1)
		row = rows[0]
		self.assertEqual(row["project"], "PROJ-001")
		self.assertEqual(row["project_name"], "Alpha")
		self.assertEqual(row["status_budget"], "Amber")
		self.assertEqual(row["active_stage"], "Discovery")
		self.assertEqual(row["nearest_milestone_subject"], "Go Live")
		self.assertEqual(row["labor_plan_total"], 120)
		self.assertEqual(row["labor_actual_total"], 35)
		self.assertEqual(row["labor_forecast_total"], 140)
		self.assertEqual(row["labor_plan_today"], 62)
		self.assertNotIn("labor_actual_today", row)
		self.assertEqual(row["can_write"], True)
		self.assertGreater(row["work_plan_percent"], 40)

	@patch.object(portfolio_grid, "_month_progress_ratio")
	@patch.object(portfolio_grid, "_load_labor_actual_rows")
	@patch.object(portfolio_grid, "_load_labor_plan_rows")
	@patch.object(portfolio_grid, "_load_project_task_rows")
	@patch.object(portfolio_grid, "today", return_value="2026-03-16")
	def test_get_labor_summaries_uses_role_aware_parent_task_labor_without_double_counting(
		self,
		_mock_today,
		load_project_task_rows,
		load_labor_plan_rows,
		load_labor_actual_rows,
		month_progress_ratio,
	):
		load_project_task_rows.return_value = [
			{"name": "TASK-ROOT", "project": "PROJ-001", "parent_task": None},
			{"name": "TASK-CHILD", "project": "PROJ-001", "parent_task": "TASK-ROOT"},
			{"name": "TASK-ROOT-2", "project": "PROJ-001", "parent_task": None},
			{"name": "TASK-LEAF-2", "project": "PROJ-001", "parent_task": "TASK-ROOT-2"},
		]
		load_labor_plan_rows.return_value = [
			{
				"project": "PROJ-001",
				"task": "TASK-ROOT",
				"project_role": "Role A",
				"year": 2026,
				"month": 3,
				"plan_hours": 100,
				"forecast_hours": 120,
			},
			{
				"project": "PROJ-001",
				"task": "TASK-CHILD",
				"project_role": "Role A",
				"year": 2026,
				"month": 3,
				"plan_hours": 40,
				"forecast_hours": 50,
			},
			{
				"project": "PROJ-001",
				"task": "TASK-CHILD",
				"project_role": "Role B",
				"year": 2026,
				"month": 3,
				"plan_hours": 20,
				"forecast_hours": 25,
			},
			{
				"project": "PROJ-001",
				"task": "TASK-LEAF-2",
				"project_role": "Role A",
				"year": 2026,
				"month": 4,
				"plan_hours": 30,
				"forecast_hours": 35,
			},
		]
		load_labor_actual_rows.return_value = [{"project": "PROJ-001", "actual_hours": 12.34}]
		month_progress_ratio.side_effect = lambda year, month, current_day: 0.5 if (year, month) == (2026, 3) else 0.0

		result = portfolio_grid._get_labor_summaries(
			[
				{
					"name": "PROJ-001",
					"expected_start_date": "2026-03-01",
					"expected_end_date": "2026-04-30",
				}
			]
		)

		self.assertEqual(result["PROJ-001"].plan_total, 150.0)
		self.assertEqual(result["PROJ-001"].forecast_total, 180.0)
		self.assertEqual(result["PROJ-001"].plan_today, 60.0)
		self.assertEqual(result["PROJ-001"].actual_total, 12.3)

	@patch.object(portfolio_grid, "_month_progress_ratio", return_value=1.0)
	@patch.object(portfolio_grid, "_load_labor_actual_rows", return_value=[])
	@patch.object(portfolio_grid, "_load_labor_plan_rows")
	@patch.object(portfolio_grid, "_load_project_task_rows")
	@patch.object(portfolio_grid, "today", return_value="2026-03-16")
	def test_get_labor_summaries_rolls_up_children_when_parent_has_no_in_window_data(
		self,
		_mock_today,
		load_project_task_rows,
		load_labor_plan_rows,
		_load_labor_actual_rows,
		_month_progress_ratio,
	):
		load_project_task_rows.return_value = [
			{"name": "TASK-ROOT", "project": "PROJ-001", "parent_task": None},
			{"name": "TASK-CHILD", "project": "PROJ-001", "parent_task": "TASK-ROOT"},
		]
		load_labor_plan_rows.return_value = [
			{
				"project": "PROJ-001",
				"task": "TASK-CHILD",
				"project_role": "Analyst",
				"year": 2026,
				"month": 3,
				"plan_hours": 40,
				"forecast_hours": 45,
			},
		]

		result = portfolio_grid._get_labor_summaries(
			[
				{
					"name": "PROJ-001",
					"expected_start_date": "2026-03-01",
					"expected_end_date": "2026-03-31",
				}
			]
		)

		self.assertEqual(result["PROJ-001"].plan_total, 40.0)
		self.assertEqual(result["PROJ-001"].forecast_total, 45.0)

	@patch.object(portfolio_grid, "_month_progress_ratio", return_value=1.0)
	@patch.object(portfolio_grid, "_load_labor_actual_rows", return_value=[])
	@patch.object(portfolio_grid, "_load_labor_plan_rows")
	@patch.object(portfolio_grid, "_load_project_task_rows")
	@patch.object(portfolio_grid, "today", return_value="2026-03-16")
	def test_get_labor_summaries_excludes_months_outside_project_window(
		self,
		_mock_today,
		load_project_task_rows,
		load_labor_plan_rows,
		_load_labor_actual_rows,
		_month_progress_ratio,
	):
		load_project_task_rows.return_value = [
			{"name": "TASK-ROOT", "project": "PROJ-001", "parent_task": None},
		]
		load_labor_plan_rows.return_value = [
			{
				"project": "PROJ-001",
				"task": "TASK-ROOT",
				"project_role": "Analyst",
				"year": 2025,
				"month": 12,
				"plan_hours": 100,
				"forecast_hours": 110,
			},
			{
				"project": "PROJ-001",
				"task": "TASK-ROOT",
				"project_role": "Analyst",
				"year": 2026,
				"month": 3,
				"plan_hours": 25,
				"forecast_hours": 30,
			},
		]

		result = portfolio_grid._get_labor_summaries(
			[
				{
					"name": "PROJ-001",
					"expected_start_date": "2026-03-01",
					"expected_end_date": "2026-03-31",
				}
			]
		)

		self.assertEqual(result["PROJ-001"].plan_total, 25.0)
		self.assertEqual(result["PROJ-001"].forecast_total, 30.0)

	@patch.object(portfolio_grid, "_month_progress_ratio", return_value=1.0)
	@patch.object(portfolio_grid, "_load_labor_actual_rows", return_value=[])
	@patch.object(portfolio_grid, "_load_labor_plan_rows")
	@patch.object(portfolio_grid, "_load_project_task_rows")
	@patch.object(portfolio_grid, "today", return_value="2026-03-16")
	def test_get_labor_summaries_matches_project_card_for_baltkhim_style_nested_same_role(
		self,
		_mock_today,
		load_project_task_rows,
		load_labor_plan_rows,
		_load_labor_actual_rows,
		_month_progress_ratio,
	):
		"""Parent PWE exists only outside the display window; children carry in-window labor."""
		load_project_task_rows.return_value = [
			{"name": "TASK-ROOT", "project": "PROJ-BALTKHIM", "parent_task": None},
			{"name": "TASK-CHILD-1", "project": "PROJ-BALTKHIM", "parent_task": "TASK-ROOT"},
			{"name": "TASK-CHILD-2", "project": "PROJ-BALTKHIM", "parent_task": "TASK-ROOT"},
			{"name": "TASK-ROOT-2", "project": "PROJ-BALTKHIM", "parent_task": None},
			{"name": "TASK-LEAF-2", "project": "PROJ-BALTKHIM", "parent_task": "TASK-ROOT-2"},
		]
		load_labor_plan_rows.return_value = [
			{
				"project": "PROJ-BALTKHIM",
				"task": "TASK-ROOT",
				"project_role": "Role A",
				"year": 2025,
				"month": 11,
				"plan_hours": 100,
				"forecast_hours": 110,
			},
			{
				"project": "PROJ-BALTKHIM",
				"task": "TASK-CHILD-1",
				"project_role": "Role A",
				"year": 2026,
				"month": 3,
				"plan_hours": 90,
				"forecast_hours": 95,
			},
			{
				"project": "PROJ-BALTKHIM",
				"task": "TASK-CHILD-2",
				"project_role": "Role A",
				"year": 2026,
				"month": 3,
				"plan_hours": 50,
				"forecast_hours": 55,
			},
			{
				"project": "PROJ-BALTKHIM",
				"task": "TASK-CHILD-2",
				"project_role": "Role B",
				"year": 2026,
				"month": 4,
				"plan_hours": 20,
				"forecast_hours": 25,
			},
			{
				"project": "PROJ-BALTKHIM",
				"task": "TASK-LEAF-2",
				"project_role": "Role A",
				"year": 2026,
				"month": 4,
				"plan_hours": 80,
				"forecast_hours": 85,
			},
		]

		result = portfolio_grid._get_labor_summaries(
			[
				{
					"name": "PROJ-BALTKHIM",
					"expected_start_date": "2026-03-01",
					"expected_end_date": "2026-04-30",
				}
			]
		)

		self.assertEqual(result["PROJ-BALTKHIM"].plan_total, 240.0)
		self.assertEqual(result["PROJ-BALTKHIM"].forecast_total, 260.0)

	@patch.object(portfolio_grid, "_month_progress_ratio", return_value=1.0)
	@patch.object(portfolio_grid, "_load_labor_actual_rows", return_value=[])
	@patch.object(portfolio_grid, "_load_labor_plan_rows")
	@patch.object(portfolio_grid, "_load_project_task_rows")
	@patch.object(portfolio_grid, "today", return_value="2026-06-21")
	def test_get_labor_summaries_matches_live_baltkhim_monthly_parent_child_split(
		self,
		_mock_today,
		load_project_task_rows,
		load_labor_plan_rows,
		_load_labor_actual_rows,
		_month_progress_ratio,
	):
		"""Live BaltKhim: parent and child carry labor in different months for the same role."""
		load_project_task_rows.return_value = [
			{"name": "TASK-2026-00010", "project": "PROJ-BALTKHIM", "parent_task": None, "is_milestone": 0},
			{"name": "TASK-2026-00156", "project": "PROJ-BALTKHIM", "parent_task": None, "is_milestone": 0},
			{"name": "TASK-2026-00008", "project": "PROJ-BALTKHIM", "parent_task": "TASK-2026-00156", "is_milestone": 0},
			{"name": "TASK-2026-00007", "project": "PROJ-BALTKHIM", "parent_task": "TASK-2026-00156", "is_milestone": 0},
			{"name": "TASK-2026-00157", "project": "PROJ-BALTKHIM", "parent_task": None, "is_milestone": 0},
			{"name": "TASK-2026-00158", "project": "PROJ-BALTKHIM", "parent_task": None, "is_milestone": 0},
			{"name": "TASK-2026-00176", "project": "PROJ-BALTKHIM", "parent_task": None, "is_milestone": 0},
		]
		load_labor_plan_rows.return_value = [
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00007", "project_role": "Консультант", "year": 2026, "month": 6, "plan_hours": 15, "forecast_hours": 15},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00007", "project_role": "Разработчик", "year": 2026, "month": 5, "plan_hours": 15, "forecast_hours": 16},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00008", "project_role": "Консультант", "year": 2026, "month": 5, "plan_hours": 15, "forecast_hours": 15},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00008", "project_role": "Разработчик", "year": 2026, "month": 4, "plan_hours": 60, "forecast_hours": 60},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00008", "project_role": "Разработчик", "year": 2026, "month": 5, "plan_hours": 40, "forecast_hours": 40},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00008", "project_role": "Руководитель проекта", "year": 2026, "month": 5, "plan_hours": 20, "forecast_hours": 20},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00010", "project_role": "Консультант", "year": 2026, "month": 6, "plan_hours": 20, "forecast_hours": 20},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00010", "project_role": "Разработчик", "year": 2026, "month": 6, "plan_hours": 20, "forecast_hours": 20},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00010", "project_role": "Руководитель проекта", "year": 2026, "month": 6, "plan_hours": 20, "forecast_hours": 20},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00156", "project_role": "Консультант", "year": 2026, "month": 4, "plan_hours": 10, "forecast_hours": 10},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00156", "project_role": "Разработчик", "year": 2026, "month": 5, "plan_hours": 60, "forecast_hours": 60},
			{"project": "PROJ-BALTKHIM", "task": "TASK-2026-00158", "project_role": "Руководитель проекта", "year": 2026, "month": 5, "plan_hours": 0, "forecast_hours": 20},
		]

		result = portfolio_grid._get_labor_summaries(
			[
				{
					"name": "PROJ-BALTKHIM",
					"expected_start_date": "2026-04-01",
					"expected_end_date": "2026-10-15",
				}
			]
		)

		self.assertEqual(result["PROJ-BALTKHIM"].plan_total, 240.0)
		self.assertEqual(result["PROJ-BALTKHIM"].forecast_total, 260.0)

	@patch.object(portfolio_grid, "_month_progress_ratio", return_value=1.0)
	@patch.object(portfolio_grid, "_load_labor_actual_rows", return_value=[])
	@patch.object(portfolio_grid, "_load_labor_plan_rows")
	@patch.object(portfolio_grid, "_load_project_task_rows")
	@patch.object(portfolio_grid, "today", return_value="2026-03-16")
	def test_get_labor_summaries_excludes_tasks_under_milestones_without_promoting_to_root(
		self,
		_mock_today,
		load_project_task_rows,
		load_labor_plan_rows,
		_load_labor_actual_rows,
		_month_progress_ratio,
	):
		load_project_task_rows.return_value = [
			{"name": "TASK-ROOT", "project": "PROJ-001", "parent_task": None, "is_milestone": 0},
			{"name": "TASK-MS", "project": "PROJ-001", "parent_task": "TASK-ROOT", "is_milestone": 1},
			{"name": "TASK-CHILD", "project": "PROJ-001", "parent_task": "TASK-MS", "is_milestone": 0},
		]
		load_labor_plan_rows.return_value = [
			{
				"project": "PROJ-001",
				"task": "TASK-ROOT",
				"project_role": "Analyst",
				"year": 2026,
				"month": 3,
				"plan_hours": 50,
				"forecast_hours": 55,
			},
			{
				"project": "PROJ-001",
				"task": "TASK-CHILD",
				"project_role": "Analyst",
				"year": 2026,
				"month": 3,
				"plan_hours": 90,
				"forecast_hours": 95,
			},
		]

		result = portfolio_grid._get_labor_summaries(
			[
				{
					"name": "PROJ-001",
					"expected_start_date": "2026-03-01",
					"expected_end_date": "2026-03-31",
				}
			]
		)

		self.assertEqual(result["PROJ-001"].plan_total, 50.0)
		self.assertEqual(result["PROJ-001"].forecast_total, 55.0)

	@patch.object(portfolio_grid, "_month_progress_ratio", return_value=1.0)
	@patch.object(portfolio_grid, "_load_labor_actual_rows", return_value=[])
	@patch.object(portfolio_grid, "_load_labor_plan_rows")
	@patch.object(portfolio_grid, "_load_project_task_rows")
	@patch.object(portfolio_grid, "today", return_value="2026-03-16")
	def test_get_labor_summaries_excludes_unreachable_tasks_with_missing_parent(
		self,
		_mock_today,
		load_project_task_rows,
		load_labor_plan_rows,
		_load_labor_actual_rows,
		_month_progress_ratio,
	):
		load_project_task_rows.return_value = [
			{"name": "TASK-ROOT", "project": "PROJ-001", "parent_task": None, "is_milestone": 0},
			{"name": "TASK-ORPHAN", "project": "PROJ-001", "parent_task": "TASK-MISSING", "is_milestone": 0},
		]
		load_labor_plan_rows.return_value = [
			{
				"project": "PROJ-001",
				"task": "TASK-ROOT",
				"project_role": "Analyst",
				"year": 2026,
				"month": 3,
				"plan_hours": 40,
				"forecast_hours": 45,
			},
			{
				"project": "PROJ-001",
				"task": "TASK-ORPHAN",
				"project_role": "Analyst",
				"year": 2026,
				"month": 3,
				"plan_hours": 90,
				"forecast_hours": 95,
			},
		]

		result = portfolio_grid._get_labor_summaries(
			[
				{
					"name": "PROJ-001",
					"expected_start_date": "2026-03-01",
					"expected_end_date": "2026-03-31",
				}
			]
		)

		self.assertEqual(result["PROJ-001"].plan_total, 40.0)
		self.assertEqual(result["PROJ-001"].forecast_total, 45.0)

	@patch.object(portfolio_grid, "today", return_value="2026-03-10")
	@patch("dinext_project_stage_gate.stage_gate.portfolio_grid.query._get_permission_aware_list")
	def test_get_nearest_milestones_skips_past_and_picks_first_future(
		self, get_permission_aware_list, _mock_today
	):
		get_permission_aware_list.return_value = [
			{
				"name": "TASK-OLD",
				"project": "PROJ-001",
				"subject": "Old milestone",
				"exp_end_date": "2026-03-05",
				"exp_start_date": None,
			},
			{
				"name": "TASK-NEW",
				"project": "PROJ-001",
				"subject": "Next milestone",
				"exp_end_date": "2026-03-15",
				"exp_start_date": None,
			},
			{
				"name": "TASK-SECOND",
				"project": "PROJ-001",
				"subject": "Later milestone",
				"exp_end_date": "2026-03-20",
				"exp_start_date": None,
			},
		]

		result = portfolio_grid._get_nearest_milestones(["PROJ-001"])

		get_permission_aware_list.assert_called_once()
		call_kwargs = get_permission_aware_list.call_args.kwargs
		self.assertEqual(
			call_kwargs["filters"]["status"],
			["not in", ["Cancelled", "Completed"]],
		)
		self.assertEqual(result["PROJ-001"]["name"], "TASK-NEW")
		self.assertEqual(result["PROJ-001"]["milestone_date"], "2026-03-15")

	@patch.object(portfolio_grid, "today", return_value="2026-03-10")
	@patch("dinext_project_stage_gate.stage_gate.portfolio_grid.query._get_permission_aware_list")
	def test_get_nearest_milestones_excludes_closed_statuses_from_query(
		self, get_permission_aware_list, _mock_today
	):
		get_permission_aware_list.return_value = [
			{
				"name": "TASK-OPEN",
				"project": "PROJ-001",
				"subject": "Open milestone",
				"exp_end_date": "2026-03-20",
				"exp_start_date": None,
			},
		]

		result = portfolio_grid._get_nearest_milestones(["PROJ-001"])

		call_kwargs = get_permission_aware_list.call_args.kwargs
		self.assertEqual(call_kwargs["filters"]["is_milestone"], 1)
		self.assertEqual(
			call_kwargs["filters"]["status"],
			["not in", ["Cancelled", "Completed"]],
		)
		self.assertEqual(result["PROJ-001"]["name"], "TASK-OPEN")

	@patch.object(portfolio_grid, "_is_app_installed", return_value=False)
	def test_get_pl_summaries_falls_back_to_project_gross_margin(self, _mock_app_installed):
		project_rows = [{"name": "PROJ-001", "gross_margin": 4200}]

		result = portfolio_grid._get_pl_summaries(project_rows)

		self.assertEqual(result["PROJ-001"].actual_total, 4200)
		self.assertTrue(result["PROJ-001"].has_data)

	@patch.object(portfolio_grid.portfolio_pl_rollup, "load_pl_budget_documents", return_value={})
	@patch.object(portfolio_grid, "today", return_value="2026-03-16")
	@patch.object(portfolio_grid.portfolio_pl_rollup, "summarize_project_pl_plan_forecast", return_value=(0.0, 0.0, 0.0, False))
	@patch.object(portfolio_grid, "_load_pl_actual_rows")
	@patch.object(portfolio_grid, "_is_app_installed", return_value=True)
	def test_get_pl_summaries_uses_signed_gl_actual(
		self,
		_mock_app_installed,
		load_pl_actual_rows,
		_mock_plan_forecast,
		_mock_today,
		_mock_load_budget_docs,
	):
		load_pl_actual_rows.return_value = [{"project": "PROJ-001", "actual_net": -80000}]

		result = portfolio_grid._get_pl_summaries(
			[
				{
					"name": "PROJ-001",
					"gross_margin": 3000,
					"company": "Dinext",
					"expected_start_date": "2026-01-01",
					"expected_end_date": "2026-12-31",
				}
			]
		)

		self.assertEqual(result["PROJ-001"].actual_total, -80000)
		self.assertTrue(result["PROJ-001"].has_data)

	@patch.object(portfolio_grid, "_has_project_write_permission")
	@patch("dinext_project_stage_gate.stage_gate.portfolio_grid.frappe.get_doc")
	def test_add_projects_to_portfolio_skips_missing_write_permission(
		self, frappe_get_doc, has_project_write_permission
	):
		project_docs = {
			"PROJ-001": FakeProjectDoc("PROJ-001", None),
			"PROJ-002": FakeProjectDoc("PROJ-002", None),
		}

		def get_doc(doctype, name):
			self.assertEqual(doctype, "Project")
			return project_docs[name]

		frappe_get_doc.side_effect = get_doc
		has_project_write_permission.side_effect = lambda name: name == "PROJ-001"

		result = portfolio_grid._update_projects_portfolio_link(
			"PORT-001", ["PROJ-001", "PROJ-002"], mode="add"
		)

		self.assertEqual(result["updated"], ["PROJ-001"])
		self.assertEqual(result["skipped"], [{"project": "PROJ-002", "reason": "no_project_write_permission"}])
		self.assertEqual(project_docs["PROJ-001"].custom_project_portfolio, "PORT-001")
		self.assertTrue(project_docs["PROJ-001"].saved)
		self.assertFalse(project_docs["PROJ-002"].saved)

	@patch.object(portfolio_grid, "_has_project_write_permission", return_value=True)
	@patch("dinext_project_stage_gate.stage_gate.portfolio_grid.frappe.get_doc")
	def test_remove_projects_from_portfolio_skips_projects_from_other_portfolios(
		self, frappe_get_doc, _mock_has_write_permission
	):
		project_docs = {
			"PROJ-001": FakeProjectDoc("PROJ-001", "PORT-001"),
			"PROJ-002": FakeProjectDoc("PROJ-002", "PORT-OTHER"),
		}

		def get_doc(doctype, name):
			self.assertEqual(doctype, "Project")
			return project_docs[name]

		frappe_get_doc.side_effect = get_doc

		result = portfolio_grid._update_projects_portfolio_link(
			"PORT-001", ["PROJ-001", "PROJ-002"], mode="remove"
		)

		self.assertEqual(result["updated"], ["PROJ-001"])
		self.assertEqual(result["skipped"], [{"project": "PROJ-002", "reason": "not_in_portfolio"}])
		self.assertIsNone(project_docs["PROJ-001"].custom_project_portfolio)
		self.assertTrue(project_docs["PROJ-001"].saved)


class TestSignedGlPlAmount(unittest.TestCase):
	def test_expense_counts_negative_in_pl_net(self):
		self.assertEqual(portfolio_grid._signed_gl_pl_line_amount("Expense", 8000, 0), -8000)

	def test_income_counts_positive(self):
		self.assertEqual(portfolio_grid._signed_gl_pl_line_amount("Income", 0, 10000), 10000)

	def test_liability_excluded(self):
		self.assertEqual(portfolio_grid._signed_gl_pl_line_amount("Liability", 0, 80000), 0)


class TestApprovedUtpStatuses(unittest.TestCase):
	def test_approved_utp_status_values_include_canonical_and_meta_options(self):
		original_get_meta = getattr(portfolio_grid.frappe, "get_meta", None)
		original_translate = portfolio_grid.frappe._
		try:
			portfolio_grid.frappe.get_meta = Mock(
				return_value=Mock(
					get_field=Mock(
						return_value=types.SimpleNamespace(
							options="\nРедактирование\nНа согласовании\nСогласовано\nОтклонено"
						)
					)
				)
			)
			portfolio_grid.frappe._ = lambda value, context=None: value

			values = portfolio_grid._approved_utp_status_values()
		finally:
			if original_get_meta is None:
				delattr(portfolio_grid.frappe, "get_meta")
			else:
				portfolio_grid.frappe.get_meta = original_get_meta
			portfolio_grid.frappe._ = original_translate

		self.assertIn("Approved", values)
		self.assertIn("Согласовано", values)
		self.assertNotIn("Редактирование", values)


class TestUnassignedProjects(unittest.TestCase):
	@patch("dinext_project_stage_gate.stage_gate.portfolio_grid.query._get_permission_aware_list")
	def test_get_unassigned_projects_filters_in_database(self, get_permission_aware_list):
		get_permission_aware_list.return_value = [
			{
				"name": "PROJ-001",
				"project_name": "Alpha",
				"project_type": "Implementation",
				"customer": "Dinext",
				"priority": "High",
			}
		]

		result = portfolio_grid.get_unassigned_projects()

		get_permission_aware_list.assert_called_once()
		call_kwargs = get_permission_aware_list.call_args.kwargs
		self.assertEqual(call_kwargs["filters"], {"custom_project_portfolio": ["is", "not set"]})
		self.assertEqual(result[0]["name"], "PROJ-001")


class TestLoadPlActualRows(unittest.TestCase):
	def test_returns_empty_for_no_projects(self):
		self.assertEqual(portfolio_grid._load_pl_actual_rows([]), [])

	@patch.object(portfolio_grid.frappe.db, "sql")
	def test_uses_query_builder_instead_of_raw_sql(self, mock_sql):
		mock_query = Mock()
		mock_query.inner_join.return_value = mock_query
		mock_query.on.return_value = mock_query
		mock_query.select.return_value = mock_query
		mock_query.where.return_value = mock_query
		mock_query.groupby.return_value = mock_query
		mock_query.run.return_value = [{"project": "PROJ-001", "actual_net": 1500.0}]

		with patch.object(portfolio_grid.frappe.qb, "from_", return_value=mock_query) as mock_from:
			result = portfolio_grid._load_pl_actual_rows(["PROJ-001"])

		mock_from.assert_called_once()
		mock_sql.assert_not_called()
		self.assertEqual(result, [{"project": "PROJ-001", "actual_net": 1500.0}])


if __name__ == "__main__":
	unittest.main()
