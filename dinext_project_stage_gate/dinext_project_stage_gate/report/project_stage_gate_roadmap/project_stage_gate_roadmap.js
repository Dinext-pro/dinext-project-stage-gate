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
			// Keep report colors aligned with the Project widget status classes.
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

dinext_project_stage_gate.roadmap.isDimmedStageStatus = function (status) {
	return status === "Skipped" || status === "Canceled";
};

dinext_project_stage_gate.roadmap.getStageItemStyle = function (stage) {
	const fallback = dinext_project_stage_gate.roadmap.getStageColors(stage.status);
	const isDimmed = dinext_project_stage_gate.roadmap.isDimmedStageStatus(stage.status);
	return {
		fill: fallback.fill,
		stroke: fallback.stroke,
		lineWidth: 1,
		textColor: isDimmed
			? dinext_project_stage_gate.roadmap.getThemeVariableColor("--text-muted", "#7c7c7c")
			: dinext_project_stage_gate.roadmap.getContrastTextColor(fallback.fill),
		textOpacity: isDimmed ? 0.6 : 1,
	};
};

dinext_project_stage_gate.roadmap.getCheckpointColor = function (status) {
	const palette = dinext_project_stage_gate.roadmap.getActivePalette();
	return palette.checkpoint[status] || palette.fallbackCheckpoint;
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
 * @param {{ fromDate?: string, toDate?: string }} [options]
 * @returns {{ categories: string[], bars: object[], gates: object[] }}
 */
dinext_project_stage_gate.roadmap.prepareSeriesData = function (payload, options) {
	const safe = payload || { projects: [], stageBars: [], gates: [] };
	const projectIndex = {};
	const categories = (safe.projects || []).map((project) => {
		const label = project.project_name || project.name;
		projectIndex[project.name] = label;
		return label;
	});
	const categoryIndexByLabel = Object.fromEntries(categories.map((label, index) => [label, index]));

	const bars = (safe.stageBars || []).map((stage) => {
		const colors = dinext_project_stage_gate.roadmap.getStageItemStyle(stage);
		const stageLabel = stage.stage_name || stage.stage;
		const range = dinext_project_stage_gate.roadmap.getStageDisplayRange(stage);
		return {
			name: stageLabel,
			docType: "Project Stage Instance",
			docName: stage.name,
			value: [
				categoryIndexByLabel[projectIndex[stage.project]] ?? 0,
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
			name: gate.checkpoint_level || __("Gate"),
			docType: "Project Gate Checkpoint",
			docName: gate.name,
			value: [
				dinext_project_stage_gate.roadmap.getDisplayDate(gate.approval_date, gate.gate_due_date),
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
}) {
	const points = dinext_project_stage_gate.roadmap.buildStageBarChevronPoints(
		startX,
		endX,
		centerY,
		height
	);
	const span = Math.max(Math.abs(endX - startX), 4);
	const children = [
		{
			type: "polygon",
			shape: { points },
			style: {
				fill,
				stroke,
				lineWidth,
			},
		},
	];

	if (label && span >= 72) {
		children.push({
			type: "text",
			style: {
				x: Math.min(startX, endX) + span / 2,
				y: centerY,
				text: label,
				fill: textColor || "#ffffff",
						opacity: textOpacity ?? 1,
				fontSize: 11,
				fontWeight: 600,
				align: "center",
				verticalAlign: "middle",
				width: Math.max(span - 28, 24),
				overflow: "truncate",
			},
			silent: true,
		});
	}

	return {
		type: "group",
		children,
	};
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
	const { categories, bars, gates } = dinext_project_stage_gate.roadmap.prepareSeriesData(payload, {
		fromDate: report.get_filter_value?.("from_date"),
		toDate: report.get_filter_value?.("to_date"),
	});

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
					});
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

