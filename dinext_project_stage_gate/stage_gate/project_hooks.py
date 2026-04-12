import frappe
from frappe import _

from dinext_project_stage_gate.stage_gate import service


SUMMARY_FIELDS = (
	"current_stage_instance",
	"current_stage",
	"stage_gate_status",
	"current_gate_result",
)


def validate_project_governance_model_change(doc, method=None):
	if doc.is_new() or not doc.name:
		return

	previous_model = frappe.db.get_value("Project", doc.name, "governance_model")
	if previous_model == doc.governance_model:
		return

	if not _get_stage_instances(doc.name):
		return

	frappe.throw(
		"Cannot change Governance Model after Project Stage Instances have been created.",
		frappe.ValidationError,
	)


def sync_project_stage_chain(doc, method=None):
	if not doc.name:
		return

	if not doc.governance_model:
		return

	stage_instances = _get_stage_instances(doc.name)
	if not stage_instances:
		stage_instances = _create_stage_instances(doc.name, doc.governance_model)

	_update_project_summary(doc.name, stage_instances)


def sync_project_stage_summary_from_instance(doc, method=None):
	if not doc.project:
		return

	_update_project_summary(doc.project, _get_stage_instances(doc.project))


def _create_stage_instances(project_name, governance_model_name):
	governance_model = frappe.get_doc("Project Governance Model", governance_model_name)
	stage_chain = service.build_stage_chain(project_name, governance_model)
	prepared_stage_instances = service.prepare_stage_instances(stage_chain)
	if not prepared_stage_instances:
		frappe.throw(
			_("Project Governance Model must define at least one stage before assigning it to a project."),
			frappe.ValidationError,
		)

	for payload in prepared_stage_instances:
		stage_instance = {
			"doctype": "Project Stage Instance",
			**payload,
			"previous_stage_instance": None,
			"next_stage_instance": None,
		}
		frappe.get_doc(stage_instance).insert(ignore_permissions=True)

	for payload in prepared_stage_instances:
		frappe.db.set_value(
			"Project Stage Instance",
			payload["name"],
			{
				"previous_stage_instance": payload.get("previous_stage_instance"),
				"next_stage_instance": payload.get("next_stage_instance"),
			},
			update_modified=False,
		)

	return _get_stage_instances(project_name)


def _get_stage_instances(project_name):
	return frappe.get_all(
		"Project Stage Instance",
		filters={"project": project_name},
		fields=["name", "stage", "status", "sequence", "gate_result"],
		order_by="sequence asc",
	)


def _update_project_summary(project_name, stage_instances):
	summary = service.compute_project_stage_summary(stage_instances)
	values = {fieldname: summary.get(fieldname) for fieldname in SUMMARY_FIELDS}
	frappe.db.set_value("Project", project_name, values, update_modified=False)
