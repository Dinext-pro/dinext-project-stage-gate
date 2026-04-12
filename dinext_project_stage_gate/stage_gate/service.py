def ping():
	return "stage-gate-service"


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
				"status": "Active" if index == 1 else "Planned",
				"gate_result": None,
			}
		)
	return chain


def prepare_stage_instances(stage_chain):
	prepared = []
	for index, row in enumerate(stage_chain, start=1):
		item = dict(row)
		sequence = int(item.get("sequence") or index)
		item["sequence"] = sequence
		item["name"] = _build_stage_instance_name(item.get("project"), index)
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
			if row.get("status") in {"Active", "Waiting Gate", "Rejected", "Blocked"}
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


def _build_stage_instance_name(project, position):
	return f"{project}-STAGE-{int(position):03d}"

