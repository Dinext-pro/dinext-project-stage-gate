# Copyright (c) 2026, Dinext and contributors
# For license information, please see license.txt

from frappe.model.document import Document

from dinext_project_stage_gate.stage_gate.checkpoint_provision import (
	provision_checkpoint_for_stage_instance,
)


class ProjectStageInstance(Document):
	def after_insert(self):
		provision_checkpoint_for_stage_instance(self)

