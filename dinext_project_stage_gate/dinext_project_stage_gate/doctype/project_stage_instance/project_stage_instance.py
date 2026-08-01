# Copyright (c) 2026, Dinext and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import cint, getdate, today

from dinext_project_stage_gate.stage_gate.checkpoint_provision import (
	provision_checkpoint_for_stage_instance,
)
from dinext_project_stage_gate.stage_gate.overdue_sync import apply_stage_instance_overdue
from dinext_project_stage_gate.stage_gate.working_days import (
	first_working_day_on_or_after,
	next_working_day_after,
	planned_end_from_duration,
	resolve_holiday_list,
)


class ProjectStageInstance(Document):
	def before_insert(self):
		if not self.project or not self.governance_model:
			return

		project = frappe.get_cached_doc("Project", self.project)
		holiday_list = resolve_holiday_list(project)
		seq = int(self.sequence or 0)

		if seq <= 1:
			base = project.expected_start_date or today()
			planned_start = first_working_day_on_or_after(holiday_list, base)
		else:
			prev_end = frappe.db.get_value(
				"Project Stage Instance",
				{
					"project": self.project,
					"stage_chain_version": int(self.stage_chain_version or 1),
					"sequence": seq - 1,
				},
				"planned_end_date",
			)
			if prev_end:
				planned_start = next_working_day_after(holiday_list, prev_end)
			else:
				base = project.expected_start_date or today()
				planned_start = first_working_day_on_or_after(holiday_list, base)

		duration_days = self._expected_duration_days_from_governance_model()
		self.planned_start_date = planned_start
		self.planned_end_date = planned_end_from_duration(
			planned_start, duration_days, holiday_list
		)

	def validate(self):
		if self.status in ("Active", "Completed") and not self.actual_start_date:
			self.actual_start_date = today()
		if self.status == "Completed" and not self.actual_end_date:
			self.actual_end_date = today()
		self._sync_planned_dates_from_actual_dates()

		row = self._governance_stage_row_for_instance()
		self.is_skippable = cint(row.is_skippable) if row else 0
		apply_stage_instance_overdue(self)

	def after_insert(self):
		provision_checkpoint_for_stage_instance(self)

	def _governance_stage_row_for_instance(self):
		if not self.governance_model:
			return None
		model = frappe.get_cached_doc("Project Governance Model", self.governance_model)
		seq = int(self.sequence or 0)
		for row in model.get("stages") or []:
			if row.stage == self.stage and int(row.sequence or 0) == seq:
				return row
		for row in model.get("stages") or []:
			if row.stage == self.stage:
				return row
		return None

	def _expected_duration_days_from_governance_model(self):
		row = self._governance_stage_row_for_instance()
		if row:
			return row.expected_duration_days
		return None

	def _sync_planned_dates_from_actual_dates(self):
		if not self.actual_start_date and not self.actual_end_date:
			return

		project = frappe.get_cached_doc("Project", self.project) if self.project else None
		holiday_list = resolve_holiday_list(project) if project else None

		if self.actual_start_date:
			self.planned_start_date = self.actual_start_date
			if self.planned_end_date and getdate(self.planned_end_date) < getdate(self.planned_start_date):
				duration_days = self._expected_duration_days_from_governance_model()
				self.planned_end_date = planned_end_from_duration(
					self.planned_start_date, duration_days, holiday_list
				)

		if self.actual_end_date:
			self.planned_end_date = self.actual_end_date

