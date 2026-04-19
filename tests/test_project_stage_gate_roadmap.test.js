const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const ROADMAP_SCRIPT_PATH =
	"/home/frappe/frappe-bench/apps/dinext_project_stage_gate/dinext_project_stage_gate/dinext_project_stage_gate/report/project_stage_gate_roadmap/project_stage_gate_roadmap.js";

function loadRoadmapScript() {
	const script = fs.readFileSync(ROADMAP_SCRIPT_PATH, "utf8");

	const state = {
		setRouteCalls: [],
		msgprintCalls: [],
	};

	const context = {
		__(value) {
			return value;
		},
		console,
		document: {
			documentElement: {
				getAttribute() {
					return null;
				},
			},
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

test("buildStageBarChevronPoints uses larger tip on wide bars than old fixed 14px cap", () => {
	const { roadmap } = loadRoadmapScript();
	const pts = roadmap.buildStageBarChevronPoints(0, 800, 40, 16);
	const x0 = pts[0][0];
	const x1 = pts[2][0];
	const tipDepth = x1 - pts[1][0];
	assert.equal(x0, 0);
	assert.equal(x1, 800);
	assert.ok(tipDepth > 14, "wide bar should get a deeper chevron than legacy MAX_INSET 14");
	assert.ok(tipDepth <= 28, "tip should respect ABS_MAX_TIP");
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

test("prepareSeriesData uses stage display name and explicit stage color when provided", () => {
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
				status: "Active",
				sequence: 1,
				planned_start_date: "2026-02-01",
				planned_end_date: "2026-02-28",
			},
		],
		gates: [],
	});

	assert.equal(bars[0].name, "Discovery");
	assert.equal(bars[0].value[3], "Discovery");
	assert.equal(bars[0].itemStyle.color, "#abcdef");
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
