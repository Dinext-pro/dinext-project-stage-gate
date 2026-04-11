import unittest

from dinext_project_stage_gate.stage_gate import permissions


class TestStageGatePermissions(unittest.TestCase):
	def test_checkpoint_level_is_treated_as_master_doctype(self):
		result = permissions.get_permissions_for_doctype("Project Gate Checkpoint Level")

		self.assertEqual(
			result,
			[
				{
					"role": "Project Governance Admin",
					"read": 1,
					"write": 1,
					"create": 1,
					"delete": 1,
					"report": 1,
					"export": 1,
				}
			],
		)

	def test_master_doctypes_only_expose_governance_admin_permissions(self):
		result = permissions.get_permissions_for_doctype("Project Governance Model")

		self.assertEqual(
			result,
			[
				{
					"role": "Project Governance Admin",
					"read": 1,
					"write": 1,
					"create": 1,
					"delete": 1,
					"report": 1,
					"export": 1,
				}
			],
		)

	def test_transaction_doctypes_expose_owner_reviewer_approver_and_admin(self):
		result = permissions.get_permissions_for_doctype("Project Gate Checkpoint")
		roles = [row["role"] for row in result]

		self.assertEqual(
			roles,
			[
				"Project Governance Admin",
				"Stage Gate Owner",
				"Stage Gate Reviewer",
				"Stage Gate Approver",
			],
		)
		self.assertEqual(
			next(row for row in result if row["role"] == "Stage Gate Owner")["create"], 1
		)
		self.assertEqual(
			next(row for row in result if row["role"] == "Stage Gate Approver")["create"], 0
		)

	def test_unknown_doctype_has_no_permissions(self):
		self.assertEqual(permissions.get_permissions_for_doctype("Task"), [])
