import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import patch

try:
	import frappe  # noqa: F401
except ModuleNotFoundError:
	_frappe_stub = types.ModuleType("frappe")
	_frappe_stub._ = lambda value: value
	_frappe_stub.PermissionError = type("PermissionError", (Exception,), {})
	_frappe_stub.ValidationError = type("ValidationError", (Exception,), {})
	_frappe_stub.local = SimpleNamespace()
	_frappe_stub.get_all = None
	_frappe_stub.get_list = None
	_frappe_stub.db = SimpleNamespace(get_value=lambda *args, **kwargs: 1)

	def _throw(message, exc=None):
		exc_type = exc or Exception
		raise exc_type(message)

	_frappe_stub.throw = _throw
	sys.modules["frappe"] = _frappe_stub
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

	@patch(
		"dinext_project_stage_gate.stage_gate.validators._",
		side_effect=lambda message: f"TR:{message}",
		create=True,
	)
	def test_validate_unique_stage_references_uses_translatable_english_source(self, translate):
		rows = [
			{"stage": "Idea", "sequence": 1},
			{"stage": "Idea", "sequence": 2},
		]

		with self.assertRaisesRegex(
			frappe.ValidationError, r"TR:Duplicate stage reference: Idea"
		):
			validators.validate_unique_stage_references(rows)

		translate.assert_called_once_with("Duplicate {0} reference: {1}")

	@patch(
		"dinext_project_stage_gate.stage_gate.validators._",
		side_effect=lambda message: f"TR:{message}",
		create=True,
	)
	def test_validate_enabled_links_uses_translatable_english_source(self, translate):
		rows = [{"stage": "Idea"}]

		with self.assertRaisesRegex(frappe.ValidationError, r"TR:Stage is disabled: Idea"):
			validators.validate_enabled_links(
				rows,
				"stage",
				{"Idea": {"enabled": 0}},
				label="Stage",
			)

		translate.assert_called_once_with("{0} is disabled: {1}")

	@patch(
		"dinext_project_stage_gate.stage_gate.validators._",
		side_effect=lambda message: f"TR:{message}",
		create=True,
	)
	def test_validate_template_items_uses_translatable_english_source(self, translate):
		items = [{"title": ""}]

		with self.assertRaisesRegex(
			frappe.ValidationError,
			r"TR:Stage Gate Template Item row 1 must define a title\.",
		):
			validators.validate_template_items(items)

		translate.assert_called_once_with(
			"Stage Gate Template Item row {0} must define a title."
		)

