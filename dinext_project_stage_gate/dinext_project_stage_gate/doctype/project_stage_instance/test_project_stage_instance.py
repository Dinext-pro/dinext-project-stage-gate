# Copyright (c) 2026, Dinext and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase


class TestProjectStageInstance(FrappeTestCase):
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

	def tearDown(self):
		self.deletion_guard.stop()
		if self.original_flags is None:
			try:
				del frappe.local.flags
			except AttributeError:
				pass
		else:
			frappe.local.flags = self.original_flags

	def test_project_insert_with_governance_model_provisions_stage_instances(self):
		governance_model = self._make_governance_model()

		project = self._make_project(governance_model=governance_model.name)

		stage_instances = frappe.get_all(
			"Project Stage Instance",
			filters={"project": project.name},
			fields=[
				"name",
				"stage",
				"status",
				"sequence",
				"governance_model",
				"previous_stage_instance",
				"next_stage_instance",
			],
			order_by="sequence asc",
		)

		self.assertEqual([row.stage for row in stage_instances], self.stage_names)
		self.assertEqual([row.status for row in stage_instances], ["Active", "Planned"])
		self.assertTrue(all(row.governance_model == governance_model.name for row in stage_instances))
		self.assertEqual(stage_instances[0].previous_stage_instance, None)
		self.assertEqual(stage_instances[0].next_stage_instance, stage_instances[1].name)
		self.assertEqual(stage_instances[1].previous_stage_instance, stage_instances[0].name)
		self.assertEqual(stage_instances[1].next_stage_instance, None)

		project.reload()
		self.assertEqual(project.current_stage_instance, stage_instances[0].name)
		self.assertEqual(project.current_stage, self.stage_names[0])
		self.assertEqual(project.stage_gate_status, "Active")
		self.assertEqual(project.current_gate_result, "Pending")

	def test_project_resave_does_not_duplicate_stage_instances(self):
		governance_model = self._make_governance_model()
		project = self._make_project(governance_model=governance_model.name)

		project.notes = "resave without changing governance model"
		project.flags.ignore_mandatory = True
		project.save()

		stage_instances = frappe.get_all(
			"Project Stage Instance",
			filters={"project": project.name},
			fields=["name"],
			order_by="sequence asc",
		)
		self.assertEqual(len(stage_instances), 2)

	def test_project_update_with_governance_model_provisions_stage_instances(self):
		governance_model = self._make_governance_model(label="Later")
		project = self._make_project(governance_model=None)

		project.governance_model = governance_model.name
		project.flags.ignore_mandatory = True
		project.save()

		stage_instances = frappe.get_all(
			"Project Stage Instance",
			filters={"project": project.name},
			fields=["name"],
			order_by="sequence asc",
		)
		self.assertEqual(len(stage_instances), 2)

	def test_stage_instance_update_refreshes_project_summary(self):
		governance_model = self._make_governance_model(label="Summary")
		project = self._make_project(governance_model=governance_model.name)

		stage_instance = frappe.get_doc(
			"Project Stage Instance", f"{project.name}-STAGE-001"
		)
		stage_instance.status = "Canceled"
		stage_instance.gate_result = "Rejected"
		stage_instance.save(ignore_permissions=True)

		project.reload()
		self.assertEqual(project.current_stage_instance, stage_instance.name)
		self.assertEqual(project.current_stage, stage_instance.stage)
		self.assertEqual(project.stage_gate_status, "Canceled")
		self.assertEqual(project.current_gate_result, "Rejected")

	def test_cannot_change_governance_model_after_stage_instances_exist(self):
		original_model = self._make_governance_model()
		replacement_model = self._make_governance_model(label="Replacement")
		project = self._make_project(governance_model=original_model.name)

		project.governance_model = replacement_model.name

		with self.assertRaises(frappe.ValidationError):
			project.flags.ignore_mandatory = True
			project.save()

	def test_cannot_clear_governance_model_after_stage_instances_exist(self):
		governance_model = self._make_governance_model(label="Clear")
		project = self._make_project(governance_model=governance_model.name)

		project.governance_model = None

		with self.assertRaises(frappe.ValidationError):
			project.flags.ignore_mandatory = True
			project.save()

	def _make_governance_model(self, label="Primary"):
		suffix = frappe.generate_hash(length=6)
		stage_docs = [
			self._make_project_stage(f"{label} Idea {suffix}", f"{label[:3].upper()}-IDEA-{suffix}"),
			self._make_project_stage(
				f"{label} Discovery {suffix}", f"{label[:3].upper()}-DISC-{suffix}"
			),
		]
		self.stage_names = [doc.name for doc in stage_docs]

		return frappe.get_doc(
			{
				"doctype": "Project Governance Model",
				"name": f"{label} Model {suffix}",
				"company": self.company,
				"enabled": 1,
				"stages": [
					{"stage": stage_docs[0].name, "sequence": 1},
					{"stage": stage_docs[1].name, "sequence": 2},
				],
			}
		).insert(ignore_permissions=True)

	def _make_project_stage(self, name, stage_code):
		return frappe.get_doc(
			{
				"doctype": "Project Stage",
				"name": name,
				"stage_code": stage_code,
				"enabled": 1,
			}
		).insert(ignore_permissions=True)

	def _make_project(self, governance_model=None):
		project = frappe.get_doc(
			{
				"doctype": "Project",
				"name": f"TEST-PROJ-{frappe.generate_hash(length=6)}",
				"project_name": f"Stage Gate Project {frappe.generate_hash(length=6)}",
				"naming_series": "PROJ-.####",
				"company": self.company,
				"governance_model": governance_model,
			}
		)
		project.insert(ignore_permissions=True, ignore_mandatory=True)
		return project

