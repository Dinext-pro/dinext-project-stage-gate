import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch

from dinext_project_stage_gate.stage_gate import service


class TestStageGateService(unittest.TestCase):
	def test_build_stage_chain_marks_first_stage_active(self):
		model = {
			"name": "MODEL-001",
			"stages": [
				{"stage": "Idea", "sequence": 1},
				{"stage": "Discovery", "sequence": 2},
			],
		}

		chain = service.build_stage_chain(project="PROJ-001", governance_model=model)

		self.assertEqual(len(chain), 2)
		self.assertEqual(chain[0]["status"], "Active")
		self.assertEqual(chain[1]["status"], "Planned")
		self.assertEqual(chain[0]["project"], "PROJ-001")
		self.assertEqual(chain[0]["governance_model"], "MODEL-001")

	def test_compute_project_stage_summary_prefers_active_stage(self):
		stages = [
			{"name": "PSI-001", "stage": "Idea", "status": "Completed", "gate_result": "Approved"},
			{"name": "PSI-002", "stage": "Discovery", "status": "Active", "gate_result": None},
		]

		summary = service.compute_project_stage_summary(stages)

		self.assertEqual(summary["current_stage_instance"], "PSI-002")
		self.assertEqual(summary["current_stage"], "Discovery")
		self.assertEqual(summary["stage_gate_status"], "Active")

	def test_compute_project_stage_summary_prefers_canceled_stage_over_later_planned_stage(self):
		stages = [
			{"name": "PSI-001", "stage": "Idea", "status": "Completed", "gate_result": "Approved"},
			{"name": "PSI-002", "stage": "Discovery", "status": "Canceled", "gate_result": None},
			{"name": "PSI-003", "stage": "Delivery", "status": "Planned", "gate_result": None},
		]

		summary = service.compute_project_stage_summary(stages)

		self.assertEqual(summary["current_stage_instance"], "PSI-002")
		self.assertEqual(summary["current_stage"], "Discovery")
		self.assertEqual(summary["stage_gate_status"], "Canceled")

	def test_advance_stage_chain_activates_next_stage(self):
		stages = [
			{"name": "PSI-001", "stage": "Idea", "status": "Waiting Gate", "gate_result": "Approved"},
			{"name": "PSI-002", "stage": "Discovery", "status": "Planned", "gate_result": None},
		]

		updated = service.advance_stage_chain(stages, current_stage_name="PSI-001")

		self.assertEqual(updated[0]["status"], "Completed")
		self.assertEqual(updated[1]["status"], "Active")

	def test_prepare_stage_instances_assigns_deterministic_names_and_links(self):
		chain = [
			{"project": "PROJ-001", "stage": "Idea", "sequence": 1, "status": "Active"},
			{"project": "PROJ-001", "stage": "Discovery", "sequence": 2, "status": "Planned"},
		]

		prepared = service.prepare_stage_instances(chain)

		self.assertEqual(prepared[0]["name"], "PROJ-001-STAGE-001")
		self.assertEqual(prepared[1]["name"], "PROJ-001-STAGE-002")
		self.assertIsNone(prepared[0]["previous_stage_instance"])
		self.assertEqual(prepared[0]["next_stage_instance"], "PROJ-001-STAGE-002")
		self.assertEqual(prepared[1]["previous_stage_instance"], "PROJ-001-STAGE-001")
		self.assertIsNone(prepared[1]["next_stage_instance"])

	def test_prepare_stage_instances_chain_version_two_prefixes_names(self):
		chain = [
			{"project": "PROJ-001", "stage": "Idea", "sequence": 1, "status": "Active"},
		]
		prepared = service.prepare_stage_instances(chain, chain_version=2)
		self.assertEqual(prepared[0]["name"], "PROJ-001-SG2-STAGE-001")
		self.assertEqual(prepared[0]["stage_chain_version"], 2)

	def test_cancel_stage_gate_chain_updates_checkpoints_via_document_api(self):
		checkpoint = SimpleNamespace(
			checklist=[
				SimpleNamespace(status="Open"),
				SimpleNamespace(status="Done"),
			]
		)
		checkpoint.save = MagicMock()

		with (
			patch.object(service.frappe, "get_all", side_effect=[["PSI-001"], ["CP-001"]]),
			patch.object(service.frappe, "get_doc", return_value=checkpoint) as get_doc,
			patch.object(service.frappe.db, "set_value") as set_value,
			patch.object(service.frappe.db, "sql") as sql,
		):
			service.cancel_stage_gate_chain("PROJ-001", 1)

		get_doc.assert_called_once_with("Project Gate Checkpoint", "CP-001")
		self.assertEqual([row.status for row in checkpoint.checklist], ["Canceled", "Canceled"])
		checkpoint.save.assert_called_once_with(ignore_permissions=True)
		sql.assert_not_called()
		set_value.assert_has_calls(
			[
				call("Project Gate Checkpoint", "CP-001", "status", "Canceled", update_modified=True),
				call("Project Stage Instance", "PSI-001", "status", "Canceled", update_modified=True),
			]
		)

