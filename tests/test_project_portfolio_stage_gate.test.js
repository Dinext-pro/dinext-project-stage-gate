const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const HOOKS_PATH = "/home/frappe/frappe-bench/apps/dinext_project_stage_gate/dinext_project_stage_gate/hooks.py";
const SCRIPT_PATH =
	"/home/frappe/frappe-bench/apps/dinext_project_stage_gate/dinext_project_stage_gate/public/js/project_portfolio_stage_gate.js";

function loadPortfolioScript() {
	const script = fs.readFileSync(SCRIPT_PATH, "utf8");
	const state = {
		handlers: {},
		setRouteCalls: [],
		alerts: [],
		msgprints: [],
	};
	const fakeDocument = {
		head: { appendChild() {} },
		body: {
			getAttribute() {
				return null;
			},
			classList: {
				contains() {
					return false;
				},
			},
		},
		querySelector() {
			return null;
		},
		createElement() {
			return {};
		},
		documentElement: {
			classList: {
				contains() {
					return false;
				},
			},
			getAttribute() {
				return null;
			},
		},
	};

	const context = {
		__(value) {
			return value;
		},
		console,
		document: fakeDocument,
		window: {
			DinextAgGrid: {
				async ensure() {},
			},
			agGrid: {
				createGrid(_container, options) {
					state.gridOptions = options;
					return {
						destroy() {},
						refreshCells() {},
						getSelectedRows() {
							return [];
						},
					};
				},
			},
			MutationObserver: class {
				disconnect() {}
				observe() {}
			},
		},
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
					on(doctype, handlers) {
						state.handlers[doctype] = handlers;
					},
				},
			},
			perm: {
				has_perm() {
					return true;
				},
			},
			utils: {
				escape_html(value) {
					return value;
				},
			},
			require(_files, callback) {
				if (callback) {
					callback();
				}
			},
			call: async () => ({ message: { rows: [] } }),
			boot: {},
			set_route(...args) {
				state.setRouteCalls.push(args);
			},
			show_alert(value) {
				state.alerts.push(value);
			},
			msgprint(value) {
				state.msgprints.push(value);
			},
			route_options: null,
		},
		dinext_project_stage_gate: {},
		$: (value) => {
			if (value === fakeDocument) {
				return { on() {} };
			}
			return {
				length: 0,
				find() {
					return this;
				},
				first() {
					return this;
				},
				prepend() {},
				remove() {},
				off() {
					return this;
				},
				on() {
					return this;
				},
				prop() {
					return this;
				},
				text() {
					return this;
				},
				html() {
					return this;
				},
				get() {
					return [null];
				},
			};
		},
	};

	vm.runInNewContext(script, context);

	return {
		state,
		refreshHandler: state.handlers["Project Portfolio"]?.refresh,
		context,
		portfolio: context.dinext_project_stage_gate.portfolio,
	};
}

function makeFormDoc({ name = "PORT-001", isNew = false } = {}) {
	const addedButtons = [];
	return {
		doc: { name },
		fields_dict: {},
		is_new() {
			return isNew;
		},
		add_custom_button(label, handler, group) {
			addedButtons.push({ label, handler, group });
		},
		getAddedButtons() {
			return addedButtons;
		},
	};
}

function makePageWithFallback(state) {
	return {
		find(selector) {
			if (selector === ".layout-main-section") {
				return {
					first() {
						return {
							prepend(node) {
								state.prependedNode = node;
							},
						};
					},
				};
			}
			return {
				length: 0,
				first() {
					return this;
				},
				prepend() {},
			};
		},
	};
}

function makeClassList() {
	const values = new Set();
	return {
		toggle(name, enabled) {
			if (enabled) {
				values.add(name);
			} else {
				values.delete(name);
			}
		},
		contains(name) {
			return values.has(name);
		},
		toArray() {
			return Array.from(values);
		},
	};
}

test("hooks register Project Portfolio doctype_js", () => {
	const hooks = fs.readFileSync(HOOKS_PATH, "utf8");

	assert.match(hooks, /"Project Portfolio": "public\/js\/project_portfolio_stage_gate\.js"/);
});

test("script registers Project Portfolio refresh handler", () => {
	const { refreshHandler } = loadPortfolioScript();

	assert.equal(typeof refreshHandler, "function");
});

test("column definition pins project column on the left", () => {
	const { portfolio } = loadPortfolioScript();
	const columns = portfolio.get_column_defs();

	assert.equal(columns[0].field, "project_name");
	assert.equal(columns[0].pinned, "left");
	assert.equal(columns[0].checkboxSelection, true);
	assert.equal(columns[0].headerCheckboxSelection, true);
	assert.equal(columns[3].headerName, "Status");
	assert.ok(Array.isArray(columns[3].children));
});

test("dark theme detection supports data-theme-mode fallback", () => {
	const { portfolio, context } = loadPortfolioScript();
	context.document.documentElement.getAttribute = (name) =>
		name === "data-theme-mode" ? "dark" : null;

	assert.equal(portfolio.is_dark_theme(), true);
});

test("apply_theme toggles AG Grid dark class on the grid element", () => {
	const { portfolio, context } = loadPortfolioScript();
	const classList = makeClassList();
	const gridElement = { classList };
	const frm = makeFormDoc();
	frm.page = {
		wrapper: {
			find(selector) {
				if (selector === ".portfolio-project-grid") {
					return {
						length: 1,
						get(index) {
							return index === 0 ? gridElement : null;
						},
					};
				}
				return {
					length: 0,
					get() {
						return null;
					},
				};
			},
		},
	};
	context.document.documentElement.getAttribute = (name) =>
		name === "data-theme-mode" ? "dark" : null;

	portfolio.apply_theme(frm);

	assert.equal(classList.contains("ag-theme-quartz-dark"), true);
	assert.equal(classList.contains("ag-theme-quartz"), false);
	assert.equal(classList.contains("portfolio-project-grid-dark"), true);
});

test("grid shell mounts right after Description when field wrapper is available", () => {
	const { portfolio } = loadPortfolioScript();
	const state = {};
	const root = { nodeName: "grid-root" };
	const frm = makeFormDoc();
	const page = makePageWithFallback(state);
	frm.fields_dict.description = {
		$wrapper: {
			length: 1,
			after(node) {
				state.afterNode = node;
			},
		},
	};

	portfolio.insert_shell_after_description(frm, root, page);

	assert.equal(state.afterNode, root);
	assert.equal(state.prependedNode, undefined);
});

test("grid shell falls back to layout main section when Description wrapper is unavailable", () => {
	const { portfolio } = loadPortfolioScript();
	const state = {};
	const root = { nodeName: "grid-root" };
	const frm = makeFormDoc();
	const page = makePageWithFallback(state);

	portfolio.insert_shell_after_description(frm, root, page);

	assert.equal(state.prependedNode, root);
	assert.equal(state.afterNode, undefined);
});

test("saved Project Portfolio form adds roadmap button", () => {
	const { portfolio } = loadPortfolioScript();
	const frm = makeFormDoc();

	portfolio.add_roadmap_button(frm);

	assert.deepEqual(frm.getAddedButtons().map(({ label, group }) => ({ label, group })), [
		{ label: "Projects Stage Roadmap", group: "View" },
	]);
});

test("unsaved Project Portfolio form does not add roadmap button", () => {
	const { portfolio } = loadPortfolioScript();
	const frm = makeFormDoc({ name: null, isNew: true });

	portfolio.add_roadmap_button(frm);

	assert.equal(frm.getAddedButtons().length, 0);
});

test("roadmap button routes to query report with portfolio filter", () => {
	const { portfolio, state, context } = loadPortfolioScript();
	const frm = makeFormDoc({ name: "Портфель 2026" });

	portfolio.add_roadmap_button(frm);

	const [button] = frm.getAddedButtons();
	assert.ok(button, "Expected roadmap button to be registered");

	button.handler();

	assert.equal(context.frappe.route_options.portfolio, "Портфель 2026");
	assert.deepEqual(state.setRouteCalls, [["query-report", "Project Stage Gate Roadmap"]]);
});

test("render_grid uses legacy AG Grid theme mode for CSS class theming", () => {
	const { portfolio, context, state } = loadPortfolioScript();
	const classList = makeClassList();
	const gridElement = { classList, innerHTML: "" };
	const frm = makeFormDoc();
	frm.page = {
		wrapper: {
			find(selector) {
				if (selector === ".portfolio-project-grid") {
					return {
						length: 1,
						get(index) {
							return index === 0 ? gridElement : null;
						},
					};
				}
				return {
					length: 0,
					get() {
						return null;
					},
				};
			},
		},
	};
	context.document.documentElement.getAttribute = (name) =>
		name === "data-theme" ? "dark" : null;

	portfolio.render_grid(frm, gridElement, [{ project_name: "Alpha" }]);

	assert.equal(state.gridOptions?.theme, "legacy");
	assert.equal(classList.contains("ag-theme-quartz-dark"), true);
	assert.equal(classList.contains("ag-theme-quartz"), false);
});

test("project option formatter includes project type and customer", () => {
	const { portfolio } = loadPortfolioScript();

	assert.equal(
		portfolio.format_project_option({
			name: "PROJ-001",
			project_name: "Alpha",
			project_type: "Implementation",
			customer: "Dinext",
		}),
		"Alpha / Implementation / Dinext"
	);
});
