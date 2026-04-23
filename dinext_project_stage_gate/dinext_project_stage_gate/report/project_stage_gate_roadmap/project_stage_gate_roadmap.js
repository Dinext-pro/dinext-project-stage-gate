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
		{
			fieldname: "show_milestones",
			label: __("Show Milestones"),
			fieldtype: "Check",
			default: 0,
		},
		{
			fieldname: "task_types",
			label: __("Task Types"),
			fieldtype: "MultiSelectList",
			options: "Task Type",
			get_data(txt) {
				return frappe.db.get_link_options("Task Type", txt);
			},
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
dinext_project_stage_gate.roadmap.ROADMAP_CHECKPOINT_PREFERRED_SIZE = 22;
dinext_project_stage_gate.roadmap.ROADMAP_CHECKPOINT_MIN_STAGE_HEIGHT_RATIO = 0.3;
dinext_project_stage_gate.roadmap.ROADMAP_CHECKPOINT_MAX_STAGE_HEIGHT_RATIO = 2 / 3;
dinext_project_stage_gate.roadmap.ROADMAP_ROW_USABLE_HEIGHT_RATIO = 0.8;
dinext_project_stage_gate.roadmap.ROADMAP_SLOT_FILL_RATIO = 0.625;

dinext_project_stage_gate.roadmap.taskTypePalette = {
	light: ["#2563eb", "#7c3aed", "#0f766e", "#dc6803", "#c2410c", "#db2777", "#4f46e5"],
	dark: ["#60a5fa", "#a78bfa", "#2dd4bf", "#f59e0b", "#fb923c", "#f472b6", "#818cf8"],
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

dinext_project_stage_gate.roadmap.getMilestoneItemStyle = function () {
	const lineColor = "#d13438";
	return {
		lineColor,
		labelColor: lineColor,
		borderColor: dinext_project_stage_gate.roadmap.getThemeVariableColor("--card-bg", "#ffffff"),
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
		return [
			params?.data?.name || params?.name || value[3] || "",
			value[4] || "",
			dinext_project_stage_gate.roadmap.formatDateRange(value[1], value[2]),
			value[5] || "",
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
	monthOnlyXAxisLabels = false,
	rowSpanUnits = 1,
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
	const categoryEntries = safeCategories.map((category) =>
		typeof category === "string"
			? { key: category, projectLabel: category, laneLabel: "", isProjectLabel: true }
			: {
					key: category?.key,
					projectLabel: category?.projectLabel || category?.key || "",
					laneLabel: category?.laneLabel || "",
					isProjectLabel: category?.isProjectLabel !== false,
				}
	);
	const categoryLabelByKey = Object.fromEntries(
		categoryEntries.map((category) => [
			category.key,
			category.isProjectLabel
				? dinext_project_stage_gate.roadmap.wrapAxisLabel(category.projectLabel)
				: category.laneLabel
					? `  ${category.laneLabel}`
					: "",
		])
	);
	const grid = {
		containLabel: true,
		top: 44,
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

	return {
		animation: true,
		animationDurationUpdate: 0,
		animationEasing: introAnimationEasing,
		animationEasingUpdate: "linear",
		grid,
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
			// Keep the first category at the top so visual row order matches the lane layout.
			inverse: true,
			triggerEvent: true,
			data: categoryEntries.map((category) => category.key),
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
					return categoryLabelByKey[value] ?? dinext_project_stage_gate.roadmap.wrapAxisLabel(value);
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
				data: bars || [],
			},
			{
				type: "scatter",
				symbol: "diamond",
				symbolSize: checkpointSymbolSize,
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
			{
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
			{
				type: "custom",
				clip: true,
				animationDuration: introAnimationDuration,
				animationDurationUpdate: 0,
				animationEasing: introAnimationEasing,
				animationEasingUpdate: "linear",
				animationDelay(dataIndex) {
					return introAnimationDelays.taskBarDelays[dataIndex] ?? 0;
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
					const slotHeight = api.size([0, 1])[1] * slotRatio;
					const lineWidth = Math.max(6, Math.min(12, slotHeight * 0.36));
					const labelLayout = dinext_project_stage_gate.roadmap.getTaskLineLabelLayout({
						span: Math.abs(end[0] - start[0]),
						lineWidth,
						slotHeight,
					});
					const fromApi = api.style();
					const itemStyle = params.data?.itemStyle || {};
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
						(lineColor
							? dinext_project_stage_gate.roadmap.hexToRgba(lineColor, 0.18)
							: undefined);
					return dinext_project_stage_gate.roadmap.buildRoundedTaskLineGraphic({
						startX: start[0],
						endX: end[0],
						centerY: start[1],
						lineWidth,
						label: params.data?.name || api.value(3),
						lineColor,
						labelColor,
						shadowColor,
						labelLayout,
						animationDelay: introAnimationDelays.taskBarDelays[params.dataIndex] ?? 0,
						animationDuration: introAnimationDuration,
						animationEasing: introAnimationEasing,
					});
				},
				encode: {
					x: [1, 2],
					y: 0,
				},
				data: taskBars || [],
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

/**
 * Build categories, stage bars, and gate markers from report payload (for chart and tests).
 * @param {{ projects?: unknown[], stageBars?: unknown[], gates?: unknown[] }} payload
 * @param {{ fromDate?: string, toDate?: string }} [options]
 * @returns {{ categories: string[], bars: object[], gates: object[], projectDocsByLabel: Record<string, { docType: string, docName: string }> }}
 */
dinext_project_stage_gate.roadmap.prepareSeriesData = function (payload, options) {
	const safe = payload || { projects: [], stageBars: [], gates: [], taskEntities: [] };
	const laneLayout = dinext_project_stage_gate.roadmap.buildProjectLaneRows(
		safe.projects || [],
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
		const stageLabel = stage.stage_name || stage.stage;
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
			name: gate.checkpoint_level || __("Gate"),
			docType: "Project Gate Checkpoint",
			docName: gate.name,
			value: [
				dinext_project_stage_gate.roadmap.getDisplayDate(gate.approval_date, gate.gate_due_date),
				getBaseLaneIndex(gate.project),
				dinext_project_stage_gate.roadmap.translateStatus(gate.status),
			],
			itemStyle: {
				...dinext_project_stage_gate.roadmap.getCheckpointItemStyle(gate.status),
			},
		}));

	const milestoneStyle = dinext_project_stage_gate.roadmap.getMilestoneItemStyle();
	const milestones = (safe.taskEntities || [])
		.filter((entity) => entity?.entity_kind === "milestone")
		.map((entity) => {
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
				taskBars.push({
					name: entity.subject || entity.name,
					docType: "Task",
					docName: entity.name,
					entityKind: "task_bar",
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
	const children = [
		{
			type: "line",
			shape: { x1: x0, y1: centerY, x2: x1, y2: centerY },
			style: {
				stroke: effectiveColor,
				lineWidth,
				lineCap: "round",
				shadowBlur: 6,
				shadowColor:
					shadowColor || dinext_project_stage_gate.roadmap.hexToRgba(effectiveColor, 0.18),
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
		},
	];

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
	};
	const fromDate = report.get_filter_value?.("from_date");
	const toDate = report.get_filter_value?.("to_date");
	const taskTypeOrder = dinext_project_stage_gate.roadmap._coerceToArray(
		report.get_filter_value?.("task_types")
	);
	const { categories, bars, gates, taskBars, milestones, rowSpanUnits, projectDocsByLabel } =
		dinext_project_stage_gate.roadmap.prepareSeriesData(payload, {
			fromDate,
			toDate,
			taskTypeOrder,
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
	const dom = mount.get(0);
	dom._dinextRoadmapCategoryCount = categories.length;
	dom._dinextRoadmapRowSpanUnits = rowSpanUnits;
	dinext_project_stage_gate.roadmap.applyChartHeight(dom, categories, rowSpanUnits);
	const existing =
		(typeof echarts.getInstanceByDom === "function" && echarts.getInstanceByDom(dom)) ||
		dom._dinextRoadmapChart ||
		null;
	const savedViewportState =
		dinext_project_stage_gate.roadmap.captureViewportStateFromChart(existing) ||
		dom._dinextRoadmapViewportState ||
		null;
	dinext_project_stage_gate.roadmap.persistViewportState(dom, savedViewportState);
	if (existing) {
		existing.dispose();
	}
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
			onShowAllData() {
				chart.setOption({
					dataZoom: showAllDataZoom,
				});
				dinext_project_stage_gate.roadmap.persistViewportState(
					dom,
					dinext_project_stage_gate.roadmap.getViewportStateFromDataZoom(showAllDataZoom)
				);
				dinext_project_stage_gate.roadmap.updateXAxisLabelDensity(chart);
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
};

