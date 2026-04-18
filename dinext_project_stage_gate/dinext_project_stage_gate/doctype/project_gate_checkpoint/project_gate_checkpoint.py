# Copyright (c) 2026, Dinext and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from dinext_project_stage_gate.stage_gate import validators

_TERMINAL_CHECKLIST_STATUSES = frozenset({"Done", "Canceled"})


class ProjectGateCheckpoint(Document):
	def validate(self):
		self._sync_checklist_completed()
		validators.validate_enabled_links(
			[self.as_dict()],
			"checkpoint_level",
			_get_checkpoint_level_status_map([self.checkpoint_level]),
			label="Checkpoint Level",
		)

	def _sync_checklist_completed(self):
		if not self.checklist:
			self.checklist_completed = 0
			return
		self.checklist_completed = int(
			all((row.status or "Open") in _TERMINAL_CHECKLIST_STATUSES for row in self.checklist)
		)


def _get_checkpoint_level_status_map(level_names):
	level_names = [name for name in level_names if name]
	if not level_names:
		return {}

	return {
		row.name: row
		for row in frappe.get_all(
			"Project Gate Checkpoint Level",
			filters={"name": ["in", level_names]},
			fields=["name", "enabled"],
		)
	}

