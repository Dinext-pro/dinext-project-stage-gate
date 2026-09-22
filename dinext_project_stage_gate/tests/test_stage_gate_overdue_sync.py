# Copyright (c) 2026, Dinext and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from dinext_project_stage_gate.stage_gate.overdue_sync import (
	compute_checkpoint_is_overdue,
	compute_stage_is_overdue,
	sync_overdue_flags,
)
from dinext_project_stage_gate.tasks import daily


REFERENCE_DATE = "2026-06-15"


class TestStageGateOverdueSync(FrappeTestCase):
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

	def test_compute_stage_planned_start_past(self):
		self.assertTrue(
			compute_stage_is_overdue(
				"Planned", "2026-06-01", "2026-12-31", REFERENCE_DATE
			)
		)

	def test_compute_stage_planned_start_future(self):
		self.assertFalse(
			compute_stage_is_overdue(
				"Planned", "2026-07-01", "2026-12-31", REFERENCE_DATE
			)
		)

	def test_compute_stage_end_past_active(self):
		self.assertTrue(
			compute_stage_is_overdue(
				"Active", "2026-01-01", "2026-06-01", REFERENCE_DATE
			)
		)

	def test_compute_stage_ignored_statuses(self):
		for status in ("Completed", "Canceled", "Skipped"):
			self.assertFalse(
				compute_stage_is_overdue(
					status, "2020-01-01", "2020-01-02", REFERENCE_DATE
				)
			)

	def test_compute_checkpoint_overdue_and_ignored(self):
		self.assertTrue(
			compute_checkpoint_is_overdue("Draft", "2026-06-01", REFERENCE_DATE)
		)
		self.assertFalse(
			compute_checkpoint_is_overdue("Approved", "2026-06-01", REFERENCE_DATE)
		)
		self.assertFalse(
			compute_checkpoint_is_overdue("Canceled", "2026-06-01", REFERENCE_DATE)
		)
		self.assertFalse(compute_checkpoint_is_overdue("Draft", None, REFERENCE_DATE))

	def test_sync_marks_planned_stage_overdue_when_start_date_past(self):
		stage = self._make_planned_stage_instance(
			planned_start_date="2026-06-01",
			planned_end_date="2026-12-31",
		)
		frappe.db.set_value(
			"Project Stage Instance", stage.name, "is_overdue", 0, update_modified=False
		)
		sync_overdue_flags(reference_date=REFERENCE_DATE)
		self.assertEqual(
			int(frappe.db.get_value("Project Stage Instance", stage.name, "is_overdue") or 0),
			1,
		)

	def test_sync_does_not_mark_planned_stage_when_start_date_future(self):
		stage = self._make_planned_stage_instance(
			planned_start_date="2026-07-01",
			planned_end_date="2026-12-31",
		)
		sync_overdue_flags(reference_date=REFERENCE_DATE)
		self.assertEqual(
			int(frappe.db.get_value("Project Stage Instance", stage.name, "is_overdue") or 0),
			0,
		)

	def test_sync_marks_active_stage_overdue_when_end_date_past(self):
		stage = self._provisioned_stage_instance(sequence=2)
		frappe.db.set_value(
			"Project Stage Instance",
			stage.name,
			{
				"status": "Active",
				"planned_start_date": "2026-01-01",
				"planned_end_date": "2026-06-01",
				"is_overdue": 0,
			},
			update_modified=False,
		)
		sync_overdue_flags(reference_date=REFERENCE_DATE)
		self.assertEqual(
			int(frappe.db.get_value("Project Stage Instance", stage.name, "is_overdue") or 0),
			1,
		)

	def test_sync_clears_overdue_when_stage_completed(self):
		stage = self._provisioned_stage_instance(sequence=1)
		frappe.db.set_value(
			"Project Stage Instance",
			stage.name,
			{
				"status": "Completed",
				"planned_end_date": "2026-06-01",
				"is_overdue": 1,
			},
			update_modified=False,
		)
		sync_overdue_flags(reference_date=REFERENCE_DATE)
		self.assertEqual(
			int(frappe.db.get_value("Project Stage Instance", stage.name, "is_overdue") or 0),
			0,
		)

	def test_sync_clears_overdue_for_canceled_and_skipped_stage(self):
		for status in ("Canceled", "Skipped"):
			stage = self._provisioned_stage_instance(sequence=2)
			frappe.db.set_value(
				"Project Stage Instance",
				stage.name,
				{
					"status": status,
					"planned_end_date": "2026-06-01",
					"is_overdue": 1,
				},
				update_modified=False,
			)
			sync_overdue_flags(reference_date=REFERENCE_DATE)
			self.assertEqual(
				int(
					frappe.db.get_value("Project Stage Instance", stage.name, "is_overdue")
					or 0
				),
				0,
				msg=f"status={status}",
			)

	def test_sync_marks_checkpoint_overdue_when_due_date_past(self):
		checkpoint = self._load_provisioned_checkpoint()
		frappe.db.set_value(
			"Project Gate Checkpoint",
			checkpoint.name,
			{
				"status": "Draft",
				"gate_due_date": "2026-06-01",
				"is_overdue": 0,
			},
			update_modified=False,
		)
		sync_overdue_flags(reference_date=REFERENCE_DATE)
		self.assertEqual(
			int(
				frappe.db.get_value("Project Gate Checkpoint", checkpoint.name, "is_overdue")
				or 0
			),
			1,
		)

	def test_sync_clears_checkpoint_overdue_when_approved(self):
		checkpoint = self._load_provisioned_checkpoint()
		frappe.db.set_value(
			"Project Gate Checkpoint",
			checkpoint.name,
			{
				"status": "Approved",
				"gate_due_date": "2026-06-01",
				"is_overdue": 1,
			},
			update_modified=False,
		)
		sync_overdue_flags(reference_date=REFERENCE_DATE)
		self.assertEqual(
			int(
				frappe.db.get_value("Project Gate Checkpoint", checkpoint.name, "is_overdue")
				or 0
			),
			0,
		)

	def test_sync_clears_checkpoint_overdue_when_canceled(self):
		checkpoint = self._load_provisioned_checkpoint()
		frappe.db.set_value(
			"Project Gate Checkpoint",
			checkpoint.name,
			{
				"status": "Canceled",
				"gate_due_date": "2026-06-01",
				"is_overdue": 1,
			},
			update_modified=False,
		)
		sync_overdue_flags(reference_date=REFERENCE_DATE)
		self.assertEqual(
			int(
				frappe.db.get_value("Project Gate Checkpoint", checkpoint.name, "is_overdue")
				or 0
			),
			0,
		)

	def test_sync_does_not_mark_checkpoint_without_due_date(self):
		checkpoint = self._load_provisioned_checkpoint()
		frappe.db.set_value(
			"Project Gate Checkpoint",
			checkpoint.name,
			{
				"status": "Draft",
				"gate_due_date": None,
				"is_overdue": 0,
			},
			update_modified=False,
		)
		sync_overdue_flags(reference_date=REFERENCE_DATE)
		self.assertEqual(
			int(
				frappe.db.get_value("Project Gate Checkpoint", checkpoint.name, "is_overdue")
				or 0
			),
			0,
		)

	def test_save_clears_stage_overdue_on_completed(self):
		stage = self._provisioned_stage_instance(sequence=1)
		frappe.db.set_value(
			"Project Stage Instance",
			stage.name,
			{
				"status": "Active",
				"planned_end_date": "2026-06-01",
				"is_overdue": 1,
			},
			update_modified=False,
		)
		stage = frappe.get_doc("Project Stage Instance", stage.name)
		stage.status = "Completed"
		with patch("frappe.model.document.validate_workflow"):
			stage.save(ignore_permissions=True)
		stage.reload()
		self.assertEqual(int(stage.is_overdue or 0), 0)

	def test_save_clears_stage_overdue_on_canceled_and_skipped(self):
		for status in ("Canceled", "Skipped"):
			stage = self._provisioned_stage_instance(sequence=2)
			frappe.db.set_value(
				"Project Stage Instance",
				stage.name,
				{
					"status": "Active",
					"planned_end_date": "2026-06-01",
					"is_overdue": 1,
				},
				update_modified=False,
			)
			stage = frappe.get_doc("Project Stage Instance", stage.name)
			stage.status = status
			with patch("frappe.model.document.validate_workflow"):
				stage.save(ignore_permissions=True)
			stage.reload()
			self.assertEqual(int(stage.is_overdue or 0), 0, msg=f"status={status}")

	def test_save_sets_stage_overdue_when_active_and_end_date_past(self):
		stage = self._provisioned_stage_instance(sequence=1)
		frappe.db.set_value(
			"Project Stage Instance",
			stage.name,
			{
				"status": "Active",
				"planned_start_date": "2026-01-01",
				"planned_end_date": "2026-06-01",
				"actual_start_date": "2026-01-01",
				"is_overdue": 0,
			},
			update_modified=False,
		)
		stage = frappe.get_doc("Project Stage Instance", stage.name)
		with patch(
			"dinext_project_stage_gate.stage_gate.overdue_sync.today",
			return_value=REFERENCE_DATE,
		):
			with patch("frappe.model.document.validate_workflow"):
				stage.save(ignore_permissions=True)
		stage.reload()
		self.assertEqual(int(stage.is_overdue or 0), 1)

	def test_save_clears_checkpoint_overdue_on_approved(self):
		frappe.set_user("Administrator")
		checkpoint = self._load_provisioned_checkpoint()
		frappe.db.set_value(
			"Project Gate Checkpoint",
			checkpoint.name,
			{
				"status": "In Review",
				"gate_due_date": "2026-06-01",
				"is_overdue": 1,
			},
			update_modified=False,
		)
		checkpoint = frappe.get_doc("Project Gate Checkpoint", checkpoint.name)
		checkpoint.status = "Approved"
		with patch("frappe.model.document.validate_workflow"):
			checkpoint.save(ignore_permissions=True)
		checkpoint.reload()
		self.assertEqual(int(checkpoint.is_overdue or 0), 0)

	def test_save_clears_checkpoint_overdue_on_canceled(self):
		checkpoint = self._load_provisioned_checkpoint()
		frappe.db.set_value(
			"Project Gate Checkpoint",
			checkpoint.name,
			{
				"status": "Draft",
				"gate_due_date": "2026-06-01",
				"is_overdue": 1,
			},
			update_modified=False,
		)
		checkpoint = frappe.get_doc("Project Gate Checkpoint", checkpoint.name)
		checkpoint.status = "Canceled"
		with patch("frappe.model.document.validate_workflow"):
			checkpoint.save(ignore_permissions=True)
		checkpoint.reload()
		self.assertEqual(int(checkpoint.is_overdue or 0), 0)

	def test_daily_task_invokes_sync(self):
		stage = self._make_planned_stage_instance(
			planned_start_date="2026-06-01",
			planned_end_date="2026-12-31",
		)
		frappe.db.set_value(
			"Project Stage Instance", stage.name, "is_overdue", 0, update_modified=False
		)
		with patch(
			"dinext_project_stage_gate.tasks.sync_overdue_flags",
			return_value={"stages_updated": 1, "checkpoints_updated": 0},
		) as sync_mock:
			daily()
		sync_mock.assert_called_once_with()

	def test_hooks_register_daily_scheduler(self):
		from dinext_project_stage_gate import hooks

		self.assertIn(
			"dinext_project_stage_gate.tasks.daily",
			hooks.scheduler_events.get("daily", []),
		)

	def _make_planned_stage_instance(self, planned_start_date, planned_end_date):
		stage = self._provisioned_stage_instance(sequence=2)
		frappe.db.set_value(
			"Project Stage Instance",
			stage.name,
			{
				"status": "Planned",
				"planned_start_date": planned_start_date,
				"planned_end_date": planned_end_date,
				"is_overdue": 0,
			},
			update_modified=False,
		)
		return frappe.get_doc("Project Stage Instance", stage.name)

	def _provisioned_stage_instance(self, sequence=1):
		governance_model = self._make_governance_model()
		project = self._make_project(governance_model=governance_model.name)
		stage_name = frappe.db.get_value(
			"Project Stage Instance",
			{"project": project.name, "sequence": sequence},
			"name",
		)
		self.assertTrue(stage_name)
		return frappe.get_doc("Project Stage Instance", stage_name)

	def _load_provisioned_checkpoint(self):
		suffix = frappe.generate_hash(length=6)
		level = frappe.get_doc(
			{
				"doctype": "Project Gate Checkpoint Level",
				"name": f"CP Level {suffix}",
				"enabled": 1,
			}
		).insert(ignore_permissions=True)
		template = frappe.get_doc(
			{
				"doctype": "Stage Gate Template",
				"name": f"Gate Tpl {suffix}",
				"checkpoint_level": level.name,
				"enabled": 1,
				"items": [
					{"title": "Criterion", "is_mandatory": 1, "is_evidence_mandatory": 0},
				],
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
				"project_name": f"Overdue sync {suffix}",
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
		self.assertTrue(checkpoints)
		return frappe.get_doc("Project Gate Checkpoint", checkpoints[0])

	def _make_governance_model(self, label="Overdue"):
		suffix = frappe.generate_hash(length=6)
		stage_docs = [
			frappe.get_doc(
				{
					"doctype": "Project Stage",
					"name": f"{label} Idea {suffix}",
					"stage_code": f"{label[:3].upper()}-IDEA-{suffix}",
					"enabled": 1,
				}
			).insert(ignore_permissions=True),
			frappe.get_doc(
				{
					"doctype": "Project Stage",
					"name": f"{label} Discovery {suffix}",
					"stage_code": f"{label[:3].upper()}-DISC-{suffix}",
					"enabled": 1,
				}
			).insert(ignore_permissions=True),
		]
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

	def _make_project(self, governance_model=None):
		project = frappe.get_doc(
			{
				"doctype": "Project",
				"name": f"TEST-PROJ-{frappe.generate_hash(length=6)}",
				"project_name": f"Overdue Project {frappe.generate_hash(length=6)}",
				"naming_series": "PROJ-.####",
				"company": self.company,
				"governance_model": governance_model,
			}
		)
		project.insert(ignore_permissions=True, ignore_mandatory=True)
		return project

	def _ensure_company_default_holiday_list(self):
		if frappe.db.get_value("Company", self.company, "default_holiday_list"):
			return
		suffix = frappe.generate_hash(length=6)
		hl = frappe.get_doc(
			{
				"doctype": "Holiday List",
				"holiday_list_name": f"TEST-OVERDUE-HL-{suffix}",
				"from_date": "2020-01-01",
				"to_date": "2035-12-31",
				"holidays": [],
			}
		).insert(ignore_permissions=True)
		frappe.db.set_value("Company", self.company, "default_holiday_list", hl.name)
