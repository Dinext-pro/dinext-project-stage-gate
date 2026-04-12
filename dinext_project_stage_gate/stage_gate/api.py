import frappe

from dinext_project_stage_gate.stage_gate import query

@frappe.whitelist()
def ping():
	return {"status": "ok"}


@frappe.whitelist()
def get_project_stage_chain(project):
	frappe.log("get_project_stage_chain")
	_ensure_permission("Project", doc=project)
	return query.get_project_stage_chain(project)


@frappe.whitelist()
def get_roadmap_dataset(filters=None):
	frappe.log("get_roadmap_dataset")
	_ensure_permission("Project")
	_ensure_permission("Project Stage Instance")
	return query.get_roadmap_dataset(_coerce_filters(filters))


def _coerce_filters(filters):
	if not filters:
		return {}
	if isinstance(filters, str):
		return frappe.parse_json(filters) or {}
	return filters


def _ensure_permission(doctype, doc=None):
	if not frappe.has_permission(doctype, "read", doc=doc):
		frappe.throw(f"Not permitted to read {doctype}", frappe.PermissionError)

