import frappe
from frappe.model.rename_doc import rename_doc


DEFAULT_CHECKPOINT_LEVELS = [
	"Stage Exit",
	"Portfolio Review",
	"SteerCo",
	"Finance",
	"Architecture",
]


def backfill_checkpoint_levels_and_names():
	for level in DEFAULT_CHECKPOINT_LEVELS:
		if not frappe.db.exists("Project Gate Checkpoint Level", level):
			frappe.get_doc(
				{
					"doctype": "Project Gate Checkpoint Level",
					"name": level,
					"enabled": 1,
					"description": level,
				}
			).insert(ignore_permissions=True)

	for doctype, old_field in (
		("Project Stage", "stage_name"),
		("Project Governance Model", "model_name"),
		("Stage Gate Template", "template_name"),
	):
		meta = frappe.get_meta(doctype)
		if not meta.has_field(old_field):
			continue

		for row in frappe.get_all(doctype, fields=["name", old_field], limit_page_length=1000):
			old_name = row.get(old_field)
			if not old_name or old_name == row.get("name") or frappe.db.exists(doctype, old_name):
				continue
			rename_doc(doctype, row["name"], old_name, force=True, merge=False, ignore_permissions=True)

	if frappe.get_meta("Stage Gate Template").has_field("gate_level"):
		for row in frappe.get_all(
			"Stage Gate Template", fields=["name", "gate_level"], limit_page_length=1000
		):
			if row.get("gate_level") and frappe.db.exists(
				"Project Gate Checkpoint Level", row["gate_level"]
			):
				frappe.db.set_value(
					"Stage Gate Template",
					row["name"],
					"checkpoint_level",
					row["gate_level"],
					update_modified=False,
				)

	if frappe.get_meta("Project Gate Checkpoint").has_field("level"):
		for row in frappe.get_all(
			"Project Gate Checkpoint", fields=["name", "level"], limit_page_length=1000
		):
			if row.get("level") and frappe.db.exists("Project Gate Checkpoint Level", row["level"]):
				frappe.db.set_value(
					"Project Gate Checkpoint",
					row["name"],
					"checkpoint_level",
					row["level"],
					update_modified=False,
				)

	frappe.db.commit()
	return {
		"levels": DEFAULT_CHECKPOINT_LEVELS,
		"status": "ok",
	}
