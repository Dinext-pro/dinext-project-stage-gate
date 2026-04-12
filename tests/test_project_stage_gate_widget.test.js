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
			set_route() {},
		},
		dinext_project_stage_gate: {},
		$: () => new FakeWidget(),
	};

	vm.runInNewContext(script, context);

	return {
		page,
		state,
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
					checkpoint_level: "Stage Exit",
					status: "In Review",
				},
			],
		},
	]);

	assert.match(state.lastHtml, /stage-gate-status-waiting-gate/);
	assert.match(state.lastHtml, /Ожидание гейта/);
	assert.match(state.lastHtml, /Одобрено/);
	assert.match(state.lastHtml, /Stage Exit: На рассмотрении/);
});
