import unittest
from unittest.mock import patch
from types import SimpleNamespace

import frappe

from dinext_project_stage_gate.stage_gate import api


class TestStageGateApi(unittest.TestCase):
	def setUp(self):
		self.original_flags = getattr(frappe.local, "flags", None)
		frappe.local.flags = SimpleNamespace(in_test=True, mute_messages=True)

	def tearDown(self):
		if self.original_flags is None:
			try:
				del frappe.local.flags
			except AttributeError:
				pass
		else:
			frappe.local.flags = self.original_flags

	@patch("dinext_project_stage_gate.stage_gate.api.query.get_project_stage_chain")
	@patch("dinext_project_stage_gate.stage_gate.api.frappe.has_permission", return_value=True)
	def test_get_project_stage_chain_returns_message(
		self, has_permission, get_project_stage_chain
	):
		get_project_stage_chain.return_value = [{"name": "PSI-001"}]

		result = api.get_project_stage_chain("PROJ-001")

		self.assertEqual(result, [{"name": "PSI-001"}])
		has_permission.assert_called_once_with("Project", "read", doc="PROJ-001")
		get_project_stage_chain.assert_called_once_with("PROJ-001")

	@patch("dinext_project_stage_gate.stage_gate.api.query.get_roadmap_dataset")
	@patch("dinext_project_stage_gate.stage_gate.api.frappe.has_permission", return_value=True)
	def test_get_roadmap_dataset_returns_query_result(
		self, has_permission, get_roadmap_dataset
	):
		get_roadmap_dataset.return_value = {"projects": [], "stageBars": [], "gates": []}

		result = api.get_roadmap_dataset({"company": "Dinext"})

		self.assertEqual(result["projects"], [])
		get_roadmap_dataset.assert_called_once_with({"company": "Dinext"})
		self.assertEqual(has_permission.call_count, 2)

	@patch("dinext_project_stage_gate.stage_gate.api.query.get_roadmap_dataset")
	@patch("dinext_project_stage_gate.stage_gate.api.frappe.parse_json", return_value={"active_only": 1})
	@patch("dinext_project_stage_gate.stage_gate.api.frappe.has_permission", return_value=True)
	def test_get_roadmap_dataset_parses_json_filters(
		self, has_permission, parse_json, get_roadmap_dataset
	):
		get_roadmap_dataset.return_value = {"projects": [], "stageBars": [], "gates": []}

		api.get_roadmap_dataset('{"active_only": 1}')

		parse_json.assert_called_once_with('{"active_only": 1}')
		get_roadmap_dataset.assert_called_once_with({"active_only": 1})

	@patch("dinext_project_stage_gate.stage_gate.api.frappe.has_permission", return_value=False)
	def test_get_project_stage_chain_requires_read_permission(self, has_permission):
		with self.assertRaises(frappe.PermissionError):
			api.get_project_stage_chain("PROJ-001")

		has_permission.assert_called_once_with("Project", "read", doc="PROJ-001")

