import frappe
from frappe import _


def assign_stage_sequences(rows):
	sequences = []
	for index, row in enumerate(rows, start=1):
		sequence = row.get("sequence")
		sequences.append(sequence if sequence else index)
	return sequences


def validate_unique_stage_references(rows, fieldname="stage"):
	seen = set()
	for row in rows:
		value = row.get(fieldname)
		if not value:
			continue
		if value in seen:
			frappe.throw(
				_("Duplicate {0} reference: {1}").format(fieldname, value),
				frappe.ValidationError,
			)
		seen.add(value)


def validate_enabled_links(rows, fieldname, records_by_name, label="Record"):
	for row in rows:
		value = row.get(fieldname)
		if not value:
			continue
		record = records_by_name.get(value)
		if record and not int(record.get("enabled", 0)):
			frappe.throw(
				_("{0} is disabled: {1}").format(label, value),
				frappe.ValidationError,
			)


def validate_template_items(items):
	for index, item in enumerate(items, start=1):
		title = (item.get("title") or "").strip()
		if not title:
			frappe.throw(
				_("Stage Gate Template Item row {0} must define a title.").format(index),
				frappe.ValidationError,
			)

