MASTER_DOCTYPES = {
	"Project Stage",
	"Project Gate Checkpoint Level",
	"Project Governance Model",
	"Project Governance Model Stage",
	"Stage Gate Template",
	"Stage Gate Template Item",
}

TRANSACTION_DOCTYPES = {
	"Project Stage Instance",
	"Project Gate Checkpoint",
	"Project Gate Checklist Item",
}

ROLE_PERMISSION_MATRIX = {
	"Project Governance Admin": {
		"masters": {"read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "export": 1},
		"transactions": {"read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "export": 1},
	},
	"Stage Gate Owner": {
		"transactions": {"read": 1, "write": 1, "create": 1, "delete": 0, "report": 1, "export": 0},
	},
	"Stage Gate Reviewer": {
		"transactions": {"read": 1, "write": 1, "create": 0, "delete": 0, "report": 1, "export": 0},
	},
	"Stage Gate Approver": {
		"transactions": {"read": 1, "write": 1, "create": 0, "delete": 0, "report": 1, "export": 0},
	},
}


def get_permissions_for_doctype(doctype):
	permissions = []
	for role, scopes in ROLE_PERMISSION_MATRIX.items():
		if doctype in MASTER_DOCTYPES and scopes.get("masters"):
			permissions.append({"role": role, **scopes["masters"]})
		if doctype in TRANSACTION_DOCTYPES and scopes.get("transactions"):
			permissions.append({"role": role, **scopes["transactions"]})
	return permissions

