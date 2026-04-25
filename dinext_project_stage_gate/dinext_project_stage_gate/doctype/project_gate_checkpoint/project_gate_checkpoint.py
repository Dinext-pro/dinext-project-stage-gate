# Copyright (c) 2026, Dinext and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate

from dinext_project_stage_gate.stage_gate import validators

_TERMINAL_CHECKLIST_STATUSES = frozenset({"Done", "Canceled"})


class ProjectGateCheckpoint(Document):
	def validate(self):
		self._sync_checklist_completed()
		self._sync_approval_audit_fields()
		validators.validate_enabled_links(
			[self.as_dict()],
			"checkpoint_level",
			_get_checkpoint_level_status_map([self.checkpoint_level]),
			label="Checkpoint Level",
		)
		if self.is_new():
			self._set_gate_due_date_from_stage_instance()

	def on_update(self):
		self._sync_stage_instance_gate_result_on_approval()

	def _transitioned_to_approved(self):
		if self.status != "Approved":
			return False
		prev = self.get_doc_before_save()
		if prev and prev.status == "Approved":
			return False
		return True

	def _sync_checklist_completed(self):
		if not self.checklist:
			self.checklist_completed = 0
			return
		self.checklist_completed = int(
			all((row.status or "Open") in _TERMINAL_CHECKLIST_STATUSES for row in self.checklist)
		)

	def _sync_approval_audit_fields(self):
		if not self._transitioned_to_approved():
			return
		self.approver_user = frappe.session.user
		self.approval_date = nowdate()

	def _sync_stage_instance_gate_result_on_approval(self):
		if not self._transitioned_to_approved() or not self.stage_instance:
			return
		if int(frappe.db.get_value("Project Stage Instance", self.stage_instance, "gate_result") or 0):
			return
		psi = frappe.get_doc("Project Stage Instance", self.stage_instance)
		psi.gate_result = 1
		psi.save(ignore_permissions=True)

	def _set_gate_due_date_from_stage_instance(self):
		if not self.stage_instance:
			return
		planned_end = frappe.db.get_value(
			"Project Stage Instance", self.stage_instance, "planned_end_date"
		)
		if planned_end:
			self.gate_due_date = planned_end


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

