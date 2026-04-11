import unittest
from types import SimpleNamespace

import frappe

from dinext_project_stage_gate.stage_gate import validators


class TestStageGateValidators(unittest.TestCase):
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

	def test_assign_stage_sequences_uses_row_order_for_missing_values(self):
		rows = [
			{"stage": "Idea", "sequence": None},
			{"stage": "Discovery", "sequence": 7},
			{"stage": "Delivery", "sequence": None},
		]

		sequences = validators.assign_stage_sequences(rows)

		self.assertEqual(sequences, [1, 7, 3])

	def test_validate_unique_stage_references_rejects_duplicates(self):
		rows = [
			{"stage": "Idea", "sequence": 1},
			{"stage": "Idea", "sequence": 2},
		]

		with self.assertRaises(frappe.ValidationError):
			validators.validate_unique_stage_references(rows)

	def test_validate_enabled_links_rejects_disabled_stage(self):
		rows = [{"stage": "Idea"}]

		with self.assertRaises(frappe.ValidationError):
			validators.validate_enabled_links(
				rows,
				"stage",
				{"Idea": {"enabled": 0}},
				label="Stage",
			)

	def test_validate_checklist_template_items_require_title(self):
		items = [{"title": "Gate review"}, {"title": ""}]

		with self.assertRaises(frappe.ValidationError):
			validators.validate_template_items(items)

