# Copyright (c) 2026, Dinext and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

def get_checkpoint_template_for_stage(governance_model: str, stage: str) -> str | None:
	if not governance_model or not stage:
		return None

	model = frappe.get_doc("Project Governance Model", governance_model)
	for row in model.get("stages") or []:
		if row.get("stage") == stage:
			return row.get("checkpoint_template") or None
	return None


def build_checklist_rows_from_template_items(template_doc: Document) -> list[dict]:
	rows = []
	for item in template_doc.get("items") or []:
		row = {
			"doctype": "Project Gate Checklist Item",
			"item_title": (item.get("title") or "").strip(),
			"is_mandatory": 1 if int(item.get("is_mandatory", 1) or 0) else 0,
			"status": "Open",
		}
		hint = item.get("evidence_type_hint")
		if hint:
			row["linked_doctype"] = hint
		rows.append(row)
	return rows


def provision_checkpoint_for_stage_instance(stage_instance: Document) -> None:
	"""Create Project Gate Checkpoint from governance model checkpoint_template if set."""
	if not stage_instance.name or not stage_instance.get("project"):
		return

	template_name = get_checkpoint_template_for_stage(
		stage_instance.get("governance_model"),
		stage_instance.get("stage"),
	)
	if not template_name:
		return

	if frappe.db.exists(
		"Project Gate Checkpoint",
		{"stage_instance": stage_instance.name, "gate_template": template_name},
	):
		return

	template = frappe.get_doc("Stage Gate Template", template_name)
	if not int(template.get("enabled") or 0):
		frappe.throw(
			_("Stage Gate Template is disabled: {0}").format(template_name),
			frappe.ValidationError,
		)

	items = template.get("items") or []
	if not items:
		frappe.throw(
			_("Stage Gate Template {0} must have at least one checklist item.").format(template_name),
			frappe.ValidationError,
		)

	checklist_rows = build_checklist_rows_from_template_items(template)
	for index, row in enumerate(checklist_rows, start=1):
		title = (row.get("item_title") or "").strip()
		if not title:
			frappe.throw(
				_("Stage Gate Template Item row {0} must define a title.").format(index),
				frappe.ValidationError,
			)

	checkpoint_name = f"{stage_instance.name}-GATE"
	if frappe.db.exists("Project Gate Checkpoint", checkpoint_name):
		frappe.throw(
			_("Project Gate Checkpoint {0} already exists.").format(checkpoint_name),
			frappe.ValidationError,
		)

	doc_dict = {
		"doctype": "Project Gate Checkpoint",
		"name": checkpoint_name,
		"project": stage_instance.project,
		"stage_instance": stage_instance.name,
		"gate_template": template_name,
		"checkpoint_level": template.checkpoint_level,
		"checklist": checklist_rows,
	}

	checkpoint = frappe.get_doc(doc_dict)
	checkpoint.insert(ignore_permissions=True)
