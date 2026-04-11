from dinext_project_stage_gate.stage_gate import query


def execute(filters=None):
	filters = filters or {}
	dataset = query.get_roadmap_dataset(filters)
	columns = get_columns()
	data = build_rows(dataset)
	chart = None
	report_summary = [
		{
			"value": len(dataset["projects"]),
			"label": "Projects",
			"datatype": "Int",
		},
		{
			"value": len(dataset["stageBars"]),
			"label": "Stages",
			"datatype": "Int",
		},
		{
			"value": len(dataset["gates"]),
			"label": "Gates",
			"datatype": "Int",
		},
	]
	message = {"projects": dataset["projects"], "stageBars": dataset["stageBars"], "gates": dataset["gates"]}
	return columns, data, message, chart, report_summary


def get_columns():
	return [
		{
			"fieldname": "portfolio",
			"label": "Portfolio",
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "project",
			"label": "Project",
			"fieldtype": "Link",
			"options": "Project",
			"width": 180,
		},
		{
			"fieldname": "project_name",
			"label": "Project Name",
			"fieldtype": "Data",
			"width": 220,
		},
		{
			"fieldname": "company",
			"label": "Company",
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "customer",
			"label": "Customer",
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "project_manager",
			"label": "Project Manager",
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "governance_model",
			"label": "Governance Model",
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "current_stage",
			"label": "Current Stage",
			"fieldtype": "Data",
			"width": 140,
		},
		{
			"fieldname": "stage_gate_status",
			"label": "Stage-gate Status",
			"fieldtype": "Data",
			"width": 140,
		},
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

