frappe.query_reports["Project Stage Gate Roadmap"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
		},
		{
			fieldname: "portfolio",
			label: __("Portfolio"),
			fieldtype: "Link",
			options: "Project Portfolio",
		},
		{
			fieldname: "customer",
			label: __("Customer"),
			fieldtype: "Link",
			options: "Customer",
		},
		{
			fieldname: "project",
			label: __("Project"),
			fieldtype: "Link",
			options: "Project",
		},
		{
			fieldname: "project_manager",
			label: __("Project Manager"),
			fieldtype: "Link",
			options: "User",
		},
		{
			fieldname: "governance_model",
			label: __("Governance Model"),
			fieldtype: "Link",
			options: "Project Governance Model",
		},
		{
			fieldname: "from_date",
			label: __("From"),
			fieldtype: "Date",
		},
		{
			fieldname: "to_date",
			label: __("To"),
			fieldtype: "Date",
		},
		{
			fieldname: "active_only",
			label: __("Active Only"),
			fieldtype: "Check",
			default: 1,
		},
	],

	onload(report) {
		dinext_project_stage_gate.roadmap.ensure_chart_mount(report);
		dinext_project_stage_gate.roadmap.ensure_theme_observer(report);
	},

	after_datatable_render(_datatable) {
		dinext_project_stage_gate.roadmap.render(frappe.query_report);
	},
};

frappe.provide("dinext_project_stage_gate.roadmap");

dinext_project_stage_gate.roadmap.statusPalette = {
	light: {
		stage: {
			Planned: { fill: "#8f9aa8", stroke: "#738094" },
			Active: { fill: "#7f95c1", stroke: "#687da8" },
			Skipped: { fill: "#8190a3", stroke: "#667487" },
			Completed: { fill: "#739b7f", stroke: "#5f846b" },
			Canceled: { fill: "#9787b0", stroke: "#7c6d95" },
		},
		checkpoint: {
			Draft: "#8f9aa8",
			"In Review": "#8ba0c9",
			Approved: "#739b7f",
			Rejected: "#c08b8b",
			Canceled: "#9787b0",
		},
		fallbackStage: { fill: "#8f9aa8", stroke: "#738094" },
		fallbackCheckpoint: "#8f9aa8",
	},
	dark: {
		stage: {
			Planned: { fill: "#6a7d92", stroke: "#54667a" },
			Active: { fill: "#4f6fa8", stroke: "#3d5a8a" },
			Skipped: { fill: "#5c708a", stroke: "#485f7a" },
			Completed: { fill: "#4e7d5c", stroke: "#3d6a4c" },
			Canceled: { fill: "#6b5b8f", stroke: "#554570" },
		},
		checkpoint: {
			Draft: "#6a7d92",
			"In Review": "#5f7fbf",
			Approved: "#4e7d5c",
			Rejected: "#a85c5c",
			Canceled: "#6b5b8f",
		},
		fallbackStage: { fill: "#6a7d92", stroke: "#54667a" },
		fallbackCheckpoint: "#6a7d92",
	},
};

dinext_project_stage_gate.roadmap.getActivePalette = function () {
	const root = document.documentElement;
	const isDark = root && root.getAttribute("data-theme") === "dark";
	return isDark ? dinext_project_stage_gate.roadmap.statusPalette.dark : dinext_project_stage_gate.roadmap.statusPalette.light;
};

dinext_project_stage_gate.roadmap.translateStatus = function (value) {
	return value ? __(value) : value;
};

dinext_project_stage_gate.roadmap.getStageColors = function (status) {
	const palette = dinext_project_stage_gate.roadmap.getActivePalette();
	return palette.stage[status] || palette.fallbackStage;
};

dinext_project_stage_gate.roadmap.getCheckpointColor = function (status) {
	const palette = dinext_project_stage_gate.roadmap.getActivePalette();
	return palette.checkpoint[status] || palette.fallbackCheckpoint;
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

	const wrapper = report.page.main.find(".project-stage-gate-roadmap-chart");
	if (wrapper.length) {
		return wrapper;
	}

	const chart = $('<div class="project-stage-gate-roadmap-chart" style="height: 420px; margin: 16px 0;"></div>');
	report.page.main.prepend(chart);
	return chart;
};

dinext_project_stage_gate.roadmap.render = async function (report) {
	if (!report?.page?.main) {
		return;
	}

	await dinext_project_stage_gate.roadmap.ensure_assets();
	const mount = dinext_project_stage_gate.roadmap.ensure_chart_mount(report);
	if (!mount?.length) {
		return;
	}

	dinext_project_stage_gate.roadmap._last_report = report;

	const dom = mount.get(0);
	const existing =
		(typeof echarts.getInstanceByDom === "function" && echarts.getInstanceByDom(dom)) ||
		dom._dinextRoadmapChart ||
		null;
	if (existing) {
		existing.dispose();
	}
	const chart = echarts.init(dom);
	dom._dinextRoadmapChart = chart;
	const payload = report.raw_data?.message || { projects: [], stageBars: [], gates: [] };
	const projectIndex = {};
	const categories = payload.projects.map(
		(project) => {
			const label = `${project.custom_project_portfolio || __("No Portfolio")} / ${
				project.project_name || project.name
			}`;
			projectIndex[project.name] = label;
			return label;
		}
	);
	const categoryIndexByLabel = Object.fromEntries(categories.map((label, index) => [label, index]));

	const bars = payload.stageBars.map(
		(stage) => {
			const colors = dinext_project_stage_gate.roadmap.getStageColors(stage.status);
			return {
				name: stage.stage,
				value: [
					categoryIndexByLabel[projectIndex[stage.project]] ?? 0,
					stage.actual_start_date || stage.planned_start_date,
					stage.actual_end_date || stage.planned_end_date,
					stage.stage,
					dinext_project_stage_gate.roadmap.translateStatus(stage.status),
				],
				itemStyle: {
					fill: colors.fill,
					stroke: colors.stroke,
				},
			};
		}
	);
	const gates = payload.gates
		.filter((gate) => gate.approval_date)
		.map(
			(gate) => ({
				name: gate.checkpoint_level || __("Gate"),
				value: [
					gate.approval_date,
					categoryIndexByLabel[projectIndex[gate.project]] ?? 0,
					dinext_project_stage_gate.roadmap.translateStatus(gate.status),
				],
				itemStyle: {
					color: dinext_project_stage_gate.roadmap.getCheckpointColor(gate.status),
				},
			})
		);

	chart.setOption({
		tooltip: {
			trigger: "item",
			formatter(params) {
				const value = params.value || [];
				return [params.name, value[3] || value[2] || "", value[4] || ""].filter(Boolean).join("<br>");
			},
		},
		xAxis: {
			type: "time",
		},
		yAxis: {
			type: "category",
			data: categories,
		},
		series: [
			{
				type: "custom",
				renderItem(params, api) {
					const categoryIndex = api.value(0);
					const start = api.coord([api.value(1), categoryIndex]);
					const end = api.coord([api.value(2), categoryIndex]);
					const height = api.size([0, 1])[1] * 0.5;
					return {
						type: "rect",
						shape: {
							x: start[0],
							y: start[1] - height / 2,
							width: Math.max(end[0] - start[0], 4),
							height,
						},
						style: api.style(),
					};
				},
				encode: {
					x: [1, 2],
					y: 0,
				},
				data: bars,
			},
			{
				type: "scatter",
				symbolSize: 12,
				data: gates,
			},
		],
	});
};

