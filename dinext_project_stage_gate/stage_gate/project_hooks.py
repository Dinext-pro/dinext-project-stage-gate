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

	old_ver = int(frappe.db.get_value("Project", doc.name, "stage_chain_version") or 1)
	if not _chain_has_stage_instances(doc.name, old_ver):
		return

	if not int(doc.get("confirm_governance_reset") or 0):
		frappe.throw(
			_(
				"Changing or clearing Governance Model will cancel the current stage gate chain "
				"(stage instances, checkpoints, and checklist items). "
				"Confirm in the dialog on the Project form, then save again."
			),
			frappe.ValidationError,
		)


def before_save_project_governance_reset(doc, method=None):
	if doc.is_new():
		if not int(doc.get("stage_chain_version") or 0):
			doc.stage_chain_version = 1
		return

	old_model = frappe.db.get_value("Project", doc.name, "governance_model")
	new_model = doc.governance_model
	if old_model == new_model:
		doc.confirm_governance_reset = 0
		return

	old_ver = int(frappe.db.get_value("Project", doc.name, "stage_chain_version") or 1)
	if not _chain_has_stage_instances(doc.name, old_ver):
		return

	if not int(doc.get("confirm_governance_reset") or 0):
		return

	service.cancel_stage_gate_chain(doc.name, old_ver)
	doc.stage_chain_version = old_ver + 1
	doc.confirm_governance_reset = 0

	_clear_project_summary_on_doc(doc)


def sync_project_stage_chain(doc, method=None):
	if not doc.name:
		return

	chain_ver = int(doc.get("stage_chain_version") or frappe.db.get_value("Project", doc.name, "stage_chain_version") or 1)

	if not doc.governance_model:
		return

	stage_instances = _get_stage_instances(doc.name, chain_ver)
	if not stage_instances:
		stage_instances = _create_stage_instances(doc.name, doc.governance_model, chain_ver)

	_update_project_summary(doc.name, stage_instances)


def sync_project_stage_summary_from_instance(doc, method=None):
	if not doc.project:
		return

	active_ver = int(frappe.db.get_value("Project", doc.project, "stage_chain_version") or 1)
	if int(doc.get("stage_chain_version") or 1) != active_ver:
		return

	_update_project_summary(doc.project, _get_stage_instances(doc.project, active_ver))


def _chain_has_stage_instances(project_name, chain_version):
	return bool(
		frappe.db.exists(
			"Project Stage Instance",
			{"project": project_name, "stage_chain_version": int(chain_version or 1)},
		)
	)


def _clear_project_summary_on_doc(doc):
	for fieldname in SUMMARY_FIELDS:
		doc.set(fieldname, None)


def _create_stage_instances(project_name, governance_model_name, chain_version):
	governance_model = frappe.get_doc("Project Governance Model", governance_model_name)
	stage_chain = service.build_stage_chain(project_name, governance_model)
	prepared_stage_instances = service.prepare_stage_instances(stage_chain, chain_version=chain_version)
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

	return _get_stage_instances(project_name, chain_version)


def _get_stage_instances(project_name, chain_version):
	chain_version = int(chain_version or 1)
	return frappe.get_all(
		"Project Stage Instance",
		filters={"project": project_name, "stage_chain_version": chain_version},
		fields=["name", "stage", "status", "sequence", "gate_result"],
		order_by="sequence asc",
	)


def _update_project_summary(project_name, stage_instances):
	summary = service.compute_project_stage_summary(stage_instances)
	values = {fieldname: summary.get(fieldname) for fieldname in SUMMARY_FIELDS}
	frappe.db.set_value("Project", project_name, values, update_modified=False)
