import frappe


def ping():
	return "stage-gate-service"


CURRENT_STAGE_STATUSES = {"Active", "Canceled", "Waiting Gate", "Rejected", "Blocked"}


def build_stage_chain(project, governance_model):
	stage_rows = sorted(governance_model.get("stages", []), key=lambda row: row.get("sequence") or 0)
	chain = []
	for index, row in enumerate(stage_rows, start=1):
		chain.append(
			{
				"project": project,
				"governance_model": governance_model.get("name"),
				"stage": row.get("stage"),
				"sequence": row.get("sequence") or index,
				#"status": "Active" if index == 1 else "Planned",
				"gate_result": None,
				"entry_criteria_text": row.get("entry_criteria_text"),
				"exit_criteria_text": row.get("exit_criteria_text"),
			}
		)
	return chain


def prepare_stage_instances(stage_chain, chain_version=1):
	chain_version = int(chain_version or 1)
	prepared = []
	for index, row in enumerate(stage_chain, start=1):
		item = dict(row)
		sequence = int(item.get("sequence") or index)
		item["sequence"] = sequence
		item["stage_chain_version"] = chain_version
		item["name"] = build_stage_instance_name(item.get("project"), index, chain_version)
		prepared.append(item)

	for index, row in enumerate(prepared):
		row["previous_stage_instance"] = prepared[index - 1]["name"] if index > 0 else None
		row["next_stage_instance"] = prepared[index + 1]["name"] if index + 1 < len(prepared) else None

	return prepared


def compute_project_stage_summary(stage_instances):
	current = next(
		(
			row
			for row in stage_instances
			if row.get("status") in CURRENT_STAGE_STATUSES
		),
		stage_instances[-1] if stage_instances else {},
	)
	return {
		"current_stage_instance": current.get("name"),
		"current_stage": current.get("stage"),
		"stage_gate_status": current.get("status"),
		"current_gate_result": current.get("gate_result"),
	}


def advance_stage_chain(stage_instances, current_stage_name):
	updated = [dict(row) for row in stage_instances]
	for index, row in enumerate(updated):
		if row.get("name") != current_stage_name:
			continue
		row["status"] = "Completed"
		if index + 1 < len(updated):
			updated[index + 1]["status"] = "Active"
		break
	return updated


def build_stage_instance_name(project, position, chain_version=1):
	chain_version = int(chain_version or 1)
	pos = int(position)
	if chain_version <= 1:
		return f"{project}-STAGE-{pos:03d}"
	return f"{project}-SG{chain_version}-STAGE-{pos:03d}"


def cancel_stage_gate_chain(project: str, chain_version: int) -> None:
	"""Cancel checkpoints (and checklist rows) and stage instances for one chain version."""
	chain_version = int(chain_version or 1)
	psi_names = frappe.get_all(
		"Project Stage Instance",
		filters={"project": project, "stage_chain_version": chain_version},
		pluck="name",
	)
	if not psi_names:
		return

	cp_names = frappe.get_all(
		"Project Gate Checkpoint",
		filters={"stage_instance": ["in", psi_names]},
		pluck="name",
	)
	user = frappe.session.user
	now = frappe.utils.now()
	for cp in cp_names:
		frappe.db.sql(
			"""
			update `tabProject Gate Checklist Item`
			set status='Canceled', modified=%(now)s, modified_by=%(user)s
			where parenttype=%(pt)s and parent=%(parent)s
			""",
			{"now": now, "user": user, "pt": "Project Gate Checkpoint", "parent": cp},
		)
		frappe.db.set_value("Project Gate Checkpoint", cp, "status", "Canceled", update_modified=True)

	for psi in psi_names:
		frappe.db.set_value("Project Stage Instance", psi, "status", "Canceled", update_modified=True)
