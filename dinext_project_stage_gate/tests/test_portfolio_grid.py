import sys
import types
import unittest
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
	_frappe_stub.qb = types.SimpleNamespace(from_=Mock())
	sys.modules["frappe"] = _frappe_stub
	_frappe_utils_stub = types.ModuleType("frappe.utils")
	_frappe_utils_stub.flt = float
	_frappe_utils_stub.get_last_day = lambda value: value
	_frappe_utils_stub.getdate = lambda value=None: value
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
				actual_today=35,
			)
		}
		get_pl_summaries.return_value = {
			"PROJ-001": portfolio_grid.ProjectPlSummary(
				plan_total=10000,
				actual_total=3200,
				forecast_total=11800,
				plan_today=5100,
				actual_today=3200,
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
		self.assertEqual(row["labor_forecast_total"], 140)
		self.assertEqual(row["pl_actual_today"], 3200)
		self.assertEqual(row["can_write"], True)
		self.assertGreater(row["work_plan_percent"], 40)

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

		self.assertEqual(result["PROJ-001"]["name"], "TASK-NEW")
		self.assertEqual(result["PROJ-001"]["milestone_date"], "2026-03-15")

	@patch.object(portfolio_grid, "_is_app_installed", return_value=False)
	def test_get_pl_summaries_falls_back_to_project_gross_margin(self, _mock_app_installed):
		project_rows = [{"name": "PROJ-001", "gross_margin": 4200}]

		result = portfolio_grid._get_pl_summaries(project_rows)

		self.assertEqual(result["PROJ-001"].actual_total, 4200)
		self.assertEqual(result["PROJ-001"].actual_today, 4200)
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


if __name__ == "__main__":
	unittest.main()
