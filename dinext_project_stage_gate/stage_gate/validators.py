import frappe


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
			frappe.throw(f"Duplicate {fieldname} reference: {value}", frappe.ValidationError)
		seen.add(value)


def validate_enabled_links(rows, fieldname, records_by_name, label="Record"):
	for row in rows:
		value = row.get(fieldname)
		if not value:
			continue
		record = records_by_name.get(value)
		if record and not int(record.get("enabled", 0)):
			frappe.throw(f"{label} is disabled: {value}", frappe.ValidationError)


def validate_template_items(items):
	for index, item in enumerate(items, start=1):
		title = (item.get("title") or "").strip()
		if not title:
			frappe.throw(
				f"Stage Gate Template Item row {index} must define a title.",
				frappe.ValidationError,
			)

