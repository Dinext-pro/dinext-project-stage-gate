const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadWidgetScript() {
	const script = fs.readFileSync(
		"/home/frappe/frappe-bench/apps/dinext_project_stage_gate/dinext_project_stage_gate/public/js/project_stage_gate_project.js",
		"utf8"
	);

	const state = {
		prependCount: 0,
		callCount: 0,
		lastHtml: "",
		setRouteCalls: [],
	};
	let page;

	class FakeWidget {
		constructor() {
			this.length = 1;
			this.removed = false;
		}

		html(value) {
			state.lastHtml = value;
		}

		find() {
			return { on() {} };
		}

		remove() {
			this.removed = true;
			page.widget = null;
		}
	}

	page = {
		widget: null,
		find(selector) {
			if (selector === ".stage-gate-widget-root") {
				return this.widget ? this.widget : { length: 0 };
			}

			if (selector === ".layout-main-section") {
				return {
					first: () => ({
						prepend: (widget) => {
							state.prependCount += 1;
							this.widget = widget;
						},
					}),
				};
			}

			throw new Error(`Unexpected selector: ${selector}`);
		},
	};

	const context = {
		__,
		console,
		document: {},
		frappe: {
			provide(path) {
				const segments = path.split(".");
				let pointer = context;
				for (const segment of segments) {
					pointer[segment] = pointer[segment] || {};
					pointer = pointer[segment];
				}
			},
			ui: {
				form: {
					on() {},
				},
			},
			model: {
				can_read() {
					return true;
				},
			},
			call: async () => {
				state.callCount += 1;
				return { message: [] };
			},
			require(files, callback) {
				callback(files);
			},
			utils: {
				escape_html(value) {
					return value;
				},
			},
			scrub(value) {
				return String(value).toLowerCase().replace(/\s+/g, "-");
			},
			perm: {
				has_perm() {
					return true;
				},
			},
			set_route(...args) {
				state.setRouteCalls.push(args);
			},
			route_options: null,
		},
		cint(value) {
			return Number.parseInt(value || 0, 10) || 0;
		},
		dinext_project_stage_gate: {},
		$: (value) => {
			if (value === context.document) {
				return { on() {} };
			}
			return new FakeWidget();
		},
	};

	vm.runInNewContext(script, context);

	return {
		page,
		state,
		context,
		project: context.dinext_project_stage_gate.project,
	};
}

function __(value) {
	return (
		{
			Approved: "Одобрено",
			"In Review": "На рассмотрении",
			Pending: "Ожидает решения",
			"Waiting Gate": "Ожидание гейта",
		}[value] || value
	);
}

function toPlainJson(value) {
	return JSON.parse(JSON.stringify(value));
}

test("refresh_widget does not mount or fetch when governance model is missing", async () => {
	const { page, state, project } = loadWidgetScript();

	await project.refresh_widget({
		doc: {
			name: "PROJ-001",
			governance_model: "",
		},
		page: {
			wrapper: page,
		},
		is_new() {
			return false;
		},
	});

	assert.equal(state.prependCount, 0);
	assert.equal(state.callCount, 0);
	assert.equal(page.widget, null);
});

test("refresh_widget removes an existing widget when governance model is cleared", async () => {
	const { page, state, project } = loadWidgetScript();

	page.widget = {
		length: 1,
		removed: false,
		remove() {
			this.removed = true;
			page.widget = null;
		},
	};

	await project.refresh_widget({
		doc: {
			name: "PROJ-001",
			governance_model: null,
		},
		page: {
			wrapper: page,
		},
		is_new() {
			return false;
		},
	});

	assert.equal(state.prependCount, 0);
	assert.equal(state.callCount, 0);
	assert.equal(page.widget, null);
});

test("render_chain removes widget when stage chain is empty", () => {
	const { page, project } = loadWidgetScript();

	page.widget = {
		length: 1,
		removed: false,
		remove() {
			this.removed = true;
			page.widget = null;
		},
	};

	project.render_chain(page.widget, []);

	assert.equal(page.widget, null);
});

test("render_chain translates displayed statuses but preserves raw status class names", () => {
	const { project, state } = loadWidgetScript();
	const widget = {
		length: 1,
		html(value) {
			state.lastHtml = value;
		},
		find() {
			return { on() {} };
		},
	};

	project.render_chain(widget, [
		{
			name: "PSI-001",
			stage: "Discovery",
			stage_name: "Discovery",
			status: "Waiting Gate",
			gate_result: "Approved",
			checkpoints: [
				{
					name: "PGC-001",
					checkpoint_level: "Stage Exit",
					status: "In Review",
				},
			],
		},
		{
			name: "PSI-002",
			stage: "Business Case",
			stage_name: "Business Case",
			status: "Active",
			checkpoints: [],
		},
	]);

	assert.match(state.lastHtml, /stage-gate-status-waiting-gate/);
	assert.match(state.lastHtml, /Ожидание гейта/);
	assert.match(state.lastHtml, /Одобрено/);
	assert.match(state.lastHtml, /Stage Exit: На рассмотрении/);
	assert.match(state.lastHtml, /stage-gate-checkpoint/);
	assert.match(state.lastHtml, /data-checkpoint="PGC-001"/);
});

test("render_chain inserts checkpoint diamonds including after last stage", () => {
	const { project, state } = loadWidgetScript();
	const widget = {
		length: 1,
		html(value) {
			state.lastHtml = value;
		},
		find() {
			return { on() {} };
		},
	};

	project.render_chain(widget, [
		{
			name: "PSI-100",
			stage: "Discovery",
			stage_name: "Discovery",
			status: "Active",
			checkpoints: [
				{ name: "PGC-100", checkpoint_level: "Gate A", status: "Draft" },
				{ name: "PGC-101", checkpoint_level: "Gate B", status: "Approved" },
			],
		},
		{
			name: "PSI-200",
			stage: "Delivery",
			stage_name: "Delivery",
			status: "Planned",
			checkpoints: [{ name: "PGC-200", checkpoint_level: "Final", status: "Draft" }],
		},
	]);

	const checkpoints = state.lastHtml.match(/data-checkpoint="/g) || [];
	assert.equal(checkpoints.length, 3);
	assert.match(state.lastHtml, /data-checkpoint="PGC-100"/);
	assert.match(state.lastHtml, /data-checkpoint="PGC-101"/);
	assert.match(state.lastHtml, /data-checkpoint="PGC-200"/);
});

test("roadmap button opens focused roadmap with project dates and default entity filters", () => {
	const { context, project, state } = loadWidgetScript();
	const addedButtons = [];
	const frm = {
		doc: {
			name: "PROJ-001",
			governance_model: "GM-001",
			stage_chain_version: 3,
			expected_start_date: "2026-01-15",
			expected_end_date: "2026-09-30",
		},
		is_new() {
			return false;
		},
		add_custom_button(label, handler, group) {
			addedButtons.push({ label, handler, group });
		},
	};

	project.add_view_menu_items(frm, [{ name: "PSI-001", checkpoints: [] }]);

	const roadmapButton = addedButtons.find((button) => button.label === "Roadmap");
	assert.ok(roadmapButton, "Expected Roadmap button to be registered");

	roadmapButton.handler();

	assert.deepEqual(toPlainJson(context.frappe.route_options), {
		project: "PROJ-001",
		roadmap_project_focus: 1,
		show_stages_and_checkpoints: 1,
		show_milestones: 1,
		task_types: ["Phase", "Stage", "Sprint"],
		from_date: "2026-01-15",
		to_date: "2026-09-30",
	});
	assert.deepEqual(state.setRouteCalls, [["query-report", "Project Stage Gate Roadmap"]]);
});
