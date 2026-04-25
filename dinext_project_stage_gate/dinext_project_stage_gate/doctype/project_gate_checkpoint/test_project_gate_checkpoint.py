# Copyright (c) 2026, Dinext and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import getdate, nowdate


class TestProjectGateCheckpoint(FrappeTestCase):
	def setUp(self):
		self.original_flags = getattr(frappe.local, "flags", None)
		flags = frappe._dict(getattr(frappe.local, "flags", {}) or {})
		flags.in_test = True
		flags.mute_messages = True
		flags.in_migrate = getattr(flags, "in_migrate", False)
		frappe.local.flags = flags
		self.deletion_guard = patch(
			"erpnext.setup.doctype.transaction_deletion_record.transaction_deletion_record.check_for_running_deletion_job"
		)
		self.deletion_guard.start()
		self.company = frappe.get_all("Company", fields=["name"], limit=1)[0].name
		self._ensure_company_default_holiday_list()

	def tearDown(self):
		self.deletion_guard.stop()
		if self.original_flags is None:
			try:
				del frappe.local.flags
			except AttributeError:
				pass
		else:
			frappe.local.flags = self.original_flags

	def test_checklist_description_copied_from_template(self):
		doc = self._load_provisioned_checkpoint(
			template_item_descriptions=["Desc for first", "Desc for second"]
		)
		self.assertEqual(doc.checklist[0].description, "Desc for first")
		self.assertEqual(doc.checklist[1].description, "Desc for second")

	def test_gate_due_date_matches_stage_planned_end_date_on_insert(self):
		doc = self._load_provisioned_checkpoint()
		stage = frappe.get_doc("Project Stage Instance", doc.stage_instance)
		self.assertEqual(getdate(doc.gate_due_date), getdate(stage.planned_end_date))

	def test_checklist_completed_false_when_any_item_open(self):
		doc = self._load_provisioned_checkpoint()
		for row in doc.checklist:
			row.status = "Open"
		doc.save(ignore_permissions=True)
		doc.reload()
		self.assertEqual(int(doc.checklist_completed or 0), 0)

	def test_checklist_completed_false_when_mixed_terminal_and_open(self):
		doc = self._load_provisioned_checkpoint()
		doc.checklist[0].status = "Done"
		doc.checklist[1].status = "Open"
		doc.save(ignore_permissions=True)
		doc.reload()
		self.assertEqual(int(doc.checklist_completed or 0), 0)

	def test_checklist_completed_true_when_all_done(self):
		doc = self._load_provisioned_checkpoint()
		for row in doc.checklist:
			row.status = "Done"
		doc.save(ignore_permissions=True)
		doc.reload()
		self.assertEqual(int(doc.checklist_completed or 0), 1)

	def test_checklist_completed_true_when_done_and_canceled(self):
		doc = self._load_provisioned_checkpoint()
		doc.checklist[0].status = "Done"
		doc.checklist[1].status = "Canceled"
		doc.save(ignore_permissions=True)
		doc.reload()
		self.assertEqual(int(doc.checklist_completed or 0), 1)

	def test_checklist_completed_reverts_when_item_reopened(self):
		doc = self._load_provisioned_checkpoint()
		for row in doc.checklist:
			row.status = "Done"
		doc.save(ignore_permissions=True)
		doc.reload()
		self.assertEqual(int(doc.checklist_completed or 0), 1)

		doc.checklist[0].status = "Open"
		doc.save(ignore_permissions=True)
		doc.reload()
		self.assertEqual(int(doc.checklist_completed or 0), 0)

	def test_sets_approver_on_first_transition_to_approved(self):
		frappe.set_user("Administrator")
		doc = self._load_provisioned_checkpoint()
		frappe.db.set_value(
			"Project Gate Checkpoint", doc.name, "status", "In Review", update_modified=False
		)
		doc = frappe.get_doc("Project Gate Checkpoint", doc.name)
		doc.status = "Approved"
		with patch("frappe.model.document.validate_workflow"):
			doc.save(ignore_permissions=True)
		doc.reload()
		self.assertEqual(doc.approver_user, "Administrator")
		self.assertEqual(getdate(doc.approval_date), getdate(nowdate()))
		self.assertEqual(
			int(frappe.db.get_value("Project Stage Instance", doc.stage_instance, "gate_result") or 0),
			1,
		)

	def test_does_not_overwrite_approval_metadata_when_already_approved(self):
		frappe.set_user("Administrator")
		doc = self._load_provisioned_checkpoint()
		frappe.db.set_value(
			"Project Gate Checkpoint", doc.name, "status", "In Review", update_modified=False
		)
		doc = frappe.get_doc("Project Gate Checkpoint", doc.name)
		doc.status = "Approved"
		with patch("frappe.model.document.validate_workflow"):
			doc.save(ignore_permissions=True)
		doc.reload()
		first_user = doc.approver_user
		first_date = doc.approval_date
		doc.decision_comment = "Updated after approval"
		with patch("frappe.model.document.validate_workflow"):
			doc.save(ignore_permissions=True)
		doc.reload()
		self.assertEqual(doc.approver_user, first_user)
		self.assertEqual(getdate(doc.approval_date), getdate(first_date))
		self.assertEqual(
			int(frappe.db.get_value("Project Stage Instance", doc.stage_instance, "gate_result") or 0),
			1,
		)

	def _load_provisioned_checkpoint(self, template_item_descriptions=None):
		suffix = frappe.generate_hash(length=6)
		level = frappe.get_doc(
			{
				"doctype": "Project Gate Checkpoint Level",
				"name": f"CP Level {suffix}",
				"enabled": 1,
			}
		).insert(ignore_permissions=True)
		items = [
			{"title": "First criterion", "is_mandatory": 1, "is_evidence_mandatory": 0},
			{"title": "Second criterion", "is_mandatory": 1, "is_evidence_mandatory": 0},
		]
		if template_item_descriptions:
			for idx, row in enumerate(items):
				if idx < len(template_item_descriptions) and template_item_descriptions[idx] is not None:
					row["description"] = template_item_descriptions[idx]
		template = frappe.get_doc(
			{
				"doctype": "Stage Gate Template",
				"name": f"Gate Tpl {suffix}",
				"checkpoint_level": level.name,
				"enabled": 1,
				"items": items,
			}
		).insert(ignore_permissions=True)
		stage_a = frappe.get_doc(
			{
				"doctype": "Project Stage",
				"name": f"Idea {suffix}",
				"stage_code": f"IDEA-{suffix}",
				"enabled": 1,
			}
		).insert(ignore_permissions=True)
		stage_b = frappe.get_doc(
			{
				"doctype": "Project Stage",
				"name": f"Discovery {suffix}",
				"stage_code": f"DISC-{suffix}",
				"enabled": 1,
			}
		).insert(ignore_permissions=True)
		governance_model = frappe.get_doc(
			{
				"doctype": "Project Governance Model",
				"name": f"Model {suffix}",
				"company": self.company,
				"enabled": 1,
				"stages": [
					{
						"stage": stage_a.name,
						"sequence": 1,
						"checkpoint_template": template.name,
					},
					{"stage": stage_b.name, "sequence": 2},
				],
			}
		).insert(ignore_permissions=True)
		project = frappe.get_doc(
			{
				"doctype": "Project",
				"name": f"TEST-PROJ-{suffix}",
				"project_name": f"Checkpoint test {suffix}",
				"naming_series": "PROJ-.####",
				"company": self.company,
				"governance_model": governance_model.name,
			}
		)
		project.insert(ignore_permissions=True, ignore_mandatory=True)

		checkpoints = frappe.get_all(
			"Project Gate Checkpoint",
			filters={"project": project.name},
			pluck="name",
			limit=1,
		)
		self.assertTrue(
			checkpoints,
			msg=(
				f"No Project Gate Checkpoint for project {project.name!r}; "
				f"stage instances: "
				f"{frappe.get_all('Project Stage Instance', filters={'project': project.name}, pluck='name')}"
			),
		)
		return frappe.get_doc("Project Gate Checkpoint", checkpoints[0])

	def _ensure_company_default_holiday_list(self):
		if frappe.db.get_value("Company", self.company, "default_holiday_list"):
			return
		suffix = frappe.generate_hash(length=6)
		hl = frappe.get_doc(
			{
				"doctype": "Holiday List",
				"holiday_list_name": f"TEST-PGCHK-HL-{suffix}",
				"from_date": "2020-01-01",
				"to_date": "2035-12-31",
				"holidays": [],
			}
		).insert(ignore_permissions=True)
		frappe.db.set_value("Company", self.company, "default_holiday_list", hl.name)
