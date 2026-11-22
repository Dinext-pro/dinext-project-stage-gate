"""Workflow defaults for the documents owned by this application."""


def email_profiles():
	return {
		"Project Stage Instance": {"workflow": "Project Stage Workflow", "approval_states": ()},
		"Project Gate Checkpoint": {"workflow": "Project Gate Checkpoint Workflow", "approval_states": ('In Review',)},
	}
