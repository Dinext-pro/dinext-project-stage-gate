from datetime import date

import frappe
from frappe.utils import add_months

DEFAULT_PROJECT_MANAGER_ROLE = "Руководитель проекта"


def _get(row, key, default=None):
	if isinstance(row, dict):
		return row.get(key, default)
	return row.get(key, default) if hasattr(row, "get") else getattr(row, key, default)


def _project_fields():
	return [
		"name",
		"project_name",
		"project_type",
		"status",
		"company",
		"customer",
		"expected_start_date",
		"expected_end_date",
		"custom_project_portfolio",
		"governance_model",
		"stage_chain_version",
		"current_stage",
		"stage_gate_status",
	]


def _get_permission_aware_list(doctype, **kwargs):
	get_list = getattr(frappe, "get_list", None)
	if callable(get_list):
		return get_list(doctype, **kwargs)
	return frappe.get_all(doctype, **kwargs)


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
		return add_months(today_date, -6), add_months(today_date, 12)

	range_start = from_date or today_date
	range_end = to_date or today_date
	if range_start > range_end:
		range_start, range_end = range_end, range_start
	return range_start, range_end


def _intervals_overlap(valid_from, valid_for, range_start, range_end):
	start = _getdate(valid_from) if valid_from else None
	end = _getdate(valid_for) if valid_for else None
	return (start is None or start <= range_end) and (end is None or end >= range_start)


def _get_project_manager_role(filters=None):
	filters = filters or {}
	return filters.get("project_manager_role") or DEFAULT_PROJECT_MANAGER_ROLE


def _coerce_to_list(value):
	if value is None:
		return []
	if isinstance(value, (list, tuple, set)):
		return [item for item in value if item]
	if isinstance(value, str):
		return [item.strip() for item in value.split(",") if item.strip()]
	return [value]


def _coerce_to_check(value, default=0):
	if value is None or value == "":
		return 1 if default else 0
	if isinstance(value, str):
		return 1 if value.strip().lower() in {"1", "true", "yes", "on"} else 0
	return 1 if bool(value) else 0


def _normalize_roadmap_visibility_filters(filters=None):
	normalized = dict(filters or {})
	normalized["task_types"] = _coerce_to_list(normalized.get("task_types"))
	normalized["show_milestones"] = _coerce_to_check(normalized.get("show_milestones"), default=0)
	normalized["show_stages_and_checkpoints"] = _coerce_to_check(
		normalized.get("show_stages_and_checkpoints"), default=1
	)
	if (
		not normalized["show_stages_and_checkpoints"]
		and not normalized["show_milestones"]
		and not normalized["task_types"]
	):
		normalized["show_stages_and_checkpoints"] = 1
	return normalized


def _get_applied_roadmap_filters(filters=None):
	normalized = _normalize_roadmap_visibility_filters(filters)
	return {
		"show_stages_and_checkpoints": normalized["show_stages_and_checkpoints"],
		"show_milestones": normalized["show_milestones"],
		"task_types": list(normalized["task_types"]),
	}


def _get_project_team_rows(project_names, role_name=None):
	if not project_names:
		return []
	return frappe.get_all(
		"Project Team Details",
		filters={
			"parent": ["in", project_names],
			"pt_role": role_name or DEFAULT_PROJECT_MANAGER_ROLE,
		},
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


def _resolve_project_managers(project_names, range_start, range_end, role_name=None):
	team_rows = _get_project_team_rows(project_names, role_name)
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


def _task_overlaps_report_range(task, range_start, range_end):
	start = _get(task, "exp_start_date")
	end = _get(task, "exp_end_date")
	if not start and not end:
		return False
	return _intervals_overlap(start, end or start, range_start, range_end)


def _build_task_entities(task_rows, project_meta, range_start, range_end, filters=None):
	filters = filters or {}
	show_milestones = bool(filters.get("show_milestones"))
	selected_task_types = set(_coerce_to_list(filters.get("task_types")))
	task_entities = []

	for row in task_rows:
		if not _task_overlaps_report_range(row, range_start, range_end):
			continue

		is_milestone = int(_get(row, "is_milestone") or 0) == 1
		task_type = _get(row, "type")
		point_date = _get(row, "exp_end_date") or _get(row, "exp_start_date")
		start_date = _get(row, "exp_start_date")
		end_date = _get(row, "exp_end_date")
		if is_milestone and not point_date:
			continue
		if not is_milestone and not start_date and not end_date:
			continue
		include = (is_milestone and show_milestones) or (
			not is_milestone and bool(task_type) and task_type in selected_task_types
		)
		if not include:
			continue

		project = project_meta.get(_get(row, "project"), {})
		entity = {
			**row,
			"entity_kind": "milestone" if is_milestone else "task_bar",
			"lane_key": "milestone" if is_milestone else f"task_type:{task_type}",
			"lane_label": "Milestone" if is_milestone else task_type,
			"docType": "Task",
			"docName": _get(row, "name"),
			"start_date": start_date,
			"end_date": end_date,
			"point_date": point_date,
			"project_name": _get(project, "project_name") or _get(row, "project"),
			"portfolio": _get(project, "custom_project_portfolio"),
		}
		if is_milestone:
			entity.pop("progress", None)
		task_entities.append(entity)

	return task_entities


def _should_include_task_entities(filters=None):
	filters = filters or {}
	return bool(filters.get("show_milestones")) or bool(_coerce_to_list(filters.get("task_types")))


def _should_include_stage_and_gate_entities(filters=None):
	filters = filters or {}
	return bool(filters.get("show_stages_and_checkpoints", 1))


def get_roadmap_dataset(filters=None):
	filters = _normalize_roadmap_visibility_filters(filters)
	range_start, range_end = _resolve_report_range(filters)
	project_manager_role = _get_project_manager_role(filters)
	project_filters = {}
	if filters.get("company"):
		project_filters["company"] = filters["company"]
	if filters.get("portfolio"):
		project_filters["custom_project_portfolio"] = filters["portfolio"]
	if filters.get("customer"):
		project_filters["customer"] = filters["customer"]
	if filters.get("project"):
		project_filters["name"] = filters["project"]
	if filters.get("project_type"):
		project_filters["project_type"] = filters["project_type"]
	if filters.get("project_status"):
		project_filters["status"] = filters["project_status"]
	if filters.get("governance_model"):
		project_filters["governance_model"] = filters["governance_model"]
	if filters.get("active_only"):
		project_filters["is_active"] = "Yes"

	project_rows = _get_permission_aware_list(
		"Project",
		filters=project_filters,
		fields=_project_fields(),
		order_by="custom_project_portfolio asc, project_name asc",
	)
	project_names = [_get(row, "name") for row in project_rows]
	project_managers, project_manager_users = _resolve_project_managers(
		project_names,
		range_start,
		range_end,
		project_manager_role,
	)

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
	stage_rows = []
	gate_rows = []
	if _should_include_stage_and_gate_entities(filters):
		stage_filters = {"project": ["in", project_names]} if project_names else {"project": ["in", [""]]}
		has_user_from = bool(filters.get("from_date"))
		has_user_to = bool(filters.get("to_date"))
		if has_user_from:
			stage_filters["planned_end_date"] = [">=", filters["from_date"]]
		elif not has_user_from and not has_user_to:
			stage_filters["planned_end_date"] = [">=", range_start]
		if has_user_to:
			stage_filters["planned_start_date"] = ["<=", filters["to_date"]]
		elif not has_user_from and not has_user_to:
			stage_filters["planned_start_date"] = ["<=", range_end]
		stage_rows = _get_permission_aware_list(
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
		stage_names = {_get(row, "stage") for row in stage_rows if _get(row, "stage")}
		stage_meta = {
			_get(row, "name"): row
			for row in frappe.get_all(
				"Project Stage",
				filters={"name": ["in", list(stage_names)]} if stage_names else {},
				fields=["name"],
			)
		}
		for row in stage_rows:
			project = project_meta.get(_get(row, "project"), {})
			want_ver = int(_get(project, "stage_chain_version") or 1)
			if int(_get(row, "stage_chain_version") or 1) != want_ver:
				continue
			stage = stage_meta.get(_get(row, "stage"), {})
			row["project_name"] = _get(project, "project_name") or _get(row, "project")
			row["portfolio"] = _get(project, "custom_project_portfolio")
			row["stage_name"] = _get(stage, "name", _get(row, "stage"))
			row["color"] = _get(stage, "color")
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
				"gate_due_date",
				"checkpoint_level",
			],
			order_by="project asc, creation asc",
		)
		for row in gate_rows:
			project = project_meta.get(_get(row, "project"), {})
			row["project_name"] = _get(project, "project_name") or _get(row, "project")
			row["portfolio"] = _get(project, "custom_project_portfolio")

	task_entities = []
	if _should_include_task_entities(filters):
		task_rows = _get_permission_aware_list(
			"Task",
			filters={"project": ["in", project_names]} if project_names else {"project": ["in", [""]]},
			fields=[
				"name",
				"project",
				"subject",
				"type",
				"progress",
				"status",
				"is_milestone",
				"exp_start_date",
				"exp_end_date",
			],
			order_by="project asc, exp_start_date asc, exp_end_date asc, modified asc",
		)
		task_entities = _build_task_entities(task_rows, project_meta, range_start, range_end, filters)

	return {
		"projects": project_rows,
		"stageBars": stage_rows,
		"gates": gate_rows,
		"taskEntities": task_entities,
		"appliedFilters": _get_applied_roadmap_filters(filters),
	}

