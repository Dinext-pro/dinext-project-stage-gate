import sys
import types
import unittest
from datetime import date

try:
	import frappe  # noqa: F401
except ModuleNotFoundError:
	_frappe_stub = types.ModuleType("frappe")
	_frappe_stub.get_all = None
	_frappe_stub._ = lambda value: value
	_frappe_stub.db = types.SimpleNamespace(get_value=lambda *args, **kwargs: 1)
	sys.modules["frappe"] = _frappe_stub

from unittest.mock import patch

from frappe.utils import add_months

from dinext_project_stage_gate.stage_gate import query


class TestStageGateQuery(unittest.TestCase):
	@patch.object(query.frappe, "get_all")
	@patch.object(query.frappe.db, "get_value", return_value=1)
	def test_get_project_stage_chain_uses_stage_name_from_docname_and_checkpoint_level(
		self, _mock_get_value, get_all
	):
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

		result = query.get_project_stage_chain("PROJ-001")

		self.assertEqual(result[0]["stage_name"], "Discovery")
		self.assertEqual(result[0]["checkpoints"][0]["checkpoint_level"], "Stage Exit")

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	def test_get_roadmap_dataset_returns_checkpoint_level_field(self, get_all, _mock_today):
		get_all.side_effect = [
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
					"full_name": "Administrator",
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

		stage_call = get_all.call_args_list[3]
		self.assertEqual(stage_call.args[0], "Project Stage Instance")
		stage_filters = stage_call.kwargs["filters"]
		t0 = date(2026, 4, 19)
		self.assertEqual(stage_filters["planned_end_date"], [">=", add_months(t0, -6)])
		self.assertEqual(stage_filters["planned_start_date"], ["<=", add_months(t0, 12)])

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	def test_get_roadmap_dataset_active_only_keeps_legacy_inflight_statuses(self, get_all, _mock_today):
		get_all.side_effect = [[], [], []]

		query.get_roadmap_dataset({"active_only": 1})

		project_filters = get_all.call_args_list[0].kwargs["filters"]
		self.assertEqual(
			project_filters["stage_gate_status"],
			["in", ["Active", "Waiting Gate", "Blocked", "Rejected"]],
		)

	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	def test_get_roadmap_dataset_uses_manager_validity_overlap(self, get_all):
		get_all.side_effect = [
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
				{"name": "valid@example.com", "full_name": "Administrator"},
			],
			[],
			[],
		]

		result = query.get_roadmap_dataset({"from_date": "2026-04-10", "to_date": "2026-04-20"})

		self.assertEqual(result["projects"][0]["project_manager"], "Valid Manager")

	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	def test_get_roadmap_dataset_filters_by_valid_manager(self, get_all):
		get_all.side_effect = [
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
				{"name": "pm@example.com", "full_name": "Administrator"},
				{"name": "other@example.com", "full_name": "Administrator"},
			],
			[],
			[],
		]

		result = query.get_roadmap_dataset({"project_manager": "pm@example.com"})

		self.assertEqual([project["name"] for project in result["projects"]], ["PROJ-001"])

	@patch.object(query, "_today", return_value=date(2026, 4, 19))
	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	def test_get_roadmap_dataset_default_range_applies_stage_date_filters(self, get_all, _mock_today):
		get_all.side_effect = [[], [], []]

		query.get_roadmap_dataset({})

		stage_call = get_all.call_args_list[1]
		self.assertEqual(stage_call.args[0], "Project Stage Instance")
		stage_filters = stage_call.kwargs["filters"]
		t0 = date(2026, 4, 19)
		self.assertEqual(stage_filters["planned_end_date"], [">=", add_months(t0, -6)])
		self.assertEqual(stage_filters["planned_start_date"], ["<=", add_months(t0, 12)])
