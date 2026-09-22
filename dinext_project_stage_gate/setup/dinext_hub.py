# Copyright (c) 2026, Dinext and contributors
# For license information, please see license.txt

"""Register this app's default Dinext Hub cards."""

from __future__ import annotations

import frappe

APP_NAME = 'dinext_project_stage_gate'

HUB_ITEMS = (
	{
		"section": 'Scope & Governance',
		"element_type": 'DocType',
		"target": 'Project Governance Model',
		"label": 'Project Governance Model',
		"description": 'Defines lifecycle stages, entry and exit criteria, expected duration, and checkpoint templates.',
		"icon": 'review',
	},
	{
		"section": 'Scope & Governance',
		"element_type": 'DocType',
		"target": 'Stage Gate Template',
		"label": 'Stage Gate Template',
		"description": 'Reusable stage-gate checkpoint templates with mandatory checklist items and evidence requirements.',
		"icon": 'milestone',
	},
	{
		"section": 'Scope & Governance',
		"element_type": 'DocType',
		"target": 'Project Stage',
		"label": 'Project Stage',
		"description": 'Master list of lifecycle stages with code, sequence, description, and gate requirement.',
		"icon": 'gantt',
	},
)


def register_dinext_hub_items() -> None:
	if "dinext_common" not in frappe.get_installed_apps():
		return

	try:
		from dinext_common.setup.hub_catalog import register_hub_items
	except ImportError:
		return

	register_hub_items(HUB_ITEMS, source_app=APP_NAME)
