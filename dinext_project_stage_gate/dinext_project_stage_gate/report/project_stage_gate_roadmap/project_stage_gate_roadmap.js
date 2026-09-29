frappe.query_reports["Project Stage Gate Roadmap"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			description: __("Limit roadmap to projects from a specific company."),
			fieldtype: "Link",
			options: "Company",
		},
		{
			fieldname: "portfolio",
			label: __("Portfolio"),
			description: __("Show only projects that belong to the selected portfolio."),
			fieldtype: "Link",
			options: "Project Portfolio",
		},
		{
			fieldname: "customer",
			label: __("Customer"),
			description: __("Filter roadmap entries by customer."),
			fieldtype: "Link",
			options: "Customer",
		},
		{
			fieldname: "project",
			label: __("Project"),
			description: __("Focus roadmap on a single project."),
			fieldtype: "Link",
			options: "Project",
		},
		{
			fieldname: "project_type",
			label: __("Project Type"),
			description: __("Filter projects by project type."),
			fieldtype: "Link",
			options: "Project Type",
		},
		{
			fieldname: "project_status",
			label: __("Project Status"),
			description: __("Filter projects by lifecycle status."),
			fieldtype: "Select",
			options: [
				"",
				{ value: "Open", label: __("Open") },
				{ value: "Completed", label: __("Completed") },
				{ value: "Cancelled", label: __("Cancelled") },
			],
		},
		{
			fieldname: "project_manager",
			label: __("Project Manager"),
			description: __("Show projects assigned to the selected project manager."),
			fieldtype: "Link",
			options: "User",
		},
		{
			fieldname: "project_manager_role",
			label: __("Project Manager Role"),
			description: __("Role used to identify the project manager in project team members."),
			fieldtype: "Link",
			options: "Project Role",
			default: "Руководитель проекта",
			get_query() {
				return {
					filters: {
						enabled: 1,
					},
				};
			},
		},
		{
			fieldname: "governance_model",
			label: __("Governance Model"),
			description: __("Filter by the governance model assigned to the project."),
			fieldtype: "Link",
			options: "Project Governance Model",
		},
		{
			fieldname: "from_date",
			label: __("From"),
			description: __("Start date of the roadmap time window."),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -12),
		},
		{
			fieldname: "to_date",
			label: __("To"),
			description: __("End date of the roadmap time window."),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), 36),
		},
		{
			fieldname: "active_only",
			label: __("Active Only"),
			description: __("Show only active projects in the roadmap."),
			fieldtype: "Check",
			default: 1,
		},
		{
			fieldname: "show_stages_and_checkpoints",
			label: __("Show Stages & Checkpoints"),
			description: __("Display stage bars and gate checkpoint markers."),
			fieldtype: "Check",
			default: 1,
		},
		{
			fieldname: "show_milestones",
			label: __("Show Milestones"),
			description: __("Display milestone points on the roadmap."),
			fieldtype: "Check",
			default: 0,
		},
		{
			fieldname: "task_types",
			label: __("Task Types"),
			description: __("Display task bars only for selected task types."),
			fieldtype: "MultiSelectList",
			options: "Task Type",
			get_data(txt) {
				return dinext_project_stage_gate.roadmap.translateLinkOptions(
					frappe.db.get_link_options("Task Type", txt)
				);
			},
		},
		{
			fieldname: "roadmap_project_focus",
			label: __("Roadmap Project Focus"),
			description: __("Internal flag used when opening the roadmap from a project."),
			fieldtype: "Check",
			hidden: 1,
		},
	],

	onload(report) {
		frappe.require(["/assets/dinext_project_stage_gate/js/stage_gate_status_palette.js"], () => {
			dinext_project_stage_gate.roadmap.ensureStatusPalette();
		});
		report._dinextRoadmapProjectFocusPromise =
			dinext_project_stage_gate.roadmap.applyProjectFocusRouteOptions(report);
		dinext_project_stage_gate.roadmap.wrapReportRefresh(report);
		dinext_project_stage_gate.roadmap.ensure_chart_mount(report);
		dinext_project_stage_gate.roadmap.ensure_theme_observer(report);
		dinext_project_stage_gate.roadmap.ensureResizeHandler(report);
		dinext_project_stage_gate.roadmap.ensureActionsMenuObserver(report);
		dinext_project_stage_gate.roadmap.hideActionsMenu(report);
		applyRoadmapStyle();
	},

	formatter(value, row, column, data, default_formatter) {
		if (column.fieldname === "current_stage" && value) {
			return __(value);
		}
		return default_formatter(value, row, column, data);
	},

	after_datatable_render(_datatable) {
		const report = frappe.query_report;
		if (!dinext_project_stage_gate.roadmap.isRoadmapReport(report)) {
			return;
		}
		if (report?._dinextRoadmapSkipNextDatatableRender) {
			report._dinextRoadmapSkipNextDatatableRender = false;
			return;
		}
		dinext_project_stage_gate.roadmap.render(report);
	},
};

function applyRoadmapStyle() {
	var styles = `
        .multiselect-list.dropdown {
	        width: 100%;
        }	
		.project-stage-gate-roadmap-shell {
			margin: 0 0 16px 0;
			position: relative;
		}
		.project-stage-gate-roadmap-chart {
			background: transparent;
		}
		.project-stage-gate-roadmap-sort-menu {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 6px;
			box-shadow: var(--shadow-md);
			min-width: 240px;
			padding: 6px;
			position: absolute;
			right: 8px;
			top: 28px;
			z-index: 30;
		}
		.project-stage-gate-roadmap-sort-menu-title {
			color: var(--text-muted);
			font-size: 11px;
			font-weight: 600;
			padding: 4px 8px 6px;
			text-transform: uppercase;
		}
		.project-stage-gate-roadmap-sort-menu-item {
			align-items: center;
			background: transparent;
			border: 0;
			border-radius: 4px;
			color: var(--text-color);
			display: flex;
			font-size: 12px;
			justify-content: space-between;
			padding: 6px 8px;
			text-align: left;
			width: 100%;
		}
		.project-stage-gate-roadmap-sort-menu-item:hover,
		.project-stage-gate-roadmap-sort-menu-item.is-active {
			background: var(--control-bg);
		}
		.project-stage-gate-roadmap-sort-menu-direction-icon {
			color: var(--text-muted);
			font-size: 13px;
			font-weight: 700;
			line-height: 1;
		}
    `;

	var styleSheet = document.createElement("style");
	styleSheet.textContent = styles;
	document.head.appendChild(styleSheet);
}

frappe.provide("dinext_project_stage_gate.roadmap");

const DINEXT_ROADMAP_REPORT_NAME = "Project Stage Gate Roadmap";

dinext_project_stage_gate.roadmap.isRoadmapReport = function (report) {
	return (report?.report_name || "") === DINEXT_ROADMAP_REPORT_NAME;
};

dinext_project_stage_gate.roadmap.teardownRoadmapMount = function (report) {
	if (!report?.page?.main || typeof report.page.main.find !== "function") {
		return;
	}
	const mount = report.page.main.find(".project-stage-gate-roadmap-shell");
	if (mount?.remove) {
		mount.remove();
	}
};

dinext_project_stage_gate.roadmap.teardownRoadmapSession = function (report) {
	if (!report) {
		return;
	}
	dinext_project_stage_gate.roadmap.teardownRoadmapMount(report);
	report._dinextRoadmapProjectFocusPromise = null;
	report._dinextRoadmapProjectFocusPending = false;
	report._dinextRoadmapProjectFocusDatesApplied = false;
	report._dinextRoadmapSkipNextDatatableRender = false;
};

const DINEXT_TASK_TYPE_TRANSLATION_CONTEXT = "Dinext.TaskType";
const DINEXT_STAGE_GATE_TRANSLATION_CONTEXT = "Dinext.StageGateModel";

dinext_project_stage_gate.roadmap.translateWithContext = function (text, context) {
	if (!text) {
		return text;
	}
	return context ? __(text, null, context) : __(text);
};

dinext_project_stage_gate.roadmap.translateTaskTypeLabel = function (text) {
	return dinext_project_stage_gate.roadmap.translateWithContext(
		text,
		DINEXT_TASK_TYPE_TRANSLATION_CONTEXT
	);
};

dinext_project_stage_gate.roadmap.translateStageGateLabel = function (text) {
	return dinext_project_stage_gate.roadmap.translateWithContext(
		text,
		DINEXT_STAGE_GATE_TRANSLATION_CONTEXT
	);
};

dinext_project_stage_gate.roadmap.translateLinkOption = function (option) {
	if (typeof option === "string") {
		return {
			value: option,
			label: dinext_project_stage_gate.roadmap.translateTaskTypeLabel(option),
			description: dinext_project_stage_gate.roadmap.translateTaskTypeLabel(option),
		};
	}
	if (!option) {
		return option;
	}
	const value = option.value || option.label || "";
	const label = option.label || value;
	const description = option.description || label;
	return {
		...option,
		value,
		label: label ? dinext_project_stage_gate.roadmap.translateTaskTypeLabel(label) : label,
		description: description
			? dinext_project_stage_gate.roadmap.translateTaskTypeLabel(description)
			: description,
	};
};

dinext_project_stage_gate.roadmap.translateLinkOptions = function (options) {
	if (options && typeof options.then === "function") {
		return options.then((resolvedOptions) =>
			dinext_project_stage_gate.roadmap.translateLinkOptions(resolvedOptions)
		);
	}
	return (options || []).map(dinext_project_stage_gate.roadmap.translateLinkOption);
};

dinext_project_stage_gate.roadmap.PROJECT_FOCUS_TASK_TYPES = ["Phase", "Stage", "Sprint"];

dinext_project_stage_gate.roadmap.getProjectFocusRouteFilters = function (routeOptions) {
	if (!routeOptions || !dinext_project_stage_gate.roadmap._coerceToCheck(routeOptions.roadmap_project_focus)) {
		return null;
	}

	const filters = {
		project: routeOptions.project,
		show_stages_and_checkpoints: 1,
		show_milestones: 1,
		task_types: [...dinext_project_stage_gate.roadmap.PROJECT_FOCUS_TASK_TYPES],
	};
	if (routeOptions.from_date) {
		filters.from_date = routeOptions.from_date;
	}
	if (routeOptions.to_date) {
		filters.to_date = routeOptions.to_date;
	}
	return filters;
};

dinext_project_stage_gate.roadmap.getProjectFocusAppliedFilters = function (report) {
	if (!report || !dinext_project_stage_gate.roadmap._coerceToCheck(report.get_filter_value?.("roadmap_project_focus"))) {
		return null;
	}

	const filters = {
		project: report.get_filter_value?.("project"),
		show_stages_and_checkpoints: 1,
		show_milestones: 1,
		task_types: [...dinext_project_stage_gate.roadmap.PROJECT_FOCUS_TASK_TYPES],
		roadmap_project_focus: 0,
	};
	const fromDate = report.get_filter_value?.("from_date");
	const toDate = report.get_filter_value?.("to_date");
	if (fromDate) {
		filters.from_date = fromDate;
	}
	if (toDate) {
		filters.to_date = toDate;
	}
	return filters;
};

dinext_project_stage_gate.roadmap.setReportFilterValueSilently = async function (
	report,
	fieldname,
	value
) {
	if (!report || !fieldname) {
		return false;
	}
	const filter =
		(typeof report.get_filter === "function" && report.get_filter(fieldname)) ||
		null;
	if (filter && typeof filter.set_value === "function") {
		await filter.set_value(value, true);
		return true;
	}
	if (typeof report.set_filter_value === "function") {
		await report.set_filter_value(fieldname, value);
		return true;
	}
	return false;
};

dinext_project_stage_gate.roadmap.applyProjectFocusRouteOptions = async function (report) {
	const filters =
		dinext_project_stage_gate.roadmap.getProjectFocusRouteFilters(frappe?.route_options) ||
		dinext_project_stage_gate.roadmap.getProjectFocusAppliedFilters(report);
	if (!filters) {
		return false;
	}

	report._dinextRoadmapProjectFocusPending = true;
	const oldNoRefresh = report._no_refresh;
	report._no_refresh = true;
	try {
		for (const [fieldname, value] of Object.entries(filters)) {
			if (value !== undefined && value !== null && value !== "") {
				await dinext_project_stage_gate.roadmap.setReportFilterValueSilently(
					report,
					fieldname,
					value
				);
			}
		}
	} finally {
		report._no_refresh = oldNoRefresh;
	}

	if (frappe?.route_options) {
		delete frappe.route_options.roadmap_project_focus;
	}
	return true;
};

dinext_project_stage_gate.roadmap.getSelectedProjectFromPayload = function (report, payload) {
	const projectName = report?.get_filter_value?.("project");
	if (!projectName) {
		return null;
	}
	return (payload?.projects || []).find((project) => project?.name === projectName) || null;
};

dinext_project_stage_gate.roadmap.applyProjectFocusDatasetDateRange = async function (
	report,
	payload
) {
	if (
		!report?._dinextRoadmapProjectFocusPending ||
		report._dinextRoadmapProjectFocusDatesApplied
	) {
		return false;
	}

	const currentFrom = report.get_filter_value?.("from_date");
	const currentTo = report.get_filter_value?.("to_date");
	if (currentFrom && currentTo) {
		report._dinextRoadmapProjectFocusDatesApplied = true;
		return false;
	}

	const project = dinext_project_stage_gate.roadmap.getSelectedProjectFromPayload(report, payload);
	if (!project) {
		return false;
	}

	const updates = {};
	if (!currentFrom && project.expected_start_date) {
		updates.from_date = project.expected_start_date;
	}
	if (!currentTo && project.expected_end_date) {
		updates.to_date = project.expected_end_date;
	}
	if (!Object.keys(updates).length) {
		return false;
	}

	const oldNoRefresh = report._no_refresh;
	report._no_refresh = true;
	try {
		for (const [fieldname, value] of Object.entries(updates)) {
			await dinext_project_stage_gate.roadmap.setReportFilterValueSilently(
				report,
				fieldname,
				value
			);
		}
	} finally {
		report._no_refresh = oldNoRefresh;
	}

	report._dinextRoadmapProjectFocusDatesApplied = true;
	return true;
};

dinext_project_stage_gate.roadmap.translateReportFilterControls = function (report) {
	(report?.filters || []).forEach((df) => {
		if (!df?.fieldname || typeof report.get_filter !== "function") {
			return;
		}
		const field = report.get_filter(df.fieldname);
		if (!field?.df) {
			return;
		}
		if (field.df.label && typeof field.set_label === "function") {
			field._label = null;
			field.set_label();
		}
		if (field.df.description && typeof field.set_description === "function") {
			field._description = null;
			field.set_description();
		}
		field.$list_wrapper?.find?.(".clear-selections")?.text?.(__("Clear All"));
	});
};

dinext_project_stage_gate.roadmap.getEmptyPayload = function () {
	return {
		projects: [],
		stageBars: [],
		gates: [],
		taskEntities: [],
	};
};

dinext_project_stage_gate.roadmap.normalizeReportPayload = function (report) {
	if (Array.isArray(report?.data) && report.data.length) {
		return report.raw_data;
	}

	report.raw_data = {
		...(report.raw_data || {}),
		result: [],
		message: dinext_project_stage_gate.roadmap.getEmptyPayload(),
	};
	return report.raw_data;
};

dinext_project_stage_gate.roadmap.wrapReportRefresh = function (report) {
	if (!report || typeof report.refresh !== "function" || report._dinextRoadmapRefreshWrapped) {
		return;
	}

	const baseRefresh = report.refresh.bind(report);
	report.refresh = function (...args) {
		if (!dinext_project_stage_gate.roadmap.isRoadmapReport(report)) {
			dinext_project_stage_gate.roadmap.teardownRoadmapSession(report);
			return baseRefresh(...args);
		}

		report._dinextRoadmapSkipNextDatatableRender = true;
		const renderAfterRefresh = () => {
			report._dinextRoadmapSkipNextDatatableRender = false;
			if (!dinext_project_stage_gate.roadmap.isRoadmapReport(report)) {
				dinext_project_stage_gate.roadmap.teardownRoadmapSession(report);
				return Promise.resolve();
			}
			dinext_project_stage_gate.roadmap.normalizeReportPayload(report);
			return Promise.resolve(dinext_project_stage_gate.roadmap.render(report));
		};
		const runBaseRefresh = () => {
			const refreshResult = baseRefresh(...args);

			if (refreshResult && typeof refreshResult.then === "function") {
				return refreshResult.then(
					(value) => renderAfterRefresh().then(() => value),
					(error) => {
						report._dinextRoadmapSkipNextDatatableRender = false;
						throw error;
					}
				);
			}

			renderAfterRefresh();
			return refreshResult;
		};
		const projectFocusPromise = report._dinextRoadmapProjectFocusPromise;
		if (projectFocusPromise && typeof projectFocusPromise.then === "function") {
			return projectFocusPromise.then(
				() => {
					report._dinextRoadmapProjectFocusPromise = null;
					return runBaseRefresh();
				},
				(error) => {
					report._dinextRoadmapProjectFocusPromise = null;
					report._dinextRoadmapSkipNextDatatableRender = false;
					throw error;
				}
			);
		}

		return runBaseRefresh();
	};
	report._dinextRoadmapRefreshWrapped = true;
};

dinext_project_stage_gate.roadmap.hideActionsMenu = function (report) {
	const page = report?.page;
	if (!page) {
		return;
	}

	const actionsLabel = __("Actions");
	const mobileActionsPrefix = `${actionsLabel} >`;

	page.get_inner_group_button?.(actionsLabel)?.remove();

	page.menu
		?.find(".menu-item-label")
		?.filter((_, element) => $(element).text().trim().startsWith(mobileActionsPrefix))
		?.closest("li")
		?.remove();
};

dinext_project_stage_gate.roadmap.ensureActionsMenuObserver = function (report) {
	const page = report?.page;
	if (
		!page ||
		page._dinextRoadmapActionsMenuObserverInstalled ||
		typeof window?.MutationObserver !== "function"
	) {
		return;
	}

	const toolbarElement = page.inner_toolbar?.get?.(0) || page.inner_toolbar?.[0];
	const menuElement = page.menu?.get?.(0) || page.menu?.[0];

	const observer = new window.MutationObserver(() => {
		const activeReport = frappe?.query_report || report;
		if (!dinext_project_stage_gate.roadmap.isRoadmapReport(activeReport)) {
			return;
		}
		dinext_project_stage_gate.roadmap.hideActionsMenu(activeReport);
	});

	if (toolbarElement) {
		observer.observe(toolbarElement, { childList: true, subtree: true });
	}
	if (menuElement) {
		observer.observe(menuElement, { childList: true, subtree: true });
	}

	page._dinextRoadmapActionsMenuObserver = observer;
	page._dinextRoadmapActionsMenuObserverInstalled = true;
};

dinext_project_stage_gate.roadmap._legacyStatusPalette = function () {
	return {
		light: {
			stage: {
				Planned: { fill: "#8f9aa8", stroke: "#8f9aa8" },
				"Waiting Gate": { fill: "#8f9aa8", stroke: "#8f9aa8" },
				Active: { fill: "#7f95c1", stroke: "#7f95c1" },
				Skipped: { fill: "#b6b9bd", stroke: "#b6b9bd" },
				Completed: { fill: "#739b7f", stroke: "#739b7f" },
				Rejected: { fill: "#c08b8b", stroke: "#c08b8b" },
				Blocked: { fill: "#c08b8b", stroke: "#c08b8b" },
				Canceled: { fill: "#9787b0", stroke: "#9787b0" },
			},
			checkpoint: {
				Draft: "#8f9aa8",
				"In Review": "#8ba0c9",
				Approved: "#739b7f",
				Rejected: "#c08b8b",
				Canceled: "#9787b0",
			},
			fallbackStage: { fill: "#8f9aa8", stroke: "#8f9aa8" },
			fallbackCheckpoint: "#8f9aa8",
		},
		dark: {
			stage: {
				Planned: { fill: "#636f7c", stroke: "#636f7c" },
				"Waiting Gate": { fill: "#636f7c", stroke: "#636f7c" },
				Active: { fill: "#4f6fa8", stroke: "#4f6fa8" },
				Skipped: { fill: "#5c708a", stroke: "#5c708a" },
				Completed: { fill: "#4e7d5c", stroke: "#4e7d5c" },
				Rejected: { fill: "#a85c5c", stroke: "#a85c5c" },
				Blocked: { fill: "#a85c5c", stroke: "#a85c5c" },
				Canceled: { fill: "#6b5b8f", stroke: "#6b5b8f" },
			},
			checkpoint: {
				Draft: "#6a7d92",
				"In Review": "#5f7fbf",
				Approved: "#4e7d5c",
				Rejected: "#a85c5c",
				Canceled: "#6b5b8f",
			},
			fallbackStage: { fill: "#636f7c", stroke: "#636f7c" },
			fallbackCheckpoint: "#6a7d92",
		},
	};
};

dinext_project_stage_gate.roadmap.ensureStatusPalette = function () {
	if (dinext_project_stage_gate.roadmap.statusPalette) {
		return dinext_project_stage_gate.roadmap.statusPalette;
	}
	const builder = dinext_project_stage_gate.status_palette?.buildRoadmapStatusPalette;
	dinext_project_stage_gate.roadmap.statusPalette = builder
		? builder()
		: dinext_project_stage_gate.roadmap._legacyStatusPalette();
	return dinext_project_stage_gate.roadmap.statusPalette;
};

dinext_project_stage_gate.roadmap.ensureStatusPalette();

dinext_project_stage_gate.roadmap.getActivePalette = function () {
	const root = document.documentElement;
	const isDark = root && root.getAttribute("data-theme") === "dark";
	const palette = dinext_project_stage_gate.roadmap.ensureStatusPalette();
	return isDark ? palette.dark : palette.light;
};

dinext_project_stage_gate.roadmap.getEChartsThemeName = function () {
	const root = document.documentElement;
	return root && root.getAttribute("data-theme") === "dark" ? "dark" : undefined;
};

dinext_project_stage_gate.roadmap.translateStatus = function (value) {
	return value ? __(value) : value;
};

dinext_project_stage_gate.roadmap.translateStageName = function (value) {
	return value ? __(value) : value;
};

dinext_project_stage_gate.roadmap.chartMonthLabels = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

dinext_project_stage_gate.roadmap.X_AXIS_MONTH_ONLY_THRESHOLD_DAYS = 45;
dinext_project_stage_gate.roadmap.ROADMAP_INTRO_ANIMATION_DURATION_MS = 420;
dinext_project_stage_gate.roadmap.ROADMAP_STAGE_INTRO_ANIMATION_MAX_SPREAD_MS = 420;
dinext_project_stage_gate.roadmap.ROADMAP_GATE_INTRO_ANIMATION_MAX_SPREAD_MS = 180;
dinext_project_stage_gate.roadmap.ROADMAP_INTRO_ANIMATION_EASING = "cubicOut";
dinext_project_stage_gate.roadmap.ROADMAP_CHECKPOINT_PREFERRED_SIZE = 22;
dinext_project_stage_gate.roadmap.ROADMAP_CHECKPOINT_MIN_STAGE_HEIGHT_RATIO = 0.3;
dinext_project_stage_gate.roadmap.ROADMAP_CHECKPOINT_MAX_STAGE_HEIGHT_RATIO = 2 / 3;
dinext_project_stage_gate.roadmap.ROADMAP_ROW_USABLE_HEIGHT_RATIO = 0.8;
dinext_project_stage_gate.roadmap.ROADMAP_SLOT_FILL_RATIO = 0.625;
dinext_project_stage_gate.roadmap.todayMarkerPalette = {
	light: {
		cssVar: "--text-muted",
		stroke: "#9ca3af",
		lineWidth: 1,
		lineDash: [6, 4],
	},
	dark: {
		cssVar: "--text-muted",
		stroke: "#8d99a8",
		lineWidth: 1,
		lineDash: [6, 4],
	},
};

dinext_project_stage_gate.roadmap.taskTypePalette = {
	light: ["#7fa6cf", "#b197d6", "#6faea5", "#d6a06c", "#c88f79", "#c988ac", "#8f96d6"],
	dark: ["#90b5dd", "#c0a8e3", "#83c0b6", "#e0b382", "#dba08b", "#d89fbd", "#a5ace6"],
};

dinext_project_stage_gate.roadmap.milestoneStatusPalette = {
	light: {
		Draft: { lineColor: "#8295ab" },
		"In Review": { lineColor: "#c7a16d" },
		Approved: { lineColor: "#7ea693" },
		Rejected: { lineColor: "#c98d7a" },
		Canceled: { lineColor: "#aa98be" },
		Overdue: { lineColor: "#d08d61" },
		fallback: { lineColor: "#8ea0b3" },
	},
	dark: {
		Draft: { lineColor: "#95a8bd" },
		"In Review": { lineColor: "#dbb482" },
		Approved: { lineColor: "#94baa7" },
		Rejected: { lineColor: "#dda08c" },
		Canceled: { lineColor: "#bbaace" },
		Overdue: { lineColor: "#e2a173" },
		fallback: { lineColor: "#a2b2c4" },
	},
};

dinext_project_stage_gate.roadmap.normalizeMilestoneStatusKey = function (status) {
	const normalized = String(status || "")
		.trim()
		.toLowerCase();
	if (!normalized) {
		return "";
	}

	const aliases = {
		draft: "Draft",
		"in review": "In Review",
		approved: "Approved",
		rejected: "Rejected",
		canceled: "Canceled",
		cancelled: "Canceled",
		overdue: "Overdue",
		"просрочено": "Overdue",
	};

	return aliases[normalized] || "";
};

dinext_project_stage_gate.roadmap.formatXAxisLabel = function (value, options = {}) {
	const time = dinext_project_stage_gate.roadmap._parseTimeMs(value);
	if (!Number.isFinite(time)) {
		return String(value ?? "");
	}

	const date = new Date(time);
	const monthSource =
		dinext_project_stage_gate.roadmap.chartMonthLabels[date.getUTCMonth()] ||
		String(date.getUTCMonth() + 1);
	const monthLabel = __(monthSource);
	if (options.monthOnly) {
		return `${monthLabel} ${date.getUTCFullYear()}`;
	}
	const day = date.getUTCDate();
	return day === 1 ? `${monthLabel} ${date.getUTCFullYear()}` : `${day} ${monthLabel}`;
};

dinext_project_stage_gate.roadmap.getHorizontalRangeFromDataZoom = function (dataZoom) {
	const zoomEntries = Array.isArray(dataZoom) ? dataZoom : [];
	const horizontalZoom = zoomEntries.find(
		(zoom) => zoom && zoom.xAxisIndex === 0 && zoom.startValue != null && zoom.endValue != null
	);
	if (!horizontalZoom) {
		return {};
	}
	return {
		startValue: horizontalZoom.startValue,
		endValue: horizontalZoom.endValue,
	};
};

dinext_project_stage_gate.roadmap.getVerticalRangeFromDataZoom = function (dataZoom) {
	const zoomEntries = Array.isArray(dataZoom) ? dataZoom : [];
	const verticalZoom = zoomEntries.find(
		(zoom) => zoom && zoom.yAxisIndex === 0 && zoom.startValue != null && zoom.endValue != null
	);
	if (!verticalZoom) {
		return {};
	}
	return {
		startValue: verticalZoom.startValue,
		endValue: verticalZoom.endValue,
	};
};

dinext_project_stage_gate.roadmap.getViewportStateFromDataZoom = function (dataZoom) {
	const horizontal = dinext_project_stage_gate.roadmap.getHorizontalRangeFromDataZoom(dataZoom);
	const vertical = dinext_project_stage_gate.roadmap.getVerticalRangeFromDataZoom(dataZoom);
	if (!Object.keys(horizontal).length && !Object.keys(vertical).length) {
		return null;
	}
	return { horizontal, vertical };
};

dinext_project_stage_gate.roadmap.captureViewportStateFromChart = function (chart) {
	if (!chart || typeof chart.getOption !== "function") {
		return null;
	}
	return dinext_project_stage_gate.roadmap.getViewportStateFromDataZoom(chart.getOption()?.dataZoom);
};

dinext_project_stage_gate.roadmap.cloneViewportState = function (viewportState) {
	if (!viewportState || typeof viewportState !== "object") {
		return null;
	}
	const horizontal = viewportState.horizontal;
	const vertical = viewportState.vertical;
	const hasHorizontal = horizontal && horizontal.startValue != null && horizontal.endValue != null;
	const hasVertical = vertical && vertical.startValue != null && vertical.endValue != null;
	if (!hasHorizontal && !hasVertical) {
		return null;
	}
	return {
		horizontal: hasHorizontal
			? {
					startValue: horizontal.startValue,
					endValue: horizontal.endValue,
			  }
			: {},
		vertical: hasVertical
			? {
					startValue: vertical.startValue,
					endValue: vertical.endValue,
			  }
			: {},
	};
};

dinext_project_stage_gate.roadmap.persistViewportState = function (target, viewportState) {
	if (!target) {
		return;
	}
	target._dinextRoadmapViewportState =
		dinext_project_stage_gate.roadmap.cloneViewportState(viewportState);
};

dinext_project_stage_gate.roadmap.applyViewportDataZoom = function (chart, dom, dataZoom) {
	if (!chart || typeof chart.setOption !== "function" || !Array.isArray(dataZoom)) {
		return;
	}

	chart.setOption({
		dataZoom,
	});
	dinext_project_stage_gate.roadmap.persistViewportState(
		dom,
		dinext_project_stage_gate.roadmap.getViewportStateFromDataZoom(dataZoom)
	);
	dinext_project_stage_gate.roadmap.updateXAxisLabelDensity(chart);
};

dinext_project_stage_gate.roadmap.clampHorizontalViewport = function (viewport, bounds) {
	const startTime = dinext_project_stage_gate.roadmap._parseTimeMs(viewport?.startValue);
	const endTime = dinext_project_stage_gate.roadmap._parseTimeMs(viewport?.endValue);
	const lowerBound = dinext_project_stage_gate.roadmap._parseTimeMs(bounds?.startValue);
	const upperBound = dinext_project_stage_gate.roadmap._parseTimeMs(bounds?.endValue);
	if (
		!Number.isFinite(startTime) ||
		!Number.isFinite(endTime) ||
		!Number.isFinite(lowerBound) ||
		!Number.isFinite(upperBound)
	) {
		return null;
	}
	const clampedStart = Math.max(startTime, lowerBound);
	const clampedEnd = Math.min(endTime, upperBound);
	if (clampedEnd < clampedStart) {
		return null;
	}
	return {
		startValue: dinext_project_stage_gate.roadmap._formatDateForChart(clampedStart),
		endValue: dinext_project_stage_gate.roadmap._formatDateForChart(clampedEnd),
	};
};

dinext_project_stage_gate.roadmap.clampVerticalViewport = function (viewport, categories) {
	const totalRows = Array.isArray(categories) ? categories.length : 0;
	if (!totalRows) {
		return null;
	}
	const startValue = Number(viewport?.startValue);
	const endValue = Number(viewport?.endValue);
	if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) {
		return null;
	}
	const maxIndex = totalRows - 1;
	const clampedStart = Math.min(Math.max(startValue, 0), maxIndex);
	const clampedEnd = Math.min(Math.max(endValue, 0), maxIndex);
	if (clampedEnd < clampedStart) {
		return null;
	}
	return {
		startValue: clampedStart,
		endValue: clampedEnd,
	};
};

dinext_project_stage_gate.roadmap.shouldUseMonthOnlyXAxisLabels = function (
	{ startValue, endValue } = {},
	thresholdDays = dinext_project_stage_gate.roadmap.X_AXIS_MONTH_ONLY_THRESHOLD_DAYS
) {
	const startTime = dinext_project_stage_gate.roadmap._parseTimeMs(startValue);
	const endTime = dinext_project_stage_gate.roadmap._parseTimeMs(endValue);
	if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
		return false;
	}
	const visibleDays = (endTime - startTime) / (24 * 60 * 60 * 1000);
	return visibleDays >= thresholdDays;
};

dinext_project_stage_gate.roadmap.getMonthOnlyXAxisLabelsForDataZoom = function (dataZoom) {
	return dinext_project_stage_gate.roadmap.shouldUseMonthOnlyXAxisLabels(
		dinext_project_stage_gate.roadmap.getHorizontalRangeFromDataZoom(dataZoom)
	);
};

dinext_project_stage_gate.roadmap.updateXAxisLabelDensity = function (chart) {
	if (!chart || typeof chart.getOption !== "function" || typeof chart.setOption !== "function") {
		return;
	}
	const monthOnly = dinext_project_stage_gate.roadmap.getMonthOnlyXAxisLabelsForDataZoom(
		chart.getOption()?.dataZoom
	);
	if (chart._dinextMonthOnlyXAxisLabels === monthOnly) {
		return;
	}
	chart._dinextMonthOnlyXAxisLabels = monthOnly;
	chart.setOption({
		xAxis: {
			axisLabel: {
				formatter(value) {
					return dinext_project_stage_gate.roadmap.formatXAxisLabel(value, {
						monthOnly,
					});
				},
			},
		},
	});
};

dinext_project_stage_gate.roadmap.getStageColors = function (status) {
	const palette = dinext_project_stage_gate.roadmap.getActivePalette();
	return palette.stage[status] || palette.fallbackStage;
};

dinext_project_stage_gate.roadmap.getContrastTextColor = function (fill) {
	if (!fill || typeof fill !== "string" || !fill.startsWith("#")) {
		return "#ffffff";
	}

	let hex = fill.slice(1);
	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((part) => part + part)
			.join("");
	}
	if (hex.length !== 6) {
		return "#ffffff";
	}

	const r = Number.parseInt(hex.slice(0, 2), 16);
	const g = Number.parseInt(hex.slice(2, 4), 16);
	const b = Number.parseInt(hex.slice(4, 6), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.6 ? "#1f2937" : "#ffffff";
};

dinext_project_stage_gate.roadmap.getThemeVariableColor = function (variableName, fallback) {
	if (
		typeof getComputedStyle !== "function" ||
		!document ||
		!document.documentElement ||
		!variableName
	) {
		return fallback;
	}

	const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
	return value || fallback;
};

dinext_project_stage_gate.roadmap.hexToRgba = function (value, alpha) {
	if (!value || typeof value !== "string" || !value.startsWith("#")) {
		return `rgba(15, 23, 42, ${alpha})`;
	}

	let hex = value.slice(1);
	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((part) => part + part)
			.join("");
	}
	if (hex.length !== 6) {
		return `rgba(15, 23, 42, ${alpha})`;
	}

	const r = Number.parseInt(hex.slice(0, 2), 16);
	const g = Number.parseInt(hex.slice(2, 4), 16);
	const b = Number.parseInt(hex.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

dinext_project_stage_gate.roadmap.isDimmedStageStatus = function (status) {
	return status === "Skipped" || status === "Canceled";
};

dinext_project_stage_gate.roadmap.isOverdueEntity = function (entity) {
	if (!entity) {
		return false;
	}
	return Boolean(Number(entity.is_overdue ?? entity.isOverdue ?? 0));
};

dinext_project_stage_gate.roadmap.getOverdueOutlineColors = function () {
	const isDark = dinext_project_stage_gate.roadmap.getEChartsThemeName() === "dark";
	return {
		stroke: isDark ? "#ef4444" : "#dc2626",
		lineWidth: 1.5,
	};
};

dinext_project_stage_gate.roadmap.getStageItemStyle = function (stage) {
	const fallback = dinext_project_stage_gate.roadmap.getStageColors(stage.status);
	const isDimmed = dinext_project_stage_gate.roadmap.isDimmedStageStatus(stage.status);
	const style = {
		fill: fallback.fill,
		stroke: fallback.stroke,
		lineWidth: 1,
		textColor: isDimmed
			? dinext_project_stage_gate.roadmap.getThemeVariableColor("--text-muted", "#7c7c7c")
			: dinext_project_stage_gate.roadmap.getContrastTextColor(fallback.fill),
		textOpacity: isDimmed ? 0.6 : 1,
	};
	if (dinext_project_stage_gate.roadmap.isOverdueEntity(stage)) {
		const overdueOutline = dinext_project_stage_gate.roadmap.getOverdueOutlineColors();
		style.stroke = overdueOutline.stroke;
		style.lineWidth = overdueOutline.lineWidth;
	}
	return style;
};

dinext_project_stage_gate.roadmap.getCheckpointColor = function (status) {
	const palette = dinext_project_stage_gate.roadmap.getActivePalette();
	return palette.checkpoint[status] || palette.fallbackCheckpoint;
};

dinext_project_stage_gate.roadmap.getCheckpointItemStyle = function (status, context = {}) {
	const fill = dinext_project_stage_gate.roadmap.getCheckpointColor(status);
	const isDark = dinext_project_stage_gate.roadmap.getEChartsThemeName() === "dark";
	const style = {
		color: fill,
		borderColor: dinext_project_stage_gate.roadmap.getThemeVariableColor(
			"--card-bg",
			isDark ? "#0f172a" : "#ffffff"
		),
		borderWidth: 2,
		shadowBlur: 8,
		shadowColor: dinext_project_stage_gate.roadmap.hexToRgba(fill, isDark ? 0.45 : 0.28),
	};
	if (dinext_project_stage_gate.roadmap.isOverdueEntity(context)) {
		const overdueOutline = dinext_project_stage_gate.roadmap.getOverdueOutlineColors();
		style.borderColor = overdueOutline.stroke;
		style.borderWidth = overdueOutline.lineWidth;
	}
	return style;
};

dinext_project_stage_gate.roadmap.getTaskTypeColorIndex = function (taskType) {
	const text = String(taskType || "").trim();
	if (!text) {
		return 0;
	}
	return Array.from(text).reduce((hash, char) => hash * 33 + char.charCodeAt(0), 5381);
};

dinext_project_stage_gate.roadmap.getTaskTypeColorKey = function (taskType, laneKey) {
	const lane = String(laneKey || "").trim();
	if (lane && lane !== "milestone") {
		return lane;
	}
	const text = String(taskType || "").trim();
	return text ? `task_type:${text}` : "";
};

dinext_project_stage_gate.roadmap.buildTaskTypeColorMap = function (
	taskEntities,
	taskTypeOrder = []
) {
	const isDark = dinext_project_stage_gate.roadmap.getEChartsThemeName() === "dark";
	const palette = isDark
		? dinext_project_stage_gate.roadmap.taskTypePalette.dark
		: dinext_project_stage_gate.roadmap.taskTypePalette.light;
	const orderedKeys = [];
	const rememberKey = (taskType, laneKey) => {
		const key = dinext_project_stage_gate.roadmap.getTaskTypeColorKey(taskType, laneKey);
		if (key && !orderedKeys.includes(key)) {
			orderedKeys.push(key);
		}
	};

	dinext_project_stage_gate.roadmap._coerceToArray(taskTypeOrder).forEach((taskType) => {
		rememberKey(taskType, `task_type:${taskType}`);
	});

	(taskEntities || [])
		.filter((entity) => entity?.entity_kind === "task_bar")
		.forEach((entity) => {
			rememberKey(entity.type || entity.lane_label, entity.lane_key);
		});

	return orderedKeys.reduce((colorMap, key, index) => {
		colorMap[key] = palette[index % palette.length];
		return colorMap;
	}, {});
};

dinext_project_stage_gate.roadmap.getTaskTypeItemStyle = function (taskType, options = {}) {
	const isDark = dinext_project_stage_gate.roadmap.getEChartsThemeName() === "dark";
	const palette = isDark
		? dinext_project_stage_gate.roadmap.taskTypePalette.dark
		: dinext_project_stage_gate.roadmap.taskTypePalette.light;
	const colorKey =
		options.colorKey ||
		dinext_project_stage_gate.roadmap.getTaskTypeColorKey(taskType, options.laneKey);
	const lineColor =
		options.colorMap?.[colorKey] ||
		palette[
			dinext_project_stage_gate.roadmap.getTaskTypeColorIndex(colorKey || taskType) %
				palette.length
		];
	return {
		lineColor,
		labelColor: lineColor,
		shadowColor: dinext_project_stage_gate.roadmap.hexToRgba(lineColor, isDark ? 0.32 : 0.2),
	};
};

dinext_project_stage_gate.roadmap.normalizeTaskProgress = function (value) {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) {
		return 0;
	}
	return Math.min(100, Math.max(0, Math.round(numericValue)));
};

dinext_project_stage_gate.roadmap.getTaskProgressTrackColor = function (lineColor) {
	const isDark = dinext_project_stage_gate.roadmap.getEChartsThemeName() === "dark";
	return dinext_project_stage_gate.roadmap.hexToRgba(lineColor, isDark ? 0.38 : 0.32);
};

dinext_project_stage_gate.roadmap.getMilestoneItemStyle = function (status) {
	const isDark = dinext_project_stage_gate.roadmap.getEChartsThemeName() === "dark";
	const palette = isDark
		? dinext_project_stage_gate.roadmap.milestoneStatusPalette.dark
		: dinext_project_stage_gate.roadmap.milestoneStatusPalette.light;
	const statusKey = dinext_project_stage_gate.roadmap.normalizeMilestoneStatusKey(status);
	const colors = palette[statusKey] || palette.fallback;
	const lineColor = colors.lineColor;
	return {
		lineColor,
		labelColor: lineColor,
		borderColor: dinext_project_stage_gate.roadmap.getThemeVariableColor("--card-bg", "#ffffff"),
	};
};

dinext_project_stage_gate.roadmap.LEGEND_ICON_CHEVRON =
	"path://M2 2H14L18 6L14 10H2L6 6Z";
dinext_project_stage_gate.roadmap.LEGEND_ICON_LINE = "path://M1 4H19V8H1Z";

dinext_project_stage_gate.roadmap.buildLegendData = function ({
	taskBars = [],
	milestones = [],
} = {}) {
	const legendData = [
		{
			name: dinext_project_stage_gate.roadmap.translateStageGateLabel("Stages"),
			icon: dinext_project_stage_gate.roadmap.LEGEND_ICON_CHEVRON,
		},
		{
			name: __("Gate checkpoints"),
			icon: "diamond",
		},
	];
	if (Array.isArray(milestones) && milestones.length) {
		legendData.push({
			name: __("Milestones"),
			icon: "diamond",
		});
	}

	const seenTaskTypes = new Set();
	(taskBars || []).forEach((taskBar) => {
		const taskType = String(taskBar?.value?.[5] || "").trim();
		if (!taskType || seenTaskTypes.has(taskType)) {
			return;
		}
		seenTaskTypes.add(taskType);
		legendData.push({
			name: dinext_project_stage_gate.roadmap.translateTaskTypeLabel(taskType),
			icon: dinext_project_stage_gate.roadmap.LEGEND_ICON_LINE,
		});
	});

	return legendData;
};

dinext_project_stage_gate.roadmap.groupTaskBarsByType = function (taskBars = []) {
	const orderedTypes = [];
	const groupedBars = {};
	(taskBars || []).forEach((taskBar, index) => {
		const taskType = String(taskBar?.value?.[5] || "").trim() || __("Task");
		if (!groupedBars[taskType]) {
			groupedBars[taskType] = [];
			orderedTypes.push(taskType);
		}
		groupedBars[taskType].push({
			...taskBar,
			_taskDelayIndex: index,
		});
	});
	return orderedTypes.map((taskType) => ({
		taskType,
		taskTypeLabel: dinext_project_stage_gate.roadmap.translateTaskTypeLabel(taskType),
		data: groupedBars[taskType],
	}));
};

dinext_project_stage_gate.roadmap.buildTaskBarSeries = function ({
	taskBars = [],
	introAnimationDuration,
	introAnimationEasing,
	introAnimationDelays,
	rowSpanUnits = 1,
} = {}) {
	return dinext_project_stage_gate.roadmap.groupTaskBarsByType(taskBars).map(
		({ taskType, taskTypeLabel, data }) => ({
			name: taskTypeLabel,
			type: "custom",
			clip: true,
			animationDuration: introAnimationDuration,
			animationDurationUpdate: 0,
			animationEasing: introAnimationEasing,
			animationEasingUpdate: "linear",
			animationDelay(dataIndex, params) {
				return (
					introAnimationDelays.taskBarDelays[params?.data?._taskDelayIndex ?? dataIndex] ?? 0
				);
			},
			animationDelayUpdate() {
				return 0;
			},
			itemStyle: {
				color:
					data[0]?.itemStyle?.color ||
					data[0]?.value?.[6] ||
					dinext_project_stage_gate.roadmap.getTaskTypeItemStyle(taskType).lineColor,
			},
			renderItem(params, api) {
				const dataItem =
					params.data ||
					data[params.dataIndex] ||
					data[params.dataIndexInside] ||
					data.find((entry) => entry?._taskDelayIndex === params.dataIndex);
				const rowPosition = api.value(0);
				const start = api.coord([api.value(1), rowPosition]);
				const end = api.coord([api.value(2), rowPosition]);
				const slotRatio = dinext_project_stage_gate.roadmap.getRowSlotHeightRatio(
					dataItem?.rowSpanUnits || rowSpanUnits
				);
				const slotHeight = api.size([0, 1])[1] * slotRatio;
				const lineWidth = Math.max(6, Math.min(12, slotHeight * 0.36));
				const labelLayout = dinext_project_stage_gate.roadmap.getTaskLineLabelLayout({
					span: Math.abs(end[0] - start[0]),
					lineWidth,
					slotHeight,
				});
				const fromApi = api.style();
				const itemStyle = dataItem?.itemStyle || {};
				const payloadColor = api.value(6);
				const lineColor =
					itemStyle.color ||
					itemStyle.lineColor ||
					itemStyle.labelColor ||
					payloadColor ||
					fromApi.stroke ||
					fromApi.borderColor ||
					fromApi.color;
				const labelColor = itemStyle.labelColor || payloadColor || lineColor;
				const shadowColor =
					itemStyle.shadowColor ||
					(lineColor ? dinext_project_stage_gate.roadmap.hexToRgba(lineColor, 0.18) : undefined);
				return dinext_project_stage_gate.roadmap.buildRoundedTaskLineGraphic({
					startX: start[0],
					endX: end[0],
					centerY: start[1],
					lineWidth,
					label: dataItem?.name || api.value(3),
					lineColor,
					labelColor,
					shadowColor,
					progress: dataItem?.progress,
					hasProgress: dataItem?.hasProgress,
					progressLineColor: dataItem?.progressLineColor || lineColor,
					labelLayout,
					animationDelay:
						introAnimationDelays.taskBarDelays[dataItem?._taskDelayIndex ?? params.dataIndex] ??
						0,
					animationDuration: introAnimationDuration,
					animationEasing: introAnimationEasing,
				});
			},
			encode: {
				x: [1, 2],
				y: 0,
			},
			data,
		})
	);
};

dinext_project_stage_gate.roadmap.buildLegendProxySeries = function ({
	taskBars = [],
	milestones = [],
} = {}) {
	const stageStyle = dinext_project_stage_gate.roadmap.getStageItemStyle({ status: "Active" });
	const gateStyle = dinext_project_stage_gate.roadmap.getCheckpointItemStyle("Approved");
	const legendSeries = [
		{
			name: dinext_project_stage_gate.roadmap.translateStageGateLabel("Stages"),
			type: "line",
			data: [],
			silent: true,
			showSymbol: false,
			legendHoverLink: false,
			tooltip: { show: false },
			lineStyle: {
				color: stageStyle.fill,
				width: 4,
			},
		},
		{
			name: __("Gate checkpoints"),
			type: "scatter",
			data: [],
			silent: true,
			legendHoverLink: false,
			tooltip: { show: false },
			symbol: "diamond",
			itemStyle: {
				color: gateStyle.color,
			},
		},
	];
	if (Array.isArray(milestones) && milestones.length) {
		const milestoneStyle = dinext_project_stage_gate.roadmap.getMilestoneItemStyle();
		legendSeries.push({
			name: __("Milestones"),
			type: "scatter",
			data: [],
			silent: true,
			legendHoverLink: false,
			tooltip: { show: false },
			symbol: "diamond",
			itemStyle: {
				color: milestoneStyle.lineColor,
			},
		});
	}
	dinext_project_stage_gate.roadmap.groupTaskBarsByType(taskBars).forEach(({ taskType, taskTypeLabel, data }) => {
		legendSeries.push({
			name: taskTypeLabel,
			type: "line",
			data: [],
			silent: true,
			showSymbol: false,
			legendHoverLink: false,
			tooltip: { show: false },
			lineStyle: {
				color:
					data[0]?.itemStyle?.color ||
					data[0]?.value?.[6] ||
					dinext_project_stage_gate.roadmap.getTaskTypeItemStyle(taskType).lineColor,
				width: 4,
			},
		});
	});
	return legendSeries;
};

dinext_project_stage_gate.roadmap.buildProjectSeparatorData = function (categoryEntries = []) {
	const separators = [];
	if (categoryEntries[0]?.projectName) {
		separators.push({
			value: [0],
		});
	}
	for (let index = 1; index < categoryEntries.length; index += 1) {
		const current = categoryEntries[index];
		const previous = categoryEntries[index - 1];
		if (!current?.projectName || current.projectName === previous?.projectName) {
			continue;
		}
		separators.push({
			value: [index],
		});
	}
	return separators;
};

dinext_project_stage_gate.roadmap.buildProjectSeparatorSeries = function ({
	projectSeparators = [],
	gridLineColor,
	startValue,
	endValue,
} = {}) {
	return {
		name: "__project-separators__",
		type: "custom",
		silent: true,
		tooltip: { show: false },
		legendHoverLink: false,
		z: 1,
		renderItem(params, api) {
			const boundaryIndex = api.value(0);
			const left = api.coord([startValue, boundaryIndex - 0.5]);
			const right = api.coord([endValue, boundaryIndex - 0.5]);
			return {
				type: "line",
				shape: {
					x1: left[0],
					y1: left[1],
					x2: right[0],
					y2: right[1],
				},
				style: {
					stroke: gridLineColor,
					lineWidth: 1,
				},
				silent: true,
			};
		},
		encode: {
			y: 0,
		},
		data: projectSeparators,
	};
};

dinext_project_stage_gate.roadmap.getTodayMarkerLineStyle = function () {
	const isDark = dinext_project_stage_gate.roadmap.getEChartsThemeName() === "dark";
	const palette = isDark
		? dinext_project_stage_gate.roadmap.todayMarkerPalette.dark
		: dinext_project_stage_gate.roadmap.todayMarkerPalette.light;
	return {
		stroke: dinext_project_stage_gate.roadmap.getThemeVariableColor(
			palette.cssVar,
			palette.stroke
		),
		lineWidth: palette.lineWidth,
		lineDash: palette.lineDash,
	};
};

dinext_project_stage_gate.roadmap.getTodayMarkerLineColor = function () {
	return dinext_project_stage_gate.roadmap.getTodayMarkerLineStyle().stroke;
};

/** Normalize a report date to the chart's YYYY-MM-DD time-axis value. */
dinext_project_stage_gate.roadmap.getTodayChartDate = function (today) {
	const fallback =
		today || frappe?.datetime?.get_today?.() || new Date().toISOString().slice(0, 10);
	const time = dinext_project_stage_gate.roadmap._parseTimeMs(fallback);
	if (!Number.isFinite(time)) {
		return null;
	}
	return dinext_project_stage_gate.roadmap._formatDateForChart(time);
};

dinext_project_stage_gate.roadmap.buildTodayMarkerSeries = function ({
	today,
	categoryCount = 0,
} = {}) {
	const chartToday = dinext_project_stage_gate.roadmap.getTodayChartDate(today);
	if (!chartToday || !categoryCount) {
		return null;
	}

	return {
		name: "__today-marker__",
		type: "custom",
		silent: true,
		tooltip: { show: false },
		legendHoverLink: false,
		z: 0,
		animation: false,
		renderItem(params, api) {
			const { stroke, lineWidth, lineDash } =
				dinext_project_stage_gate.roadmap.getTodayMarkerLineStyle();
			const topY = -0.5;
			const bottomY = Math.max(0, categoryCount - 1) + 0.5;
			const top = api.coord([chartToday, topY]);
			const bottom = api.coord([chartToday, bottomY]);
			return {
				type: "line",
				shape: {
					x1: top[0],
					y1: top[1],
					x2: bottom[0],
					y2: bottom[1],
				},
				style: {
					stroke,
					lineWidth,
					lineDash,
				},
				silent: true,
			};
		},
		data: [{ value: [chartToday] }],
	};
};

dinext_project_stage_gate.roadmap.wrapAxisLabel = function (label, maxLineLength = 24) {
	const text = String(label || "").trim();
	if (!text || text.length <= maxLineLength) {
		return text;
	}

	const words = text.split(/\s+/);
	if (words.length <= 1) {
		return text;
	}

	const firstLine = [];
	while (words.length > 1) {
		const nextWord = words[0];
		const candidate = [...firstLine, nextWord].join(" ");
		if (firstLine.length && candidate.length > maxLineLength) {
			break;
		}
		firstLine.push(words.shift());
		if (candidate.length >= maxLineLength) {
			break;
		}
	}

	if (!firstLine.length) {
		firstLine.push(words.shift());
	}

	return [firstLine.join(" "), words.join(" ")].filter(Boolean).join("\n");
};

dinext_project_stage_gate.roadmap.formatDateRange = function (start, end) {
	if (start && end) {
		return start === end ? start : `${start} - ${end}`;
	}
	return start || end || "";
};

dinext_project_stage_gate.roadmap.formatTooltip = function (params) {
	const value = params?.value || [];
	const docType = params?.data?.docType;

	if (docType === "Project Stage Instance") {
		return [
			params?.data?.name || value[3] || params?.name || "",
			value[4] || "",
			dinext_project_stage_gate.roadmap.formatDateRange(value[1], value[2]),
		]
			.filter(Boolean)
			.join("<br>");
	}

	if (docType === "Project Gate Checkpoint") {
		return [params?.name || "", value[2] || "", value[0] || ""].filter(Boolean).join("<br>");
	}

	if (docType === "Task") {
		if (params?.data?.entityKind === "milestone") {
			return [params?.name || "", value[2] || "", value[0] || ""].filter(Boolean).join("<br>");
		}
		const progress = dinext_project_stage_gate.roadmap.normalizeTaskProgress(params?.data?.progress);
		return [
			params?.data?.name || params?.name || value[3] || "",
			value[4] || "",
			dinext_project_stage_gate.roadmap.formatDateRange(value[1], value[2]),
			__(value[5] || ""),
			`${progress}%`,
		]
			.filter(Boolean)
			.filter((entry, index, parts) => parts.indexOf(entry) === index)
			.join("<br>");
	}

	return [params?.name || "", value[3] || value[2] || "", value[4] || ""]
		.filter(Boolean)
		.filter((entry, index, parts) => parts.indexOf(entry) === index)
		.join("<br>");
};

dinext_project_stage_gate.roadmap.calculateChartHeight = function (categories, rowSpanUnits = 1) {
	const rowCount = Array.isArray(categories) ? categories.length : Number(categories) || 0;
	const safeRowSpanUnits = Math.max(1, Number(rowSpanUnits) || 1);
	const effectiveRows = rowCount * safeRowSpanUnits;
	const dynamicHeight = effectiveRows <= 10 ? 420 : 420 + (effectiveRows - 10) * 25;
	const viewportHeight = Number(window?.innerHeight) || 0;
	const minHeight = viewportHeight > 0 ? Math.round(viewportHeight * 0.65) : 420;
	return Math.max(dynamicHeight, minHeight);
};

dinext_project_stage_gate.roadmap.getRowSlotHeightRatio = function (rowSpanUnits = 1) {
	const safeRowSpanUnits = Math.max(1, Number(rowSpanUnits) || 1);
	return dinext_project_stage_gate.roadmap.ROADMAP_ROW_USABLE_HEIGHT_RATIO / safeRowSpanUnits;
};

dinext_project_stage_gate.roadmap.estimateStageBarHeight = function (
	categories,
	chartHeight,
	grid = {},
	rowSpanUnits = 1
) {
	const rowCount = Array.isArray(categories) ? categories.length : Number(categories) || 0;
	if (rowCount <= 0) {
		return 0;
	}

	const plotHeight =
		Math.max(0, Number(chartHeight) || 0) -
		Math.max(0, Number(grid.top) || 0) -
		Math.max(0, Number(grid.bottom) || 0);
	if (plotHeight <= 0) {
		return 0;
	}

	return (
		(plotHeight / rowCount) *
		dinext_project_stage_gate.roadmap.getRowSlotHeightRatio(rowSpanUnits) *
		dinext_project_stage_gate.roadmap.ROADMAP_SLOT_FILL_RATIO
	);
};

dinext_project_stage_gate.roadmap.getCheckpointDiamondSize = function (
	stageHeight,
	preferredSize = dinext_project_stage_gate.roadmap.ROADMAP_CHECKPOINT_PREFERRED_SIZE
) {
	const safeStageHeight = Number(stageHeight) || 0;
	if (safeStageHeight <= 0) {
		return preferredSize;
	}

	const minSize =
		safeStageHeight *
		dinext_project_stage_gate.roadmap.ROADMAP_CHECKPOINT_MIN_STAGE_HEIGHT_RATIO;
	const maxSize =
		safeStageHeight *
		dinext_project_stage_gate.roadmap.ROADMAP_CHECKPOINT_MAX_STAGE_HEIGHT_RATIO;

	return Math.min(Math.max(preferredSize, minSize), maxSize);
};

dinext_project_stage_gate.roadmap.applyChartHeight = function (dom, categories, rowSpanUnits = 1) {
	if (!dom?.style) {
		return 0;
	}

	const height = dinext_project_stage_gate.roadmap.calculateChartHeight(categories, rowSpanUnits);
	dom.style.height = `${height}px`;
	return height;
};

dinext_project_stage_gate.roadmap.getDisplayDate = function (actualValue, plannedValue) {
	const normalize = (value) => {
		if (value == null) {
			return undefined;
		}
		if (typeof value === "string" && value.trim() === "") {
			return undefined;
		}
		return value;
	};

	const actual = normalize(actualValue);
	if (actual !== undefined) {
		return actual;
	}

	return normalize(plannedValue);
};

dinext_project_stage_gate.roadmap.getStageDisplayRange = function (stage) {
	const plannedStart = dinext_project_stage_gate.roadmap.getDisplayDate(
		null,
		stage.planned_start_date
	);
	const plannedEnd = dinext_project_stage_gate.roadmap.getDisplayDate(null, stage.planned_end_date);
	const actualStart = dinext_project_stage_gate.roadmap.getDisplayDate(
		stage.actual_start_date,
		null
	);
	const actualEnd = dinext_project_stage_gate.roadmap.getDisplayDate(stage.actual_end_date, null);

	const actualStartMs = dinext_project_stage_gate.roadmap._parseTimeMs(actualStart);
	const actualEndMs = dinext_project_stage_gate.roadmap._parseTimeMs(actualEnd);

	// Stage instances auto-fill actual dates on status changes, often as a single timestamp.
	// For roadmap bars we need a visible interval; otherwise colors collapse into near-invisible lines.
	if (Number.isFinite(actualStartMs) && Number.isFinite(actualEndMs) && actualEndMs > actualStartMs) {
		return { start: actualStart, end: actualEnd };
	}

	return {
		start: plannedStart || actualStart || actualEnd,
		end: plannedEnd || actualEnd || actualStart,
	};
};

/** Parse report date value to UTC ms (date-only strings treated as UTC midnight). */
dinext_project_stage_gate.roadmap._parseTimeMs = function (value) {
	if (value == null || value === "") {
		return NaN;
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : NaN;
	}
	if (value instanceof Date) {
		return value.getTime();
	}
	const s = String(value).trim();
	const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
	const t = Date.parse(iso);
	return Number.isFinite(t) ? t : NaN;
};

dinext_project_stage_gate.roadmap._formatDateForChart = function (ms) {
	const d = new Date(ms);
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
};

dinext_project_stage_gate.roadmap._coerceToArray = function (value) {
	if (value == null || value === "") {
		return [];
	}
	if (Array.isArray(value)) {
		return value.filter(Boolean);
	}
	if (typeof value === "string") {
		return value
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean);
	}
	return [value];
};

dinext_project_stage_gate.roadmap._coerceToCheck = function (value, defaultValue = 0) {
	if (value == null || value === "") {
		return defaultValue ? 1 : 0;
	}
	if (typeof value === "string") {
		return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase()) ? 1 : 0;
	}
	return value ? 1 : 0;
};

dinext_project_stage_gate.roadmap.DEFAULT_SORT_STATE = {
	field: "current_order",
	direction: "asc",
};

dinext_project_stage_gate.roadmap.PROJECT_SORT_FIELDS = [
	"current_order",
	"project_name",
	"expected_start_date",
	"expected_end_date",
];

dinext_project_stage_gate.roadmap.normalizeSortState = function (sortState) {
	const field = dinext_project_stage_gate.roadmap.PROJECT_SORT_FIELDS.includes(sortState?.field)
		? sortState.field
		: dinext_project_stage_gate.roadmap.DEFAULT_SORT_STATE.field;
	const direction = sortState?.direction === "desc" ? "desc" : "asc";
	return { field, direction };
};

dinext_project_stage_gate.roadmap.compareProjectNames = function (left, right) {
	const leftLabel = String(left?.project_name || left?.name || "");
	const rightLabel = String(right?.project_name || right?.name || "");
	const labelComparison = leftLabel.localeCompare(rightLabel);
	if (labelComparison !== 0) {
		return labelComparison;
	}
	return String(left?.name || "").localeCompare(String(right?.name || ""));
};

dinext_project_stage_gate.roadmap.compareProjectDates = function (left, right, field) {
	const leftTime = dinext_project_stage_gate.roadmap._parseTimeMs(left?.[field]);
	const rightTime = dinext_project_stage_gate.roadmap._parseTimeMs(right?.[field]);
	const leftHasDate = Number.isFinite(leftTime);
	const rightHasDate = Number.isFinite(rightTime);
	if (leftHasDate && rightHasDate && leftTime !== rightTime) {
		return leftTime - rightTime;
	}
	if (leftHasDate !== rightHasDate) {
		return leftHasDate ? -1 : 1;
	}
	return dinext_project_stage_gate.roadmap.compareProjectNames(left, right);
};

dinext_project_stage_gate.roadmap.sortProjectsForRoadmap = function (projects, sortState) {
	const sortedProjects = Array.isArray(projects) ? [...projects] : [];
	const normalized = dinext_project_stage_gate.roadmap.normalizeSortState(sortState);
	if (normalized.field === "current_order") {
		return normalized.direction === "desc" ? sortedProjects.reverse() : sortedProjects;
	}
	const multiplier = normalized.direction === "desc" ? -1 : 1;
	return sortedProjects.sort((left, right) => {
		if (normalized.field === "project_name") {
			return multiplier * dinext_project_stage_gate.roadmap.compareProjectNames(left, right);
		}
		const comparison = dinext_project_stage_gate.roadmap.compareProjectDates(
			left,
			right,
			normalized.field
		);
		const leftHasDate = Number.isFinite(
			dinext_project_stage_gate.roadmap._parseTimeMs(left?.[normalized.field])
		);
		const rightHasDate = Number.isFinite(
			dinext_project_stage_gate.roadmap._parseTimeMs(right?.[normalized.field])
		);
		if (leftHasDate && rightHasDate) {
			return multiplier * comparison;
		}
		return comparison;
	});
};

dinext_project_stage_gate.roadmap.getSortStateFromChartDom = function (dom) {
	return dinext_project_stage_gate.roadmap.normalizeSortState(dom?._dinextRoadmapSortState);
};

dinext_project_stage_gate.roadmap.getViewportStateForSortChange = function (viewportState) {
	const savedViewport = dinext_project_stage_gate.roadmap.cloneViewportState(viewportState);
	return savedViewport || { horizontal: {}, vertical: {} };
};

dinext_project_stage_gate.roadmap.handleRoadmapSortChange = function (report, dom, sortState) {
	if (!dom) {
		return Promise.resolve();
	}
	const chart =
		(typeof echarts !== "undefined" &&
			typeof echarts.getInstanceByDom === "function" &&
			echarts.getInstanceByDom(dom)) ||
		dom._dinextRoadmapChart ||
		null;
	const viewportState =
		dinext_project_stage_gate.roadmap.captureViewportStateFromChart(chart) ||
		dom._dinextRoadmapViewportState ||
		null;
	dom._dinextRoadmapSortState = dinext_project_stage_gate.roadmap.normalizeSortState(sortState);
	dom._dinextRoadmapViewportState =
		dinext_project_stage_gate.roadmap.getViewportStateForSortChange(viewportState);
	dom._dinextRoadmapIgnoreChartViewportOnce = true;
	return Promise.resolve(dinext_project_stage_gate.roadmap.render(report));
};

dinext_project_stage_gate.roadmap.PROJECT_SORT_MENU_FIELDS = [
	{ field: "current_order", label: "Current order" },
	{ field: "project_name", label: "Project Name" },
	{ field: "expected_start_date", label: "Forecast Start Date" },
	{ field: "expected_end_date", label: "Forecast End Date" },
];

dinext_project_stage_gate.roadmap.PROJECT_SORT_MENU_DIRECTIONS = [
	{ direction: "asc", label: "Ascending", icon: "&#8593;" },
	{ direction: "desc", label: "Descending", icon: "&#8595;" },
];

dinext_project_stage_gate.roadmap.getSortMenuItems = function (sortState) {
	const activeState = dinext_project_stage_gate.roadmap.normalizeSortState(sortState);
	return dinext_project_stage_gate.roadmap.PROJECT_SORT_MENU_FIELDS.flatMap((fieldEntry) =>
		dinext_project_stage_gate.roadmap.PROJECT_SORT_MENU_DIRECTIONS.map((directionEntry) => ({
			field: fieldEntry.field,
			direction: directionEntry.direction,
			label: __(fieldEntry.label),
			directionLabel: __(directionEntry.label),
			directionIcon: directionEntry.icon,
			active:
				activeState.field === fieldEntry.field &&
				activeState.direction === directionEntry.direction,
		}))
	);
};

dinext_project_stage_gate.roadmap.closeSortMenu = function (dom) {
	if (!dom?._dinextRoadmapSortMenu) {
		return;
	}
	if (typeof dom._dinextRoadmapSortMenu.remove === "function") {
		dom._dinextRoadmapSortMenu.remove();
	}
	dom._dinextRoadmapSortMenu = null;
};

dinext_project_stage_gate.roadmap.getSortMenuContainer = function (dom) {
	if (dom?._dinextRoadmapShell) {
		return dom._dinextRoadmapShell;
	}
	if (typeof $ === "function") {
		const chartElement = $(dom);
		if (typeof chartElement.parent === "function") {
			return chartElement.parent();
		}
	}
	return null;
};

dinext_project_stage_gate.roadmap.buildSortMenu = function (report, dom) {
	const items = dinext_project_stage_gate.roadmap.getSortMenuItems(
		dom?._dinextRoadmapSortState
	);
	const itemMarkup = items
		.map(
			(item) => `
				<button
					type="button"
					class="project-stage-gate-roadmap-sort-menu-item${item.active ? " is-active" : ""}"
					data-roadmap-sort-menu-item
					data-roadmap-sort-field="${item.field}"
					data-roadmap-sort-direction="${item.direction}"
				>
					<span>${item.label}</span>
					<span
						class="project-stage-gate-roadmap-sort-menu-direction-icon"
						aria-label="${item.directionLabel}"
						title="${item.directionLabel}"
					>${item.directionIcon}</span>
				</button>
			`
		)
		.join("");
	const menu = $(`
		<div class="project-stage-gate-roadmap-sort-menu" role="menu">
			<div class="project-stage-gate-roadmap-sort-menu-title">${__("Project sorting")}</div>
			${itemMarkup}
		</div>
	`);
	if (typeof menu.on === "function") {
		menu.on("click", "[data-roadmap-sort-menu-item]", function () {
			const item = $(this);
			const field = typeof item.attr === "function" ? item.attr("data-roadmap-sort-field") : null;
			const direction =
				typeof item.attr === "function" ? item.attr("data-roadmap-sort-direction") : null;
			dinext_project_stage_gate.roadmap.closeSortMenu(dom);
			dinext_project_stage_gate.roadmap.handleRoadmapSortChange(report, dom, {
				field,
				direction,
			});
		});
		menu.on("mouseleave", () => {
			dinext_project_stage_gate.roadmap.closeSortMenu(dom);
		});
	}
	return menu;
};

dinext_project_stage_gate.roadmap.toggleSortMenu = function (report, dom) {
	if (!dom) {
		return null;
	}
	if (dom._dinextRoadmapSortMenu) {
		dinext_project_stage_gate.roadmap.closeSortMenu(dom);
		return null;
	}
	const menu = dinext_project_stage_gate.roadmap.buildSortMenu(report, dom);
	const container = dinext_project_stage_gate.roadmap.getSortMenuContainer(dom);
	if (container && typeof container.append === "function") {
		container.append(menu);
	} else if (typeof $ === "function") {
		const chartElement = $(dom);
		if (typeof chartElement.after === "function") {
			chartElement.after(menu);
		}
	}
	dom._dinextRoadmapSortMenu = menu;
	return menu;
};

dinext_project_stage_gate.roadmap.normalizeVisibilityFilters = function (filters) {
	const normalized = {
		...(filters || {}),
		show_stages_and_checkpoints: dinext_project_stage_gate.roadmap._coerceToCheck(
			filters?.show_stages_and_checkpoints,
			1
		),
		show_milestones: dinext_project_stage_gate.roadmap._coerceToCheck(filters?.show_milestones, 0),
		task_types: dinext_project_stage_gate.roadmap._coerceToArray(filters?.task_types),
	};
	if (
		!normalized.show_stages_and_checkpoints &&
		!normalized.show_milestones &&
		!normalized.task_types.length
	) {
		normalized.show_stages_and_checkpoints = 1;
	}
	return normalized;
};

dinext_project_stage_gate.roadmap.getVisibilityFiltersFromReport = function (report) {
	return {
		show_stages_and_checkpoints: report?.get_filter_value?.("show_stages_and_checkpoints"),
		show_milestones: report?.get_filter_value?.("show_milestones"),
		task_types: report?.get_filter_value?.("task_types"),
	};
};

dinext_project_stage_gate.roadmap.getAppliedVisibilityFilters = function (
	payload,
	fallbackFilters = {}
) {
	return dinext_project_stage_gate.roadmap.normalizeVisibilityFilters({
		...fallbackFilters,
		...(payload?.appliedFilters || {}),
	});
};

dinext_project_stage_gate.roadmap.isStageVisibilityMandatory = function (filters) {
	const normalized = dinext_project_stage_gate.roadmap.normalizeVisibilityFilters(filters);
	return !normalized.show_milestones && !normalized.task_types.length;
};

dinext_project_stage_gate.roadmap.getEffectiveVisibilityFilters = function (
	requestedFilters,
	appliedFilters
) {
	const requested = dinext_project_stage_gate.roadmap.normalizeVisibilityFilters(requestedFilters);
	const applied = dinext_project_stage_gate.roadmap.normalizeVisibilityFilters(appliedFilters);
	if (dinext_project_stage_gate.roadmap.isStageVisibilityMandatory(requested)) {
		return applied;
	}
	return {
		...applied,
		show_stages_and_checkpoints: requested.show_stages_and_checkpoints,
		show_milestones: requested.show_milestones,
		task_types: requested.task_types,
	};
};

dinext_project_stage_gate.roadmap.syncVisibilityFilters = async function (report, appliedFilters) {
	if (!report || !appliedFilters) {
		return false;
	}
	const currentValue = dinext_project_stage_gate.roadmap._coerceToCheck(
		report.get_filter_value?.("show_stages_and_checkpoints"),
		1
	);
	if (currentValue === appliedFilters.show_stages_and_checkpoints) {
		return false;
	}
	const filter =
		(typeof report.get_filter === "function" &&
			report.get_filter("show_stages_and_checkpoints")) ||
		null;
	if (!filter || typeof filter.set_value !== "function") {
		return false;
	}
	const oldNoRefresh = report._no_refresh;
	report._no_refresh = true;
	try {
		await filter.set_value(appliedFilters.show_stages_and_checkpoints, true);
	} finally {
		report._no_refresh = oldNoRefresh;
	}
	return true;
};

dinext_project_stage_gate.roadmap.applyStageVisibilityAvailability = function (
	report,
	appliedFilters
) {
	if (!report || !appliedFilters || typeof report.get_filter !== "function") {
		return;
	}
	const filter = report.get_filter("show_stages_and_checkpoints");
	if (!filter || !filter.df) {
		return;
	}
	const shouldBeReadOnly = dinext_project_stage_gate.roadmap.isStageVisibilityMandatory(
		appliedFilters
	)
		? 1
		: 0;
	if ((filter.df.read_only ? 1 : 0) === shouldBeReadOnly) {
		return;
	}
	filter.df.read_only = shouldBeReadOnly;
	if (typeof filter.refresh === "function") {
		filter.refresh();
	}
};

dinext_project_stage_gate.roadmap._addUtcMonths = function (value, months) {
	const time = dinext_project_stage_gate.roadmap._parseTimeMs(value);
	if (!Number.isFinite(time)) {
		return NaN;
	}
	const date = new Date(time);
	return Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth() + months,
		date.getUTCDate(),
		date.getUTCHours(),
		date.getUTCMinutes(),
		date.getUTCSeconds(),
		date.getUTCMilliseconds()
	);
};

dinext_project_stage_gate.roadmap.getDefaultVerticalViewport = function (categories, visibleRows = 10) {
	const totalRows = Array.isArray(categories) ? categories.length : 0;
	if (!totalRows) {
		return { startValue: 0, endValue: 0 };
	}
	return {
		startValue: 0,
		endValue: Math.min(totalRows, visibleRows) - 1,
	};
};

dinext_project_stage_gate.roadmap.getDefaultHorizontalViewport = function ({
	today,
	fromDate,
	toDate,
	monthsBack = 0,
	monthsForward = 12,
} = {}) {
	const fallbackToday =
		today || frappe?.datetime?.get_today?.() || new Date().toISOString().slice(0, 10);
	const fromTime = dinext_project_stage_gate.roadmap._parseTimeMs(fromDate);
	const toTime = dinext_project_stage_gate.roadmap._parseTimeMs(toDate);
	let lowerBound = fromTime;
	let upperBound = toTime;

	if (Number.isFinite(lowerBound) && Number.isFinite(upperBound) && lowerBound > upperBound) {
		[lowerBound, upperBound] = [upperBound, lowerBound];
	}

	let startTime = dinext_project_stage_gate.roadmap._addUtcMonths(fallbackToday, -monthsBack);
	let endTime = dinext_project_stage_gate.roadmap._addUtcMonths(fallbackToday, monthsForward);

	if (Number.isFinite(lowerBound)) {
		startTime = Math.max(startTime, lowerBound);
	}
	if (Number.isFinite(upperBound)) {
		endTime = Math.min(endTime, upperBound);
	}

	if (!Number.isFinite(startTime) && Number.isFinite(lowerBound)) {
		startTime = lowerBound;
	}
	if (!Number.isFinite(endTime) && Number.isFinite(upperBound)) {
		endTime = upperBound;
	}
	if (!Number.isFinite(startTime) && Number.isFinite(endTime)) {
		startTime = endTime;
	}
	if (!Number.isFinite(endTime) && Number.isFinite(startTime)) {
		endTime = startTime;
	}

	if (endTime < startTime) {
		if (Number.isFinite(lowerBound) && Number.isFinite(upperBound)) {
			startTime = lowerBound;
			endTime = upperBound;
		} else if (Number.isFinite(lowerBound)) {
			startTime = lowerBound;
			endTime = lowerBound;
		} else if (Number.isFinite(upperBound)) {
			startTime = upperBound;
			endTime = upperBound;
		}
	}

	return {
		startValue: dinext_project_stage_gate.roadmap._formatDateForChart(startTime),
		endValue: dinext_project_stage_gate.roadmap._formatDateForChart(endTime),
	};
};

dinext_project_stage_gate.roadmap.getFullHorizontalViewport = function ({
	bars,
	gates,
	taskBars,
	milestones,
	fromDate,
	toDate,
} = {}) {
	const times = [];

	(bars || []).forEach((bar) => {
		const value = bar?.value || [];
		[value[1], value[2]].forEach((point) => {
			const time = dinext_project_stage_gate.roadmap._parseTimeMs(point);
			if (Number.isFinite(time)) {
				times.push(time);
			}
		});
	});

	(gates || []).forEach((gate) => {
		const time = dinext_project_stage_gate.roadmap._parseTimeMs(gate?.value?.[0]);
		if (Number.isFinite(time)) {
			times.push(time);
		}
	});

	(taskBars || []).forEach((taskBar) => {
		const value = taskBar?.value || [];
		[value[1], value[2]].forEach((point) => {
			const time = dinext_project_stage_gate.roadmap._parseTimeMs(point);
			if (Number.isFinite(time)) {
				times.push(time);
			}
		});
	});

	(milestones || []).forEach((milestone) => {
		const time = dinext_project_stage_gate.roadmap._parseTimeMs(milestone?.value?.[0]);
		if (Number.isFinite(time)) {
			times.push(time);
		}
	});

	if (!times.length) {
		return {
			startValue: fromDate,
			endValue: toDate,
		};
	}

	return {
		startValue: dinext_project_stage_gate.roadmap._formatDateForChart(Math.min(...times)),
		endValue: dinext_project_stage_gate.roadmap._formatDateForChart(Math.max(...times)),
	};
};

dinext_project_stage_gate.roadmap.getFullVerticalViewport = function (categories) {
	const totalRows = Array.isArray(categories) ? categories.length : 0;
	if (!totalRows) {
		return { startValue: 0, endValue: 0 };
	}

	return {
		startValue: 0,
		endValue: totalRows - 1,
	};
};

dinext_project_stage_gate.roadmap.buildShowAllDataZoomConfig = function ({
	categories,
	bars,
	gates,
	taskBars,
	milestones,
	fromDate,
	toDate,
} = {}) {
	const horizontal = dinext_project_stage_gate.roadmap.getFullHorizontalViewport({
		bars,
		gates,
		taskBars,
		milestones,
		fromDate,
		toDate,
	});
	const vertical = dinext_project_stage_gate.roadmap.getFullVerticalViewport(categories);

	return [
		{
			xAxisIndex: 0,
			startValue: horizontal.startValue,
			endValue: horizontal.endValue,
		},
		{
			xAxisIndex: 0,
			startValue: horizontal.startValue,
			endValue: horizontal.endValue,
		},
		{
			yAxisIndex: 0,
			startValue: vertical.startValue,
			endValue: vertical.endValue,
		},
		{
			yAxisIndex: 0,
			startValue: vertical.startValue,
			endValue: vertical.endValue,
		},
	];
};

dinext_project_stage_gate.roadmap.applyProjectFocusInitialViewport = function (
	report,
	dom,
	options = {}
) {
	if (!report?._dinextRoadmapProjectFocusPending || !dom) {
		return false;
	}
	const dataZoom = dinext_project_stage_gate.roadmap.buildShowAllDataZoomConfig(options);
	dinext_project_stage_gate.roadmap.persistViewportState(
		dom,
		dinext_project_stage_gate.roadmap.getViewportStateFromDataZoom(dataZoom)
	);
	report._dinextRoadmapProjectFocusPending = false;
	return true;
};

dinext_project_stage_gate.roadmap.buildAxisFitDataZoomConfig = function ({
	axis,
	viewportState,
	categories,
	bars,
	gates,
	taskBars,
	milestones,
	fromDate,
	toDate,
} = {}) {
	const safeAxis = axis === "vertical" ? "vertical" : "horizontal";
	const fullHorizontalViewport = dinext_project_stage_gate.roadmap.getFullHorizontalViewport({
		bars,
		gates,
		taskBars,
		milestones,
		fromDate,
		toDate,
	});
	const fullVerticalViewport = dinext_project_stage_gate.roadmap.getFullVerticalViewport(categories);
	const savedViewport = dinext_project_stage_gate.roadmap.cloneViewportState(viewportState);
	const currentHorizontalViewport =
		(savedViewport?.horizontal &&
			dinext_project_stage_gate.roadmap.clampHorizontalViewport(
				savedViewport.horizontal,
				fullHorizontalViewport
			)) ||
		fullHorizontalViewport;
	const currentVerticalViewport =
		(savedViewport?.vertical &&
			dinext_project_stage_gate.roadmap.clampVerticalViewport(
				savedViewport.vertical,
				categories
			)) ||
		fullVerticalViewport;
	const horizontalViewport =
		safeAxis === "horizontal" ? fullHorizontalViewport : currentHorizontalViewport;
	const verticalViewport =
		safeAxis === "vertical" ? fullVerticalViewport : currentVerticalViewport;

	return [
		{
			xAxisIndex: 0,
			startValue: horizontalViewport.startValue,
			endValue: horizontalViewport.endValue,
		},
		{
			xAxisIndex: 0,
			startValue: horizontalViewport.startValue,
			endValue: horizontalViewport.endValue,
		},
		{
			yAxisIndex: 0,
			startValue: verticalViewport.startValue,
			endValue: verticalViewport.endValue,
		},
		{
			yAxisIndex: 0,
			startValue: verticalViewport.startValue,
			endValue: verticalViewport.endValue,
		},
	];
};

dinext_project_stage_gate.roadmap.buildDataZoomConfig = function ({
	categories,
	bars,
	gates,
	taskBars,
	milestones,
	fromDate,
	toDate,
	today,
	viewportState,
} = {}) {
	let horizontal = dinext_project_stage_gate.roadmap.getDefaultHorizontalViewport({
		today,
		fromDate,
		toDate,
	});
	let vertical = dinext_project_stage_gate.roadmap.getDefaultVerticalViewport(categories);
	const savedViewport = dinext_project_stage_gate.roadmap.cloneViewportState(viewportState);
	const fullHorizontalViewport = dinext_project_stage_gate.roadmap.getFullHorizontalViewport({
		bars,
		gates,
		taskBars,
		milestones,
		fromDate,
		toDate,
	});
	if (savedViewport?.horizontal && Object.keys(savedViewport.horizontal).length) {
		horizontal =
			dinext_project_stage_gate.roadmap.clampHorizontalViewport(
				savedViewport.horizontal,
				fullHorizontalViewport
			) || horizontal;
	}
	if (savedViewport?.vertical && Object.keys(savedViewport.vertical).length) {
		vertical =
			dinext_project_stage_gate.roadmap.clampVerticalViewport(
				savedViewport.vertical,
				categories
			) || vertical;
	}

	return [
		{
			type: "inside",
			xAxisIndex: 0,
			filterMode: "none",
			startValue: horizontal.startValue,
			endValue: horizontal.endValue,
		},
		{
			type: "slider",
			xAxisIndex: 0,
			filterMode: "none",
			height: 24,
			bottom: 4,
			startValue: horizontal.startValue,
			endValue: horizontal.endValue,
		},
		{
			type: "inside",
			yAxisIndex: 0,
			filterMode: "filter",
			zoomOnMouseWheel: false,
			moveOnMouseWheel: false,
			startValue: vertical.startValue,
			endValue: vertical.endValue,
		},
		{
			type: "slider",
			yAxisIndex: 0,
			filterMode: "filter",
			width: 18,
			right: 4,
			top: 44,
			bottom: 36,
			startValue: vertical.startValue,
			endValue: vertical.endValue,
		},
	];
};

dinext_project_stage_gate.roadmap.getRoadmapIntroAnimationTimeMs = function (entry, kind) {
	if (kind === "bar") {
		return dinext_project_stage_gate.roadmap._parseTimeMs(entry?.value?.[1]);
	}
	if (kind === "gate") {
		return dinext_project_stage_gate.roadmap._parseTimeMs(entry?.value?.[0]);
	}
	if (kind === "taskBar") {
		return dinext_project_stage_gate.roadmap._parseTimeMs(entry?.value?.[1]);
	}
	if (kind === "milestone") {
		return dinext_project_stage_gate.roadmap._parseTimeMs(entry?.value?.[0]);
	}
	return NaN;
};

dinext_project_stage_gate.roadmap.buildRoadmapIntroAnimationDelaySeries = function (
	entries,
	maxSpreadMs
) {
	const delays = new Array(entries.length).fill(0);
	if (entries.length <= 1) {
		return delays;
	}

	const safeMaxSpread = Math.max(0, Number(maxSpreadMs) || 0);
	entries
		.map((entry, originalIndex) => ({
			originalIndex,
			timeMs: entry.timeMs,
		}))
		.sort((left, right) => {
			const leftHasTime = Number.isFinite(left.timeMs);
			const rightHasTime = Number.isFinite(right.timeMs);
			if (leftHasTime && rightHasTime && left.timeMs !== right.timeMs) {
				return left.timeMs - right.timeMs;
			}
			if (leftHasTime !== rightHasTime) {
				return leftHasTime ? -1 : 1;
			}
			return left.originalIndex - right.originalIndex;
		})
		.forEach((entry, orderIndex, sortedEntries) => {
			const progress = sortedEntries.length <= 1 ? 0 : orderIndex / (sortedEntries.length - 1);
			delays[entry.originalIndex] = Math.round(progress * safeMaxSpread);
		});

	return delays;
};

dinext_project_stage_gate.roadmap.buildSequentialIntroAnimationDelays = function ({
	bars,
	gates,
	taskBars,
	milestones,
} = {}) {
	const safeBars = Array.isArray(bars) ? bars : [];
	const safeGates = Array.isArray(gates) ? gates : [];
	const safeTaskBars = Array.isArray(taskBars) ? taskBars : [];
	const safeMilestones = Array.isArray(milestones) ? milestones : [];
	const barDelays = dinext_project_stage_gate.roadmap.buildRoadmapIntroAnimationDelaySeries(
		safeBars.map((bar) => ({
			timeMs: dinext_project_stage_gate.roadmap.getRoadmapIntroAnimationTimeMs(bar, "bar"),
		})),
		dinext_project_stage_gate.roadmap.ROADMAP_STAGE_INTRO_ANIMATION_MAX_SPREAD_MS
	);
	const gateDelays = dinext_project_stage_gate.roadmap.buildRoadmapIntroAnimationDelaySeries(
		safeGates.map((gate) => ({
			timeMs: dinext_project_stage_gate.roadmap.getRoadmapIntroAnimationTimeMs(gate, "gate"),
		})),
		dinext_project_stage_gate.roadmap.ROADMAP_GATE_INTRO_ANIMATION_MAX_SPREAD_MS
	);
	const taskBarDelays = dinext_project_stage_gate.roadmap.buildRoadmapIntroAnimationDelaySeries(
		safeTaskBars.map((taskBar) => ({
			timeMs: dinext_project_stage_gate.roadmap.getRoadmapIntroAnimationTimeMs(taskBar, "taskBar"),
		})),
		dinext_project_stage_gate.roadmap.ROADMAP_STAGE_INTRO_ANIMATION_MAX_SPREAD_MS
	);
	const milestoneDelays = dinext_project_stage_gate.roadmap.buildRoadmapIntroAnimationDelaySeries(
		safeMilestones.map((milestone) => ({
			timeMs: dinext_project_stage_gate.roadmap.getRoadmapIntroAnimationTimeMs(
				milestone,
				"milestone"
			),
		})),
		dinext_project_stage_gate.roadmap.ROADMAP_GATE_INTRO_ANIMATION_MAX_SPREAD_MS
	);

	return { barDelays, gateDelays, taskBarDelays, milestoneDelays };
};

dinext_project_stage_gate.roadmap.buildChartOptions = function ({
	categories,
	bars,
	gates,
	taskBars,
	milestones,
	dataZoom,
	onShowAllData,
	onShowFullWidth,
	onShowFullHeight,
	onSortProjects,
	monthOnlyXAxisLabels = false,
	rowSpanUnits = 1,
	today,
} = {}) {
	const gridLineColor = dinext_project_stage_gate.roadmap.getThemeVariableColor(
		"--border-color",
		"rgba(148, 163, 184, 0.28)"
	);
	const minorGridLineColor = dinext_project_stage_gate.roadmap.getThemeVariableColor(
		"--border-color",
		"rgba(148, 163, 184, 0.18)"
	);
	const introAnimationDelays = dinext_project_stage_gate.roadmap.buildSequentialIntroAnimationDelays({
		bars,
		gates,
		taskBars,
		milestones,
	});
	const introAnimationDuration =
		dinext_project_stage_gate.roadmap.ROADMAP_INTRO_ANIMATION_DURATION_MS;
	const introAnimationEasing = dinext_project_stage_gate.roadmap.ROADMAP_INTRO_ANIMATION_EASING;
	const safeCategories = categories || [];
	const safeTaskBars = Array.isArray(taskBars) ? taskBars : [];
	const legendData = dinext_project_stage_gate.roadmap.buildLegendData({
		taskBars: safeTaskBars,
		milestones,
	});
	const legendRows = Math.max(1, Math.ceil(legendData.length / 4));
	const categoryEntries = safeCategories.map((category) =>
		typeof category === "string"
			? {
					key: category,
					projectName: category,
					projectLabel: category,
					laneLabel: "",
					isProjectLabel: true,
			  }
			: {
					key: category?.key,
					projectName: category?.projectName || category?.projectLabel || category?.key || "",
					projectLabel: category?.projectLabel || category?.key || "",
					laneLabel: category?.laneLabel || "",
					isProjectLabel: category?.isProjectLabel !== false,
				}
	);
	const projectSeparators = dinext_project_stage_gate.roadmap.buildProjectSeparatorData(categoryEntries);
	const categoryLabelByKey = Object.fromEntries(
		categoryEntries.map((category) => [
			category.key,
			category.isProjectLabel
				? dinext_project_stage_gate.roadmap.wrapAxisLabel(category.projectLabel)
				: "",
		])
	);
	const grid = {
		containLabel: true,
		top: Math.max(44, 18 + legendRows * 24),
		right: 28,
		bottom: 44,
		left: 12,
	};
	const chartHeight = dinext_project_stage_gate.roadmap.calculateChartHeight(
		safeCategories,
		rowSpanUnits
	);
	const estimatedStageBarHeight = dinext_project_stage_gate.roadmap.estimateStageBarHeight(
		safeCategories,
		chartHeight,
		grid,
		rowSpanUnits
	);
	const checkpointSymbolSize =
		dinext_project_stage_gate.roadmap.getCheckpointDiamondSize(estimatedStageBarHeight);
	const fullHorizontalViewport = dinext_project_stage_gate.roadmap.getFullHorizontalViewport({
		bars,
		gates,
		taskBars: safeTaskBars,
		milestones,
	});
	const todayMarkerSeries = dinext_project_stage_gate.roadmap.buildTodayMarkerSeries({
		today,
		categoryCount: categoryEntries.length,
	});

	return {
		backgroundColor: "transparent",
		animation: true,
		animationDurationUpdate: 0,
		animationEasing: introAnimationEasing,
		animationEasingUpdate: "linear",
		grid,
		legend: {
			show: true,
			top: 4,
			left: 12,
			right: 88,
			z: 20,
			selectedMode: false,
			itemWidth: 18,
			itemHeight: 12,
			textStyle: {
				color: dinext_project_stage_gate.roadmap.getThemeVariableColor("--text-color", "#d1d5db"),
				fontSize: 11,
				lineHeight: 14,
			},
			data: legendData,
		},
		tooltip: {
			trigger: "item",
			formatter: dinext_project_stage_gate.roadmap.formatTooltip,
		},
		toolbox: {
			right: 8,
			top: 4,
			itemSize: 16,
			feature: {
				restore: {
					title: __("Restore"),
				},
				mySortProjects: {
					show: true,
					title: __("Sort projects"),
					icon: "path://M4 5H16M4 10H13M4 15H10M16 13L19 16L22 13M19 4V16",
					onclick() {
						onSortProjects?.();
					},
				},
				myShowFullWidth: {
					show: true,
					title: __("Show Full Width"),
					icon: "path://M2 10H18M6 6L2 10L6 14M14 6L18 10L14 14",
					onclick() {
						onShowFullWidth?.();
					},
				},
				myShowFullHeight: {
					show: true,
					title: __("Show Full Height"),
					icon: "path://M10 2V18M6 6L10 2L14 6M6 14L10 18L14 14",
					onclick() {
						onShowFullHeight?.();
					},
				},
				myShowAllData: {
					show: true,
					title: __("Show All"),
					icon: "path://M3 8h18M8 3v18M16 3v18M3 16h18",
					onclick() {
						onShowAllData?.();
					},
				},
				saveAsImage: {
					title: __("Save as Image"),
					name: "project-stage-gate-roadmap",
					pixelRatio: 2,
					backgroundColor: dinext_project_stage_gate.roadmap.getThemeVariableColor(
						"--card-bg",
						"#ffffff"
					),
				},
			},
		},
		xAxis: {
			type: "time",
			axisLabel: {
				formatter(value) {
					return dinext_project_stage_gate.roadmap.formatXAxisLabel(value, {
						monthOnly: monthOnlyXAxisLabels,
					});
				},
			},
			splitLine: {
				show: true,
				lineStyle: {
					color: gridLineColor,
					type: "solid",
				},
			},
			minorSplitLine: {
				show: true,
				lineStyle: {
					color: minorGridLineColor,
					type: "dashed",
				},
			},
			minorTick: {
				show: true,
				splitNumber: 2,
			},
		},
		yAxis: {
			type: "category",
			// Keep the first category at the top so visual row order matches the lane layout.
			inverse: true,
			triggerEvent: true,
			data: categoryEntries.map((category) => category.key),
			splitLine: {
				show: false,
				lineStyle: {
					color: gridLineColor,
					type: "solid",
				},
			},
			axisLabel: {
				show: true,
				interval: 0,
				width: 190,
				overflow: "break",
				fontSize: 12,
				lineHeight: 14,
				margin: 12,
				align: "right",
				formatter(value) {
					return categoryLabelByKey[value] ?? dinext_project_stage_gate.roadmap.wrapAxisLabel(value);
				},
			},
		},
		dataZoom: dataZoom || [],
		series: [
			{
				name: dinext_project_stage_gate.roadmap.translateStageGateLabel("Stages"),
				type: "custom",
				clip: true,
				animationDuration: introAnimationDuration,
				animationDurationUpdate: 0,
				animationEasing: introAnimationEasing,
				animationEasingUpdate: "linear",
				animationDelay(dataIndex) {
					return introAnimationDelays.barDelays[dataIndex] ?? 0;
				},
				animationDelayUpdate() {
					return 0;
				},
				renderItem(params, api) {
					const rowPosition = api.value(0);
					const start = api.coord([api.value(1), rowPosition]);
					const end = api.coord([api.value(2), rowPosition]);
					const slotRatio = dinext_project_stage_gate.roadmap.getRowSlotHeightRatio(
						params.data?.rowSpanUnits || rowSpanUnits
					);
					const height =
						api.size([0, 1])[1] *
						slotRatio *
						dinext_project_stage_gate.roadmap.ROADMAP_SLOT_FILL_RATIO;
					const fromApi = api.style();
					const itemStyle = params.data?.itemStyle || {};
					const fill = fromApi.fill || fromApi.color || itemStyle.color || itemStyle.fill;
					const stroke =
						fromApi.stroke || fromApi.borderColor || itemStyle.borderColor || itemStyle.stroke;
					const lineWidth =
						fromApi.lineWidth ?? fromApi.borderWidth ?? itemStyle.borderWidth ?? 1;
					return dinext_project_stage_gate.roadmap.buildStageBarGraphic({
						startX: start[0],
						endX: end[0],
						centerY: start[1],
						height,
						label: params.data?.name || api.value(3),
						fill,
						stroke,
						lineWidth,
						textColor: itemStyle.textColor,
						textOpacity: itemStyle.textOpacity,
						animationDelay: introAnimationDelays.barDelays[params.dataIndex] ?? 0,
						animationDuration: introAnimationDuration,
						animationEasing: introAnimationEasing,
					});
				},
				encode: {
					x: [1, 2],
					y: 0,
				},
				itemStyle: {
					color: dinext_project_stage_gate.roadmap.getStageItemStyle({ status: "Active" }).fill,
				},
				data: bars || [],
			},
			{
				name: __("Gate checkpoints"),
				type: "custom",
				clip: true,
				symbol: "diamond",
				symbolSize: checkpointSymbolSize,
				z: 8,
				animationDuration: introAnimationDuration,
				animationDurationUpdate: 0,
				animationEasing: introAnimationEasing,
				animationEasingUpdate: "linear",
				animationDelay(dataIndex) {
					return introAnimationDelays.gateDelays[dataIndex] ?? 0;
				},
				animationDelayUpdate() {
					return 0;
				},
				renderItem(params, api) {
					const center = api.coord([api.value(0), api.value(1)]);
					const slotRatio = dinext_project_stage_gate.roadmap.getRowSlotHeightRatio(
						params.data?.rowSpanUnits || rowSpanUnits
					);
					const stageHeight =
						api.size([0, 1])[1] *
						slotRatio *
						dinext_project_stage_gate.roadmap.ROADMAP_SLOT_FILL_RATIO;
					const size = dinext_project_stage_gate.roadmap.getCheckpointDiamondSize(stageHeight);
					const half = size / 2;
					const fromApi = api.style();
					const itemStyle = params.data?.itemStyle || {};
					const fill = fromApi.fill || fromApi.color || itemStyle.color;
					const stroke =
						fromApi.stroke || fromApi.borderColor || itemStyle.borderColor || itemStyle.stroke;
					const lineWidth =
						fromApi.lineWidth ?? fromApi.borderWidth ?? itemStyle.borderWidth ?? 2;
					return {
						type: "polygon",
						shape: {
							points: [
								[center[0], center[1] - half],
								[center[0] + half, center[1]],
								[center[0], center[1] + half],
								[center[0] - half, center[1]],
							],
						},
						style: {
							fill,
							stroke,
							lineWidth,
							shadowBlur: itemStyle.shadowBlur,
							shadowColor: itemStyle.shadowColor,
						},
						enterFrom: {
							shape: {
								points: [
									[center[0], center[1]],
									[center[0], center[1]],
									[center[0], center[1]],
									[center[0], center[1]],
								],
							},
							style: { opacity: 0 },
						},
						enterAnimation: {
							delay: introAnimationDelays.gateDelays[params.dataIndex] ?? 0,
							duration: introAnimationDuration,
							easing: introAnimationEasing,
						},
						transition: "all",
					};
				},
				itemStyle: {
					color: dinext_project_stage_gate.roadmap.getCheckpointItemStyle("Approved").color,
					borderWidth: 2,
				},
				encode: {
					x: 0,
					y: 1,
				},
				data: gates || [],
			},
			{
				name: __("Milestones"),
				type: "scatter",
				symbol: "diamond",
				symbolSize(value, params) {
					return params?.data?.symbolSize || 14;
				},
				animationDuration: introAnimationDuration,
				animationDurationUpdate: 0,
				animationEasing: introAnimationEasing,
				animationEasingUpdate: "linear",
				animationDelay(dataIndex) {
					return introAnimationDelays.milestoneDelays[dataIndex] ?? 0;
				},
				animationDelayUpdate() {
					return 0;
				},
				label: {
					show: true,
					position: "right",
					align: "left",
					verticalAlign: "middle",
					fontWeight: 600,
					formatter(params) {
						return params?.data?.label?.text || params?.data?.name || params?.name || "";
					},
					color(params) {
						return params?.data?.label?.color || params?.data?.labelColor || "#d13438";
					},
				},
				itemStyle: {
					color: dinext_project_stage_gate.roadmap.getMilestoneItemStyle().lineColor,
				},
				encode: {
					x: 0,
					y: 1,
				},
				data: milestones || [],
			},
			...dinext_project_stage_gate.roadmap.buildTaskBarSeries({
				taskBars: safeTaskBars,
				introAnimationDuration,
				introAnimationEasing,
				introAnimationDelays,
				rowSpanUnits,
			}),
			dinext_project_stage_gate.roadmap.buildProjectSeparatorSeries({
				projectSeparators,
				gridLineColor,
				startValue: fullHorizontalViewport.startValue,
				endValue: fullHorizontalViewport.endValue,
			}),
			...(todayMarkerSeries ? [todayMarkerSeries] : []),
			...dinext_project_stage_gate.roadmap.buildLegendProxySeries({
				taskBars: safeTaskBars,
				milestones,
			}),
		],
	};
};

dinext_project_stage_gate.roadmap.isStrictlyWithinDisplayRange = function (value, options) {
	const time = dinext_project_stage_gate.roadmap._parseTimeMs(value);
	if (!Number.isFinite(time)) {
		return false;
	}

	const fromTime = dinext_project_stage_gate.roadmap._parseTimeMs(options?.fromDate);
	if (Number.isFinite(fromTime) && time <= fromTime) {
		return false;
	}

	const toTime = dinext_project_stage_gate.roadmap._parseTimeMs(options?.toDate);
	if (Number.isFinite(toTime) && time >= toTime) {
		return false;
	}

	return true;
};

/**
 * When every stage on a row shares the same start/end, intervals stack in the chart as one shape.
 * Split the shared range into equal slices by sequence so each stage is visible (like the widget chain).
 */
dinext_project_stage_gate.roadmap.normalizeIdenticalStageRanges = function (bars) {
	if (!bars || !bars.length) {
		return;
	}
	const byRow = {};
	bars.forEach((bar) => {
		const row = bar.value[0];
		(byRow[row] ??= []).push(bar);
	});
	Object.values(byRow).forEach((rowBars) => {
		if (rowBars.length <= 1) {
			return;
		}
		rowBars.sort((a, b) => (a.value[5] ?? 0) - (b.value[5] ?? 0));
		const tStart = dinext_project_stage_gate.roadmap._parseTimeMs(rowBars[0].value[1]);
		const tEnd = dinext_project_stage_gate.roadmap._parseTimeMs(rowBars[0].value[2]);
		if (!Number.isFinite(tStart) || !Number.isFinite(tEnd) || tEnd <= tStart) {
			return;
		}
		const sameWindow = rowBars.every((b) => {
			const s = dinext_project_stage_gate.roadmap._parseTimeMs(b.value[1]);
			const e = dinext_project_stage_gate.roadmap._parseTimeMs(b.value[2]);
			return s === tStart && e === tEnd;
		});
		if (!sameWindow) {
			return;
		}
		const n = rowBars.length;
		const span = tEnd - tStart;
		const slice = span / n;
		const innerGap = Math.min(slice * 0.06, 2 * 86400000);
		rowBars.forEach((bar, i) => {
			let s = tStart + i * slice + (i === 0 ? 0 : innerGap / 2);
			let e = tStart + (i + 1) * slice - (i === n - 1 ? 0 : innerGap / 2);
			if (e <= s) {
				e = s + 86400000;
			}
			bar.value[1] = dinext_project_stage_gate.roadmap._formatDateForChart(s);
			bar.value[2] = dinext_project_stage_gate.roadmap._formatDateForChart(e);
		});
	});
};

dinext_project_stage_gate.roadmap.assignTaskLaneLevels = function (entities) {
	const safeEntities = Array.isArray(entities) ? [...entities] : [];
	const laneEndTimes = [];
	return safeEntities
		.sort((left, right) => {
			const leftStart = dinext_project_stage_gate.roadmap._parseTimeMs(left.startDate);
			const rightStart = dinext_project_stage_gate.roadmap._parseTimeMs(right.startDate);
			if (Number.isFinite(leftStart) && Number.isFinite(rightStart) && leftStart !== rightStart) {
				return leftStart - rightStart;
			}
			return String(left.name || "").localeCompare(String(right.name || ""));
		})
		.map((entity) => {
			const startMs = dinext_project_stage_gate.roadmap._parseTimeMs(entity.startDate);
			const endMs = dinext_project_stage_gate.roadmap._parseTimeMs(entity.endDate || entity.startDate);
			let stackLevel = 0;
			while (
				stackLevel < laneEndTimes.length &&
				Number.isFinite(startMs) &&
				Number.isFinite(laneEndTimes[stackLevel]) &&
				startMs <= laneEndTimes[stackLevel]
			) {
				stackLevel += 1;
			}
			laneEndTimes[stackLevel] = Number.isFinite(endMs) ? endMs : startMs;
			return {
				...entity,
				stackLevel,
			};
		});
};

dinext_project_stage_gate.roadmap.getRoadmapRowOffset = function (slotIndex, totalSlots) {
	const safeTotalSlots = Math.max(1, Number(totalSlots) || 1);
	const usableHeight = dinext_project_stage_gate.roadmap.ROADMAP_ROW_USABLE_HEIGHT_RATIO;
	const slotSize = usableHeight / safeTotalSlots;
	return -usableHeight / 2 + slotSize * (slotIndex + 0.5);
};

dinext_project_stage_gate.roadmap.getOrderedTaskLaneKeys = function (laneMap, taskTypeOrder = []) {
	const safeTaskTypeOrder = dinext_project_stage_gate.roadmap._coerceToArray(taskTypeOrder);
	return Object.keys(laneMap || {}).sort((left, right) => {
		if (left === "milestone") {
			return 1;
		}
		if (right === "milestone") {
			return -1;
		}
		const leftType = left.replace(/^task_type:/, "");
		const rightType = right.replace(/^task_type:/, "");
		const leftIndex = safeTaskTypeOrder.indexOf(leftType);
		const rightIndex = safeTaskTypeOrder.indexOf(rightType);
		if (leftIndex !== -1 || rightIndex !== -1) {
			if (leftIndex === -1) {
				return 1;
			}
			if (rightIndex === -1) {
				return -1;
			}
			return leftIndex - rightIndex;
		}
		return leftType.localeCompare(rightType);
	});
};

dinext_project_stage_gate.roadmap.buildProjectLaneRows = function (
	projects,
	taskEntities,
	taskTypeOrder = []
) {
	const safeProjects = Array.isArray(projects) ? projects : [];
	const safeTaskEntities = Array.isArray(taskEntities) ? taskEntities : [];
	const groupedByProject = {};
	const categories = [];
	const laneIndexByKey = {};
	const projectDocsByLabel = {};
	const rowLayoutsByProject = {};

	safeTaskEntities.forEach((entity) => {
		if (!entity?.project) {
			return;
		}
		const laneKey = entity.lane_key || (entity.entity_kind === "milestone" ? "milestone" : "task");
		(groupedByProject[entity.project] ??= {});
		(groupedByProject[entity.project][laneKey] ??= []).push(entity);
	});

	safeProjects.forEach((project) => {
		const projectName = project?.name;
		const projectLabel = project?.project_name || projectName;
		const baseKey = `${projectName}::base`;
		const baseCategory = {
			key: baseKey,
			projectName,
			projectLabel,
			laneKey: "base",
			laneLabel: __("Project"),
			isProjectLabel: true,
		};
		laneIndexByKey[baseKey] = categories.length;
		categories.push(baseCategory);
		projectDocsByLabel[baseKey] = { docType: "Project", docName: projectName };
		projectDocsByLabel[projectLabel] = { docType: "Project", docName: projectName };

		const lanes = groupedByProject[projectName] || {};
		const orderedLaneKeys = dinext_project_stage_gate.roadmap.getOrderedTaskLaneKeys(
			lanes,
			taskTypeOrder
		);
		const laneRowIndexByKey = { base: laneIndexByKey[baseKey] };

		orderedLaneKeys.forEach((laneKey) => {
			const positioned = dinext_project_stage_gate.roadmap.assignTaskLaneLevels(
				lanes[laneKey].map((entity) => ({
					...entity,
					startDate:
						entity.entity_kind === "milestone"
							? entity.point_date
							: entity.start_date || entity.point_date,
					endDate:
						entity.entity_kind === "milestone"
							? entity.point_date
							: entity.end_date || entity.start_date || entity.point_date,
				}))
			);
			const laneLabel =
				laneKey === "milestone" ? __("Milestones") : lanes[laneKey]?.[0]?.lane_label || laneKey;
			const stackCount = Math.max(
				1,
				positioned.reduce((maxLevel, entity) => Math.max(maxLevel, entity.stackLevel + 1), 1)
			);
			const stackKeys = [];
			for (let stackLevel = 0; stackLevel < stackCount; stackLevel += 1) {
				const categoryKey =
					laneKey === "milestone"
						? `${projectName}::milestone`
						: `${projectName}::${laneKey}::${stackLevel}`;
				laneIndexByKey[categoryKey] = categories.length;
				stackKeys.push(categoryKey);
				categories.push({
					key: categoryKey,
					projectName,
					projectLabel,
					laneKey,
					laneLabel: stackLevel === 0 ? laneLabel : "",
					isProjectLabel: false,
				});
			}
			laneRowIndexByKey[laneKey] = stackKeys;
		});

		rowLayoutsByProject[projectName] = {
			baseKey,
			laneRowIndexByKey,
		};
	});

	return { categories, laneIndexByKey, rowLayoutsByProject, projectDocsByLabel };
};

dinext_project_stage_gate.roadmap.getTaskLineLabelLayout = function ({
	span,
	lineWidth,
	slotHeight,
} = {}) {
	const safeSpan = Math.max(Number(span) || 0, 0);
	const safeLineWidth = Math.max(Number(lineWidth) || 0, 0);
	const hasSlotHeight = Number.isFinite(Number(slotHeight));
	const safeSlotHeight = hasSlotHeight
		? Math.max(Number(slotHeight) || 0, safeLineWidth)
		: null;
	let fontSize = 11;
	if (safeSpan < 80 || (safeSlotHeight != null && safeSlotHeight < 22)) {
		fontSize = 9;
	} else if (safeSpan < 140 || (safeSlotHeight != null && safeSlotHeight < 28)) {
		fontSize = 10;
	}
	return {
		fontSize,
		minSpanForLabel: 40,
		offsetY: Math.max(
			5,
			Math.min(
				9,
				safeLineWidth * 0.5 + (safeSlotHeight != null ? safeSlotHeight * 0.08 : safeLineWidth * 0.2)
			)
		),
	};
};

dinext_project_stage_gate.roadmap.getMilestoneLabelLayout = function ({ symbolSize } = {}) {
	const safeSymbolSize = Math.max(Number(symbolSize) || 0, 0);
	let fontSize = 11;
	if (safeSymbolSize < 16) {
		fontSize = 9;
	} else if (safeSymbolSize < 20) {
		fontSize = 10;
	}
	return {
		position: "right",
		align: "left",
		verticalAlign: "middle",
		fontSize,
		distance: Math.max(4, Math.min(8, safeSymbolSize * 0.35)),
	};
};

dinext_project_stage_gate.roadmap.ensure_theme_observer = function (report) {
	if (!report || typeof MutationObserver === "undefined") {
		return;
	}

	dinext_project_stage_gate.roadmap._last_report = report;

	if (dinext_project_stage_gate.roadmap._theme_observer) {
		return;
	}

	const root = document.documentElement;
	if (!root) {
		return;
	}

	let theme = root.getAttribute("data-theme");
	const observer = new MutationObserver(() => {
		const next = root.getAttribute("data-theme");
		if (next === theme) {
			return;
		}
		theme = next;

		const lastReport = dinext_project_stage_gate.roadmap._last_report;
		if (!lastReport || !lastReport.raw_data) {
			return;
		}
		if (!dinext_project_stage_gate.roadmap.isRoadmapReport(lastReport)) {
			return;
		}

		dinext_project_stage_gate.roadmap.render(lastReport);
	});

	observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
	dinext_project_stage_gate.roadmap._theme_observer = observer;
};

dinext_project_stage_gate.roadmap.ensure_assets = function () {
	if (window.echarts) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		frappe.require(
			["/assets/dinext_common/js/echarts.min.js"],
			function () {
				resolve();
			}
		);
	});
};

dinext_project_stage_gate.roadmap.ensure_chart_mount = function (report) {
	if (!report?.page?.main) {
		return null;
	}

	const existingWrapper = report.page.main.find(".project-stage-gate-roadmap");
	if (existingWrapper.length) {
		if (typeof existingWrapper.find !== "function") {
			return existingWrapper;
		}
		const existingChart = existingWrapper.find(".project-stage-gate-roadmap-chart");
		const legacyLegend = existingWrapper.find(".project-stage-gate-roadmap-legend-slot");
		if (legacyLegend?.length && typeof legacyLegend.remove === "function") {
			legacyLegend.remove();
		}
		if (existingChart.length) {
			return existingChart;
		}
		return existingWrapper;
	}

	const wrapper = $('<div class="project-stage-gate-roadmap-shell" style="margin: 0 0 16px 0;"></div>');
	const chart = $(
		'<div class="project-stage-gate-roadmap-chart project-stage-gate-roadmap"></div>'
	);
	wrapper.append(chart);
	dinext_project_stage_gate.roadmap.applyChartHeight(chart.get(0), 0);
	if (chart.get(0)) {
		chart.get(0)._dinextRoadmapShell = wrapper;
	}
	report.page.main.prepend(wrapper);
	return chart;
};

dinext_project_stage_gate.roadmap.resizeCurrentChart = function () {
	const lastReport = dinext_project_stage_gate.roadmap._last_report;
	if (
		!lastReport?.page?.main ||
		!dinext_project_stage_gate.roadmap.isRoadmapReport(lastReport)
	) {
		return;
	}

	const mount = dinext_project_stage_gate.roadmap.ensure_chart_mount(lastReport);
	if (!mount?.length) {
		return;
	}

	const dom = mount.get(0);
	if (!dom) {
		return;
	}

	dinext_project_stage_gate.roadmap.applyChartHeight(
		dom,
		dom._dinextRoadmapCategoryCount || 0,
		dom._dinextRoadmapRowSpanUnits || 1
	);
	const chart =
		(typeof echarts !== "undefined" &&
			typeof echarts.getInstanceByDom === "function" &&
			echarts.getInstanceByDom(dom)) ||
		dom._dinextRoadmapChart ||
		null;
	if (!chart || typeof chart.resize !== "function") {
		return;
	}

	chart.resize();
	dinext_project_stage_gate.roadmap.updateXAxisLabelDensity(chart);
};

dinext_project_stage_gate.roadmap.ensureResizeHandler = function (report) {
	if (report) {
		dinext_project_stage_gate.roadmap._last_report = report;
	}

	if (
		dinext_project_stage_gate.roadmap._resize_handler ||
		typeof window === "undefined" ||
		typeof window.addEventListener !== "function"
	) {
		return;
	}

	const handler = function () {
		dinext_project_stage_gate.roadmap.resizeCurrentChart();
	};
	window.addEventListener("resize", handler);
	dinext_project_stage_gate.roadmap._resize_handler = handler;
};

dinext_project_stage_gate.roadmap.showEmptyState = function (dom, message) {
	if (!dom) {
		return;
	}

	dom.innerHTML = `<div class="project-stage-gate-roadmap-empty-state" style="padding: 32px 16px; text-align: center; color: var(--text-muted);">${message}</div>`;
};

dinext_project_stage_gate.roadmap.clearEmptyState = function (dom) {
	if (!dom) {
		return;
	}

	dom.innerHTML = "";
};

/**
 * Build categories, stage bars, and gate markers from report payload (for chart and tests).
 * @param {{ projects?: unknown[], stageBars?: unknown[], gates?: unknown[] }} payload
 * @param {{ fromDate?: string, toDate?: string }} [options]
 * @returns {{ categories: string[], bars: object[], gates: object[], projectDocsByLabel: Record<string, { docType: string, docName: string }> }}
 */
dinext_project_stage_gate.roadmap.prepareSeriesData = function (payload, options) {
	const safe = payload || { projects: [], stageBars: [], gates: [], taskEntities: [] };
	const sortedProjects = dinext_project_stage_gate.roadmap.sortProjectsForRoadmap(
		safe.projects || [],
		options?.sortState
	);
	const laneLayout = dinext_project_stage_gate.roadmap.buildProjectLaneRows(
		sortedProjects,
		safe.taskEntities || [],
		options?.taskTypeOrder
	);
	const categories = laneLayout.categories;
	const projectDocsByLabel = laneLayout.projectDocsByLabel;
	const taskTypeColorMap = dinext_project_stage_gate.roadmap.buildTaskTypeColorMap(
		safe.taskEntities || [],
		options?.taskTypeOrder
	);
	const getBaseLaneIndex = (projectName) =>
		laneLayout.rowLayoutsByProject[projectName]?.laneRowIndexByKey?.base ?? 0;

	const bars = (safe.stageBars || []).map((stage) => {
		const colors = dinext_project_stage_gate.roadmap.getStageItemStyle(stage);
		const stageLabel = dinext_project_stage_gate.roadmap.translateStageName(
			stage.stage_name || stage.stage
		);
		const range = dinext_project_stage_gate.roadmap.getStageDisplayRange(stage);
		return {
			name: stageLabel,
			docType: "Project Stage Instance",
			docName: stage.name,
			value: [
				getBaseLaneIndex(stage.project),
				range.start,
				range.end,
				stageLabel,
				dinext_project_stage_gate.roadmap.translateStatus(stage.status),
				Number(stage.sequence) || 0,
			],
			itemStyle: {
				color: colors.fill,
				borderColor: colors.stroke,
				borderWidth: colors.lineWidth,
				textColor: colors.textColor,
			},
		};
	});
	dinext_project_stage_gate.roadmap.normalizeIdenticalStageRanges(bars);

	const gates = (safe.gates || [])
		.filter((gate) => {
			const displayDate = dinext_project_stage_gate.roadmap.getDisplayDate(
				gate.approval_date,
				gate.gate_due_date
			);
			return (
				Boolean(gate.name) &&
				dinext_project_stage_gate.roadmap.isStrictlyWithinDisplayRange(displayDate, options)
			);
		})
		.map((gate) => ({
			name: gate.checkpoint_level
				? dinext_project_stage_gate.roadmap.translateStageName(gate.checkpoint_level)
				: dinext_project_stage_gate.roadmap.translateStageGateLabel("Gate"),
			docType: "Project Gate Checkpoint",
			docName: gate.name,
			value: [
				dinext_project_stage_gate.roadmap.getDisplayDate(gate.approval_date, gate.gate_due_date),
				getBaseLaneIndex(gate.project),
				dinext_project_stage_gate.roadmap.translateStatus(gate.status),
			],
			itemStyle: {
				...dinext_project_stage_gate.roadmap.getCheckpointItemStyle(gate.status, gate),
			},
		}));

	const milestones = (safe.taskEntities || [])
		.filter((entity) => entity?.entity_kind === "milestone")
		.map((entity) => {
			const milestoneStyle = dinext_project_stage_gate.roadmap.getMilestoneItemStyle(entity.status);
			const rowIndex =
				laneLayout.laneIndexByKey[`${entity.project}::milestone`] ?? getBaseLaneIndex(entity.project);
			const symbolSize = Number(entity.symbolSize) || 14;
			const labelLayout = dinext_project_stage_gate.roadmap.getMilestoneLabelLayout({
				symbolSize,
			});
			return {
				name: entity.subject || entity.name,
				docType: "Task",
				docName: entity.name,
				entityKind: "milestone",
				labelColor: milestoneStyle.labelColor,
				symbolSize,
				label: {
					show: true,
					position: labelLayout.position,
					distance: labelLayout.distance,
					fontSize: labelLayout.fontSize,
					fontWeight: 600,
					align: labelLayout.align,
					verticalAlign: labelLayout.verticalAlign,
					color: milestoneStyle.labelColor,
					text: entity.subject || entity.name,
				},
				value: [entity.point_date, rowIndex, dinext_project_stage_gate.roadmap.translateStatus(entity.status)],
				itemStyle: {
					color: milestoneStyle.lineColor,
					borderColor: milestoneStyle.borderColor,
				},
			};
		});

	const taskBars = [];
	Object.entries(laneLayout.rowLayoutsByProject).forEach(([projectName, projectLayout]) => {
		const laneMap = {};
		(safe.taskEntities || [])
			.filter((entity) => entity?.project === projectName && entity?.entity_kind === "task_bar")
			.forEach((entity) => {
				(laneMap[entity.lane_key] ??= []).push(entity);
			});

		Object.entries(laneMap).forEach(([laneKey, entities]) => {
			const positioned = dinext_project_stage_gate.roadmap.assignTaskLaneLevels(
				entities.map((entity) => ({
					...entity,
					startDate: entity.start_date || entity.point_date,
					endDate: entity.end_date || entity.start_date || entity.point_date,
				}))
			);
			positioned.forEach((entity) => {
				const laneKeys = projectLayout.laneRowIndexByKey[laneKey] || [];
				const rowIndex = laneLayout.laneIndexByKey[laneKeys[entity.stackLevel]] ?? getBaseLaneIndex(projectName);
				const taskColorKey =
					entity.type || entity.lane_label || laneKey.replace(/^task_type:/, "") || laneKey;
				const taskStyle = dinext_project_stage_gate.roadmap.getTaskTypeItemStyle(taskColorKey, {
					laneKey: entity.lane_key,
					colorMap: taskTypeColorMap,
				});
				const hasProgress = entity.progress != null && entity.progress !== "";
				const progress = dinext_project_stage_gate.roadmap.normalizeTaskProgress(entity.progress);
				taskBars.push({
					name: entity.subject || entity.name,
					docType: "Task",
					docName: entity.name,
					entityKind: "task_bar",
					progress,
					hasProgress,
					progressLineColor: taskStyle.lineColor,
					value: [
						rowIndex,
						entity.start_date,
						entity.end_date || entity.start_date,
						entity.subject || entity.name,
						dinext_project_stage_gate.roadmap.translateStatus(entity.status),
						entity.lane_label || entity.type || __("Task"),
						taskStyle.lineColor,
					],
					itemStyle: {
						color: taskStyle.lineColor,
						labelColor: taskStyle.labelColor,
						shadowColor: taskStyle.shadowColor,
					},
				});
			});
		});
	});

	return {
		categories,
		bars,
		gates,
		taskBars,
		milestones,
		rowSpanUnits: 1,
		projectDocsByLabel,
	};
};

/**
 * Open linked DocType form from chart item data (same pattern as project stage widget).
 * @param {{ docType?: string, docName?: string } | null | undefined} data
 */
dinext_project_stage_gate.roadmap.navigateFromChartItem = function (data) {
	if (!data || !data.docName || !data.docType) {
		return;
	}
	if (frappe.model && typeof frappe.model.can_read === "function" && !frappe.model.can_read(data.docType)) {
		frappe.msgprint(__("You do not have permission to open this document."));
		return;
	}
	frappe.set_route("Form", data.docType, data.docName);
};

dinext_project_stage_gate.roadmap._getAxisNavigationTarget = function (params, projectDocsByLabel) {
	if (params?.componentType !== "yAxis") {
		return null;
	}
	const label = params.value || params.name;
	if (!label || !projectDocsByLabel) {
		return null;
	}
	return projectDocsByLabel[label] || null;
};

dinext_project_stage_gate.roadmap._chartClickHandler = function (params, projectDocsByLabel) {
	const axisTarget = dinext_project_stage_gate.roadmap._getAxisNavigationTarget(
		params,
		projectDocsByLabel
	);
	dinext_project_stage_gate.roadmap.navigateFromChartItem(axisTarget || params?.data);
};

dinext_project_stage_gate.roadmap.attachChartClickNavigation = function (chart, projectDocsByLabel) {
	if (!chart || typeof chart.on !== "function") {
		return;
	}
	chart._dinextProjectDocsByLabel = projectDocsByLabel || {};
	if (!chart._dinextChartClickHandler) {
		chart._dinextChartClickHandler = function (params) {
			dinext_project_stage_gate.roadmap._chartClickHandler(
				params,
				chart._dinextProjectDocsByLabel
			);
		};
	}
	if (typeof chart.off === "function") {
		chart.off("click", chart._dinextChartClickHandler);
	}
	chart.on("click", chart._dinextChartClickHandler);
};

/**
 * Pixel coordinates for a horizontal stage bar chevron (right-pointing tip).
 * Normalizes near-zero or inverted axis spans so inset/tip math matches the real span.
 *
 * @param {number} startX - api.coord x for interval start
 * @param {number} endX - api.coord x for interval end
 * @param {number} centerY - category band center y
 * @param {number} barHeight - full vertical thickness of the bar in px
 * @returns {number[][]} polygon points for ECharts custom series
 */
dinext_project_stage_gate.roadmap.buildStageBarChevronPoints = function (startX, endX, centerY, barHeight) {
	const MIN_PIXEL_SPAN = 4;
	const MIN_TIP = 2;
	const DEFAULT_TIP = 14;

	const xLeft = Math.min(startX, endX);
	let x0 = xLeft;
	let x1 = Math.max(startX, endX);
	let span = x1 - x0;
	if (span < MIN_PIXEL_SPAN) {
		x1 = x0 + MIN_PIXEL_SPAN;
		span = MIN_PIXEL_SPAN;
	}

	const halfH = barHeight / 2;
	const yc = centerY;

	// Keep chevron angle stable across stage durations, matching the fixed skew used in the widget.
	let tip = DEFAULT_TIP;
	const maxTipForSpan = Math.max(MIN_TIP, (span - 2) / 2);
	tip = Math.min(tip, maxTipForSpan);
	const notch = tip;

	return [
		[x0, yc - halfH],
		[x1 - tip, yc - halfH],
		[x1, yc],
		[x1 - tip, yc + halfH],
		[x0, yc + halfH],
		[x0 + notch, yc],
	];
};

dinext_project_stage_gate.roadmap.buildStageBarGraphic = function ({
	startX,
	endX,
	centerY,
	height,
	label,
	fill,
	stroke,
	lineWidth,
	textColor,
	textOpacity,
	animationDelay = 0,
	animationDuration = dinext_project_stage_gate.roadmap.ROADMAP_INTRO_ANIMATION_DURATION_MS,
	animationEasing = dinext_project_stage_gate.roadmap.ROADMAP_INTRO_ANIMATION_EASING,
}) {
	const points = dinext_project_stage_gate.roadmap.buildStageBarChevronPoints(
		startX,
		endX,
		centerY,
		height
	);
	const collapsedPoints = dinext_project_stage_gate.roadmap.buildStageBarChevronPoints(
		startX,
		startX,
		centerY,
		height
	);
	const span = Math.max(Math.abs(endX - startX), 4);
	const children = [
		{
			type: "polygon",
			shape: { points },
			enterFrom: {
				shape: { points: collapsedPoints },
				style: { opacity: 0 },
			},
			enterAnimation: {
				delay: animationDelay,
				duration: animationDuration,
				easing: animationEasing,
			},
			transition: "all",
			style: {
				fill,
				stroke,
				lineWidth,
			},
		},
	];

	let fontSize = 12;
	if (span < 120) {
		fontSize = 10;
	} else if (span < 200) {
		fontSize = 11;
	}

	if (label && span >= 56) {
		children.push({
			type: "text",
			style: {
				x: Math.min(startX, endX) + span / 2,
				y: centerY,
				text: label,
				fill: textColor || "#ffffff",
				opacity: textOpacity ?? 1,
				fontSize,
				fontWeight: 600,
				align: "center",
				verticalAlign: "middle",
				width: Math.max(span - 28, 24),
				overflow: "truncate",
			},
			enterFrom: {
				style: {
					opacity: 0,
				},
			},
			enterAnimation: {
				delay: animationDelay,
				duration: animationDuration,
				easing: animationEasing,
			},
			transition: "all",
			silent: true,
		});
	}

	return {
		type: "group",
		children,
	};
};

dinext_project_stage_gate.roadmap.buildRoundedTaskLineGraphic = function ({
	startX,
	endX,
	centerY,
	lineWidth,
	label,
	lineColor,
	labelColor,
	shadowColor,
	progress,
	hasProgress,
	progressLineColor,
	labelLayout = {},
	animationDelay = 0,
	animationDuration = dinext_project_stage_gate.roadmap.ROADMAP_INTRO_ANIMATION_DURATION_MS,
	animationEasing = dinext_project_stage_gate.roadmap.ROADMAP_INTRO_ANIMATION_EASING,
}) {
	const x0 = Math.min(startX, endX);
	const x1 = Math.max(startX, endX);
	const span = Math.max(Math.abs(x1 - x0), 4);
	const layout = {
		...dinext_project_stage_gate.roadmap.getTaskLineLabelLayout({ span, lineWidth }),
		...(labelLayout || {}),
	};
	const textY = centerY - layout.offsetY;
	const effectiveColor = lineColor || labelColor || "#2563eb";
	const shouldRenderProgress =
		hasProgress == null ? progress != null && progress !== "" : Boolean(hasProgress);
	const normalizedProgress = dinext_project_stage_gate.roadmap.normalizeTaskProgress(progress);
	const overlayEndX = x0 + span * (normalizedProgress / 100);
	const trackColor =
		shouldRenderProgress && normalizedProgress < 100
			? dinext_project_stage_gate.roadmap.getTaskProgressTrackColor(effectiveColor)
			: effectiveColor;
	const baseShadowColor =
		shouldRenderProgress && normalizedProgress < 100
			? trackColor
			: shadowColor || dinext_project_stage_gate.roadmap.hexToRgba(effectiveColor, 0.18);
	const children = [];

	if (shouldRenderProgress) {
		const trackHeight = Math.max(4, lineWidth);
		children.push({
			type: "rect",
			z2: 1,
			shape: {
				x: x0,
				y: centerY - trackHeight / 2,
				width: span,
				height: trackHeight,
				r: trackHeight / 2,
			},
			style: {
				fill: trackColor,
				stroke: trackColor,
				lineWidth: 0,
				shadowBlur: 6,
				shadowColor: baseShadowColor,
			},
			enterFrom: {
				shape: {
					x: x0,
					y: centerY - trackHeight / 2,
					width: 0,
					height: trackHeight,
					r: trackHeight / 2,
				},
				style: { opacity: 0 },
			},
			enterAnimation: {
				delay: animationDelay,
				duration: animationDuration,
				easing: animationEasing,
			},
			transition: "all",
		});
	} else {
		children.push({
			type: "line",
			shape: { x1: x0, y1: centerY, x2: x1, y2: centerY },
			style: {
				stroke: trackColor,
				lineWidth,
				lineCap: "round",
				shadowBlur: 6,
				shadowColor: baseShadowColor,
			},
			enterFrom: {
				shape: { x1: x0, y1: centerY, x2: x0, y2: centerY },
				style: { opacity: 0 },
			},
			enterAnimation: {
				delay: animationDelay,
				duration: animationDuration,
				easing: animationEasing,
			},
			transition: "all",
		});
	}

	if (shouldRenderProgress && normalizedProgress > 0) {
		const progressWidth = Math.max(0, overlayEndX - x0);
		const progressHeight = Math.max(3, lineWidth * 0.72);
		children.push({
			type: "rect",
			z2: 2,
			shape: {
				x: x0,
				y: centerY - progressHeight / 2,
				width: progressWidth,
				height: progressHeight,
				r: progressHeight / 2,
			},
			style: {
				fill: progressLineColor || effectiveColor,
				stroke: progressLineColor || effectiveColor,
				lineWidth: 1,
				shadowBlur: 8,
				shadowColor: dinext_project_stage_gate.roadmap.hexToRgba(
					progressLineColor || effectiveColor,
					0.35
				),
			},
			enterFrom: {
				shape: {
					x: x0,
					y: centerY - progressHeight / 2,
					width: 0,
					height: progressHeight,
					r: progressHeight / 2,
				},
				style: { opacity: 0 },
			},
			enterAnimation: {
				delay: animationDelay,
				duration: animationDuration,
				easing: animationEasing,
			},
			transition: "all",
			silent: true,
		});
		if (normalizedProgress < 100) {
			const markerRadius = Math.max(2, lineWidth * 0.4);
			children.push({
				type: "circle",
				z2: 3,
				shape: { cx: overlayEndX, cy: centerY, r: markerRadius },
				style: {
					fill: progressLineColor || effectiveColor,
					stroke: dinext_project_stage_gate.roadmap.getThemeVariableColor("--card-bg", "#ffffff"),
					lineWidth: Math.max(1.5, markerRadius * 0.7),
					shadowBlur: 10,
					shadowColor: dinext_project_stage_gate.roadmap.hexToRgba(
						progressLineColor || effectiveColor,
						0.4
					),
				},
				enterFrom: {
					shape: { cx: x0, cy: centerY, r: markerRadius * 0.6 },
					style: { opacity: 0 },
				},
				enterAnimation: {
					delay: animationDelay,
					duration: animationDuration,
					easing: animationEasing,
				},
				transition: "all",
				silent: true,
			});
		}
	}

	if (label && span >= layout.minSpanForLabel) {
		children.push({
			type: "text",
			style: {
				x: x0 + span / 2,
				y: textY,
				text: label,
				fill: effectiveColor,
				fontSize: layout.fontSize,
				fontWeight: 600,
				align: "center",
				verticalAlign: "bottom",
				width: Math.max(span, 48),
				overflow: "truncate",
			},
			enterFrom: {
				style: {
					opacity: 0,
				},
			},
			enterAnimation: {
				delay: animationDelay,
				duration: animationDuration,
				easing: animationEasing,
			},
			transition: "all",
			silent: true,
		});
	}

	return { type: "group", children };
};

dinext_project_stage_gate.roadmap.render = async function (report) {
	if (!report?.page?.main) {
		return;
	}
	if (!dinext_project_stage_gate.roadmap.isRoadmapReport(report)) {
		dinext_project_stage_gate.roadmap.teardownRoadmapSession(report);
		return;
	}

	dinext_project_stage_gate.roadmap.ensureActionsMenuObserver(report);
	dinext_project_stage_gate.roadmap.hideActionsMenu(report);
	dinext_project_stage_gate.roadmap.translateReportFilterControls(report);

	await dinext_project_stage_gate.roadmap.ensure_assets();
	const mount = dinext_project_stage_gate.roadmap.ensure_chart_mount(report);
	if (!mount?.length) {
		return;
	}

	dinext_project_stage_gate.roadmap.ensureResizeHandler(report);
	dinext_project_stage_gate.roadmap._last_report = report;
	const payload = report.raw_data?.message || {
		projects: [],
		stageBars: [],
		gates: [],
		taskEntities: [],
		appliedFilters: {},
	};
	const requestedVisibilityFilters = dinext_project_stage_gate.roadmap.normalizeVisibilityFilters(
		dinext_project_stage_gate.roadmap.getVisibilityFiltersFromReport(report)
	);
	const appliedVisibilityFilters =
		dinext_project_stage_gate.roadmap.getAppliedVisibilityFilters(
			payload,
			requestedVisibilityFilters
		);
	const effectiveVisibilityFilters =
		dinext_project_stage_gate.roadmap.getEffectiveVisibilityFilters(
			requestedVisibilityFilters,
			appliedVisibilityFilters
		);
	if (dinext_project_stage_gate.roadmap.isStageVisibilityMandatory(requestedVisibilityFilters)) {
		await dinext_project_stage_gate.roadmap.syncVisibilityFilters(
			report,
			effectiveVisibilityFilters
		);
	}
	dinext_project_stage_gate.roadmap.applyStageVisibilityAvailability(
		report,
		effectiveVisibilityFilters
	);
	const seriesPayload = {
		...payload,
		stageBars: effectiveVisibilityFilters.show_stages_and_checkpoints ? payload.stageBars || [] : [],
		gates: effectiveVisibilityFilters.show_stages_and_checkpoints ? payload.gates || [] : [],
	};
	await dinext_project_stage_gate.roadmap.applyProjectFocusDatasetDateRange(report, payload);
	const fromDate = report.get_filter_value?.("from_date");
	const toDate = report.get_filter_value?.("to_date");
	const taskTypeOrder = dinext_project_stage_gate.roadmap._coerceToArray(
		report.get_filter_value?.("task_types")
	);
	const dom = mount.get(0);
	const sortState = dinext_project_stage_gate.roadmap.getSortStateFromChartDom(dom);
	const { categories, bars, gates, taskBars, milestones, rowSpanUnits, projectDocsByLabel } =
		dinext_project_stage_gate.roadmap.prepareSeriesData(seriesPayload, {
			fromDate,
			toDate,
			taskTypeOrder,
			sortState,
		});
	const showAllDataZoom = dinext_project_stage_gate.roadmap.buildShowAllDataZoomConfig({
		categories,
		bars,
		gates,
		taskBars,
		milestones,
		fromDate,
		toDate,
	});
	dom._dinextRoadmapCategoryCount = categories.length;
	dom._dinextRoadmapRowSpanUnits = rowSpanUnits;
	dinext_project_stage_gate.roadmap.applyChartHeight(dom, categories, rowSpanUnits);
	const existing =
		(typeof echarts.getInstanceByDom === "function" && echarts.getInstanceByDom(dom)) ||
		dom._dinextRoadmapChart ||
		null;
	const shouldIgnoreExistingViewport = dom._dinextRoadmapIgnoreChartViewportOnce;
	dom._dinextRoadmapIgnoreChartViewportOnce = false;
	const savedViewportState =
		(shouldIgnoreExistingViewport
			? null
			: dinext_project_stage_gate.roadmap.captureViewportStateFromChart(existing)) ||
		dom._dinextRoadmapViewportState ||
		null;
	dinext_project_stage_gate.roadmap.persistViewportState(dom, savedViewportState);
	dinext_project_stage_gate.roadmap.closeSortMenu(dom);
	if (existing) {
		existing.dispose();
	}
	if (!categories.length) {
		dom._dinextRoadmapChart = null;
		dom._dinextRoadmapViewportState = null;
		dinext_project_stage_gate.roadmap.applyChartHeight(dom, 0, 1);
		dinext_project_stage_gate.roadmap.showEmptyState(
			dom,
			__("No projects match the selected filters.")
		);
		return;
	}
	dinext_project_stage_gate.roadmap.clearEmptyState(dom);
	dinext_project_stage_gate.roadmap.applyProjectFocusInitialViewport(report, dom, {
		categories,
		bars,
		gates,
		taskBars,
		milestones,
		fromDate,
		toDate,
	});
	const chart = echarts.init(dom, dinext_project_stage_gate.roadmap.getEChartsThemeName());
	dom._dinextRoadmapChart = chart;
	const dataZoom = dinext_project_stage_gate.roadmap.buildDataZoomConfig({
		categories,
		bars,
		gates,
		taskBars,
		milestones,
		fromDate,
		toDate,
		today: frappe?.datetime?.get_today?.(),
		viewportState: dom._dinextRoadmapViewportState,
	});
	const monthOnlyXAxisLabels =
		dinext_project_stage_gate.roadmap.getMonthOnlyXAxisLabelsForDataZoom(dataZoom);
	const today = frappe?.datetime?.get_today?.();
	const getCurrentViewportState = function () {
		return (
			dinext_project_stage_gate.roadmap.captureViewportStateFromChart(chart) ||
			dom._dinextRoadmapViewportState ||
			null
		);
	};

	chart.setOption(
		dinext_project_stage_gate.roadmap.buildChartOptions({
			categories,
			bars,
			gates,
			taskBars,
			milestones,
			dataZoom,
			monthOnlyXAxisLabels,
			rowSpanUnits,
			today,
			onShowFullWidth() {
				const fitWidthDataZoom = dinext_project_stage_gate.roadmap.buildAxisFitDataZoomConfig({
					axis: "horizontal",
					viewportState: getCurrentViewportState(),
					categories,
					bars,
					gates,
					taskBars,
					milestones,
					fromDate,
					toDate,
				});
				dinext_project_stage_gate.roadmap.applyViewportDataZoom(
					chart,
					dom,
					fitWidthDataZoom
				);
			},
			onShowFullHeight() {
				const fitHeightDataZoom = dinext_project_stage_gate.roadmap.buildAxisFitDataZoomConfig({
					axis: "vertical",
					viewportState: getCurrentViewportState(),
					categories,
					bars,
					gates,
					taskBars,
					milestones,
					fromDate,
					toDate,
				});
				dinext_project_stage_gate.roadmap.applyViewportDataZoom(
					chart,
					dom,
					fitHeightDataZoom
				);
			},
			onShowAllData() {
				dinext_project_stage_gate.roadmap.applyViewportDataZoom(chart, dom, showAllDataZoom);
			},
			onSortProjects() {
				dinext_project_stage_gate.roadmap.toggleSortMenu(report, dom);
			},
		})
	);
	chart._dinextMonthOnlyXAxisLabels = monthOnlyXAxisLabels;
	dinext_project_stage_gate.roadmap.persistViewportState(
		dom,
		dinext_project_stage_gate.roadmap.getViewportStateFromDataZoom(dataZoom)
	);
	chart.on("datazoom", () => {
		dinext_project_stage_gate.roadmap.persistViewportState(
			dom,
			dinext_project_stage_gate.roadmap.captureViewportStateFromChart(chart)
		);
		dinext_project_stage_gate.roadmap.updateXAxisLabelDensity(chart);
	});

	dinext_project_stage_gate.roadmap.attachChartClickNavigation(chart, projectDocsByLabel);
	dinext_project_stage_gate.roadmap.hideActionsMenu(report);
};

