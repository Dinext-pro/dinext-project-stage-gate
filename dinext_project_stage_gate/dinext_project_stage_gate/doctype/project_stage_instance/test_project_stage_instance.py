# Copyright (c) 2026, Dinext and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import getdate


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
				"stage_chain_version",
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
		self.assertTrue(all(int(row.get("stage_chain_version") or 1) == 1 for row in stage_instances))

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

	def test_is_skippable_synced_from_governance_model_stages(self):
		governance_model = self._make_governance_model(
			label="Skippable", stage_is_skippable=[1, 0]
		)
		project = self._make_project(governance_model=governance_model.name)

		s1 = frappe.get_doc("Project Stage Instance", f"{project.name}-STAGE-001")
		s2 = frappe.get_doc("Project Stage Instance", f"{project.name}-STAGE-002")
		self.assertEqual(int(s1.is_skippable or 0), 1)
		self.assertEqual(int(s2.is_skippable or 0), 0)

	def test_is_skippable_updates_when_governance_stage_row_changes(self):
		governance_model = self._make_governance_model(
			label="SkippableResync", stage_is_skippable=[0, 0]
		)
		project = self._make_project(governance_model=governance_model.name)

		s2 = frappe.get_doc("Project Stage Instance", f"{project.name}-STAGE-002")
		self.assertEqual(int(s2.is_skippable or 0), 0)

		gm = frappe.get_doc("Project Governance Model", governance_model.name)
		gm.stages[1].is_skippable = 1
		gm.save(ignore_permissions=True)

		s2.reload()
		s2.save(ignore_permissions=True)
		s2.reload()
		self.assertEqual(int(s2.is_skippable or 0), 1)

	def test_change_governance_model_requires_confirmation(self):
		original_model = self._make_governance_model()
		replacement_model = self._make_governance_model(label="Replacement")
		project = self._make_project(governance_model=original_model.name)

		project.governance_model = replacement_model.name

		with self.assertRaises(frappe.ValidationError):
			project.flags.ignore_mandatory = True
			project.save()

	def test_change_governance_model_with_confirm_resets_chain(self):
		suffix = frappe.generate_hash(length=6)
		level = self._make_checkpoint_level(f"CP Reset {suffix}")
		template = self._make_stage_gate_template(
			f"Gate Reset {suffix}",
			level.name,
			["Criterion A"],
		)
		original_model = self._make_governance_model(
			label="OrigReset", checkpoint_template=template.name
		)
		replacement_model = self._make_governance_model(
			label="Replacement", checkpoint_template=template.name
		)
		project = self._make_project(governance_model=original_model.name)

		old_names = frappe.get_all(
			"Project Stage Instance",
			filters={"project": project.name, "stage_chain_version": 1},
			pluck="name",
		)
		self.assertEqual(len(old_names), 2)

		project.governance_model = replacement_model.name
		project.confirm_governance_reset = 1
		project.flags.ignore_mandatory = True
		project.save()

		project.reload()
		self.assertEqual(int(project.stage_chain_version or 1), 2)
		self.assertEqual(project.confirm_governance_reset, 0)

		v1_rows = frappe.get_all(
			"Project Stage Instance",
			filters={"project": project.name, "stage_chain_version": 1},
			fields=["status"],
		)
		self.assertTrue(v1_rows)
		self.assertTrue(all(row.status == "Canceled" for row in v1_rows))

		v2_rows = frappe.get_all(
			"Project Stage Instance",
			filters={"project": project.name, "stage_chain_version": 2},
			fields=["name", "stage", "governance_model", "status", "gate_result"],
			order_by="sequence asc",
		)
		self.assertEqual(len(v2_rows), 2)
		self.assertTrue(all(row.governance_model == replacement_model.name for row in v2_rows))
		self.assertTrue(v2_rows[0].name.startswith(f"{project.name}-SG2-STAGE-"))

		self.assertNotIn(project.current_stage_instance, old_names)
		self.assertEqual(project.current_stage_instance, v2_rows[0].name)
		self.assertEqual(project.current_stage, v2_rows[0].stage)
		self.assertEqual(project.stage_gate_status, "Active")
		self.assertEqual(project.current_gate_result, v2_rows[0].gate_result)

		v1_cp = frappe.get_all(
			"Project Gate Checkpoint",
			filters={"project": project.name, "stage_chain_version": 1},
			fields=["status"],
		)
		self.assertTrue(v1_cp)
		self.assertTrue(all(row.status == "Canceled" for row in v1_cp))

	def test_clear_governance_model_with_confirm_cancels_chain(self):
		governance_model = self._make_governance_model(label="Clear")
		project = self._make_project(governance_model=governance_model.name)

		project.governance_model = None
		project.confirm_governance_reset = 1
		project.flags.ignore_mandatory = True
		project.save()

		project.reload()
		self.assertEqual(project.governance_model, None)
		self.assertEqual(int(project.stage_chain_version or 1), 2)
		self.assertEqual(project.current_stage_instance, None)
		self.assertEqual(project.current_stage, None)
		self.assertEqual(project.stage_gate_status, None)
		self.assertEqual(project.current_gate_result, None)

		v1_rows = frappe.get_all(
			"Project Stage Instance",
			filters={"project": project.name, "stage_chain_version": 1},
			fields=["status"],
		)
		self.assertTrue(all(row.status == "Canceled" for row in v1_rows))

	def test_project_planned_dates_use_calendar_and_working_days(self):
		suffix = frappe.generate_hash(length=6)
		holiday_list = frappe.get_doc(
			{
				"doctype": "Holiday List",
				"holiday_list_name": f"TEST-SG-HL-{suffix}",
				"from_date": "2026-01-01",
				"to_date": "2026-02-28",
				"holidays": [{"holiday_date": "2026-01-05", "description": "Test holiday"}],
			}
		).insert(ignore_permissions=True)

		governance_model = self._make_governance_model(
			label="Dates", stage_durations=[3, 5]
		)
		project = self._make_project(
			governance_model=governance_model.name,
			expected_start_date="2026-01-05",
			holiday_list=holiday_list.name,
		)

		s1 = frappe.get_doc("Project Stage Instance", f"{project.name}-STAGE-001")
		s2 = frappe.get_doc("Project Stage Instance", f"{project.name}-STAGE-002")

		self.assertEqual(getdate(s1.planned_start_date), getdate("2026-01-06"))
		self.assertEqual(getdate(s1.planned_end_date), getdate("2026-01-08"))
		self.assertEqual(getdate(s2.planned_start_date), getdate("2026-01-09"))
		self.assertEqual(getdate(s2.planned_end_date), getdate("2026-01-15"))

	def test_project_stage_instance_actual_dates_on_active_and_completed(self):
		governance_model = self._make_governance_model(label="Actual")
		project = self._make_project(governance_model=governance_model.name)
		stage = frappe.get_doc("Project Stage Instance", f"{project.name}-STAGE-002")

		fixed_today = "2026-03-20"
		with patch(
			"dinext_project_stage_gate.dinext_project_stage_gate.doctype.project_stage_instance.project_stage_instance.today",
			return_value=fixed_today,
		):
			stage.status = "Active"
			stage.save(ignore_permissions=True)

		stage.reload()
		self.assertEqual(getdate(stage.actual_start_date), getdate(fixed_today))
		self.assertFalse(stage.actual_end_date)

		with patch(
			"dinext_project_stage_gate.dinext_project_stage_gate.doctype.project_stage_instance.project_stage_instance.today",
			return_value=fixed_today,
		):
			stage.status = "Completed"
			stage.save(ignore_permissions=True)

		stage.reload()
		self.assertEqual(getdate(stage.actual_start_date), getdate(fixed_today))
		self.assertEqual(getdate(stage.actual_end_date), getdate(fixed_today))

	def test_project_stage_instance_actual_dates_respect_manual_values(self):
		governance_model = self._make_governance_model(label="ManualActual")
		project = self._make_project(governance_model=governance_model.name)
		stage = frappe.get_doc("Project Stage Instance", f"{project.name}-STAGE-001")

		stage.actual_start_date = "2026-01-10"
		stage.actual_end_date = "2026-01-20"
		with patch(
			"dinext_project_stage_gate.dinext_project_stage_gate.doctype.project_stage_instance.project_stage_instance.today",
			return_value="2026-03-01",
		):
			stage.status = "Completed"
			stage.save(ignore_permissions=True)

		stage.reload()
		self.assertEqual(getdate(stage.actual_start_date), getdate("2026-01-10"))
		self.assertEqual(getdate(stage.actual_end_date), getdate("2026-01-20"))

	def test_provision_checkpoints_from_governance_checkpoint_template(self):
		suffix = frappe.generate_hash(length=6)
		level = self._make_checkpoint_level(f"CP Level {suffix}")
		template = self._make_stage_gate_template(
			f"Gate Tpl {suffix}",
			level.name,
			["First criterion", "Second criterion"],
			is_evidence_mandatory_flags=[1, 0],
		)
		governance_model = self._make_governance_model(
			label="CP", checkpoint_template=template.name
		)
		project = self._make_project(governance_model=governance_model.name)

		checkpoints = frappe.get_all(
			"Project Gate Checkpoint",
			filters={"project": project.name},
			fields=["name", "stage_instance", "gate_template", "checkpoint_level"],
			order_by="name asc",
		)
		self.assertEqual(len(checkpoints), 2)
		for row in checkpoints:
			self.assertEqual(row.gate_template, template.name)
			self.assertEqual(row.checkpoint_level, level.name)
			self.assertTrue(row.name.endswith("-GATE"))

		for row in checkpoints:
			doc = frappe.get_doc("Project Gate Checkpoint", row.name)
			self.assertEqual(int(doc.get("stage_chain_version") or 1), 1)
			self.assertEqual(len(doc.checklist), 2)
			titles = [c.item_title for c in doc.checklist]
			self.assertEqual(titles, ["First criterion", "Second criterion"])
			evidence_flags = [int(c.is_evidence_mandatory or 0) for c in doc.checklist]
			self.assertEqual(evidence_flags, [1, 0])

	def _make_checkpoint_level(self, name):
		return frappe.get_doc(
			{
				"doctype": "Project Gate Checkpoint Level",
				"name": name,
				"enabled": 1,
			}
		).insert(ignore_permissions=True)

	def _make_stage_gate_template(
		self, name, checkpoint_level, item_titles, is_evidence_mandatory_flags=None
	):
		items = []
		for idx, t in enumerate(item_titles):
			row = {"title": t, "is_mandatory": 1}
			if is_evidence_mandatory_flags is not None:
				row["is_evidence_mandatory"] = int(is_evidence_mandatory_flags[idx])
			items.append(row)
		return frappe.get_doc(
			{
				"doctype": "Stage Gate Template",
				"name": name,
				"checkpoint_level": checkpoint_level,
				"enabled": 1,
				"items": items,
			}
		).insert(ignore_permissions=True)

	def _make_governance_model(
		self,
		label="Primary",
		checkpoint_template=None,
		stage_durations=None,
		stage_is_skippable=None,
	):
		suffix = frappe.generate_hash(length=6)
		stage_docs = [
			self._make_project_stage(f"{label} Idea {suffix}", f"{label[:3].upper()}-IDEA-{suffix}"),
			self._make_project_stage(
				f"{label} Discovery {suffix}", f"{label[:3].upper()}-DISC-{suffix}"
			),
		]
		self.stage_names = [doc.name for doc in stage_docs]

		stages = [
			{"stage": stage_docs[0].name, "sequence": 1},
			{"stage": stage_docs[1].name, "sequence": 2},
		]
		if stage_durations:
			for idx, row in enumerate(stages):
				if idx < len(stage_durations) and stage_durations[idx] is not None:
					row["expected_duration_days"] = stage_durations[idx]
		if stage_is_skippable:
			for idx, row in enumerate(stages):
				if idx < len(stage_is_skippable) and stage_is_skippable[idx] is not None:
					row["is_skippable"] = int(stage_is_skippable[idx])
		if checkpoint_template:
			for row in stages:
				row["checkpoint_template"] = checkpoint_template

		return frappe.get_doc(
			{
				"doctype": "Project Governance Model",
				"name": f"{label} Model {suffix}",
				"company": self.company,
				"enabled": 1,
				"stages": stages,
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

	def _make_project(
		self,
		governance_model=None,
		expected_start_date=None,
		holiday_list=None,
	):
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
		if expected_start_date:
			project.expected_start_date = expected_start_date
		if holiday_list:
			project.holiday_list = holiday_list
		project.insert(ignore_permissions=True, ignore_mandatory=True)
		return project

	def _ensure_company_default_holiday_list(self):
		if frappe.db.get_value("Company", self.company, "default_holiday_list"):
			return
		suffix = frappe.generate_hash(length=6)
		hl = frappe.get_doc(
			{
				"doctype": "Holiday List",
				"holiday_list_name": f"TEST-SG-DEFAULT-HL-{suffix}",
				"from_date": "2020-01-01",
				"to_date": "2035-12-31",
				"holidays": [],
			}
		).insert(ignore_permissions=True)
		frappe.db.set_value("Company", self.company, "default_holiday_list", hl.name)

