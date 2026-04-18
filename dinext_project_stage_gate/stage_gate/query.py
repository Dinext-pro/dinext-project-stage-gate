from datetime import date

import frappe

PROJECT_MANAGER_ROLE = "Руководитель проекта"


def _get(row, key, default=None):
	if isinstance(row, dict):
		return row.get(key, default)
	return row.get(key, default) if hasattr(row, "get") else getattr(row, key, default)


def _project_fields():
	return [
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


def _getdate(value):
	utils = getattr(frappe, "utils", None)
	if utils and hasattr(utils, "getdate"):
		return utils.getdate(value)
	if isinstance(value, date):
		return value
	return date.fromisoformat(str(value))


def _today():
	utils = getattr(frappe, "utils", None)
	if utils and hasattr(utils, "today"):
		return _getdate(utils.today())
	return date.today()


def _resolve_report_range(filters):
	from_date = _getdate(filters.get("from_date")) if filters.get("from_date") else None
	to_date = _getdate(filters.get("to_date")) if filters.get("to_date") else None
	today_date = _today()

	if from_date is None and to_date is None:
		return today_date, today_date

	range_start = from_date or today_date
	range_end = to_date or today_date
	if range_start > range_end:
		range_start, range_end = range_end, range_start
	return range_start, range_end


def _intervals_overlap(valid_from, valid_for, range_start, range_end):
	start = _getdate(valid_from) if valid_from else None
	end = _getdate(valid_for) if valid_for else None
	return (start is None or start <= range_end) and (end is None or end >= range_start)


def _get_project_team_rows(project_names):
	if not project_names:
		return []
	return frappe.get_all(
		"Project Team Details",
		filters={"parent": ["in", project_names], "pt_role": PROJECT_MANAGER_ROLE},
		fields=[
			"parent",
			"pt_participant",
			"pt_participant_type",
			"pt_valid_from",
			"pt_valid_for",
			"idx",
			"creation",
		],
		order_by="parent asc, idx asc, creation asc",
	)


def _get_user_display_names(user_ids):
	if not user_ids:
		return {}
	return {
		_get(row, "name"): _get(row, "full_name") or _get(row, "name")
		for row in frappe.get_all(
			"User",
			filters={"name": ["in", list(user_ids)]},
			fields=["name", "full_name"],
		)
	}


def _resolve_project_managers(project_names, range_start, range_end):
	team_rows = _get_project_team_rows(project_names)
	valid_rows = [
		row
		for row in team_rows
		if _intervals_overlap(
			_get(row, "pt_valid_from"),
			_get(row, "pt_valid_for"),
			range_start,
			range_end,
		)
	]
	user_ids = {
		_get(row, "pt_participant")
		for row in valid_rows
		if _get(row, "pt_participant_type") == "User" and _get(row, "pt_participant")
	}
	user_names = _get_user_display_names(user_ids)

	project_managers = {project_name: [] for project_name in project_names}
	project_manager_users = {project_name: set() for project_name in project_names}
	seen_labels = {project_name: set() for project_name in project_names}

	for row in valid_rows:
		project_name = _get(row, "parent")
		participant = _get(row, "pt_participant")
		participant_type = _get(row, "pt_participant_type")
		if not project_name or not participant:
			continue

		if participant_type == "User":
			label = user_names.get(participant) or participant
			project_manager_users.setdefault(project_name, set()).add(participant)
		else:
			label = participant

		if label in seen_labels.setdefault(project_name, set()):
			continue
		seen_labels[project_name].add(label)
		project_managers.setdefault(project_name, []).append(label)

	return project_managers, project_manager_users


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
	range_start, range_end = _resolve_report_range(filters)
	project_filters = {}
	if filters.get("company"):
		project_filters["company"] = filters["company"]
	if filters.get("portfolio"):
		project_filters["custom_project_portfolio"] = filters["portfolio"]
	if filters.get("customer"):
		project_filters["customer"] = filters["customer"]
	if filters.get("project"):
		project_filters["name"] = filters["project"]
	if filters.get("governance_model"):
		project_filters["governance_model"] = filters["governance_model"]
	if filters.get("active_only"):
		project_filters["stage_gate_status"] = ["in", ["Active", "Waiting Gate", "Blocked", "Rejected"]]

	project_rows = frappe.get_all(
		"Project",
		filters=project_filters,
		fields=_project_fields(),
		order_by="custom_project_portfolio asc, project_name asc",
	)
	project_names = [_get(row, "name") for row in project_rows]
	project_managers, project_manager_users = _resolve_project_managers(project_names, range_start, range_end)

	selected_project_manager = filters.get("project_manager")
	if selected_project_manager:
		project_rows = [
			row
			for row in project_rows
			if selected_project_manager in project_manager_users.get(_get(row, "name"), set())
		]
		project_names = [_get(row, "name") for row in project_rows]

	for row in project_rows:
		labels = project_managers.get(_get(row, "name"), [])
		row["project_manager"] = ", ".join(labels) if labels else None

	project_meta = {_get(row, "name"): row for row in project_rows}
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

