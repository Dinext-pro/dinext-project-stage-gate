import json
import unittest
from pathlib import Path
from unittest.mock import patch

import frappe


class TestAppBootstrap(unittest.TestCase):
	def test_stage_workflows_leave_terminal_documents_out_of_new_processes(self):
		from dinext_common.workflow_approval.scenarios import service

		fixtures = Path(__file__).resolve().parents[1] / "fixtures" / "workflow.json"
		workflows = {row["name"]: frappe._dict(row) for row in json.loads(fixtures.read_text())}
		cases = (
			("Project Stage Workflow", ("Completed", "Skipped", "Canceled"), (None, "Planned", "Active")),
			("Project Gate Checkpoint Workflow", ("Approved", "Canceled"), (None, "Draft", "In Review", "Rejected")),
		)
		for name, terminal, still_actionable in cases:
			workflow = workflows[name]
			with patch.object(service, "_definitions", return_value=[workflow]):
				for status in terminal + still_actionable:
					with self.subTest(workflow=name, status=status):
						source = frappe._dict(doctype=workflow.document_type, status=status, docstatus=0)
						self.assertIs(service.select_workflow(source), None if status in terminal else workflow)

	def test_hooks_define_required_apps(self):
		from dinext_project_stage_gate import hooks

		self.assertEqual(hooks.required_apps, ["dinext_common", "dinext_projects"])

	def test_hooks_define_project_assets_and_fixtures(self):
		from dinext_project_stage_gate import hooks

		self.assertEqual(
			hooks.doctype_js["Project"], "public/js/project_stage_gate_project.js"
		)
		self.assertTrue(
			any(
				isinstance(entry, dict)
				and entry.get("doctype") == "Role"
				for entry in hooks.fixtures
			)
		)

		self.assertTrue(
			any(
				isinstance(entry, dict)
				and entry.get("doctype") == "Custom Field"
				and ["module", "=", "Dinext Project Stage Gate"] in entry.get("filters", [])
				for entry in hooks.fixtures
			)
		)
		wf_entries = [
			entry
			for entry in hooks.fixtures
			if isinstance(entry, dict) and entry.get("doctype") == "Workflow"
		]
		self.assertTrue(wf_entries)
		name_filter = next(
			f
			for f in wf_entries[0].get("filters", [])
			if isinstance(f, (list, tuple)) and len(f) >= 3 and f[0] == "name" and f[1] == "in"
		)
		wf_names = name_filter[2]
		self.assertIn("Project Gate Checkpoint Workflow", wf_names)
		self.assertIn("Project Stage Workflow", wf_names)
		self.assertTrue(
			any(
				isinstance(entry, dict)
				and entry.get("doctype") == "Report"
				and ["name", "in", ["Project Stage Gate Roadmap"]]
				in entry.get("filters", [])
				for entry in hooks.fixtures
			)
		)

