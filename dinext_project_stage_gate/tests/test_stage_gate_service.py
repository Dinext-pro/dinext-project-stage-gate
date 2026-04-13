import unittest

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

