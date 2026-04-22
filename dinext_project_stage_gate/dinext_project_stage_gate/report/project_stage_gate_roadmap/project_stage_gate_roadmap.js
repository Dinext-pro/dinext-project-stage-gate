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
			fieldname: "project_manager_role",
			label: __("Project Manager Role"),
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
			fieldtype: "Link",
			options: "Project Governance Model",
		},
		{
			fieldname: "from_date",
			label: __("From"),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -12),
		},
		{
			fieldname: "to_date",
			label: __("To"),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), 36),
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
		dinext_project_stage_gate.roadmap.ensureResizeHandler(report);
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

dinext_project_stage_gate.roadmap.getEChartsThemeName = function () {
	const root = document.documentElement;
	return root && root.getAttribute("data-theme") === "dark" ? "dark" : undefined;
};

dinext_project_stage_gate.roadmap.translateStatus = function (value) {
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

dinext_project_stage_gate.roadmap.getCheckpointItemStyle = function (status) {
	const fill = dinext_project_stage_gate.roadmap.getCheckpointColor(status);
	const isDark = dinext_project_stage_gate.roadmap.getEChartsThemeName() === "dark";
	return {
		color: fill,
		borderColor: dinext_project_stage_gate.roadmap.getThemeVariableColor(
			"--card-bg",
			isDark ? "#0f172a" : "#ffffff"
		),
		borderWidth: 2,
		shadowBlur: 8,
		shadowColor: dinext_project_stage_gate.roadmap.hexToRgba(fill, isDark ? 0.45 : 0.28),
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

	return [params?.name || "", value[3] || value[2] || "", value[4] || ""]
		.filter(Boolean)
		.filter((entry, index, parts) => parts.indexOf(entry) === index)
		.join("<br>");
};

dinext_project_stage_gate.roadmap.calculateChartHeight = function (categories) {
	const rowCount = Array.isArray(categories) ? categories.length : Number(categories) || 0;
	const dynamicHeight = rowCount <= 10 ? 420 : 420 + (rowCount - 10) * 25;
	const viewportHeight = Number(window?.innerHeight) || 0;
	const minHeight = viewportHeight > 0 ? Math.round(viewportHeight * 0.65) : 420;
	return Math.max(dynamicHeight, minHeight);
};

dinext_project_stage_gate.roadmap.applyChartHeight = function (dom, categories) {
	if (!dom?.style) {
		return 0;
	}

	const height = dinext_project_stage_gate.roadmap.calculateChartHeight(categories);
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
	fromDate,
	toDate,
} = {}) {
	const horizontal = dinext_project_stage_gate.roadmap.getFullHorizontalViewport({
		bars,
		gates,
		fromDate,
		toDate,
	});
	const vertical = dinext_project_stage_gate.roadmap.getFullVerticalViewport(categories);

	return [
		{
			startValue: horizontal.startValue,
			endValue: horizontal.endValue,
		},
		{
			startValue: horizontal.startValue,
			endValue: horizontal.endValue,
		},
		{
			startValue: vertical.startValue,
			endValue: vertical.endValue,
		},
		{
			startValue: vertical.startValue,
			endValue: vertical.endValue,
		},
	];
};

dinext_project_stage_gate.roadmap.buildDataZoomConfig = function ({
	categories,
	fromDate,
	toDate,
	today,
} = {}) {
	const horizontal = dinext_project_stage_gate.roadmap.getDefaultHorizontalViewport({
		today,
		fromDate,
		toDate,
	});
	const vertical = dinext_project_stage_gate.roadmap.getDefaultVerticalViewport(categories);

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
			filterMode: "none",
			zoomOnMouseWheel: false,
			moveOnMouseWheel: false,
			startValue: vertical.startValue,
			endValue: vertical.endValue,
		},
		{
			type: "slider",
			yAxisIndex: 0,
			filterMode: "none",
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
} = {}) {
	const safeBars = Array.isArray(bars) ? bars : [];
	const safeGates = Array.isArray(gates) ? gates : [];
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

	return { barDelays, gateDelays };
};

dinext_project_stage_gate.roadmap.buildChartOptions = function ({
	categories,
	bars,
	gates,
	dataZoom,
	onShowAllData,
	monthOnlyXAxisLabels = false,
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
	});
	const introAnimationDuration =
		dinext_project_stage_gate.roadmap.ROADMAP_INTRO_ANIMATION_DURATION_MS;
	const introAnimationEasing = dinext_project_stage_gate.roadmap.ROADMAP_INTRO_ANIMATION_EASING;

	return {
		animation: true,
		animationDurationUpdate: 0,
		animationEasing: introAnimationEasing,
		animationEasingUpdate: "linear",
		grid: {
			containLabel: true,
			top: 44,
			right: 28,
			bottom: 44,
			left: 12,
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
			triggerEvent: true,
			data: categories || [],
			splitLine: {
				show: true,
				lineStyle: {
					color: gridLineColor,
					type: "solid",
				},
			},
			axisLabel: {
				show: true,
				interval: 0,
				width: 176,
				overflow: "break",
				fontSize: 11,
				lineHeight: 14,
				margin: 12,
				align: "right",
				formatter(value) {
					return dinext_project_stage_gate.roadmap.wrapAxisLabel(value);
				},
			},
		},
		dataZoom: dataZoom || [],
		series: [
			{
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
						animationDelay: introAnimationDelays.barDelays[params.dataIndex] ?? 0,
						animationDuration: introAnimationDuration,
						animationEasing: introAnimationEasing,
					});
				},
				encode: {
					x: [1, 2],
					y: 0,
				},
				data: bars || [],
			},
			{
				type: "scatter",
				symbol: "diamond",
				symbolSize: 22,
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
				itemStyle: {
					borderWidth: 2,
				},
				encode: {
					x: 0,
					y: 1,
				},
				data: gates || [],
			},
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

	const chart = $('<div class="project-stage-gate-roadmap-chart" style="margin: 0 0 16px 0;"></div>');
	dinext_project_stage_gate.roadmap.applyChartHeight(chart.get(0), 0);
	report.page.main.prepend(chart);
	return chart;
};

dinext_project_stage_gate.roadmap.resizeCurrentChart = function () {
	const lastReport = dinext_project_stage_gate.roadmap._last_report;
	if (!lastReport?.page?.main) {
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
		dom._dinextRoadmapCategoryCount || 0
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

/**
 * Build categories, stage bars, and gate markers from report payload (for chart and tests).
 * @param {{ projects?: unknown[], stageBars?: unknown[], gates?: unknown[] }} payload
 * @param {{ fromDate?: string, toDate?: string }} [options]
 * @returns {{ categories: string[], bars: object[], gates: object[], projectDocsByLabel: Record<string, { docType: string, docName: string }> }}
 */
dinext_project_stage_gate.roadmap.prepareSeriesData = function (payload, options) {
	const safe = payload || { projects: [], stageBars: [], gates: [] };
	const projectIndex = {};
	const projectDocsByLabel = {};
	const categories = (safe.projects || []).map((project) => {
		const label = project.project_name || project.name;
		projectIndex[project.name] = label;
		projectDocsByLabel[label] = {
			docType: "Project",
			docName: project.name,
		};
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
				...dinext_project_stage_gate.roadmap.getCheckpointItemStyle(gate.status),
			},
		}));

	return { categories, bars, gates, projectDocsByLabel };
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

dinext_project_stage_gate.roadmap.render = async function (report) {
	if (!report?.page?.main) {
		return;
	}

	await dinext_project_stage_gate.roadmap.ensure_assets();
	const mount = dinext_project_stage_gate.roadmap.ensure_chart_mount(report);
	if (!mount?.length) {
		return;
	}

	dinext_project_stage_gate.roadmap.ensureResizeHandler(report);
	dinext_project_stage_gate.roadmap._last_report = report;
	const payload = report.raw_data?.message || { projects: [], stageBars: [], gates: [] };
	const fromDate = report.get_filter_value?.("from_date");
	const toDate = report.get_filter_value?.("to_date");
	const { categories, bars, gates, projectDocsByLabel } =
		dinext_project_stage_gate.roadmap.prepareSeriesData(payload, {
			fromDate,
			toDate,
		});
	const showAllDataZoom = dinext_project_stage_gate.roadmap.buildShowAllDataZoomConfig({
		categories,
		bars,
		gates,
		fromDate,
		toDate,
	});
	const dom = mount.get(0);
	dom._dinextRoadmapCategoryCount = categories.length;
	dinext_project_stage_gate.roadmap.applyChartHeight(dom, categories);
	const existing =
		(typeof echarts.getInstanceByDom === "function" && echarts.getInstanceByDom(dom)) ||
		dom._dinextRoadmapChart ||
		null;
	if (existing) {
		existing.dispose();
	}
	const chart = echarts.init(dom, dinext_project_stage_gate.roadmap.getEChartsThemeName());
	dom._dinextRoadmapChart = chart;
	const dataZoom = dinext_project_stage_gate.roadmap.buildDataZoomConfig({
		categories,
		fromDate,
		toDate,
		today: frappe?.datetime?.get_today?.(),
	});
	const monthOnlyXAxisLabels =
		dinext_project_stage_gate.roadmap.getMonthOnlyXAxisLabelsForDataZoom(dataZoom);

	chart.setOption(
		dinext_project_stage_gate.roadmap.buildChartOptions({
			categories,
			bars,
			gates,
			dataZoom,
			monthOnlyXAxisLabels,
			onShowAllData() {
				chart.setOption({
					dataZoom: showAllDataZoom,
				});
				dinext_project_stage_gate.roadmap.updateXAxisLabelDensity(chart);
			},
		})
	);
	chart._dinextMonthOnlyXAxisLabels = monthOnlyXAxisLabels;
	chart.on("datazoom", () => {
		dinext_project_stage_gate.roadmap.updateXAxisLabelDensity(chart);
	});

	dinext_project_stage_gate.roadmap.attachChartClickNavigation(chart, projectDocsByLabel);
};

