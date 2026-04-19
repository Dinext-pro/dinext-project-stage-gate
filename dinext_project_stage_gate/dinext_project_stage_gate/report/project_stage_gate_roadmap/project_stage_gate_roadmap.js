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
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -6),
		},
		{
			fieldname: "to_date",
			label: __("To"),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), 12),
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

/** Parse report date value to UTC ms (date-only strings treated as UTC midnight). */
dinext_project_stage_gate.roadmap._parseTimeMs = function (value) {
	if (value == null || value === "") {
		return NaN;
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

/**
 * Build categories, stage bars, and gate markers from report payload (for chart and tests).
 * @param {{ projects?: unknown[], stageBars?: unknown[], gates?: unknown[] }} payload
 * @returns {{ categories: string[], bars: object[], gates: object[] }}
 */
dinext_project_stage_gate.roadmap.prepareSeriesData = function (payload) {
	const safe = payload || { projects: [], stageBars: [], gates: [] };
	const projectIndex = {};
	const categories = (safe.projects || []).map((project) => {
		const label = project.project_name || project.name;
		projectIndex[project.name] = label;
		return label;
	});
	const categoryIndexByLabel = Object.fromEntries(categories.map((label, index) => [label, index]));

	const bars = (safe.stageBars || []).map((stage) => {
		const colors = dinext_project_stage_gate.roadmap.getStageColors(stage.status);
		return {
			name: stage.stage,
			docType: "Project Stage Instance",
			docName: stage.name,
			value: [
				categoryIndexByLabel[projectIndex[stage.project]] ?? 0,
				stage.actual_start_date || stage.planned_start_date,
				stage.actual_end_date || stage.planned_end_date,
				stage.stage,
				dinext_project_stage_gate.roadmap.translateStatus(stage.status),
				Number(stage.sequence) || 0,
			],
			itemStyle: {
				color: colors.fill,
				borderColor: colors.stroke,
				borderWidth: 1,
			},
		};
	});
	dinext_project_stage_gate.roadmap.normalizeIdenticalStageRanges(bars);

	const gates = (safe.gates || [])
		.filter((gate) => gate.approval_date && gate.name)
		.map((gate) => ({
			name: gate.checkpoint_level || __("Gate"),
			docType: "Project Gate Checkpoint",
			docName: gate.name,
			value: [
				gate.approval_date,
				categoryIndexByLabel[projectIndex[gate.project]] ?? 0,
				dinext_project_stage_gate.roadmap.translateStatus(gate.status),
			],
			itemStyle: {
				color: dinext_project_stage_gate.roadmap.getCheckpointColor(gate.status),
			},
		}));

	return { categories, bars, gates };
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

dinext_project_stage_gate.roadmap._chartClickHandler = function (params) {
	dinext_project_stage_gate.roadmap.navigateFromChartItem(params.data);
};

dinext_project_stage_gate.roadmap.attachChartClickNavigation = function (chart) {
	if (!chart || typeof chart.on !== "function") {
		return;
	}
	if (typeof chart.off === "function" && dinext_project_stage_gate.roadmap._chartClickHandler) {
		chart.off("click", dinext_project_stage_gate.roadmap._chartClickHandler);
	}
	chart.on("click", dinext_project_stage_gate.roadmap._chartClickHandler);
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
	const { categories, bars, gates } = dinext_project_stage_gate.roadmap.prepareSeriesData(payload);

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
					const width = Math.max(end[0] - start[0], 4);
					const x0 = start[0];
					const x1 = end[0];
					const yc = start[1];
					const MAX_INSET = 14;
					const inset = Math.min(MAX_INSET, Math.max(0, (width - 1) / 2));
					const tip = inset;
					const notch = inset;
					const points = [
						[x0, yc - height / 2],
						[x1 - tip, yc - height / 2],
						[x1, yc],
						[x1 - tip, yc + height / 2],
						[x0, yc + height / 2],
						[x0 + notch, yc],
					];
					const fromApi = api.style();
					const itemStyle = params.data?.itemStyle || {};
					const fill = fromApi.fill || fromApi.color || itemStyle.color || itemStyle.fill;
					const stroke =
						fromApi.stroke || fromApi.borderColor || itemStyle.borderColor || itemStyle.stroke;
					const lineWidth =
						fromApi.lineWidth ?? fromApi.borderWidth ?? itemStyle.borderWidth ?? 1;
					return {
						type: "polygon",
						shape: { points },
						style: {
							...fromApi,
							fill,
							stroke,
							lineWidth,
						},
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
				symbol: "diamond",
				symbolSize: 20,
				encode: {
					x: 0,
					y: 1,
				},
				data: gates,
			},
		],
	});

	dinext_project_stage_gate.roadmap.attachChartClickNavigation(chart);
};

