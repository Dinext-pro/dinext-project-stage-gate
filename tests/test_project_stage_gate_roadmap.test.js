const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const ROADMAP_SCRIPT_PATH =
	"/home/frappe/frappe-bench/apps/dinext_project_stage_gate/dinext_project_stage_gate/dinext_project_stage_gate/report/project_stage_gate_roadmap/project_stage_gate_roadmap.js";

function loadRoadmapScript(translations = {}) {
	const script = fs.readFileSync(ROADMAP_SCRIPT_PATH, "utf8");

	const state = {
		setRouteCalls: [],
		msgprintCalls: [],
		windowListeners: {},
	};

	const context = {
		__(value) {
			return Object.prototype.hasOwnProperty.call(translations, value)
				? translations[value]
				: value;
		},
		console,
		document: {
			documentElement: {
				getAttribute() {
					return null;
				},
			},
		},
		window: {
			innerHeight: 1200,
			addEventListener(event, handler) {
				state.windowListeners[event] = handler;
			},
			removeEventListener(event, handler) {
				if (state.windowListeners[event] === handler) {
					delete state.windowListeners[event];
				}
			},
		},
		getComputedStyle(target) {
			return {
				getPropertyValue(name) {
					if (name !== "--text-muted") {
						return "";
					}
					return target?.getAttribute?.("data-theme") === "dark" ? "#c7c7c7" : "#7c7c7c";
				},
			};
		},
		frappe: {
			query_reports: {},
			datetime: {
				add_months() {
					return "2026-01-01";
				},
				get_today() {
					return "2026-01-01";
				},
			},
			provide(path) {
				const segments = path.split(".");
				let pointer = context;
				for (const segment of segments) {
					pointer[segment] = pointer[segment] || {};
					pointer = pointer[segment];
				}
			},
			model: {
				can_read() {
					return true;
				},
			},
			set_route(...args) {
				state.setRouteCalls.push(args);
			},
			msgprint(msg) {
				state.msgprintCalls.push(msg);
			},
			require(_files, callback) {
				if (callback) {
					callback();
				}
			},
		},
		dinext_project_stage_gate: {},
		$: () => ({
			length: 0,
			find() {
				return { length: 0 };
			},
		}),
	};

	vm.runInNewContext(script, context);

	return {
		roadmap: context.dinext_project_stage_gate.roadmap,
		state,
		context,
	};
}

test("report defines project type, project status, stage visibility, milestone and task type filters", () => {
	const { context } = loadRoadmapScript();
	const report = context.frappe.query_reports["Project Stage Gate Roadmap"];

	assert.ok(report);
	assert.ok(Array.isArray(report.filters));

	const projectType = report.filters.find((filter) => filter.fieldname === "project_type");
	assert.ok(projectType);
	assert.equal(projectType.fieldtype, "Link");
	assert.equal(projectType.options, "Project Type");

	const projectStatus = report.filters.find((filter) => filter.fieldname === "project_status");
	assert.ok(projectStatus);
	assert.equal(projectStatus.fieldtype, "Select");
	assert.equal(projectStatus.options, ["", "Open", "Completed", "Cancelled"].join("\n"));

	const showMilestones = report.filters.find((filter) => filter.fieldname === "show_milestones");
	assert.ok(showMilestones);
	assert.equal(showMilestones.fieldtype, "Check");

	const showStages = report.filters.find(
		(filter) => filter.fieldname === "show_stages_and_checkpoints"
	);
	assert.ok(showStages);
	assert.equal(showStages.fieldtype, "Check");
	assert.equal(showStages.default, 1);

	const taskTypes = report.filters.find((filter) => filter.fieldname === "task_types");
	assert.ok(taskTypes);
	assert.equal(taskTypes.fieldtype, "MultiSelectList");
	assert.equal(taskTypes.options, "Task Type");
	assert.equal(typeof taskTypes.get_data, "function");
});

test("normalizeVisibilityFilters re-enables stages when no other project entities are selected", () => {
	const { roadmap } = loadRoadmapScript();

	const normalized = roadmap.normalizeVisibilityFilters({
		show_stages_and_checkpoints: 0,
		show_milestones: 0,
		task_types: [],
	});

	assert.equal(normalized.show_stages_and_checkpoints, 1);
});

test("normalizeVisibilityFilters keeps stages hidden when milestones or task types are selected", () => {
	const { roadmap } = loadRoadmapScript();

	const normalized = roadmap.normalizeVisibilityFilters({
		show_stages_and_checkpoints: 0,
		show_milestones: 1,
		task_types: [],
	});
	assert.equal(normalized.show_stages_and_checkpoints, 0);

	const normalizedWithTaskTypes = roadmap.normalizeVisibilityFilters({
		show_stages_and_checkpoints: 0,
		show_milestones: 0,
		task_types: ["Sprint"],
	});
	assert.equal(normalizedWithTaskTypes.show_stages_and_checkpoints, 0);
});

test("isStageVisibilityMandatory returns true only when no other entities are selected", () => {
	const { roadmap } = loadRoadmapScript();

	assert.equal(
		roadmap.isStageVisibilityMandatory({
			show_stages_and_checkpoints: 1,
			show_milestones: 0,
			task_types: [],
		}),
		true
	);
	assert.equal(
		roadmap.isStageVisibilityMandatory({
			show_stages_and_checkpoints: 1,
			show_milestones: 1,
			task_types: [],
		}),
		false
	);
	assert.equal(
		roadmap.isStageVisibilityMandatory({
			show_stages_and_checkpoints: 0,
			show_milestones: 0,
			task_types: ["Sprint"],
		}),
		false
	);
});

test("render syncs server-applied stage visibility without triggering a second report refresh", async () => {
	const { roadmap, context } = loadRoadmapScript();
	const dom = {};
	const mount = {
		length: 1,
		get() {
			return dom;
		},
	};
	const field = {
		value: 0,
		df: {
			read_only: 0,
		},
		setValueCalls: [],
		reportNoRefreshValues: [],
		refreshCalls: 0,
		async set_value(value) {
			this.reportNoRefreshValues.push(report._no_refresh);
			this.value = value;
			this.setValueCalls.push(value);
		},
		refresh() {
			this.refreshCalls += 1;
		},
		get_value() {
			return this.value;
		},
	};
	const report = {
		raw_data: {
			message: {
				projects: [],
				stageBars: [],
				gates: [],
				taskEntities: [],
				appliedFilters: {
					show_stages_and_checkpoints: 1,
					show_milestones: 0,
					task_types: [],
				},
			},
		},
		page: { main: {} },
		get_filter_value(fieldname) {
			if (fieldname === "show_stages_and_checkpoints") {
				return field.value;
			}
			if (fieldname === "task_types") {
				return [];
			}
			return null;
		},
		get_filter(fieldname) {
			return fieldname === "show_stages_and_checkpoints" ? field : null;
		},
		set_filter_value() {
			throw new Error("render should not trigger report.set_filter_value during server sync");
		},
	};

	roadmap.ensure_assets = async function () {};
	roadmap.ensure_chart_mount = function () {
		return mount;
	};
	roadmap.ensureResizeHandler = function () {};
	context.echarts = {
		getInstanceByDom() {
			return null;
		},
		init() {
			return {
				setOption() {},
				on() {},
			};
		},
	};

	await roadmap.render(report);

	assert.deepEqual(field.setValueCalls, [1]);
	assert.deepEqual(field.reportNoRefreshValues, [true]);
	assert.equal(field.value, 1);
	assert.equal(field.df.read_only, 1);
	assert.equal(field.refreshCalls, 1);
});

test("render preserves a user-disabled stage toggle when other entities are selected", async () => {
	const { roadmap, context } = loadRoadmapScript();
	const dom = {};
	const mount = {
		length: 1,
		get() {
			return dom;
		},
	};
	const field = {
		value: 0,
		df: {
			read_only: 0,
		},
		setValueCalls: [],
		refreshCalls: 0,
		async set_value(value) {
			this.value = value;
			this.setValueCalls.push(value);
		},
		refresh() {
			this.refreshCalls += 1;
		},
		get_value() {
			return this.value;
		},
	};
	const report = {
		raw_data: {
			message: {
				projects: [],
				stageBars: [{ name: "PSI-1" }],
				gates: [{ name: "PGC-1" }],
				taskEntities: [{ name: "TASK-1", entity_kind: "milestone", project: "PRJ-1" }],
				appliedFilters: {
					show_stages_and_checkpoints: 1,
					show_milestones: 1,
					task_types: [],
				},
			},
		},
		page: { main: {} },
		get_filter_value(fieldname) {
			if (fieldname === "show_stages_and_checkpoints") {
				return field.value;
			}
			if (fieldname === "show_milestones") {
				return 1;
			}
			if (fieldname === "task_types") {
				return [];
			}
			return null;
		},
		get_filter(fieldname) {
			return fieldname === "show_stages_and_checkpoints" ? field : null;
		},
	};

	roadmap.ensure_assets = async function () {};
	roadmap.ensure_chart_mount = function () {
		return mount;
	};
	roadmap.ensureResizeHandler = function () {};
	context.echarts = {
		getInstanceByDom() {
			return null;
		},
		init() {
			return {
				setOption() {},
				on() {},
			};
		},
	};

	await roadmap.render(report);

	assert.deepEqual(field.setValueCalls, []);
	assert.equal(field.value, 0);
	assert.equal(field.df.read_only, 0);
});

test("render disposes existing chart and shows empty state when no projects match filters", async () => {
	const { roadmap, context } = loadRoadmapScript();
	const existingChart = {
		disposeCalls: 0,
		dispose() {
			this.disposeCalls += 1;
		},
	};
	const dom = {
		_dinextRoadmapChart: existingChart,
		style: {},
		innerHTML: "",
		textContent: "",
	};
	const mount = {
		length: 1,
		get() {
			return dom;
		},
	};
	const emptyResult = { length: 0 };
	const wrapper = {
		length: 1,
		find(selector) {
			if (selector === ".project-stage-gate-roadmap-chart") {
				return mount;
			}
			return emptyResult;
		},
	};
	const report = {
		raw_data: {
			message: {
				projects: [],
				stageBars: [],
				gates: [],
				taskEntities: [],
			},
		},
		get_filter_value() {
			return null;
		},
		page: {
			main: {
				find(selector) {
					if (selector === ".project-stage-gate-roadmap") {
						return wrapper;
					}
					return emptyResult;
				},
			},
		},
	};

	context.echarts = {
		getInstanceByDom(target) {
			return target === dom ? existingChart : null;
		},
		init() {
			throw new Error("echarts.init should not run for empty roadmap data");
		},
	};

	await roadmap.render(report);

	assert.equal(existingChart.disposeCalls, 1);
	assert.equal(dom._dinextRoadmapChart, null);
	assert.equal(dom._dinextRoadmapCategoryCount, 0);
	assert.match(dom.innerHTML, /No projects match the selected filters\./);
});

test("onload wraps refresh to clear stale roadmap payload and rerender empty results", async () => {
	const { roadmap, context } = loadRoadmapScript();
	const reportDefinition = context.frappe.query_reports["Project Stage Gate Roadmap"];
	const renderSnapshots = [];

	context.document.createElement = function () {
		return {
			setAttribute() {},
			textContent: "",
		};
	};
	context.document.head = {
		appendChild() {},
	};
	roadmap.ensure_chart_mount = function () {};
	roadmap.ensure_theme_observer = function () {};
	roadmap.ensureResizeHandler = function () {};
	roadmap.render = async function (report) {
		renderSnapshots.push(report.raw_data?.message?.projects || null);
	};

	const report = {
		page: { main: {} },
		data: [{ project: "PRJ-1" }],
		raw_data: {
			message: {
				projects: [{ name: "PRJ-1" }],
				stageBars: [{ name: "PSI-1" }],
				gates: [{ name: "PGC-1" }],
				taskEntities: [{ name: "TASK-1" }],
			},
		},
		refreshCalls: 0,
		refresh() {
			this.refreshCalls += 1;
			this.data = [];
			return Promise.resolve({ ok: true });
		},
	};

	reportDefinition.onload(report);
	await report.refresh();

	assert.equal(report.refreshCalls, 1);
	assert.equal(renderSnapshots.length, 1);
	assert.deepEqual(Array.from(renderSnapshots[0]), []);
	assert.deepEqual(Array.from(report.raw_data.message.projects), []);
	assert.deepEqual(Array.from(report.raw_data.message.stageBars), []);
	assert.deepEqual(Array.from(report.raw_data.message.gates), []);
	assert.deepEqual(Array.from(report.raw_data.message.taskEntities), []);
});

test("hideActionsMenu removes only the grouped Actions button and mirrored mobile items", () => {
	const { roadmap, context } = loadRoadmapScript();
	let actionsGroupRemoved = false;
	let refreshItemRemoved = false;
	let actionItemRemoved = false;

	const menuItems = [
		{
			text() {
				return "Actions > Set Chart";
			},
			remove() {
				actionItemRemoved = true;
			},
		},
		{
			text() {
				return "Refresh";
			},
			remove() {
				refreshItemRemoved = true;
			},
		},
	];

	context.$ = (element) => ({
		text() {
			return element.text();
		},
	});

	const report = {
		page: {
			get_inner_group_button(label) {
				assert.equal(label, "Actions");
				return {
					remove() {
						actionsGroupRemoved = true;
					},
				};
			},
			menu: {
				find(selector) {
					assert.equal(selector, ".menu-item-label");
					return {
						filter(predicate) {
							const matches = menuItems.filter((item, index) => predicate(index, item));
							return {
								closest(closestSelector) {
									assert.equal(closestSelector, "li");
									return {
										remove() {
											matches.forEach((item) => item.remove());
										},
									};
								},
							};
						},
					};
				},
			},
		},
	};

	roadmap.hideActionsMenu(report);

	assert.equal(actionsGroupRemoved, true);
	assert.equal(actionItemRemoved, true);
	assert.equal(refreshItemRemoved, false);
});

test("ensureActionsMenuObserver installs a single observer for toolbar and menu mutations", () => {
	const { roadmap, context } = loadRoadmapScript();
	const observedTargets = [];
	let hideCalls = 0;

	class MutationObserverMock {
		constructor(callback) {
			this.callback = callback;
		}

		observe(target, options) {
			observedTargets.push({ target, options });
		}
	}

	context.window.MutationObserver = MutationObserverMock;
	roadmap.hideActionsMenu = function () {
		hideCalls += 1;
	};

	const toolbarElement = { id: "toolbar" };
	const menuElement = { id: "menu" };
	const report = {
		page: {
			inner_toolbar: [toolbarElement],
			menu: [menuElement],
		},
	};

	roadmap.ensureActionsMenuObserver(report);
	roadmap.ensureActionsMenuObserver(report);

	assert.equal(report.page._dinextRoadmapActionsMenuObserverInstalled, true);
	assert.equal(observedTargets.length, 2);
	assert.strictEqual(observedTargets[0].target, toolbarElement);
	assert.equal(observedTargets[0].options.childList, true);
	assert.equal(observedTargets[0].options.subtree, true);
	assert.strictEqual(observedTargets[1].target, menuElement);
	assert.equal(observedTargets[1].options.childList, true);
	assert.equal(observedTargets[1].options.subtree, true);

	report.page._dinextRoadmapActionsMenuObserver.callback();
	assert.equal(hideCalls, 1);
});

test("buildStageBarChevronPoints expands zero span and keeps tip inside bar", () => {
	const { roadmap } = loadRoadmapScript();
	const yc = 50;
	const h = 20;
	const pts = roadmap.buildStageBarChevronPoints(100, 100, yc, h);
	assert.equal(pts.length, 6);
	const x0 = pts[0][0];
	const x1 = pts[2][0];
	assert.equal(x0, 100);
	assert.ok(x1 > x0, "bar should have positive pixel span");
	const tipDepth = x1 - pts[1][0];
	assert.ok(tipDepth > 0, "right chevron tip should be visible");
	assert.ok(pts[1][0] > x0, "top edge should extend past left edge");
});

test("buildStageBarChevronPoints keeps the same chevron depth for short and wide bars", () => {
	const { roadmap } = loadRoadmapScript();

	const shortPts = roadmap.buildStageBarChevronPoints(0, 120, 40, 16);
	const widePts = roadmap.buildStageBarChevronPoints(0, 800, 40, 16);
	const shortTipDepth = shortPts[2][0] - shortPts[1][0];
	const wideTipDepth = widePts[2][0] - widePts[1][0];

	assert.equal(shortTipDepth, 14);
	assert.equal(wideTipDepth, 14);
});

test("buildStageBarChevronPoints handles inverted x (end before start)", () => {
	const { roadmap } = loadRoadmapScript();
	const pts = roadmap.buildStageBarChevronPoints(200, 100, 30, 12);
	const xs = pts.map((p) => p[0]);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	assert.equal(minX, 100);
	assert.equal(maxX, 200);
});

test("buildStageBarGraphic includes text label and uses explicit stage colors", () => {
	const { roadmap } = loadRoadmapScript();

	const graphic = roadmap.buildStageBarGraphic({
		startX: 10,
		endX: 200,
		centerY: 40,
		height: 18,
		label: "Discovery",
		fill: "#abcdef",
		stroke: "#123456",
		lineWidth: 2,
		textColor: "#ffffff",
	});

	assert.equal(graphic.type, "group");
	assert.equal(graphic.children.length, 2);
	assert.equal(graphic.children[0].type, "polygon");
	assert.equal(graphic.children[0].style.fill, "#abcdef");
	assert.equal(graphic.children[0].style.stroke, "#123456");
	assert.equal(graphic.children[1].type, "text");
	assert.equal(graphic.children[1].style.text, "Discovery");
	assert.equal(graphic.children[0].enterAnimation.duration, roadmap.ROADMAP_INTRO_ANIMATION_DURATION_MS);
	assert.equal(graphic.children[0].enterFrom.style.opacity, 0);
	assert.equal(graphic.children[0].transition, "all");
});

test("prepareSeriesData attaches docType and docName for stages and gates", () => {
	const { roadmap } = loadRoadmapScript();

	const { bars, gates } = roadmap.prepareSeriesData({
		projects: [{ name: "PRJ-1", project_name: "Alpha" }],
		stageBars: [
			{
				name: "PSI-10",
				project: "PRJ-1",
				stage: "Discovery",
				status: "Active",
				sequence: 1,
				planned_start_date: "2026-02-01",
				planned_end_date: "2026-02-28",
			},
		],
		gates: [
			{
				name: "PGC-20",
				project: "PRJ-1",
				approval_date: "2026-02-15",
				status: "Approved",
				checkpoint_level: "Gate 1",
			},
		],
	});

	assert.equal(bars.length, 1);
	assert.equal(bars[0].docType, "Project Stage Instance");
	assert.equal(bars[0].docName, "PSI-10");
	assert.equal(bars[0].value[3], "Discovery");

	assert.equal(gates.length, 1);
	assert.equal(gates[0].docType, "Project Gate Checkpoint");
	assert.equal(gates[0].docName, "PGC-20");
});

test("prepareSeriesData builds task bars and milestones into separate sublanes", () => {
	const { roadmap } = loadRoadmapScript();

	const { categories, bars, taskBars, milestones, rowSpanUnits } = roadmap.prepareSeriesData(
		{
			projects: [{ name: "PRJ-1", project_name: "Alpha" }],
			stageBars: [
				{
					name: "PSI-10",
					project: "PRJ-1",
					stage: "Discovery",
					status: "Active",
					sequence: 1,
					planned_start_date: "2026-04-01",
					planned_end_date: "2026-04-20",
				},
			],
			gates: [],
			taskEntities: [
				{
					name: "TASK-1",
					project: "PRJ-1",
					subject: "Milestone A",
					status: "Open",
					type: "Sprint",
					entity_kind: "milestone",
					lane_key: "milestone",
					point_date: "2026-04-03",
				},
				{
					name: "TASK-2",
					project: "PRJ-1",
					subject: "Sprint A",
					status: "Working",
					progress: 35,
					type: "Sprint",
					entity_kind: "task_bar",
					lane_key: "task_type:Sprint",
					start_date: "2026-04-04",
					end_date: "2026-04-10",
				},
				{
					name: "TASK-3",
					project: "PRJ-1",
					subject: "Sprint B",
					status: "Open",
					type: "Sprint",
					entity_kind: "task_bar",
					lane_key: "task_type:Sprint",
					start_date: "2026-04-06",
					end_date: "2026-04-12",
				},
				{
					name: "TASK-4",
					project: "PRJ-1",
					subject: "Phase A",
					status: "Open",
					type: "Phase",
					entity_kind: "task_bar",
					lane_key: "task_type:Phase",
					start_date: "2026-04-05",
					end_date: "2026-04-16",
				},
			],
		},
		{ taskTypeOrder: ["Sprint", "Phase"] }
	);

	assert.equal(milestones.length, 1);
	assert.equal(milestones[0].docType, "Task");
	assert.equal(milestones[0].docName, "TASK-1");
	assert.equal(taskBars.length, 3);
	assert.equal(taskBars[0].docType, "Task");
	assert.equal(taskBars[0].value[3], "Sprint A");
	assert.equal(taskBars[0].progress, 35);
	assert.ok(categories.length > 1);
	assert.ok(bars[0].value[0] < taskBars[0].value[0], "stage band should stay above task lanes");
	assert.ok(
		taskBars[0].value[0] < taskBars[1].value[0],
		"overlapping tasks in the same sublane should stack downward"
	);
	assert.ok(
		taskBars[2].value[0] < milestones[0].value[1],
		"milestones should render below all task type lanes"
	);
	assert.ok(
		taskBars[1].value[0] < taskBars[2].value[0],
		"later task type lanes should render below earlier ones"
	);
});

test("prepareSeriesData expands projects into explicit lane rows", () => {
	const { roadmap } = loadRoadmapScript();

	const data = roadmap.prepareSeriesData(
		{
			projects: [{ name: "PRJ-1", project_name: "Alpha" }],
			stageBars: [
				{
					name: "PSI-10",
					project: "PRJ-1",
					stage: "Discovery",
					status: "Active",
					sequence: 1,
					planned_start_date: "2026-04-01",
					planned_end_date: "2026-04-20",
				},
			],
			gates: [
				{
					name: "PGC-1",
					project: "PRJ-1",
					approval_date: "2026-04-12",
					status: "Approved",
					checkpoint_level: "Gate 1",
				},
			],
			taskEntities: [
				{
					name: "TASK-M1",
					project: "PRJ-1",
					subject: "Milestone A",
					status: "Open",
					type: "Sprint",
					entity_kind: "milestone",
					lane_key: "milestone",
					point_date: "2026-04-03",
				},
				{
					name: "TASK-T1",
					project: "PRJ-1",
					subject: "Sprint A",
					status: "Working",
					type: "Sprint",
					entity_kind: "task_bar",
					lane_key: "task_type:Sprint",
					start_date: "2026-04-04",
					end_date: "2026-04-10",
				},
			],
		},
		{ taskTypeOrder: ["Sprint"] }
	);

	assert.deepEqual(
		Array.from(data.categories, (lane) => lane.key),
		["PRJ-1::base", "PRJ-1::task_type:Sprint::0", "PRJ-1::milestone"]
	);
	assert.equal(data.bars[0].value[0], 0);
	assert.equal(data.gates[0].value[1], 0);
	assert.equal(data.taskBars[0].value[0], 1);
	assert.equal(data.milestones[0].value[1], 2);
	assert.equal(data.projectDocsByLabel["PRJ-1::base"].docType, "Project");
	assert.equal(data.projectDocsByLabel["PRJ-1::base"].docName, "PRJ-1");
	assert.equal(data.projectDocsByLabel["PRJ-1::milestone"], undefined);
});

test("getTaskTypeItemStyle switches palette across themes and task types", () => {
	const { roadmap, context } = loadRoadmapScript();

	context.document.documentElement.getAttribute = () => null;
	const lightSprint = roadmap.getTaskTypeItemStyle("Sprint");
	const lightPhase = roadmap.getTaskTypeItemStyle("Phase");

	context.document.documentElement.getAttribute = () => "dark";
	const darkSprint = roadmap.getTaskTypeItemStyle("Sprint");

	assert.notEqual(lightSprint.lineColor, lightPhase.lineColor);
	assert.notEqual(lightSprint.lineColor, darkSprint.lineColor);
	assert.ok(lightSprint.labelColor);
	assert.ok(darkSprint.labelColor);
});

test("getTaskTypeItemStyle is stable for the same task type", () => {
	const { roadmap, context } = loadRoadmapScript();

	context.document.documentElement.getAttribute = () => null;
	const first = roadmap.getTaskTypeItemStyle("Sprint");
	const second = roadmap.getTaskTypeItemStyle("Sprint");

	assert.equal(first.lineColor, second.lineColor);
	assert.equal(first.labelColor, second.labelColor);
});

test("getTaskTypeItemStyle keeps Stage and Sprint visually distinct", () => {
	const { roadmap, context } = loadRoadmapScript();

	context.document.documentElement.getAttribute = () => null;
	const stageStyle = roadmap.getTaskTypeItemStyle("Stage");
	const sprintStyle = roadmap.getTaskTypeItemStyle("Sprint");

	assert.notEqual(stageStyle.lineColor, sprintStyle.lineColor);
	assert.notEqual(stageStyle.labelColor, sprintStyle.labelColor);
});

test("buildRoundedTaskLineGraphic draws rounded line with label above", () => {
	const { roadmap } = loadRoadmapScript();

	const graphic = roadmap.buildRoundedTaskLineGraphic({
		startX: 40,
		endX: 180,
		centerY: 80,
		lineWidth: 8,
		label: "Sprint Alpha",
		lineColor: "#3366ff",
		labelColor: "#3366ff",
	});

	assert.equal(graphic.type, "group");
	assert.equal(graphic.children[0].type, "line");
	assert.equal(graphic.children[0].style.lineCap, "round");
	assert.equal(graphic.children[0].style.lineWidth, 8);
	assert.equal(graphic.children[1].type, "text");
	assert.equal(graphic.children[1].style.text, "Sprint Alpha");
	assert.ok(graphic.children[1].style.y < 80, "label should sit above the line");
});

test("buildRoundedTaskLineGraphic scales task labels with span and keeps them closer to the line", () => {
	const { roadmap } = loadRoadmapScript();

	const shortGraphic = roadmap.buildRoundedTaskLineGraphic({
		startX: 40,
		endX: 96,
		centerY: 80,
		lineWidth: 8,
		label: "Short Sprint",
		lineColor: "#3366ff",
		labelColor: "#3366ff",
	});
	const longGraphic = roadmap.buildRoundedTaskLineGraphic({
		startX: 40,
		endX: 220,
		centerY: 80,
		lineWidth: 8,
		label: "Long Sprint",
		lineColor: "#3366ff",
		labelColor: "#3366ff",
	});

	assert.equal(shortGraphic.children[1].type, "text");
	assert.equal(longGraphic.children[1].type, "text");
	assert.ok(
		shortGraphic.children[1].style.fontSize < longGraphic.children[1].style.fontSize,
		"narrower task bars should render smaller labels"
	);
	assert.ok(
		shortGraphic.children[1].style.y > 66,
		"task labels should sit closer to the line than the previous fixed offset"
	);
});

test("buildRoundedTaskLineGraphic falls back to a visible shared color when lineColor is missing", () => {
	const { roadmap } = loadRoadmapScript();

	const graphic = roadmap.buildRoundedTaskLineGraphic({
		startX: 40,
		endX: 180,
		centerY: 80,
		lineWidth: 8,
		label: "Sprint Alpha",
		labelColor: "#3366ff",
	});

	assert.equal(graphic.children[0].style.stroke, "#3366ff");
	assert.equal(graphic.children[1].style.fill, "#3366ff");
});

test("buildRoundedTaskLineGraphic adds an inner progress overlay with proportional width", () => {
	const { roadmap } = loadRoadmapScript();

	const graphic = roadmap.buildRoundedTaskLineGraphic({
		startX: 40,
		endX: 180,
		centerY: 80,
		lineWidth: 8,
		label: "Sprint Alpha",
		lineColor: "#3366ff",
		labelColor: "#3366ff",
		progress: 35,
		progressLineColor: "#84cc16",
	});

	assert.equal(graphic.children[0].type, "rect");
	assert.equal(graphic.children[0].z2, 1);
	assert.equal(graphic.children[0].style.fill, roadmap.getTaskProgressTrackColor("#3366ff"));
	assert.equal(graphic.children[0].style.shadowColor, roadmap.getTaskProgressTrackColor("#3366ff"));
	assert.equal(graphic.children[1].type, "rect");
	assert.equal(graphic.children[1].z2, 2);
	assert.equal(graphic.children[1].style.stroke, "#84cc16");
	assert.equal(graphic.children[1].shape.x, 40);
	assert.equal(graphic.children[1].shape.width, 49);
	assert.ok(graphic.children[1].shape.height < graphic.children[0].shape.height);
	assert.equal(graphic.children[2].type, "circle");
	assert.equal(graphic.children[2].z2, 3);
	assert.equal(graphic.children[2].shape.cx, 89);
	assert.equal(graphic.children[2].style.stroke, "#ffffff");
	assert.equal(graphic.children[3].type, "text");
});

test("prepareSeriesData uses widget status palette instead of per-stage color override", () => {
	const { roadmap } = loadRoadmapScript();

	const { bars } = roadmap.prepareSeriesData({
		projects: [{ name: "PRJ-1", project_name: "Alpha" }],
		stageBars: [
			{
				name: "PSI-10",
				project: "PRJ-1",
				stage: "DISC",
				stage_name: "Discovery",
				color: "#abcdef",
				status: "Waiting Gate",
				sequence: 1,
				planned_start_date: "2026-02-01",
				planned_end_date: "2026-02-28",
			},
		],
		gates: [],
	});

	assert.equal(bars[0].name, "Discovery");
	assert.equal(bars[0].value[3], "Discovery");
	assert.equal(bars[0].itemStyle.color, "#8f9aa8");
	assert.equal(bars[0].itemStyle.borderColor, "#8f9aa8");
});

test("prepareSeriesData assigns different colors to different task types and keeps same type stable", () => {
	const { roadmap } = loadRoadmapScript();

	const { taskBars } = roadmap.prepareSeriesData(
		{
			projects: [
				{ name: "PRJ-1", project_name: "Alpha" },
				{ name: "PRJ-2", project_name: "Beta" },
			],
			stageBars: [],
			gates: [],
			taskEntities: [
				{
					name: "TASK-1",
					project: "PRJ-1",
					subject: "Sprint A",
					status: "Working",
					type: "Sprint",
					entity_kind: "task_bar",
					lane_key: "task_type:Sprint",
					lane_label: "Sprint",
					start_date: "2026-04-01",
					end_date: "2026-04-10",
				},
				{
					name: "TASK-2",
					project: "PRJ-2",
					subject: "Sprint B",
					status: "Open",
					type: "Sprint",
					entity_kind: "task_bar",
					lane_key: "task_type:Sprint",
					lane_label: "Sprint",
					start_date: "2026-04-03",
					end_date: "2026-04-12",
				},
				{
					name: "TASK-3",
					project: "PRJ-1",
					subject: "Phase A",
					status: "Open",
					type: "Phase",
					entity_kind: "task_bar",
					lane_key: "task_type:Phase",
					lane_label: "Phase",
					start_date: "2026-04-05",
					end_date: "2026-04-15",
				},
			],
		},
		{ taskTypeOrder: ["Sprint", "Phase"] }
	);

	const sprintBars = taskBars.filter((task) => task.value[5] === "Sprint");
	const phaseBars = taskBars.filter((task) => task.value[5] === "Phase");

	assert.equal(sprintBars.length, 2);
	assert.equal(phaseBars.length, 1);
	assert.equal(sprintBars[0].itemStyle.color, sprintBars[1].itemStyle.color);
	assert.equal(sprintBars[0].itemStyle.labelColor, sprintBars[0].itemStyle.color);
	assert.notEqual(sprintBars[0].itemStyle.color, phaseBars[0].itemStyle.color);
	assert.equal(sprintBars[0].value[6], sprintBars[0].itemStyle.color);
	assert.equal(phaseBars[0].value[6], phaseBars[0].itemStyle.color);
});

test("prepareSeriesData falls back to lane metadata when task type is missing", () => {
	const { roadmap } = loadRoadmapScript();

	const { taskBars } = roadmap.prepareSeriesData(
		{
			projects: [{ name: "PRJ-1", project_name: "Alpha" }],
			stageBars: [],
			gates: [],
			taskEntities: [
				{
					name: "TASK-1",
					project: "PRJ-1",
					subject: "Portal Discovery",
					status: "Working",
					type: "",
					entity_kind: "task_bar",
					lane_key: "task_type:Sprint",
					lane_label: "Sprint",
					start_date: "2026-04-01",
					end_date: "2026-04-10",
				},
				{
					name: "TASK-2",
					project: "PRJ-1",
					subject: "Portal Build",
					status: "Open",
					type: "",
					entity_kind: "task_bar",
					lane_key: "task_type:Phase",
					lane_label: "Phase",
					start_date: "2026-04-03",
					end_date: "2026-04-12",
				},
			],
		},
		{ taskTypeOrder: ["Sprint", "Phase"] }
	);

	assert.equal(taskBars.length, 2);
	assert.notEqual(taskBars[0].itemStyle.color, taskBars[1].itemStyle.color);
});

test("getStageItemStyle switches palette with theme exactly like widget", () => {
	const { roadmap, context } = loadRoadmapScript();

	context.document.documentElement.getAttribute = () => null;
	const lightStyle = roadmap.getStageItemStyle({ status: "Active" });

	context.document.documentElement.getAttribute = () => "dark";
	const darkStyle = roadmap.getStageItemStyle({ status: "Active" });

	assert.equal(lightStyle.fill, "#7f95c1");
	assert.equal(darkStyle.fill, "#4f6fa8");
});

test("getStageItemStyle dims skipped and canceled stage text like widget", () => {
	const { roadmap, context } = loadRoadmapScript();

	context.document.documentElement.getAttribute = () => "dark";
	const skipped = roadmap.getStageItemStyle({ status: "Skipped" });
	const canceled = roadmap.getStageItemStyle({ status: "Canceled" });

	assert.equal(skipped.textColor, "#c7c7c7");
	assert.equal(skipped.textOpacity, 0.6);
	assert.equal(canceled.textColor, "#c7c7c7");
	assert.equal(canceled.textOpacity, 0.6);
});

test("prepareSeriesData prefers actual dates and falls back to planned checkpoint due date", () => {
	const { roadmap } = loadRoadmapScript();

	const { bars, gates } = roadmap.prepareSeriesData(
		{
			projects: [{ name: "PRJ-1", project_name: "Alpha" }],
			stageBars: [
				{
					name: "PSI-10",
					project: "PRJ-1",
					stage: "Discovery",
					status: "Active",
					sequence: 1,
					planned_start_date: "2026-02-01",
					planned_end_date: "2026-02-28",
					actual_start_date: "2026-02-03",
					actual_end_date: "2026-02-20",
				},
			],
			gates: [
				{
					name: "PGC-20",
					project: "PRJ-1",
					approval_date: "",
					gate_due_date: "2026-02-18",
					status: "Approved",
					checkpoint_level: "Gate 1",
				},
			],
		},
		{ fromDate: "2026-02-01", toDate: "2026-02-28" }
	);

	assert.equal(bars[0].value[1], "2026-02-03");
	assert.equal(bars[0].value[2], "2026-02-20");
	assert.equal(gates.length, 1);
	assert.equal(gates[0].value[0], "2026-02-18");
});

test("prepareSeriesData keeps planned stage interval when actual dates collapse to a single day", () => {
	const { roadmap } = loadRoadmapScript();

	const { bars } = roadmap.prepareSeriesData({
		projects: [{ name: "PRJ-1", project_name: "Alpha" }],
		stageBars: [
			{
				name: "PSI-10",
				project: "PRJ-1",
				stage: "Discovery",
				status: "Completed",
				sequence: 1,
				planned_start_date: "2026-02-01",
				planned_end_date: "2026-02-28",
				actual_start_date: "2026-02-20",
				actual_end_date: "2026-02-20",
			},
		],
		gates: [],
	});

	assert.equal(bars[0].value[1], "2026-02-01");
	assert.equal(bars[0].value[2], "2026-02-28");
	assert.equal(bars[0].itemStyle.color, "#739b7f");
});

test("prepareSeriesData excludes gates on or outside display boundaries", () => {
	const { roadmap } = loadRoadmapScript();

	const { gates } = roadmap.prepareSeriesData(
		{
			projects: [{ name: "PRJ-1", project_name: "Alpha" }],
			stageBars: [],
			gates: [
				{ name: "PGC-1", project: "PRJ-1", approval_date: "2026-01-01", status: "Draft" },
				{ name: "PGC-2", project: "PRJ-1", approval_date: "2026-01-15", status: "Approved" },
				{ name: "PGC-3", project: "PRJ-1", approval_date: "2026-01-31", status: "Approved" },
				{ name: "PGC-4", project: "PRJ-1", approval_date: "2025-12-31", status: "Approved" },
				{ name: "PGC-5", project: "PRJ-1", approval_date: "2026-02-01", status: "Approved" },
			],
		},
		{ fromDate: "2026-01-01", toDate: "2026-01-31" }
	);

	assert.deepEqual(
		gates.map((gate) => gate.docName),
		["PGC-2"]
	);
});

test("prepareSeriesData skips gates without approval_date or without name", () => {
	const { roadmap } = loadRoadmapScript();

	const { gates } = roadmap.prepareSeriesData({
		projects: [{ name: "PRJ-1", project_name: "Alpha" }],
		stageBars: [],
		gates: [
			{ name: "PGC-1", project: "PRJ-1", approval_date: null, status: "Draft" },
			{ name: "", project: "PRJ-1", approval_date: "2026-01-01", status: "Approved" },
			{ name: "PGC-2", project: "PRJ-1", approval_date: "2026-01-02", status: "Approved" },
		],
	});

	assert.equal(gates.length, 1);
	assert.equal(gates[0].docName, "PGC-2");
});

test("getDefaultVerticalViewport shows first 10 project rows by default", () => {
	const { roadmap } = loadRoadmapScript();

	const defaultViewport = roadmap.getDefaultVerticalViewport(new Array(15).fill("row"));
	assert.equal(defaultViewport.startValue, 0);
	assert.equal(defaultViewport.endValue, 9);

	const compactViewport = roadmap.getDefaultVerticalViewport(["A", "B", "C"]);
	assert.equal(compactViewport.startValue, 0);
	assert.equal(compactViewport.endValue, 2);
});

test("getDefaultHorizontalViewport clamps the target year window to active report filters", () => {
	const { roadmap } = loadRoadmapScript();

	const viewport = roadmap.getDefaultHorizontalViewport({
		today: "2026-01-01",
		fromDate: "2025-11-15",
		toDate: "2026-08-15",
	});

	assert.equal(viewport.startValue, "2026-01-01");
	assert.equal(viewport.endValue, "2026-08-15");
});

test("buildDataZoomConfig returns slider and inside zoom for both axes", () => {
	const { roadmap } = loadRoadmapScript();

	const dataZoom = roadmap.buildDataZoomConfig({
		categories: new Array(12).fill("row"),
		fromDate: "2025-10-01",
		toDate: "2026-12-31",
		today: "2026-01-01",
	});

	assert.equal(dataZoom.length, 4);
	assert.equal(dataZoom[0].type, "inside");
	assert.equal(dataZoom[0].xAxisIndex, 0);
	assert.equal(dataZoom[1].type, "slider");
	assert.equal(dataZoom[1].xAxisIndex, 0);
	assert.equal(dataZoom[2].type, "inside");
	assert.equal(dataZoom[2].yAxisIndex, 0);
	assert.equal(dataZoom[3].type, "slider");
	assert.equal(dataZoom[3].yAxisIndex, 0);
	assert.equal(dataZoom[2].zoomOnMouseWheel, false);
	assert.equal(dataZoom[2].moveOnMouseWheel, false);
	assert.equal(dataZoom[2].startValue, 0);
	assert.equal(dataZoom[2].endValue, 9);
	assert.equal(dataZoom[0].startValue, "2026-01-01");
	assert.equal(dataZoom[0].endValue, "2026-12-31");
	assert.equal(dataZoom[1].height, 24);
	assert.equal(dataZoom[3].width, 18);
});

test("getViewportStateFromDataZoom extracts horizontal and vertical ranges", () => {
	const { roadmap } = loadRoadmapScript();

	const viewportState = roadmap.getViewportStateFromDataZoom([
		{ type: "inside", xAxisIndex: 0, startValue: "2026-03-01", endValue: "2026-06-01" },
		{ type: "slider", xAxisIndex: 0, startValue: "2026-03-01", endValue: "2026-06-01" },
		{ type: "inside", yAxisIndex: 0, startValue: 2, endValue: 6 },
		{ type: "slider", yAxisIndex: 0, startValue: 2, endValue: 6 },
	]);

	assert.equal(viewportState.horizontal.startValue, "2026-03-01");
	assert.equal(viewportState.horizontal.endValue, "2026-06-01");
	assert.equal(viewportState.vertical.startValue, 2);
	assert.equal(viewportState.vertical.endValue, 6);
});

test("buildDataZoomConfig restores a saved viewport when it remains valid", () => {
	const { roadmap } = loadRoadmapScript();

	const dataZoom = roadmap.buildDataZoomConfig({
		categories: new Array(12).fill("row"),
		bars: [
			{ value: [0, "2026-01-01", "2026-09-30"] },
		],
		fromDate: "2026-01-01",
		toDate: "2026-12-31",
		today: "2026-01-01",
		viewportState: {
			horizontal: {
				startValue: "2026-03-01",
				endValue: "2026-06-01",
			},
			vertical: {
				startValue: 3,
				endValue: 7,
			},
		},
	});

	assert.equal(dataZoom[0].startValue, "2026-03-01");
	assert.equal(dataZoom[0].endValue, "2026-06-01");
	assert.equal(dataZoom[1].startValue, "2026-03-01");
	assert.equal(dataZoom[1].endValue, "2026-06-01");
	assert.equal(dataZoom[2].startValue, 3);
	assert.equal(dataZoom[2].endValue, 7);
	assert.equal(dataZoom[3].startValue, 3);
	assert.equal(dataZoom[3].endValue, 7);
});

test("buildDataZoomConfig clamps a saved viewport to the refreshed dataset bounds", () => {
	const { roadmap } = loadRoadmapScript();

	const dataZoom = roadmap.buildDataZoomConfig({
		categories: new Array(5).fill("row"),
		bars: [
			{ value: [0, "2026-02-01", "2026-05-15"] },
		],
		fromDate: "2026-01-01",
		toDate: "2026-12-31",
		today: "2026-01-01",
		viewportState: {
			horizontal: {
				startValue: "2025-11-01",
				endValue: "2026-10-01",
			},
			vertical: {
				startValue: 4,
				endValue: 12,
			},
		},
	});

	assert.equal(dataZoom[0].startValue, "2026-02-01");
	assert.equal(dataZoom[0].endValue, "2026-05-15");
	assert.equal(dataZoom[2].startValue, 4);
	assert.equal(dataZoom[2].endValue, 4);
});

test("buildDataZoomConfig falls back to default viewport when saved state is invalid", () => {
	const { roadmap } = loadRoadmapScript();

	const dataZoom = roadmap.buildDataZoomConfig({
		categories: new Array(12).fill("row"),
		bars: [
			{ value: [0, "2026-02-01", "2026-05-15"] },
		],
		fromDate: "2025-10-01",
		toDate: "2026-12-31",
		today: "2026-01-01",
		viewportState: {
			horizontal: {
				startValue: "not-a-date",
				endValue: "2026-04-01",
			},
			vertical: {
				startValue: "bad",
				endValue: 4,
			},
		},
	});

	assert.equal(dataZoom[0].startValue, "2026-01-01");
	assert.equal(dataZoom[0].endValue, "2026-12-31");
	assert.equal(dataZoom[2].startValue, 0);
	assert.equal(dataZoom[2].endValue, 9);
});

test("getEChartsThemeName uses the standard dark theme only for dark mode", () => {
	const { roadmap, context } = loadRoadmapScript();

	context.document.documentElement.getAttribute = () => "dark";
	assert.equal(roadmap.getEChartsThemeName(), "dark");

	context.document.documentElement.getAttribute = () => "light";
	assert.equal(roadmap.getEChartsThemeName(), undefined);
});

test("buildChartOptions makes y-axis project labels explicit and readable", () => {
	const { roadmap } = loadRoadmapScript({
		Jan: "янв",
	});

	const options = roadmap.buildChartOptions({
		categories: ["Very long project name", "Another long project name"],
		bars: [],
		gates: [],
		dataZoom: [],
	});

	assert.equal(options.grid.left, 12);
	assert.equal(options.grid.right, 28);
	assert.equal(options.grid.bottom, 44);
	assert.equal(options.yAxis.type, "category");
	assert.equal(options.yAxis.data.length, 2);
	assert.equal(options.yAxis.inverse, true);
	assert.equal(options.yAxis.triggerEvent, true);
	assert.equal(options.yAxis.axisLabel.show, true);
	assert.equal(options.yAxis.axisLabel.interval, 0);
	assert.equal(options.yAxis.axisLabel.width, 190);
	assert.equal(options.yAxis.axisLabel.fontSize, 12);
	assert.equal(options.yAxis.axisLabel.lineHeight, 14);
	assert.equal(options.yAxis.axisLabel.align, "right");
	assert.equal(options.yAxis.axisLabel.margin, 12);
	assert.equal(typeof options.yAxis.axisLabel.formatter, "function");
	assert.match(
		options.yAxis.axisLabel.formatter("Лукойл: Внедрение CRM и Service Desk"),
		/\n/
	);
	assert.equal(options.xAxis.splitLine.show, true);
	assert.equal(options.xAxis.minorSplitLine.show, true);
	assert.equal(options.yAxis.splitLine.show, false);
	assert.ok(options.toolbox);
	assert.equal(options.toolbox.top, 4);
	assert.ok(options.toolbox.top < options.grid.top);
	assert.ok(options.legend);
	assert.equal(options.legend.top, 4);
	assert.equal(options.legend.selectedMode, false);
	assert.ok(options.toolbox.feature.restore);
	assert.equal(options.toolbox.feature.restore.title, "Restore");
	assert.ok(options.toolbox.feature.saveAsImage);
	assert.equal(options.toolbox.feature.saveAsImage.title, "Save as Image");
	assert.ok(options.toolbox.feature.myShowFullWidth);
	assert.equal(options.toolbox.feature.myShowFullWidth.title, "Show Full Width");
	assert.ok(options.toolbox.feature.myShowFullHeight);
	assert.equal(options.toolbox.feature.myShowFullHeight.title, "Show Full Height");
	assert.ok(options.toolbox.feature.myShowAllData);
	assert.equal(options.toolbox.feature.myShowAllData.title, "Show All");
	assert.equal(typeof options.xAxis.axisLabel.formatter, "function");
	assert.equal(options.xAxis.axisLabel.formatter("2026-01-01"), "янв 2026");
	assert.equal(options.xAxis.axisLabel.formatter("2026-01-15"), "15 янв");
	assert.equal(options.series[0].clip, true);
	const estimatedStageHeight = roadmap.estimateStageBarHeight(
		["Very long project name", "Another long project name"],
		roadmap.calculateChartHeight(["Very long project name", "Another long project name"]),
		{ top: 44, bottom: 44 },
		1
	);
	assert.equal(
		options.series[1].symbolSize,
		Math.min(
			Math.max(
				roadmap.ROADMAP_CHECKPOINT_PREFERRED_SIZE,
				estimatedStageHeight * roadmap.ROADMAP_CHECKPOINT_MIN_STAGE_HEIGHT_RATIO
			),
			estimatedStageHeight * roadmap.ROADMAP_CHECKPOINT_MAX_STAGE_HEIGHT_RATIO
		)
	);
	assert.equal(options.series[1].itemStyle.borderWidth, 2);
});

test("buildChartOptions hides lane labels on the y-axis and keeps project labels", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: [
			{
				key: "PRJ-1::base",
				projectLabel: "Alpha Delivery Program",
				laneLabel: "Project",
				isProjectLabel: true,
			},
			{
				key: "PRJ-1::task_type:Phase::0",
				projectLabel: "Alpha Delivery Program",
				laneLabel: "Phase",
				isProjectLabel: false,
			},
			{
				key: "PRJ-1::milestone",
				projectLabel: "Alpha Delivery Program",
				laneLabel: "Milestones",
				isProjectLabel: false,
			},
		],
		bars: [],
		gates: [],
		milestones: [],
		taskBars: [],
		dataZoom: [],
	});

	assert.equal(options.yAxis.axisLabel.formatter("PRJ-1::base"), "Alpha Delivery Program");
	assert.equal(options.yAxis.axisLabel.formatter("PRJ-1::task_type:Phase::0"), "");
	assert.equal(options.yAxis.axisLabel.formatter("PRJ-1::milestone"), "");
});

test("buildChartOptions disables default y-axis split lines in favor of project separators", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: [
			{ key: "PRJ-1::base", projectName: "PRJ-1", projectLabel: "Alpha", isProjectLabel: true },
			{ key: "PRJ-1::task_type:Phase::0", projectName: "PRJ-1", projectLabel: "Alpha", isProjectLabel: false },
			{ key: "PRJ-2::base", projectName: "PRJ-2", projectLabel: "Beta", isProjectLabel: true },
		],
		bars: [],
		gates: [],
		milestones: [],
		taskBars: [],
		dataZoom: [],
	});

	assert.equal(options.yAxis.splitLine.show, false);
});

test("buildChartOptions adds separator series only between different projects", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: [
			{ key: "PRJ-1::base", projectName: "PRJ-1", projectLabel: "Alpha", isProjectLabel: true },
			{ key: "PRJ-1::task_type:Sprint::0", projectName: "PRJ-1", projectLabel: "Alpha", isProjectLabel: false },
			{ key: "PRJ-1::milestone", projectName: "PRJ-1", projectLabel: "Alpha", isProjectLabel: false },
			{ key: "PRJ-2::base", projectName: "PRJ-2", projectLabel: "Beta", isProjectLabel: true },
			{ key: "PRJ-2::task_type:Phase::0", projectName: "PRJ-2", projectLabel: "Beta", isProjectLabel: false },
		],
		bars: [],
		gates: [],
		milestones: [],
		taskBars: [],
		dataZoom: [],
	});

	const separatorSeries = options.series.find((series) => series.name === "__project-separators__");
	assert.ok(separatorSeries);
	assert.equal(separatorSeries.type, "custom");
	assert.equal(separatorSeries.silent, true);
	assert.deepEqual(
		Array.from(separatorSeries.data, (item) => item.value[0]),
		[0, 3]
	);
});

test("project separator series uses chart time range instead of pixel width for x coordinates", () => {
	const { roadmap } = loadRoadmapScript();

	const series = roadmap.buildProjectSeparatorSeries({
		projectSeparators: [{ value: [3] }],
		gridLineColor: "#334155",
		startValue: "2026-01-01",
		endValue: "2026-12-31",
	});

	const coordCalls = [];
	const graphic = series.renderItem(
		{},
		{
			value(index) {
				return [3][index];
			},
			coord(value) {
				coordCalls.push(value);
				return value[0] === "2026-01-01" ? [10, 40] : [210, 40];
			},
		}
	);

	assert.deepEqual(Array.from(coordCalls, (value) => Array.from(value)), [
		["2026-01-01", 2.5],
		["2026-12-31", 2.5],
	]);
	assert.equal(graphic.shape.x1, 10);
	assert.equal(graphic.shape.x2, 210);
	assert.equal(graphic.style.stroke, "#334155");
});

test("buildChartOptions configures standard ECharts legend entries for roadmap series", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: ["Project A"],
		bars: [{ value: [0, "2026-02-01", "2026-02-28"] }],
		gates: [{ value: ["2026-01-15", 0] }],
		milestones: [{ value: ["2026-01-20", 0.2, "Open"], docType: "Task", docName: "TASK-1" }],
		taskBars: [
			{
				value: [1, "2026-04-04", "2026-04-10", "Sprint A", "Working", "Sprint", "#2563eb"],
			},
			{
				value: [2, "2026-04-05", "2026-04-16", "Phase A", "Open", "Phase", "#7c3aed"],
			},
		],
		dataZoom: [],
	});

	assert.deepEqual(
		Array.from(options.legend.data, (item) => item.name || item),
		["Stages", "Gate checkpoints", "Milestones", "Sprint", "Phase"]
	);
	assert.match(options.legend.data[0].icon, /^path:\/\//);
	assert.equal(options.legend.data[1].icon, "diamond");
	assert.equal(options.legend.data[2].icon, "diamond");
	assert.match(options.legend.data[3].icon, /^path:\/\//);
	assert.match(options.legend.data[4].icon, /^path:\/\//);
});

test("buildChartOptions splits task bars into separate custom series per task type", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: ["Project A"],
		bars: [{ value: [0, "2026-02-01", "2026-02-28"] }],
		gates: [{ value: ["2026-01-15", 0] }],
		milestones: [{ value: ["2026-01-20", 0.2, "Open"], docType: "Task", docName: "TASK-1" }],
		taskBars: [
			{ value: [0.3, "2026-01-21", "2026-01-29", "Sprint A", "Working", "Sprint", "#2563eb"], docType: "Task" },
			{ value: [0.4, "2026-01-22", "2026-01-30", "Sprint B", "Working", "Sprint", "#2563eb"], docType: "Task" },
			{ value: [0.5, "2026-01-25", "2026-02-05", "Phase A", "Open", "Phase", "#7c3aed"], docType: "Task" },
		],
		dataZoom: [],
	});

	const taskSeries = options.series.filter((series) => series.type === "custom" && ["Sprint", "Phase"].includes(series.name));
	assert.equal(taskSeries.length, 2);
	assert.deepEqual(
		Array.from(taskSeries, (series) => [series.name, series.data.length]),
		[
			["Sprint", 2],
			["Phase", 1],
		]
	);
	assert.equal(taskSeries[0].itemStyle.color, "#2563eb");
	assert.equal(taskSeries[1].itemStyle.color, "#7c3aed");
});

test("buildChartOptions keeps checkpoint diamonds at preferred size when it fits stage height", () => {
	const { roadmap } = loadRoadmapScript();

	const categories = new Array(8).fill(null).map((_, index) => `Project ${index + 1}`);
	const options = roadmap.buildChartOptions({
		categories,
		bars: [],
		gates: [],
		dataZoom: [],
	});

	assert.equal(options.series[1].symbolSize, 22);
});

test("buildChartOptions grows checkpoint diamonds to at least thirty percent of stage height", () => {
	const { roadmap } = loadRoadmapScript();

	const categories = ["Project A", "Project B"];
	const options = roadmap.buildChartOptions({
		categories,
		bars: [],
		gates: [],
		dataZoom: [],
	});
	const chartHeight = roadmap.calculateChartHeight(categories);
	const estimatedStageHeight = roadmap.estimateStageBarHeight(
		categories,
		chartHeight,
		{ top: 44, bottom: 44 },
		1
	);

	assert.equal(
		options.series[1].symbolSize,
		estimatedStageHeight * roadmap.ROADMAP_CHECKPOINT_MIN_STAGE_HEIGHT_RATIO
	);
	assert.equal(roadmap.ROADMAP_CHECKPOINT_MIN_STAGE_HEIGHT_RATIO, 0.3);
	assert.equal(roadmap.getCheckpointDiamondSize(100, 10), 30);
});

test("gate checkpoint renderItem sizes diamonds from the current stage arrow height", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: ["Project A"],
		bars: [],
		gates: [{ value: ["2026-01-15", 0], itemStyle: { color: "#739b7f" } }],
		dataZoom: [],
	});
	const gateSeries = options.series.find((series) => series.name === "Gate checkpoints");
	const graphic = gateSeries.renderItem(
		{},
		{
			value(index) {
				return ["2026-01-15", 0][index];
			},
			coord() {
				return [50, 40];
			},
			size() {
				return [0, 200];
			},
			style() {
				return { fill: "#739b7f", stroke: "#ffffff", lineWidth: 2 };
			},
		}
	);
	const points = graphic.shape.points;
	const ys = points.map((point) => point[1]);

	assert.equal(gateSeries.type, "custom");
	assert.equal(gateSeries.clip, true);
	assert.equal(Math.max(...ys) - Math.min(...ys), 30);
});

test("buildChartOptions caps checkpoint diamonds at two thirds of stage height", () => {
	const { roadmap } = loadRoadmapScript();

	const categories = new Array(24).fill(null).map((_, index) => `Project ${index + 1}`);
	const options = roadmap.buildChartOptions({
		categories,
		bars: [],
		gates: [],
		dataZoom: [],
	});
	const chartHeight = roadmap.calculateChartHeight(categories);
	const estimatedStageHeight = roadmap.estimateStageBarHeight(
		categories,
		chartHeight,
		{ top: 44, bottom: 44 },
		1
	);

	assert.equal(
		options.series[1].symbolSize,
		estimatedStageHeight * roadmap.ROADMAP_CHECKPOINT_MAX_STAGE_HEIGHT_RATIO
	);
});

test("buildChartOptions can force month-year labels for wide horizontal ranges", () => {
	const { roadmap } = loadRoadmapScript({
		Jan: "янв",
	});

	const options = roadmap.buildChartOptions({
		categories: ["Project A"],
		bars: [],
		gates: [],
		dataZoom: [],
		monthOnlyXAxisLabels: true,
	});

	assert.equal(options.xAxis.axisLabel.formatter("2026-01-01"), "янв 2026");
	assert.equal(options.xAxis.axisLabel.formatter("2026-01-15"), "янв 2026");
});

test("buildSequentialIntroAnimationDelays orders stages and gates left to right", () => {
	const { roadmap } = loadRoadmapScript();

	const delays = roadmap.buildSequentialIntroAnimationDelays({
		bars: [
			{ value: [0, "2026-02-01", "2026-02-28"] },
			{ value: [0, "2026-03-01", "2026-03-15"] },
		],
		gates: [{ value: ["2026-01-15", 0] }, { value: ["2026-04-01", 0] }],
	});

	assert.deepEqual(Array.from(delays.barDelays), [
		0,
		roadmap.ROADMAP_STAGE_INTRO_ANIMATION_MAX_SPREAD_MS,
	]);
	assert.deepEqual(Array.from(delays.gateDelays), [
		0,
		roadmap.ROADMAP_GATE_INTRO_ANIMATION_MAX_SPREAD_MS,
	]);
});

test("buildSequentialIntroAnimationDelays keeps stable order for identical and invalid dates", () => {
	const { roadmap } = loadRoadmapScript();

	const delays = roadmap.buildSequentialIntroAnimationDelays({
		bars: [
			{ value: [0, "2026-02-01", "2026-02-28"] },
			{ value: [0, "invalid-date", "2026-03-15"] },
		],
		gates: [{ value: ["2026-02-01", 0] }, { value: ["invalid-date", 0] }],
	});

	assert.deepEqual(Array.from(delays.barDelays), [
		0,
		roadmap.ROADMAP_STAGE_INTRO_ANIMATION_MAX_SPREAD_MS,
	]);
	assert.deepEqual(Array.from(delays.gateDelays), [
		0,
		roadmap.ROADMAP_GATE_INTRO_ANIMATION_MAX_SPREAD_MS,
	]);
});

test("buildSequentialIntroAnimationDelays keeps checkpoint cascade within a short max spread", () => {
	const { roadmap } = loadRoadmapScript();

	const delays = roadmap.buildSequentialIntroAnimationDelays({
		bars: [],
		gates: new Array(8).fill(null).map((_, index) => ({
			value: [`2026-01-${String(index + 1).padStart(2, "0")}`, 0],
		})),
	});

	assert.equal(delays.gateDelays[0], 0);
	assert.ok(
		delays.gateDelays[delays.gateDelays.length - 1] <=
			roadmap.ROADMAP_GATE_INTRO_ANIMATION_MAX_SPREAD_MS
	);
});

test("buildSequentialIntroAnimationDelays returns empty delay lists for empty data", () => {
	const { roadmap } = loadRoadmapScript();

	const delays = roadmap.buildSequentialIntroAnimationDelays({
		bars: [],
		gates: [],
	});

	assert.deepEqual(
		{
			barDelays: Array.from(delays.barDelays),
			gateDelays: Array.from(delays.gateDelays),
		},
		{
			barDelays: [],
			gateDelays: [],
		}
	);
});

test("buildChartOptions adds intro animation config for stages and gates", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: ["Project A"],
		bars: [
			{ value: [0, "2026-02-01", "2026-02-28"] },
			{ value: [0, "2026-03-01", "2026-03-31"] },
		],
		gates: [{ value: ["2026-01-15", 0] }],
		dataZoom: [],
	});

	assert.equal(options.animation, true);
	assert.equal(options.animationDurationUpdate, 0);
	assert.equal(options.series[0].type, "custom");
	assert.equal(options.series[0].animationDuration, roadmap.ROADMAP_INTRO_ANIMATION_DURATION_MS);
	assert.equal(options.series[0].animationDurationUpdate, 0);
	assert.equal(typeof options.series[0].animationDelay, "function");
	assert.equal(options.series[0].animationDelay(0), 0);
	assert.equal(options.series[0].animationDelay(1), roadmap.ROADMAP_STAGE_INTRO_ANIMATION_MAX_SPREAD_MS);
	assert.equal(options.series[1].type, "custom");
	assert.equal(options.series[1].animationDuration, roadmap.ROADMAP_INTRO_ANIMATION_DURATION_MS);
	assert.equal(options.series[1].animationDurationUpdate, 0);
	assert.equal(typeof options.series[1].animationDelay, "function");
	assert.equal(typeof options.series[1].renderItem, "function");
	assert.equal(options.series[1].animationDelay(0), 0);
});

test("buildChartOptions adds series for milestones and task lines", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: ["Project A"],
		bars: [{ value: [0, "2026-02-01", "2026-02-28"] }],
		gates: [{ value: ["2026-01-15", 0] }],
		milestones: [{ value: ["2026-01-20", 0.2, "Open"], docType: "Task", docName: "TASK-1" }],
		taskBars: [
			{ value: [0.3, "2026-01-21", "2026-01-29", "Sprint A", "Open", "Sprint", "#2563eb"], docType: "Task" },
			{ value: [0.4, "2026-01-21", "2026-02-02", "Phase A", "Open", "Phase", "#7c3aed"], docType: "Task" },
		],
		dataZoom: [],
	});

	assert.equal(options.series[2].type, "scatter");
	assert.equal(options.series[2].symbol, "diamond");
	assert.equal(options.series[3].type, "custom");
	assert.equal(options.series[3].name, "Sprint");
	assert.equal(options.series[4].name, "Phase");
	assert.ok(options.series.length >= 5);
});

test("getMilestoneLabelLayout scales labels with compact symbol sizes and keeps them close", () => {
	const { roadmap } = loadRoadmapScript();

	const compactLayout = roadmap.getMilestoneLabelLayout({
		symbolSize: 12,
	});
	const roomyLayout = roadmap.getMilestoneLabelLayout({
		symbolSize: 22,
	});

	assert.ok(
		compactLayout.fontSize < roomyLayout.fontSize,
		"smaller milestone markers should render smaller labels"
	);
	assert.equal(compactLayout.position, "right");
	assert.equal(compactLayout.align, "left");
	assert.equal(compactLayout.verticalAlign, "middle");
	assert.ok(
		compactLayout.distance < 10,
		"milestone label should stay closer to the marker than the old fixed distance"
	);
});

test("prepareSeriesData stores milestone label layout as numeric values on each item", () => {
	const { roadmap } = loadRoadmapScript();

	const { milestones } = roadmap.prepareSeriesData({
		projects: [{ name: "PRJ-1", project_name: "Alpha" }],
		stageBars: [],
		gates: [],
		taskEntities: [
			{
				project: "PRJ-1",
				name: "Compact milestone",
				subject: "Compact milestone",
				entity_kind: "milestone",
				symbolSize: 12,
				point_date: "2026-01-20",
				status: "Open",
			},
		],
	});

	assert.equal(typeof milestones[0].label.fontSize, "number");
	assert.equal(typeof milestones[0].label.distance, "number");
	assert.equal(milestones[0].label.position, "right");
	assert.equal(milestones[0].label.align, "left");
	assert.equal(milestones[0].label.text, "Compact milestone");
	assert.ok(milestones[0].label.fontSize < 11);
	assert.ok(milestones[0].label.distance < 10);
});

test("task custom renderItem uses api style fallback for visible line stroke", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: [{ key: "PRJ-1::task_type:Sprint::0", projectLabel: "Alpha", laneLabel: "Sprint" }],
		bars: [],
		gates: [],
		milestones: [],
		taskBars: [{ value: [0, "2026-01-21", "2026-01-29", "Sprint A"], docType: "Task", name: "Sprint A" }],
		dataZoom: [],
	});

	const graphic = options.series[3].renderItem(
		{
			data: { name: "Sprint A", itemStyle: {} },
			dataIndex: 0,
		},
		{
			value(index) {
				return ["2026-01-21", "2026-01-29", "Sprint A"][index - 1] ?? 0;
			},
			coord([x, y]) {
				return [x === "2026-01-21" ? 10 : 110, y === 0 ? 50 : y];
			},
			size() {
				return [100, 24];
			},
			style() {
				return { color: "#2255cc" };
			},
		}
	);

	assert.equal(graphic.children[0].style.stroke, "#2255cc");
});

test("task custom renderItem prefers task type color over generic api style color", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: [{ key: "PRJ-1::task_type:Sprint::0", projectLabel: "Alpha", laneLabel: "Sprint" }],
		bars: [],
		gates: [],
		milestones: [],
		taskBars: [
			{
				value: [0, "2026-01-21", "2026-01-29", "Sprint A"],
				docType: "Task",
				name: "Sprint A",
				itemStyle: {
					color: "#7c3aed",
					labelColor: "#7c3aed",
				},
			},
		],
		dataZoom: [],
	});

	const graphic = options.series[3].renderItem(
		{
			data: {
				name: "Sprint A",
				itemStyle: {
					color: "#7c3aed",
					labelColor: "#7c3aed",
				},
			},
			dataIndex: 0,
		},
		{
			value(index) {
				return ["2026-01-21", "2026-01-29", "Sprint A"][index - 1] ?? 0;
			},
			coord([x, y]) {
				return [x === "2026-01-21" ? 10 : 110, y === 0 ? 50 : y];
			},
			size() {
				return [100, 24];
			},
			style() {
				return { color: "#2563eb" };
			},
		}
	);

	assert.equal(graphic.children[0].style.stroke, "#7c3aed");
	assert.equal(graphic.children[1].style.fill, "#7c3aed");
});

test("task custom renderItem can recover task type color from value payload when itemStyle is missing", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: [{ key: "PRJ-1::task_type:Phase::0", projectLabel: "Alpha", laneLabel: "Phase" }],
		bars: [],
		gates: [],
		milestones: [],
		taskBars: [{ value: [0, "2026-01-21", "2026-01-29", "Phase A", "Open", "Phase", "#f59e0b"], docType: "Task", name: "Phase A" }],
		dataZoom: [],
	});

	const graphic = options.series[3].renderItem(
		{
			data: {
				name: "Phase A",
				itemStyle: {},
			},
			dataIndex: 0,
		},
		{
			value(index) {
				return [0, "2026-01-21", "2026-01-29", "Phase A", "Open", "Phase", "#f59e0b"][index];
			},
			coord([x, y]) {
				return [x === "2026-01-21" ? 10 : 110, y === 0 ? 50 : y];
			},
			size() {
				return [100, 24];
			},
			style() {
				return { color: "#2563eb" };
			},
		}
	);

	assert.equal(graphic.children[0].style.stroke, "#f59e0b");
	assert.equal(graphic.children[1].style.fill, "#f59e0b");
});

test("task custom renderItem reads progress from series data when params.data is absent", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: [{ key: "PRJ-1::task_type:Sprint::0", projectLabel: "Alpha", laneLabel: "Sprint" }],
		bars: [],
		gates: [],
		milestones: [],
		taskBars: [
			{
				value: [0, "2026-01-21", "2026-01-29", "Sprint A", "Open", "Sprint", "#60a5fa"],
				docType: "Task",
				name: "Sprint A",
				progress: 25,
				hasProgress: true,
				progressLineColor: "#60a5fa",
				itemStyle: {
					color: "#60a5fa",
					labelColor: "#60a5fa",
				},
			},
		],
		dataZoom: [],
	});

	const graphic = options.series[3].renderItem(
		{
			dataIndex: 0,
		},
		{
			value(index) {
				return [0, "2026-01-21", "2026-01-29", "Sprint A", "Open", "Sprint", "#60a5fa"][index];
			},
			coord([x, y]) {
				return [x === "2026-01-21" ? 10 : 110, y === 0 ? 50 : y];
			},
			size() {
				return [100, 24];
			},
			style() {
				return { color: "#2563eb" };
			},
		}
	);

	assert.equal(graphic.children[0].type, "rect");
	assert.equal(graphic.children[1].type, "rect");
	assert.equal(graphic.children[1].shape.width, 25);
	assert.equal(graphic.children[1].style.fill, "#60a5fa");
});

test("buildChartOptions keeps explicit lane rows but hides their axis labels", () => {
	const { roadmap } = loadRoadmapScript();

	const options = roadmap.buildChartOptions({
		categories: [
			{ key: "PRJ-1::base", projectLabel: "Alpha", laneLabel: "Project", isProjectLabel: true },
			{ key: "PRJ-1::milestone", projectLabel: "Alpha", laneLabel: "Milestones", isProjectLabel: false },
		],
		bars: [],
		gates: [],
		milestones: [],
		taskBars: [],
		dataZoom: [],
	});

	assert.equal(options.yAxis.data.length, 2);
	assert.equal(options.yAxis.data[0], "PRJ-1::base");
	assert.equal(options.yAxis.data[1], "PRJ-1::milestone");
	assert.equal(options.yAxis.axisLabel.formatter("PRJ-1::base"), "Alpha");
	assert.equal(options.yAxis.axisLabel.formatter("PRJ-1::milestone"), "");
});

test("getFullHorizontalViewport spans full visible timeline from bars and gates", () => {
	const { roadmap } = loadRoadmapScript();

	const viewport = roadmap.getFullHorizontalViewport({
		bars: [
			{ value: [0, "2026-02-01", "2026-02-28"] },
			{ value: [1, "2026-01-15", "2026-03-15"] },
		],
		gates: [{ value: ["2026-03-20", 0] }],
		fromDate: "2026-01-01",
		toDate: "2026-04-01",
	});

	assert.equal(viewport.startValue, "2026-01-15");
	assert.equal(viewport.endValue, "2026-03-20");
});

test("getFullHorizontalViewport includes milestones and task bars", () => {
	const { roadmap } = loadRoadmapScript();

	const viewport = roadmap.getFullHorizontalViewport({
		bars: [],
		gates: [],
		milestones: [{ value: ["2026-01-08", 0.1] }],
		taskBars: [{ value: [0.2, "2026-01-10", "2026-02-14"] }],
		fromDate: "2026-01-01",
		toDate: "2026-03-01",
	});

	assert.equal(viewport.startValue, "2026-01-08");
	assert.equal(viewport.endValue, "2026-02-14");
});

test("getFullHorizontalViewport falls back to filter range when dataset is empty", () => {
	const { roadmap } = loadRoadmapScript();

	const viewport = roadmap.getFullHorizontalViewport({
		bars: [],
		gates: [],
		fromDate: "2026-01-01",
		toDate: "2026-04-01",
	});

	assert.equal(viewport.startValue, "2026-01-01");
	assert.equal(viewport.endValue, "2026-04-01");
});

test("getFullVerticalViewport expands y-axis to all categories", () => {
	const { roadmap } = loadRoadmapScript();

	const viewport = roadmap.getFullVerticalViewport(["A", "B", "C", "D"]);
	assert.equal(viewport.startValue, 0);
	assert.equal(viewport.endValue, 3);
});

test("buildShowAllDataZoomConfig updates all x and y zoom entries consistently", () => {
	const { roadmap } = loadRoadmapScript();

	const dataZoom = roadmap.buildShowAllDataZoomConfig({
		categories: ["A", "B", "C"],
		bars: [{ value: [0, "2026-01-01", "2026-02-01"] }],
		gates: [{ value: ["2026-03-01", 1] }],
		fromDate: "2025-12-01",
		toDate: "2026-04-01",
	});

	assert.equal(dataZoom.length, 4);
	assert.equal(dataZoom[0].startValue, "2026-01-01");
	assert.equal(dataZoom[1].endValue, "2026-03-01");
	assert.equal(dataZoom[2].startValue, 0);
	assert.equal(dataZoom[3].endValue, 2);
});

test("buildAxisFitDataZoomConfig expands only the horizontal viewport", () => {
	const { roadmap } = loadRoadmapScript();

	const dataZoom = roadmap.buildAxisFitDataZoomConfig({
		axis: "horizontal",
		viewportState: {
			horizontal: {
				startValue: "2026-02-01",
				endValue: "2026-02-20",
			},
			vertical: {
				startValue: 2,
				endValue: 6,
			},
		},
		categories: new Array(10).fill("row"),
		bars: [{ value: [0, "2026-01-01", "2026-03-01"] }],
		gates: [{ value: ["2026-03-15", 0] }],
		fromDate: "2025-12-01",
		toDate: "2026-04-01",
	});

	assert.equal(dataZoom.length, 4);
	assert.equal(dataZoom[0].startValue, "2026-01-01");
	assert.equal(dataZoom[0].endValue, "2026-03-15");
	assert.equal(dataZoom[1].startValue, "2026-01-01");
	assert.equal(dataZoom[1].endValue, "2026-03-15");
	assert.equal(dataZoom[2].startValue, 2);
	assert.equal(dataZoom[2].endValue, 6);
	assert.equal(dataZoom[3].startValue, 2);
	assert.equal(dataZoom[3].endValue, 6);
});

test("buildAxisFitDataZoomConfig expands only the vertical viewport", () => {
	const { roadmap } = loadRoadmapScript();

	const dataZoom = roadmap.buildAxisFitDataZoomConfig({
		axis: "vertical",
		viewportState: {
			horizontal: {
				startValue: "2026-02-01",
				endValue: "2026-02-20",
			},
			vertical: {
				startValue: 2,
				endValue: 6,
			},
		},
		categories: new Array(10).fill("row"),
		bars: [{ value: [0, "2026-01-01", "2026-03-01"] }],
		gates: [{ value: ["2026-03-15", 0] }],
		fromDate: "2025-12-01",
		toDate: "2026-04-01",
	});

	assert.equal(dataZoom.length, 4);
	assert.equal(dataZoom[0].startValue, "2026-02-01");
	assert.equal(dataZoom[0].endValue, "2026-02-20");
	assert.equal(dataZoom[1].startValue, "2026-02-01");
	assert.equal(dataZoom[1].endValue, "2026-02-20");
	assert.equal(dataZoom[2].startValue, 0);
	assert.equal(dataZoom[2].endValue, 9);
	assert.equal(dataZoom[3].startValue, 0);
	assert.equal(dataZoom[3].endValue, 9);
});

test("wrapAxisLabel splits long project names into at most two lines", () => {
	const { roadmap } = loadRoadmapScript();

	const wrapped = roadmap.wrapAxisLabel("Лукойл: Внедрение CRM и Service Desk");
	assert.match(wrapped, /\n/);
	assert.equal(wrapped.split("\n").length, 2);
	assert.ok(wrapped.split("\n")[0].length > 16);

	const shortLabel = roadmap.wrapAxisLabel("Короткое имя");
	assert.equal(shortLabel, "Короткое имя");
});

test("formatXAxisLabel formats numeric timestamps as localized strings", () => {
	const { roadmap } = loadRoadmapScript({
		Jan: "янв",
	});

	assert.equal(roadmap.formatXAxisLabel(Date.UTC(2026, 0, 1)), "янв 2026");
	assert.equal(roadmap.formatXAxisLabel(Date.UTC(2026, 0, 15)), "15 янв");
	assert.equal(roadmap.formatXAxisLabel(Date.UTC(2026, 0, 15), { monthOnly: true }), "янв 2026");
});

test("formatXAxisLabel uses English month source strings that can be translated", () => {
	const { roadmap } = loadRoadmapScript({
		Jan: "janv",
		Feb: "fevr",
	});

	assert.equal(roadmap.chartMonthLabels[0], "Jan");
	assert.equal(roadmap.chartMonthLabels[1], "Feb");
	assert.equal(roadmap.formatXAxisLabel(Date.UTC(2026, 0, 1)), "janv 2026");
	assert.equal(roadmap.formatXAxisLabel(Date.UTC(2026, 1, 15)), "15 fevr");
});

test("shouldUseMonthOnlyXAxisLabels switches to compact month labels for wide ranges", () => {
	const { roadmap } = loadRoadmapScript();

	assert.equal(
		roadmap.shouldUseMonthOnlyXAxisLabels({
			startValue: "2026-01-01",
			endValue: "2026-04-01",
		}),
		true
	);
	assert.equal(
		roadmap.shouldUseMonthOnlyXAxisLabels({
			startValue: "2026-01-01",
			endValue: "2026-01-20",
		}),
		false
	);
});

test("buildStageBarGraphic scales label font size down for shorter visible bars", () => {
	const { roadmap } = loadRoadmapScript();

	const compact = roadmap.buildStageBarGraphic({
		startX: 10,
		endX: 110,
		centerY: 40,
		height: 18,
		label: "Discovery",
		fill: "#abcdef",
		stroke: "#123456",
		lineWidth: 2,
		textColor: "#ffffff",
	});
	const spacious = roadmap.buildStageBarGraphic({
		startX: 10,
		endX: 260,
		centerY: 40,
		height: 18,
		label: "Discovery",
		fill: "#abcdef",
		stroke: "#123456",
		lineWidth: 2,
		textColor: "#ffffff",
	});

	assert.equal(compact.children[1].style.fontSize, 10);
	assert.equal(spacious.children[1].style.fontSize, 12);
});

test("buildStageBarGraphic hides stage text when the visible bar is too narrow", () => {
	const { roadmap } = loadRoadmapScript();

	const graphic = roadmap.buildStageBarGraphic({
		startX: 10,
		endX: 58,
		centerY: 40,
		height: 18,
		label: "Discovery",
		fill: "#abcdef",
		stroke: "#123456",
		lineWidth: 2,
		textColor: "#ffffff",
	});

	assert.equal(graphic.children.length, 1);
});

test("formatTooltip renders stage details without duplicating the stage name", () => {
	const { roadmap } = loadRoadmapScript();

	const tooltip = roadmap.formatTooltip({
		name: "Реализация",
		data: { docType: "Project Stage Instance" },
		value: [0, "2026-01-01", "2026-02-01", "Реализация", "Active"],
	});

	assert.equal(
		tooltip,
		["Реализация", "Active", "2026-01-01 - 2026-02-01"].join("<br>")
	);
});

test("formatTooltip renders task progress for task bars but not milestones", () => {
	const { roadmap } = loadRoadmapScript();

	const taskTooltip = roadmap.formatTooltip({
		name: "Sprint Alpha",
		data: { docType: "Task", entityKind: "task_bar", progress: 35 },
		value: [0, "2026-01-01", "2026-01-10", "Sprint Alpha", "Working", "Sprint"],
	});
	const milestoneTooltip = roadmap.formatTooltip({
		name: "Milestone A",
		data: { docType: "Task", entityKind: "milestone" },
		value: ["2026-01-10", 2, "Open"],
	});

	assert.equal(
		taskTooltip,
		["Sprint Alpha", "Working", "2026-01-01 - 2026-01-10", "Sprint", "35%"].join("<br>")
	);
	assert.equal(milestoneTooltip, ["Milestone A", "Open", "2026-01-10"].join("<br>"));
});

test("prepareSeriesData adds outlined checkpoint styling for contrast", () => {
	const { roadmap } = loadRoadmapScript();

	const { gates } = roadmap.prepareSeriesData({
		projects: [{ name: "PRJ-1", project_name: "Alpha" }],
		stageBars: [],
		gates: [
			{
				name: "PGC-20",
				project: "PRJ-1",
				approval_date: "2026-02-15",
				status: "Approved",
				checkpoint_level: "Gate 1",
			},
		],
	});

	assert.equal(gates[0].itemStyle.borderWidth, 2);
	assert.ok(gates[0].itemStyle.shadowBlur >= 6);
	assert.ok(gates[0].itemStyle.borderColor);
});

test("calculateChartHeight keeps at least 65vh and does not cap tall datasets", () => {
	const { roadmap, context } = loadRoadmapScript();

	assert.equal(roadmap.calculateChartHeight([]), 780);
	assert.equal(roadmap.calculateChartHeight(new Array(6).fill("row")), 780);
	assert.equal(roadmap.calculateChartHeight(new Array(14).fill("row")), 780);

	context.window.innerHeight = 800;
	assert.equal(roadmap.calculateChartHeight([]), 520);
	assert.equal(roadmap.calculateChartHeight(new Array(40).fill("row")), 1170);

	context.window.innerHeight = 500;
	assert.equal(roadmap.calculateChartHeight([]), 420);
});

test("ensureResizeHandler recalculates current chart height and resizes the chart on viewport changes", () => {
	const { roadmap, state, context } = loadRoadmapScript();
	const dom = {
		style: {},
		_dinextRoadmapCategoryCount: 40,
		_dinextRoadmapChart: {
			resizeCalls: 0,
			resize() {
				this.resizeCalls += 1;
			},
		},
	};
	const mount = {
		length: 1,
		get() {
			return dom;
		},
	};
	const report = {
		page: {
			main: {
				find() {
					return mount;
				},
			},
		},
	};

	roadmap.ensureResizeHandler(report);
	roadmap.ensureResizeHandler(report);
	assert.equal(typeof state.windowListeners.resize, "function");

	context.window.innerHeight = 700;
	state.windowListeners.resize();

	assert.equal(dom.style.height, "1170px");
	assert.equal(dom._dinextRoadmapChart.resizeCalls, 1);
});

test("navigateFromChartItem calls set_route when doc present and can_read", () => {
	const { roadmap, state } = loadRoadmapScript();

	roadmap.navigateFromChartItem({
		docType: "Project Stage Instance",
		docName: "PSI-99",
	});

	assert.deepEqual(state.setRouteCalls, [["Form", "Project Stage Instance", "PSI-99"]]);
	assert.equal(state.msgprintCalls.length, 0);
});

test("navigateFromChartItem does nothing when docName missing", () => {
	const { roadmap, state } = loadRoadmapScript();

	roadmap.navigateFromChartItem({ docType: "Project Stage Instance" });
	roadmap.navigateFromChartItem(null);

	assert.equal(state.setRouteCalls.length, 0);
});

test("navigateFromChartItem shows msgprint when can_read is false", () => {
	const { roadmap, state, context } = loadRoadmapScript();
	context.frappe.model.can_read = () => false;

	roadmap.navigateFromChartItem({
		docType: "Project Gate Checkpoint",
		docName: "PGC-1",
	});

	assert.equal(state.setRouteCalls.length, 0);
	assert.equal(state.msgprintCalls.length, 1);
});

test("attachChartClickNavigation registers click and replacing handler does not stack", () => {
	const { roadmap, state } = loadRoadmapScript();

	const chart = {
		offCalls: [],
		onCalls: [],
		off(event, handler) {
			this.offCalls.push({ event, handler });
		},
		on(event, handler) {
			this.onCalls.push({ event, handler });
		},
	};

	roadmap.attachChartClickNavigation(chart);
	roadmap.attachChartClickNavigation(chart);

	assert.equal(chart.onCalls.length, 2);
	assert.equal(chart.onCalls[0].event, "click");
	assert.equal(chart.onCalls[1].event, "click");
	assert.equal(chart.offCalls.length, 2);
	assert.strictEqual(chart.onCalls[0].handler, chart.onCalls[1].handler);

	chart.onCalls[1].handler({ data: { docType: "Project Stage Instance", docName: "PSI-1" } });
	assert.deepEqual(state.setRouteCalls, [["Form", "Project Stage Instance", "PSI-1"]]);
});

test("attachChartClickNavigation opens project form from y-axis label click", () => {
	const { roadmap, state } = loadRoadmapScript();

	const chart = {
		offCalls: [],
		onCalls: [],
		off(event, handler) {
			this.offCalls.push({ event, handler });
		},
		on(event, handler) {
			this.onCalls.push({ event, handler });
		},
	};

	roadmap.attachChartClickNavigation(chart, {
		Alpha: { docType: "Project", docName: "PRJ-1" },
	});

	chart.onCalls[0].handler({ componentType: "yAxis", value: "Alpha" });
	assert.deepEqual(state.setRouteCalls, [["Form", "Project", "PRJ-1"]]);
});

test("attachChartClickNavigation only opens project from base lane click", () => {
	const { roadmap, state } = loadRoadmapScript();

	const chart = {
		offCalls: [],
		onCalls: [],
		off(event, handler) {
			this.offCalls.push({ event, handler });
		},
		on(event, handler) {
			this.onCalls.push({ event, handler });
		},
	};

	roadmap.attachChartClickNavigation(chart, {
		"PRJ-1::base": { docType: "Project", docName: "PRJ-1" },
	});

	chart.onCalls[0].handler({ componentType: "yAxis", value: "PRJ-1::milestone" });
	assert.equal(state.setRouteCalls.length, 0);

	chart.onCalls[0].handler({ componentType: "yAxis", value: "PRJ-1::base" });
	assert.deepEqual(state.setRouteCalls, [["Form", "Project", "PRJ-1"]]);
});
