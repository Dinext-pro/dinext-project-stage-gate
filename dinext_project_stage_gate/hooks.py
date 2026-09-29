app_name = "dinext_project_stage_gate"
app_title = "Dinext Project Stage Gate"
app_publisher = "Dinext"
app_description = "Dinext Project Stage Gate"
app_email = "info@dinext.ru"
app_license = "GNU General Public License (v3)"

required_apps = ["dinext_common", "dinext_projects"]

fixtures = [
	{
		"doctype": "Role",
		"filters": [
			[
				"name",
				"in",
				[
					"Stage Gate Owner",
					"Stage Gate Reviewer",
					"Stage Gate Approver",
					"Project Governance Admin"
				],
			],
			["disabled", "=", 0],
		],
	},
	{
		"doctype": "Custom Field",
		"filters": [
			["module", "=", "Dinext Project Stage Gate"],
		],
	},
	{
		"doctype": "Client Script",
		"filters": [
			["module", "=", "Dinext Project Stage Gate"],
			["enabled", "=", 1],
		],
	},
	{
		"doctype": "Custom DocPerm",
		"filters": [
			["parent", "in", [
				"Project Stage",
				"Project Gate Checkpoint Level",
				"Project Governance Model",
				"Project Governance Model Stage",
				"Stage Gate Template",
				"Stage Gate Template Item",
				"Project Stage Instance",
				"Project Gate Checkpoint",
				"Project Gate Checklist Item",
			]],
		],
	},
	{
		"doctype": "Workflow",
		"filters": [
			[
				"name",
				"in",
				["Project Gate Checkpoint Workflow", "Project Stage Workflow"],
			],
			["is_active", "=", 1],
		],
	},
	{
		"doctype": "Workflow Action Master",
		"filters": [
			[
				"name",
				"in",
				[
					"Submit for Review",
					"Approve",
					"Reject",
					"Revise",
					"Cancel",
					"Activate",
					"Skip",
					"Complete",
				],
			],
		],
	},
	{
		"doctype": "Workflow State",
		"filters": [
			["workflow_state_name", "in", [
				"Draft",
				"In Review",
				"Approved",
				"Rejected",
				"Canceled",
				"Planned",
				"Active",
				"Skipped",
				"Completed",
			]],
		],
	},
	{
		"doctype": "Report",
		"filters": [
			["name", "in", ["Project Stage Gate Roadmap"]],
		],
	},
	# Demo / test reference data (export with: bench --site <site> export-fixtures --app dinext_project_stage_gate)
	{
		"doctype": "Project Stage",
		"filters": [
			["stage_code", "in", ["IDEA", "INITIATION", "IMPLEMENTATION", "CLOSURE"]],
		],
	},
	{
		"doctype": "Project Gate Checkpoint Level",
		"filters": [
			[
				"name",
				"in",
				[
					"Портфельный комитет",
					"Проектный комитет",
					"Рабочая группа",
					"Руководитель проекта",
				],
			],
		],
	},
	{
		"doctype": "Stage Gate Template",
		"filters": [
			[
				"name",
				"in",
				[
					"Шаблон гейта — Идея (портфель)",
					"Шаблон гейта — Инициирование (проектный комитет)",
					"Шаблон гейта — Реализация (рабочая группа)",
					"Шаблон гейта — Завершение (руководитель проекта)",
				],
			],
		],
	},
	{
		"doctype": "Project Governance Model",
		"filters": [
			["name", "=", "Тестовая модель управления"],
		],
	},
]

# Apps
# ------------------

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "dinext_project_stage_gate",
# 		"logo": "/assets/dinext_project_stage_gate/logo.png",
# 		"title": "Dinext Project Stage Gate",
# 		"route": "/dinext_project_stage_gate",
# 		"has_permission": "dinext_project_stage_gate.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/dinext_project_stage_gate/css/dinext_project_stage_gate.css"
# app_include_js = "/assets/dinext_project_stage_gate/js/dinext_project_stage_gate.js"

# include js, css files in header of web template
# web_include_css = "/assets/dinext_project_stage_gate/css/dinext_project_stage_gate.css"
# web_include_js = "/assets/dinext_project_stage_gate/js/dinext_project_stage_gate.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "dinext_project_stage_gate/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
	"Project": "public/js/project_stage_gate_project.js",
	"Project Portfolio": "public/js/project_portfolio_stage_gate.js",
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "dinext_project_stage_gate/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "dinext_project_stage_gate.utils.jinja_methods",
# 	"filters": "dinext_project_stage_gate.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "dinext_project_stage_gate.install.before_install"
after_install = "dinext_project_stage_gate.install.after_install"
after_migrate = "dinext_project_stage_gate.install.after_migrate"

# Uninstallation
# ------------

# before_uninstall = "dinext_project_stage_gate.uninstall.before_uninstall"
# after_uninstall = "dinext_project_stage_gate.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "dinext_project_stage_gate.utils.before_app_install"
# after_app_install = "dinext_project_stage_gate.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "dinext_project_stage_gate.utils.before_app_uninstall"
# after_app_uninstall = "dinext_project_stage_gate.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "dinext_project_stage_gate.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Project": {
		"validate": "dinext_project_stage_gate.stage_gate.project_hooks.validate_project_governance_model_change",
		"before_save": "dinext_project_stage_gate.stage_gate.project_hooks.before_save_project_governance_reset",
		"after_insert": "dinext_project_stage_gate.stage_gate.project_hooks.sync_project_stage_chain",
		"on_update": "dinext_project_stage_gate.stage_gate.project_hooks.sync_project_stage_chain",
	},
	"Project Stage Instance": {
		"on_update": "dinext_project_stage_gate.stage_gate.project_hooks.sync_project_stage_summary_from_instance",
		"on_trash": "dinext_project_stage_gate.stage_gate.project_hooks.sync_project_stage_summary_from_instance",
	},
}

# Scheduled Tasks
# ---------------

scheduler_events = {
	"daily": [
		"dinext_project_stage_gate.tasks.daily",
	],
}

# Testing
# -------

# before_tests = "dinext_project_stage_gate.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "dinext_project_stage_gate.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "dinext_project_stage_gate.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["dinext_project_stage_gate.utils.before_request"]
# after_request = ["dinext_project_stage_gate.utils.after_request"]

# Job Events
# ----------
# before_job = ["dinext_project_stage_gate.utils.before_job"]
# after_job = ["dinext_project_stage_gate.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"dinext_project_stage_gate.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

