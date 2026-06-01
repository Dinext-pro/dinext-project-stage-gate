# Copyright (c) 2026, Dinext and contributors
# For license information, please see license.txt

import frappe

from dinext_project_stage_gate.stage_gate.overdue_sync import sync_overdue_flags


def daily():
	result = sync_overdue_flags()
	frappe.logger().info(
		"Stage gate overdue sync: stages_updated=%(stages_updated)s "
		"checkpoints_updated=%(checkpoints_updated)s",
		result,
	)
