import frappe
from frappe import _

from dinext_project_stage_gate.stage_gate import portfolio_grid, query

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


@frappe.whitelist()
def get_portfolio_project_grid(portfolio):
	return {
		"rows": portfolio_grid.get_portfolio_project_rows(portfolio),
	}


@frappe.whitelist()
def get_unassigned_projects():
	_ensure_permission("Project")
	return {
		"projects": portfolio_grid.get_unassigned_projects(),
	}


@frappe.whitelist()
def add_projects_to_portfolio(portfolio, projects):
	return portfolio_grid.add_projects_to_portfolio(portfolio, _coerce_list(projects))


@frappe.whitelist()
def remove_projects_from_portfolio(portfolio, projects):
	return portfolio_grid.remove_projects_from_portfolio(portfolio, _coerce_list(projects))


def _coerce_filters(filters):
	if not filters:
		return {}
	if isinstance(filters, str):
		return frappe.parse_json(filters) or {}
	return filters


def _coerce_list(values):
	if not values:
		return []
	if isinstance(values, str):
		parsed = frappe.parse_json(values)
		if isinstance(parsed, list):
			return parsed
		return [values]
	if isinstance(values, (list, tuple, set)):
		return [value for value in values if value]
	return [values]


def _ensure_permission(doctype, doc=None):
	if not frappe.has_permission(doctype, "read", doc=doc):
		frappe.throw(
			_("Not permitted to read {0}").format(doctype),
			frappe.PermissionError,
		)

