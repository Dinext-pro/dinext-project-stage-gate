import unittest


class TestAppBootstrap(unittest.TestCase):
	def test_hooks_define_required_apps(self):
		from dinext_project_stage_gate import hooks

		self.assertEqual(hooks.required_apps, ["erpnext", "dinext_projects"])

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

