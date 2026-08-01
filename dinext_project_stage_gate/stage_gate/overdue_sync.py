# Copyright (c) 2026, Dinext and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import getdate, today

STAGE_IGNORED_STATUSES = frozenset({"Completed", "Canceled", "Skipped"})
CHECKPOINT_IGNORED_STATUSES = frozenset({"Approved", "Canceled", "Skipped"})


def sync_overdue_flags(reference_date=None):
	"""Recompute is_overdue for all stage instances and gate checkpoints."""
	reference_date = getdate(reference_date or today())
	stage_count = _sync_stage_overdue_flags(reference_date)
	checkpoint_count = _sync_checkpoint_overdue_flags(reference_date)
	return {
		"stages_updated": stage_count,
		"checkpoints_updated": checkpoint_count,
	}


def compute_stage_is_overdue(status, planned_start_date, planned_end_date, reference_date=None):
	reference_date = getdate(reference_date or today())
	if status in STAGE_IGNORED_STATUSES:
		return False

	if status == "Planned" and planned_start_date:
		if getdate(planned_start_date) < reference_date:
			return True

	if planned_end_date and getdate(planned_end_date) < reference_date:
		return True

	return False


def compute_checkpoint_is_overdue(status, gate_due_date, reference_date=None):
	reference_date = getdate(reference_date or today())
	if status in CHECKPOINT_IGNORED_STATUSES:
		return False
	if not gate_due_date:
		return False
	return getdate(gate_due_date) < reference_date


def apply_stage_instance_overdue(doc):
	doc.is_overdue = int(
		compute_stage_is_overdue(
			doc.status,
			doc.planned_start_date,
			doc.planned_end_date,
		)
	)


def apply_checkpoint_overdue(doc):
	doc.is_overdue = int(compute_checkpoint_is_overdue(doc.status, doc.gate_due_date))


def _sync_stage_overdue_flags(reference_date):
	updated = 0
	rows = frappe.get_all(
		"Project Stage Instance",
		fields=["name", "status", "planned_start_date", "planned_end_date", "is_overdue"],
	)
	for row in rows:
		expected = int(
			compute_stage_is_overdue(
				row.status,
				row.planned_start_date,
				row.planned_end_date,
				reference_date,
			)
		)
		current = int(row.is_overdue or 0)
		if expected != current:
			frappe.db.set_value(
				"Project Stage Instance",
				row.name,
				"is_overdue",
				expected,
				update_modified=False,
			)
			updated += 1
	return updated


def _sync_checkpoint_overdue_flags(reference_date):
	updated = 0
	rows = frappe.get_all(
		"Project Gate Checkpoint",
		fields=["name", "status", "gate_due_date", "is_overdue"],
	)
	for row in rows:
		expected = int(
			compute_checkpoint_is_overdue(row.status, row.gate_due_date, reference_date)
		)
		current = int(row.is_overdue or 0)
		if expected != current:
			frappe.db.set_value(
				"Project Gate Checkpoint",
				row.name,
				"is_overdue",
				expected,
				update_modified=False,
			)
			updated += 1
	return updated
