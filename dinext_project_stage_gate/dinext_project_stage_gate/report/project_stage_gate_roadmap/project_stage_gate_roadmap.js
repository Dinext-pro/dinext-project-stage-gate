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
	},

	after_datatable_render(report) {
		dinext_project_stage_gate.roadmap.render(report);
	},
};

frappe.provide("dinext_project_stage_gate.roadmap");

dinext_project_stage_gate.roadmap.translateStatus = function (value) {
	return value ? __(value) : value;
};

dinext_project_stage_gate.roadmap.ensure_assets = function () {
	if (window.echarts) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		frappe.require(
			["/assets/dinext_project_stage_gate/js/vendor/echarts.min.js"],
			function () {
				resolve();
			}
		);
	});
};

dinext_project_stage_gate.roadmap.ensure_chart_mount = function (report) {
	const wrapper = report.page.main.find(".project-stage-gate-roadmap-chart");
	if (wrapper.length) {
		return wrapper;
	}

	const chart = $('<div class="project-stage-gate-roadmap-chart" style="height: 420px; margin: 16px 0;"></div>');
	report.page.main.prepend(chart);
	return chart;
};

dinext_project_stage_gate.roadmap.render = async function (report) {
	await dinext_project_stage_gate.roadmap.ensure_assets();
	const mount = dinext_project_stage_gate.roadmap.ensure_chart_mount(report);
	const chart = echarts.init(mount.get(0));
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

	const bars = payload.stageBars.map((stage) => ({
		name: stage.stage,
		value: [
			categoryIndexByLabel[projectIndex[stage.project]] ?? 0,
			stage.actual_start_date || stage.planned_start_date,
			stage.actual_end_date || stage.planned_end_date,
			stage.stage,
			dinext_project_stage_gate.roadmap.translateStatus(stage.status),
		],
	}));
	const gates = payload.gates
		.filter((gate) => gate.approval_date)
		.map((gate) => ({
			name: gate.checkpoint_level || __("Gate"),
			value: [
				gate.approval_date,
				categoryIndexByLabel[projectIndex[gate.project]] ?? 0,
				dinext_project_stage_gate.roadmap.translateStatus(gate.status),
			],
		}));

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
						style: api.style({
							fill: "#7c8cff",
							stroke: "#5e64ff",
						}),
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
				itemStyle: {
					color: "#ff914d",
				},
				data: gates,
			},
		],
	});
};

