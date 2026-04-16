import frappe


def _get(row, key, default=None):
	if isinstance(row, dict):
		return row.get(key, default)
	return row.get(key, default) if hasattr(row, "get") else getattr(row, key, default)


def _project_fields(include_project_manager=False):
	fields = [
		"name",
		"project_name",
		"company",
		"customer",
		"custom_project_portfolio",
		"governance_model",
		"stage_chain_version",
		"current_stage",
		"stage_gate_status",
	]
	if include_project_manager:
		fields.insert(4, "project_manager")
	return fields


def ping():
	return "stage-gate-query"


def get_project_stage_chain(project_name):
	active_ver = int(frappe.db.get_value("Project", project_name, "stage_chain_version") or 1)
	stage_rows = frappe.get_all(
		"Project Stage Instance",
		filters={"project": project_name, "stage_chain_version": active_ver},
		fields=[
			"name",
			"stage",
			"status",
			"sequence",
			"gate_result",
			"planned_start_date",
			"planned_end_date",
			"actual_start_date",
			"actual_end_date",
			"gate_due_date",
		],
		order_by="sequence asc",
	)

	stage_names = [_get(row, "stage") for row in stage_rows if _get(row, "stage")]
	stage_meta = {
		_get(row, "name"): row
		for row in frappe.get_all(
			"Project Stage",
			filters={"name": ["in", stage_names]} if stage_names else {},
			fields=["name", "color", "icon", "is_gate_required"],
		)
	}

	checkpoint_rows = frappe.get_all(
		"Project Gate Checkpoint",
		filters={"project": project_name, "stage_chain_version": active_ver},
		fields=[
			"name",
			"stage_instance",
			"status",
			"checkpoint_level",
			"approval_date",
			"decision_comment",
		],
		order_by="creation asc",
	)

	checkpoints_by_stage = {}
	for checkpoint in checkpoint_rows:
		checkpoints_by_stage.setdefault(_get(checkpoint, "stage_instance"), []).append(checkpoint)

	return [
		{
			**row,
			"stage_name": _get(stage_meta.get(_get(row, "stage"), {}), "name", _get(row, "stage")),
			"color": _get(stage_meta.get(_get(row, "stage"), {}), "color"),
			"icon": _get(stage_meta.get(_get(row, "stage"), {}), "icon"),
			"is_gate_required": _get(stage_meta.get(_get(row, "stage"), {}), "is_gate_required", 0),
			"checkpoints": checkpoints_by_stage.get(_get(row, "name"), []),
		}
		for row in stage_rows
	]


def get_roadmap_dataset(filters=None):
	filters = filters or {}
	project_filters = {}
	include_project_manager = False
	if filters.get("company"):
		project_filters["company"] = filters["company"]
	if filters.get("portfolio"):
		project_filters["custom_project_portfolio"] = filters["portfolio"]
	if filters.get("customer"):
		project_filters["customer"] = filters["customer"]
	if filters.get("project"):
		project_filters["name"] = filters["project"]
	if filters.get("project_manager"):
		project_filters["project_manager"] = filters["project_manager"]
		include_project_manager = True
	if filters.get("governance_model"):
		project_filters["governance_model"] = filters["governance_model"]
	if filters.get("active_only"):
		project_filters["stage_gate_status"] = ["in", ["Active", "Waiting Gate", "Blocked", "Rejected"]]

	try:
		project_rows = frappe.get_all(
			"Project",
			filters=project_filters,
			fields=_project_fields(include_project_manager=include_project_manager),
			order_by="custom_project_portfolio asc, project_name asc",
		)
	except Exception as exc:
		if "Unknown column 'project_manager'" not in str(exc):
			raise
		project_filters.pop("project_manager", None)
		project_rows = frappe.get_all(
			"Project",
			filters=project_filters,
			fields=_project_fields(include_project_manager=False),
			order_by="custom_project_portfolio asc, project_name asc",
		)
	project_meta = {_get(row, "name"): row for row in project_rows}

	project_names = [_get(row, "name") for row in project_rows]
	stage_filters = {"project": ["in", project_names]} if project_names else {"project": ["in", [""]]}
	if filters.get("from_date"):
		stage_filters["planned_end_date"] = [">=", filters["from_date"]]
	if filters.get("to_date"):
		stage_filters["planned_start_date"] = ["<=", filters["to_date"]]
	stage_rows = frappe.get_all(
		"Project Stage Instance",
		filters=stage_filters,
		fields=[
			"name",
			"project",
			"stage",
			"status",
			"sequence",
			"stage_chain_version",
			"planned_start_date",
			"planned_end_date",
			"actual_start_date",
			"actual_end_date",
			"gate_due_date",
			"gate_result",
		],
		order_by="project asc, sequence asc",
	)
	filtered_stage_rows = []
	for row in stage_rows:
		project = project_meta.get(_get(row, "project"), {})
		want_ver = int(_get(project, "stage_chain_version") or 1)
		if int(_get(row, "stage_chain_version") or 1) != want_ver:
			continue
		row["project_name"] = _get(project, "project_name") or _get(row, "project")
		row["portfolio"] = _get(project, "custom_project_portfolio")
		filtered_stage_rows.append(row)
	stage_rows = filtered_stage_rows
	stage_instance_names = [_get(row, "name") for row in stage_rows]
	gate_rows = frappe.get_all(
		"Project Gate Checkpoint",
		filters={"stage_instance": ["in", stage_instance_names]}
		if stage_instance_names
		else {"stage_instance": ["in", [""]]},
		fields=[
			"name",
			"project",
			"stage_instance",
			"status",
			"approval_date",
			"checkpoint_level",
		],
		order_by="project asc, creation asc",
	)
	for row in gate_rows:
		project = project_meta.get(_get(row, "project"), {})
		row["project_name"] = _get(project, "project_name") or _get(row, "project")
		row["portfolio"] = _get(project, "custom_project_portfolio")

	return {
		"projects": project_rows,
		"stageBars": stage_rows,
		"gates": gate_rows,
	}

