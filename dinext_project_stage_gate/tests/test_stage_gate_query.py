import sys
import types
import unittest
from datetime import date

try:
	import frappe  # noqa: F401
except ModuleNotFoundError:
	_frappe_stub = types.ModuleType("frappe")
	_frappe_stub.get_all = None
	_frappe_stub.get_list = None
	_frappe_stub._ = lambda value: value
	_frappe_stub.db = types.SimpleNamespace(get_value=lambda *args, **kwargs: 1)
	sys.modules["frappe"] = _frappe_stub
	_frappe_utils_stub = types.ModuleType("frappe.utils")
	_frappe_utils_stub.add_months = lambda value, months: value
	sys.modules["frappe.utils"] = _frappe_utils_stub
else:
	if not hasattr(frappe, "get_all"):
		frappe.get_all = None
	if not hasattr(frappe, "get_list"):
		frappe.get_list = None
	if not hasattr(frappe, "_"):
		frappe._ = lambda value: value
	if not hasattr(frappe, "db"):
		frappe.db = types.SimpleNamespace(get_value=lambda *args, **kwargs: 1)

from unittest.mock import Mock, patch

from frappe.utils import add_months

from dinext_project_stage_gate.stage_gate import query


class TestStageGateQuery(unittest.TestCase):
	def test_normalize_roadmap_visibility_filters_reenables_stages_when_no_other_entities_selected(self):
		filters = query._normalize_roadmap_visibility_filters(
			{
				"show_stages_and_checkpoints": 0,
				"show_milestones": 0,
				"task_types": [],
			}
		)

		self.assertEqual(filters["show_stages_and_checkpoints"], 1)

	def test_normalize_roadmap_visibility_filters_keeps_stages_hidden_when_other_entities_selected(self):
		filters = query._normalize_roadmap_visibility_filters(
			{
				"show_stages_and_checkpoints": 0,
				"show_milestones": 1,
				"task_types": [],
			}
		)

		self.assertEqual(filters["show_stages_and_checkpoints"], 0)

	def test_get_project_stage_chain_uses_stage_name_from_docname_and_checkpoint_level(self):
		get_all = Mock()
		get_all.side_effect = [
			[
				{
					"name": "PSI-001",
					"stage": "Discovery",
					"status": "Active",
					"sequence": 1,
					"gate_result": None,
					"planned_start_date": None,
					"planned_end_date": None,
					"actual_start_date": None,
					"actual_end_date": None,
					"gate_due_date": None,
				}
			],
			[
				{
					"name": "Discovery",
					"color": "#abcdef",
					"icon": "compass",
					"is_gate_required": 1,
				}
			],
			[
				{
					"name": "PGC-001",
					"stage_instance": "PSI-001",
					"status": "Approved",
					"checkpoint_level": "Stage Exit",
					"approval_date": "2026-04-11",
					"decision_comment": "Ready",
				}
			],
		]
		fake_frappe = types.SimpleNamespace(
			get_all=get_all,
			db=types.SimpleNamespace(get_value=Mock(return_value=1)),
		)

		with patch.object(query, "frappe", fake_frappe):
			result = query.get_project_stage_chain("PROJ-001")

		self.assertEqual(result[0]["stage_name"], "Discovery")
		self.assertEqual(result[0]["checkpoints"][0]["checkpoint_level"], "Stage Exit")

	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	def test_get_project_team_rows_uses_selected_manager_role(self, get_all):
		query._get_project_team_rows(["PROJ-001"], "Delivery Manager")

		get_all.assert_called_once()
		self.assertEqual(
			get_all.call_args.kwargs["filters"]["pt_role"],
			"Delivery Manager",
		)

	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	def test_get_project_team_rows_uses_default_manager_role_when_missing(self, get_all):
		query._get_project_team_rows(["PROJ-001"], None)

		get_all.assert_called_once()
		self.assertEqual(
			get_all.call_args.kwargs["filters"]["pt_role"],
			"Руководитель проекта",
		)

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_returns_project_expected_dates(self, get_list, get_all, _mock_today):
		get_list.side_effect = [
			[
				{
					"name": "PROJ-001",
					"project_name": "Alpha",
					"project_type": "Implementation",
					"status": "Open",
					"company": "Dinext",
					"customer": "Customer A",
					"custom_project_portfolio": "Portfolio A",
					"governance_model": "Standard",
					"stage_chain_version": 1,
					"current_stage": "Discovery",
					"stage_gate_status": "Active",
					"expected_start_date": "2026-05-01",
					"expected_end_date": "2026-09-30",
				}
			],
			[],
		]
		get_all.side_effect = [[], [], []]

		result = query.get_roadmap_dataset({"project": "PROJ-001"})

		project_call = get_list.call_args_list[0]
		self.assertIn("expected_start_date", project_call.kwargs["fields"])
		self.assertIn("expected_end_date", project_call.kwargs["fields"])
		self.assertEqual(result["projects"][0]["expected_start_date"], "2026-05-01")
		self.assertEqual(result["projects"][0]["expected_end_date"], "2026-09-30")

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_returns_checkpoint_level_field(self, get_list, get_all, _mock_today):
		get_list.side_effect = [
			[
				{
					"name": "PROJ-001",
					"project_name": "Alpha",
					"company": "Dinext",
					"customer": "Customer A",
					"custom_project_portfolio": "Portfolio A",
					"governance_model": "Standard",
					"stage_chain_version": 1,
					"current_stage": "Discovery",
					"stage_gate_status": "Active",
				}
			],
			[
				{
					"name": "PSI-001",
					"project": "PROJ-001",
					"stage": "Discovery",
					"status": "Active",
					"sequence": 1,
					"stage_chain_version": 1,
					"planned_start_date": None,
					"planned_end_date": None,
					"actual_start_date": None,
					"actual_end_date": None,
					"gate_due_date": None,
					"gate_result": None,
				}
			],
		]
		get_all.side_effect = [
			[
				{
					"parent": "PROJ-001",
					"pt_participant": "pm@example.com",
					"pt_participant_type": "User",
					"pt_valid_from": "2026-04-01",
					"pt_valid_for": "2026-04-30",
					"idx": 1,
					"creation": "2026-04-01 00:00:00",
				}
			],
			[
				{
					"name": "pm@example.com",
					"full_name": "Project Manager",
				}
			],
			[
				{
					"name": "Discovery",
					"color": "#abcdef",
				}
			],
			[
				{
					"name": "PGC-001",
					"project": "PROJ-001",
					"stage_instance": "PSI-001",
					"status": "Approved",
					"approval_date": "2026-04-11",
					"checkpoint_level": "Stage Exit",
				}
			],
		]

		result = query.get_roadmap_dataset()

		self.assertEqual(result["gates"][0]["checkpoint_level"], "Stage Exit")
		self.assertEqual(result["projects"][0]["project_manager"], "Project Manager")
		self.assertEqual(result["stageBars"][0]["stage_name"], "Discovery")
		self.assertEqual(result["stageBars"][0]["color"], "#abcdef")

		stage_call = get_list.call_args_list[1]
		self.assertEqual(stage_call.args[0], "Project Stage Instance")
		stage_filters = stage_call.kwargs["filters"]
		t0 = date(2026, 4, 19)
		self.assertEqual(stage_filters["planned_end_date"], [">=", add_months(t0, -6)])
		self.assertEqual(stage_filters["planned_start_date"], ["<=", add_months(t0, 12)])

		stage_meta_call = get_all.call_args_list[2]
		self.assertEqual(stage_meta_call.args[0], "Project Stage")

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_skips_stage_and_gate_queries_when_hidden(self, get_list, get_all, _mock_today):
		get_list.side_effect = [
			[
				{
					"name": "PROJ-001",
					"project_name": "Alpha",
					"company": "Dinext",
					"customer": "Customer A",
					"custom_project_portfolio": "Portfolio A",
					"governance_model": "Standard",
					"stage_chain_version": 1,
					"current_stage": "Discovery",
					"stage_gate_status": "Active",
				}
			],
			[
				{
					"name": "TASK-001",
					"project": "PROJ-001",
					"subject": "Kickoff",
					"type": "Sprint",
					"status": "Open",
					"is_milestone": 0,
					"exp_start_date": "2026-04-12",
					"exp_end_date": "2026-04-18",
				}
			],
		]
		get_all.side_effect = [
			[],
			[],
		]

		result = query.get_roadmap_dataset(
			{
				"show_stages_and_checkpoints": 0,
				"show_milestones": 0,
				"task_types": ["Sprint"],
			}
		)

		self.assertEqual(result["stageBars"], [])
		self.assertEqual(result["gates"], [])
		self.assertEqual(result["appliedFilters"]["show_stages_and_checkpoints"], 0)
		self.assertEqual(
			[call.args[0] for call in get_list.call_args_list],
			["Project", "Task"],
		)
		self.assertNotIn(
			"Project Gate Checkpoint",
			[call.args[0] for call in get_all.call_args_list],
		)

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_active_only_keeps_legacy_inflight_statuses(self, get_list, get_all, _mock_today):
		get_list.side_effect = [[], []]
		get_all.side_effect = [[], [], [], []]

		query.get_roadmap_dataset({"active_only": 1})

		project_filters = get_list.call_args_list[0].kwargs["filters"]
		self.assertEqual(
			project_filters["stage_gate_status"],
			["in", ["Active", "Waiting Gate", "Blocked", "Rejected"]],
		)

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_filters_projects_by_project_type(self, get_list, get_all, _mock_today):
		get_list.side_effect = [[], []]
		get_all.side_effect = [[], [], [], []]

		query.get_roadmap_dataset({"project_type": "Implementation"})

		project_filters = get_list.call_args_list[0].kwargs["filters"]
		self.assertEqual(project_filters["project_type"], "Implementation")

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_filters_projects_by_standard_project_status(
		self, get_list, get_all, _mock_today
	):
		get_list.side_effect = [[], []]
		get_all.side_effect = [[], [], [], []]

		query.get_roadmap_dataset({"project_status": "Completed"})

		project_filters = get_list.call_args_list[0].kwargs["filters"]
		self.assertEqual(project_filters["status"], "Completed")

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_uses_manager_validity_overlap(self, get_list, get_all, _mock_today):
		get_list.side_effect = [
			[
				{
					"name": "PROJ-001",
					"project_name": "Alpha",
					"company": "Dinext",
					"customer": "Customer A",
					"custom_project_portfolio": "Portfolio A",
					"governance_model": "Standard",
					"stage_chain_version": 1,
					"current_stage": "Discovery",
					"stage_gate_status": "Active",
				}
			],
			[],
		]
		get_all.side_effect = [
			[
				{
					"parent": "PROJ-001",
					"pt_participant": "valid@example.com",
					"pt_participant_type": "User",
					"pt_valid_from": "2026-04-01",
					"pt_valid_for": "2026-04-15",
					"idx": 1,
					"creation": "2026-04-01 00:00:00",
				},
				{
					"parent": "PROJ-001",
					"pt_participant": "expired@example.com",
					"pt_participant_type": "User",
					"pt_valid_from": "2026-03-01",
					"pt_valid_for": "2026-03-31",
					"idx": 2,
					"creation": "2026-03-01 00:00:00",
				},
			],
			[
				{"name": "valid@example.com", "full_name": "Valid Manager"},
			],
			[],
			[],
			[],
		]

		result = query.get_roadmap_dataset({"from_date": "2026-04-10", "to_date": "2026-04-20"})

		self.assertEqual(result["projects"][0]["project_manager"], "Valid Manager")

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_filters_by_valid_manager(self, get_list, get_all, _mock_today):
		get_list.side_effect = [
			[
				{
					"name": "PROJ-001",
					"project_name": "Alpha",
					"company": "Dinext",
					"customer": "Customer A",
					"custom_project_portfolio": "Portfolio A",
					"governance_model": "Standard",
					"stage_chain_version": 1,
					"current_stage": "Discovery",
					"stage_gate_status": "Active",
				},
				{
					"name": "PROJ-002",
					"project_name": "Beta",
					"company": "Dinext",
					"customer": "Customer B",
					"custom_project_portfolio": "Portfolio B",
					"governance_model": "Standard",
					"stage_chain_version": 1,
					"current_stage": "Delivery",
					"stage_gate_status": "Active",
				},
			],
			[],
		]
		get_all.side_effect = [
			[
				{
					"parent": "PROJ-001",
					"pt_participant": "pm@example.com",
					"pt_participant_type": "User",
					"pt_valid_from": None,
					"pt_valid_for": None,
					"idx": 1,
					"creation": "2026-01-01 00:00:00",
				},
				{
					"parent": "PROJ-002",
					"pt_participant": "other@example.com",
					"pt_participant_type": "User",
					"pt_valid_from": None,
					"pt_valid_for": None,
					"idx": 1,
					"creation": "2026-01-01 00:00:00",
				},
			],
			[
				{"name": "pm@example.com", "full_name": "Project Manager"},
				{"name": "other@example.com", "full_name": "Other Manager"},
			],
			[],
			[],
			[],
		]

		result = query.get_roadmap_dataset({"project_manager": "pm@example.com"})

		self.assertEqual([project["name"] for project in result["projects"]], ["PROJ-001"])
		project_team_call = get_all.call_args_list[0]
		self.assertEqual(
			project_team_call.kwargs["filters"]["pt_role"],
			"Руководитель проекта",
		)

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_uses_selected_project_manager_role(self, get_list, get_all, _mock_today):
		get_list.side_effect = [
			[
				{
					"name": "PROJ-001",
					"project_name": "Alpha",
					"company": "Dinext",
					"customer": "Customer A",
					"custom_project_portfolio": "Portfolio A",
					"governance_model": "Standard",
					"stage_chain_version": 1,
					"current_stage": "Discovery",
					"stage_gate_status": "Active",
				}
			],
			[],
		]
		get_all.side_effect = [[], [], [], []]

		query.get_roadmap_dataset({"project_manager_role": "Delivery Manager"})

		project_team_call = get_all.call_args_list[0]
		self.assertEqual(
			project_team_call.kwargs["filters"]["pt_role"],
			"Delivery Manager",
		)

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_default_range_applies_stage_date_filters(self, get_list, get_all, _mock_today):
		get_list.side_effect = [[], []]
		get_all.side_effect = [[], [], [], []]

		query.get_roadmap_dataset({})

		stage_call = get_list.call_args_list[1]
		self.assertEqual(stage_call.args[0], "Project Stage Instance")
		stage_filters = stage_call.kwargs["filters"]
		t0 = date(2026, 4, 19)
		self.assertEqual(stage_filters["planned_end_date"], [">=", add_months(t0, -6)])
		self.assertEqual(stage_filters["planned_start_date"], ["<=", add_months(t0, 12)])

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_uses_permission_aware_project_and_stage_queries(
		self, get_list, get_all, _mock_today
	):
		get_list.side_effect = [
			[
				{
					"name": "PROJ-001",
					"project_name": "Alpha",
					"company": "Dinext",
					"customer": "Customer A",
					"custom_project_portfolio": "Portfolio A",
					"governance_model": "Standard",
					"stage_chain_version": 1,
					"current_stage": "Discovery",
					"stage_gate_status": "Active",
				}
			],
			[
				{
					"name": "PSI-001",
					"project": "PROJ-001",
					"stage": "Discovery",
					"status": "Active",
					"sequence": 1,
					"stage_chain_version": 1,
					"planned_start_date": "2026-01-10",
					"planned_end_date": "2026-02-10",
					"actual_start_date": None,
					"actual_end_date": None,
					"gate_due_date": None,
					"gate_result": None,
				}
			],
		]
		get_all.side_effect = [
			[],
			[
				{
					"name": "Discovery",
					"color": "#abcdef",
				}
			],
			[
				{
					"name": "PGC-001",
					"project": "PROJ-001",
					"stage_instance": "PSI-001",
					"status": "Approved",
					"approval_date": "2026-02-11",
					"checkpoint_level": "Stage Exit",
				}
			],
		]

		result = query.get_roadmap_dataset({"project": "PROJ-001"})

		self.assertEqual([row["name"] for row in result["projects"]], ["PROJ-001"])
		self.assertEqual([row["name"] for row in result["stageBars"]], ["PSI-001"])
		self.assertEqual([row["name"] for row in result["gates"]], ["PGC-001"])
		self.assertEqual(get_list.call_args_list[0].args[0], "Project")
		self.assertEqual(get_list.call_args_list[1].args[0], "Project Stage Instance")
		self.assertEqual(get_all.call_args_list[2].kwargs["filters"], {"stage_instance": ["in", ["PSI-001"]]})

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_includes_filtered_task_entities(self, get_list, get_all, _mock_today):
		get_list.side_effect = [
			[
				{
					"name": "PROJ-001",
					"project_name": "Alpha",
					"company": "Dinext",
					"customer": "Customer A",
					"custom_project_portfolio": "Portfolio A",
					"governance_model": "Standard",
					"stage_chain_version": 1,
					"current_stage": "Discovery",
					"stage_gate_status": "Active",
				}
			],
			[],
			[
				{
					"name": "TASK-001",
					"project": "PROJ-001",
					"subject": "Milestone A",
					"type": "Sprint",
					"progress": 100,
					"status": "Open",
					"is_milestone": 1,
					"exp_start_date": "2026-04-10",
					"exp_end_date": "2026-04-12",
				},
				{
					"name": "TASK-002",
					"project": "PROJ-001",
					"subject": "Sprint 2",
					"type": "Sprint",
					"progress": 35,
					"status": "Working",
					"is_milestone": 0,
					"exp_start_date": "2026-04-14",
					"exp_end_date": "2026-04-30",
				},
				{
					"name": "TASK-003",
					"project": "PROJ-001",
					"subject": "Phase X",
					"type": "Phase",
					"status": "Open",
					"is_milestone": 0,
					"exp_start_date": "2026-04-05",
					"exp_end_date": "2026-04-07",
				},
			],
		]
		get_all.side_effect = [[], [], []]

		result = query.get_roadmap_dataset(
			{
				"from_date": "2026-04-10",
				"to_date": "2026-04-20",
				"show_milestones": 1,
				"task_types": ["Sprint"],
			}
		)

		self.assertEqual([row["name"] for row in result["taskEntities"]], ["TASK-001", "TASK-002"])
		self.assertEqual(result["taskEntities"][0]["entity_kind"], "milestone")
		self.assertEqual(result["taskEntities"][0]["lane_key"], "milestone")
		self.assertEqual(result["taskEntities"][0]["point_date"], "2026-04-12")
		self.assertEqual(result["taskEntities"][0]["project_name"], "Alpha")
		self.assertEqual(result["taskEntities"][0]["portfolio"], "Portfolio A")
		self.assertNotIn("progress", result["taskEntities"][0])
		self.assertEqual(result["taskEntities"][1]["entity_kind"], "task_bar")
		self.assertEqual(result["taskEntities"][1]["lane_key"], "task_type:Sprint")
		self.assertEqual(result["taskEntities"][1]["start_date"], "2026-04-14")
		self.assertEqual(result["taskEntities"][1]["end_date"], "2026-04-30")
		self.assertEqual(result["taskEntities"][1]["progress"], 35)
		self.assertEqual(get_list.call_args_list[2].args[0], "Task")
		task_filters = get_list.call_args_list[2].kwargs["filters"]
		self.assertEqual(task_filters["project"], ["in", ["PROJ-001"]])
		self.assertIn("progress", get_list.call_args_list[2].kwargs["fields"])

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_list", create=True)
	def test_get_roadmap_dataset_skips_undated_task_entities(self, get_list, get_all, _mock_today):
		get_list.side_effect = [
			[
				{
					"name": "PROJ-001",
					"project_name": "Alpha",
					"company": "Dinext",
					"customer": "Customer A",
					"custom_project_portfolio": "Portfolio A",
					"governance_model": "Standard",
					"stage_chain_version": 1,
					"current_stage": "Discovery",
					"stage_gate_status": "Active",
				}
			],
			[],
			[
				{
					"name": "TASK-UNDATED-MILESTONE",
					"project": "PROJ-001",
					"subject": "Undated milestone",
					"type": "Sprint",
					"status": "Open",
					"is_milestone": 1,
					"exp_start_date": None,
					"exp_end_date": None,
				},
				{
					"name": "TASK-DATED",
					"project": "PROJ-001",
					"subject": "Sprint A",
					"type": "Sprint",
					"status": "Working",
					"is_milestone": 0,
					"exp_start_date": "2026-04-14",
					"exp_end_date": "2026-04-30",
				},
			],
		]
		get_all.side_effect = [[], [], []]

		result = query.get_roadmap_dataset(
			{
				"from_date": "2026-04-10",
				"to_date": "2026-04-20",
				"show_milestones": 1,
				"task_types": ["Sprint"],
			}
		)

		self.assertEqual([row["name"] for row in result["taskEntities"]], ["TASK-DATED"])
