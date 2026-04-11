# Copyright (c) 2026, Dinext and contributors
# For license information, please see license.txt

from frappe.model.document import Document

from dinext_project_stage_gate.stage_gate import validators


class ProjectGovernanceModel(Document):
	def validate(self):
		stages = [row.as_dict() for row in self.get("stages", [])]
		validators.validate_unique_stage_references(stages)
		validators.validate_enabled_links(stages, "stage", _get_stage_status_map(stages), label="Stage")

		for sequence, row in zip(validators.assign_stage_sequences(stages), self.get("stages", []), strict=False):
			row.sequence = sequence


def _get_stage_status_map(rows):
	stage_names = [row.get("stage") for row in rows if row.get("stage")]
	if not stage_names:
		return {}

	import frappe

	return {
		row.name: row
		for row in frappe.get_all(
			"Project Stage", filters={"name": ["in", stage_names]}, fields=["name", "enabled"]
		)
	}

