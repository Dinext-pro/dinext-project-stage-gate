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
