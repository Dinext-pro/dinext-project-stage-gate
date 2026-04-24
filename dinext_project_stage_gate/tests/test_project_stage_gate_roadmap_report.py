import sys
import types
import unittest
from unittest.mock import patch

try:
	import frappe  # noqa: F401
except ModuleNotFoundError:
	_frappe_stub = types.ModuleType("frappe")
	_frappe_stub._ = lambda value: value
	sys.modules["frappe"] = _frappe_stub
	_frappe_utils_stub = types.ModuleType("frappe.utils")
	_frappe_utils_stub.add_months = lambda value, months: value
	sys.modules["frappe.utils"] = _frappe_utils_stub

from dinext_project_stage_gate.dinext_project_stage_gate.report.project_stage_gate_roadmap import (
	project_stage_gate_roadmap,
)


class TestProjectStageGateRoadmapReport(unittest.TestCase):
	@patch(
		"dinext_project_stage_gate.dinext_project_stage_gate.report.project_stage_gate_roadmap.project_stage_gate_roadmap.query.get_roadmap_dataset"
	)
	@patch(
		"dinext_project_stage_gate.dinext_project_stage_gate.report.project_stage_gate_roadmap.project_stage_gate_roadmap._",
		side_effect=lambda value: value,
	)
	def test_execute_returns_dataset_in_message_and_summary(self, _translate, get_roadmap_dataset):
		get_roadmap_dataset.return_value = {
			"projects": [{"name": "PROJ-001", "project_name": "Alpha"}],
			"stageBars": [{"name": "PSI-001"}],
			"gates": [{"name": "PGC-001"}],
			"taskEntities": [{"name": "TASK-001"}],
		}

		columns, data, message, chart, report_summary = project_stage_gate_roadmap.execute(
			{"company": "Dinext"}
		)

		self.assertTrue(any(column["fieldname"] == "governance_model" for column in columns))
		self.assertEqual(columns[0]["label"], "Portfolio")
		self.assertEqual(data[0]["project"], "PROJ-001")
		self.assertEqual(message["projects"][0]["name"], "PROJ-001")
		self.assertEqual(message["taskEntities"][0]["name"], "TASK-001")
		self.assertIsNone(chart)
		self.assertEqual(report_summary[0]["value"], 1)
		self.assertEqual(report_summary[0]["label"], "Projects")
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

	@patch(
		"dinext_project_stage_gate.dinext_project_stage_gate.report.project_stage_gate_roadmap.project_stage_gate_roadmap.query.get_roadmap_dataset"
	)
	def test_execute_passes_project_type_and_project_status_filters_to_dataset_query(self, get_roadmap_dataset):
		get_roadmap_dataset.return_value = {
			"projects": [],
			"stageBars": [],
			"gates": [],
			"taskEntities": [],
		}

		project_stage_gate_roadmap.execute(
			{
				"project_type": "Implementation",
				"project_status": "Completed",
			}
		)

		get_roadmap_dataset.assert_called_once_with(
			{
				"project_type": "Implementation",
				"project_status": "Completed",
			}
		)

	@patch(
		"dinext_project_stage_gate.dinext_project_stage_gate.report.project_stage_gate_roadmap.project_stage_gate_roadmap.query.get_roadmap_dataset"
	)
	def test_execute_exposes_applied_filters_from_dataset_message(self, get_roadmap_dataset):
		get_roadmap_dataset.return_value = {
			"projects": [],
			"stageBars": [],
			"gates": [],
			"taskEntities": [],
			"appliedFilters": {
				"show_stages_and_checkpoints": 1,
			},
		}

		_columns, _data, message, _chart, _summary = project_stage_gate_roadmap.execute(
			{"show_stages_and_checkpoints": 0}
		)

		self.assertEqual(message["appliedFilters"]["show_stages_and_checkpoints"], 1)
