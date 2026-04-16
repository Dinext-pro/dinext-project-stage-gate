import sys
import types
import unittest

try:
	import frappe  # noqa: F401
except ModuleNotFoundError:
	_frappe_stub = types.SimpleNamespace(get_all=None)
	_frappe_stub.db = types.SimpleNamespace(get_value=lambda *args, **kwargs: 1)
	sys.modules["frappe"] = _frappe_stub

from unittest.mock import patch

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

	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	def test_get_roadmap_dataset_returns_checkpoint_level_field(self, get_all):
		get_all.side_effect = [
			[
				{
					"name": "PROJ-001",
					"project_name": "Alpha",
					"company": "Dinext",
					"customer": "Customer A",
					"project_manager": "pm@example.com",
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

	@patch("dinext_project_stage_gate.stage_gate.query.frappe.get_all")
	def test_get_roadmap_dataset_active_only_keeps_legacy_inflight_statuses(self, get_all):
		get_all.side_effect = [[], [], []]

		query.get_roadmap_dataset({"active_only": 1})

		project_filters = get_all.call_args_list[0].kwargs["filters"]
		self.assertEqual(
			project_filters["stage_gate_status"],
			["in", ["Active", "Waiting Gate", "Blocked", "Rejected"]],
		)
