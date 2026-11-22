"""Workflow defaults for the documents owned by this application."""


def email_profiles():
	profiles = {
		"Project Stage Instance": {"workflow": "Project Stage Workflow", "approval_states": ()},
		"Project Gate Checkpoint": {"workflow": "Project Gate Checkpoint Workflow", "approval_states": ('In Review',)},
	}
	rejection_states = ("Rejected", "Отклонено")
	for profile in profiles.values():
		profile["migration"] = {
			"workflow_fields": {
				"send_email_alert": 1,
				"custom_group_workflow_action_emails": 1,
				"custom_group_interval_unit": "Days",
				"custom_group_interval_value": 1,
				"custom_group_send_times": "08:00, 17:00",
				"custom_group_send_time": "08:00:00",
				"custom_group_email_template": "Dinext Workflow Digest",
				"custom_workflow_action_email_template": "Dinext Workflow Action",
				"custom_attach_document_pdf": 0,
			},
			"enabled_states": profile["approval_states"] + rejection_states,
			"state_overrides": {
				state: {
					"custom_group_workflow_action_emails": 0,
					"next_action_email_template": "Dinext Workflow Correction",
				}
				for state in rejection_states
			},
			"creator_notification_states": rejection_states,
			"suppress_open_tasks_in_states": rejection_states,
		}
	return profiles
