import frappe
from frappe import _

from dinext_project_stage_gate.stage_gate import query

DINEXT_TASK_TYPE_TRANSLATION_CONTEXT = "Dinext.TaskType"
DINEXT_STAGE_GATE_TRANSLATION_CONTEXT = "Dinext.StageGateModel"
ROADMAP_STAGE_GATE_TRANSLATION_SOURCES = frozenset({"Stages", "Current Stage"})

ROADMAP_CLIENT_TRANSLATION_SOURCES = (
	"Stages",
	"Gate checkpoints",
	"Milestones",
	"Restore",
	"Sort projects",
	"Show Full Width",
	"Show Full Height",
	"Show All",
	"Save as Image",
	"Project sorting",
	"Current order",
	"Project Name",
	"Forecast Start Date",
	"Forecast End Date",
	"Ascending",
	"Descending",
	"Company",
	"Limit roadmap to projects from a specific company.",
	"Portfolio",
	"Show only projects that belong to the selected portfolio.",
	"Customer",
	"Filter roadmap entries by customer.",
	"Project",
	"Focus roadmap on a single project.",
	"Project Type",
	"Filter projects by project type.",
	"Project Status",
	"Filter projects by lifecycle status.",
	"Open",
	"Completed",
	"Cancelled",
	"Project Manager",
	"Show projects assigned to the selected project manager.",
	"Project Manager Role",
	"Role used to identify the project manager in project team members.",
	"Governance Model",
	"Filter by the governance model assigned to the project.",
	"From",
	"Start date of the roadmap time window.",
	"To",
	"End date of the roadmap time window.",
	"Active Only",
	"Show only active projects in the roadmap.",
	"Show Stages & Checkpoints",
	"Display stage bars and gate checkpoint markers.",
	"Show Milestones",
	"Display milestone points on the roadmap.",
	"Task Types",
	"Display task bars only for selected task types.",
	"Clear All",
	"Issue",
)


def execute(filters=None):
	filters = filters or {}
	dataset = query.get_roadmap_dataset(filters)
	send_roadmap_client_translations(dataset)
	columns = get_columns()
	data = build_rows(dataset)
	chart = None
	report_summary = [
		{
			"value": len(dataset["projects"]),
			"label": _("Projects"),
			"datatype": "Int",
		},
		{
			"value": len(dataset["stageBars"]),
			"label": _("Stages", context=DINEXT_STAGE_GATE_TRANSLATION_CONTEXT),
			"datatype": "Int",
		},
		{
			"value": len(dataset["gates"]),
			"label": _("Gates"),
			"datatype": "Int",
		},
	]
	message = {
		"projects": dataset["projects"],
		"stageBars": dataset["stageBars"],
		"gates": dataset["gates"],
		"taskEntities": dataset.get("taskEntities", []),
		"appliedFilters": dataset.get("appliedFilters", {}),
	}
	return columns, data, message, chart, report_summary


def get_columns():
	return [
		{
			"fieldname": "portfolio",
			"label": _("Portfolio"),
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "project",
			"label": _("Project"),
			"fieldtype": "Link",
			"options": "Project",
			"width": 180,
		},
		{
			"fieldname": "project_name",
			"label": _("Project Name"),
			"fieldtype": "Data",
			"width": 220,
		},
		{
			"fieldname": "company",
			"label": _("Company"),
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "customer",
			"label": _("Customer"),
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "project_manager",
			"label": _("Project Manager"),
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "governance_model",
			"label": _("Governance Model"),
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "current_stage",
			"label": _("Current Stage", context=DINEXT_STAGE_GATE_TRANSLATION_CONTEXT),
			"fieldtype": "Data",
			"width": 140,
		}
	]


def build_rows(dataset):
	rows = []
	for project in dataset["projects"]:
		rows.append(
			{
				"portfolio": project.get("custom_project_portfolio"),
				"project": project.get("name"),
				"project_name": project.get("project_name"),
				"company": project.get("company"),
				"customer": project.get("customer"),
				"project_manager": project.get("project_manager"),
				"governance_model": project.get("governance_model"),
				"current_stage": project.get("current_stage"),
				"stage_gate_status": project.get("stage_gate_status"),
			}
		)
	return rows


def _roadmap_translation_message_keys(source: str, task_type_sources: set[str]) -> list[tuple[str, str | None]]:
	"""Return (source_text, context) pairs to expose on the client for __()."""
	if not source:
		return []
	if source in ROADMAP_STAGE_GATE_TRANSLATION_SOURCES:
		return [(source, DINEXT_STAGE_GATE_TRANSLATION_CONTEXT)]
	if source in task_type_sources:
		return [(source, DINEXT_TASK_TYPE_TRANSLATION_CONTEXT)]
	return [(source, None)]


def _collect_roadmap_client_translations(
	all_translations: dict[str, str], sources: set[str], task_type_sources: set[str]
) -> dict[str, str]:
	translations: dict[str, str] = {}
	for source in sources:
		for message, context in _roadmap_translation_message_keys(source, task_type_sources):
			if context:
				context_key = f"{message}:{context}"
				if all_translations.get(context_key):
					translations[context_key] = all_translations[context_key]
			elif all_translations.get(message):
				translations[message] = all_translations[message]
	return translations


def send_roadmap_client_translations(dataset):
	lang = getattr(getattr(frappe, "local", None), "lang", None)
	translate = getattr(frappe, "translate", None)
	if not lang or not translate:
		return

	all_translations = translate.get_all_translations(lang)
	if not all_translations:
		return

	sources = set(ROADMAP_CLIENT_TRANSLATION_SOURCES)
	task_type_sources = set(get_task_type_translation_sources(dataset))
	sources.update(task_type_sources)

	translations = _collect_roadmap_client_translations(all_translations, sources, task_type_sources)
	if translations:
		translate.send_translations(translations)


def get_task_type_translation_sources(dataset):
	sources = set()
	for task_bar in dataset.get("taskBars", []):
		value = task_bar.get("value") or []
		if len(value) > 5 and value[5]:
			sources.add(value[5])

	for entity in dataset.get("taskEntities", []):
		if entity.get("type"):
			sources.add(entity["type"])
		if entity.get("lane_label"):
			sources.add(entity["lane_label"])

	return sources

