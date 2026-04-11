import unittest
from unittest.mock import patch

from dinext_project_stage_gate.dinext_project_stage_gate.report.project_stage_gate_roadmap import (
	project_stage_gate_roadmap,
)


class TestProjectStageGateRoadmapReport(unittest.TestCase):
	@patch(
		"dinext_project_stage_gate.dinext_project_stage_gate.report.project_stage_gate_roadmap.project_stage_gate_roadmap.query.get_roadmap_dataset"
	)
	def test_execute_returns_dataset_in_message_and_summary(self, get_roadmap_dataset):
		get_roadmap_dataset.return_value = {
			"projects": [{"name": "PROJ-001", "project_name": "Alpha"}],
			"stageBars": [{"name": "PSI-001"}],
			"gates": [{"name": "PGC-001"}],
		}

		columns, data, message, chart, report_summary = project_stage_gate_roadmap.execute(
			{"company": "Dinext"}
		)

		self.assertTrue(any(column["fieldname"] == "governance_model" for column in columns))
		self.assertEqual(data[0]["project"], "PROJ-001")
		self.assertEqual(message["projects"][0]["name"], "PROJ-001")
		self.assertIsNone(chart)
		self.assertEqual(report_summary[0]["value"], 1)
		get_roadmap_dataset.assert_called_once_with({"company": "Dinext"})

	def test_build_rows_includes_project_manager_and_governance_model(self):
		rows = project_stage_gate_roadmap.build_rows(
			{
				"projects": [
					{
						"name": "PROJ-001",
						"project_name": "Alpha",
						"company": "Dinext",
						"customer": "Customer A",
						"project_manager": "pm@example.com",
						"custom_project_portfolio": "Portfolio A",
						"governance_model": "Standard",
						"current_stage": "Discovery",
						"stage_gate_status": "Active",
					}
				],
				"stageBars": [],
				"gates": [],
			}
		)

		self.assertEqual(rows[0]["project_manager"], "pm@example.com")
		self.assertEqual(rows[0]["governance_model"], "Standard")
