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
		requestAnimationFrame(callback) {
			callback();
		},
		window: {
			DinextAgGrid: {
				async ensure() {},
			},
			agGrid: {
				createGrid(_container, options) {
					state.gridOptions = options;
					const api = {
						destroy() {},
						refreshCells() {},
						getSelectedRows() {
							return [];
						},
					};
					if (typeof options.onGridReady === "function") {
						options.onGridReady({ api });
					}
					return api;
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
	assert.equal(columns[0].minWidth, 180);
	assert.equal(columns[0].maxWidth, 320);
	assert.equal(columns[3].headerName, "Status");
	assert.ok(Array.isArray(columns[3].children));
});

test("leaf columns expose bounded width tiers", () => {
	const { portfolio } = loadPortfolioScript();
	const leaves = portfolio.collect_leaf_column_defs(portfolio.get_column_defs());
	const byField = Object.fromEntries(leaves.map((colDef) => [colDef.field, colDef]));

	assert.equal(byField.project_name.maxWidth, 320);
	assert.equal(byField.status_overall.maxWidth, 115);
	assert.equal(byField.expected_start_date.maxWidth, 118);
	assert.equal(byField.work_plan_percent.maxWidth, 108);
	assert.equal(byField.pl_plan_total.maxWidth, 152);
	assert.equal(byField.nearest_milestone_subject.maxWidth, 280);
});

test("autosize_grid_columns clamps measured widths to column bounds", () => {
	const { portfolio } = loadPortfolioScript();
	const updates = [];
	const api = {
		getColumns() {
			return [
				{
					getColId() {
						return "project_name";
					},
					getColDef() {
						return { minWidth: 180, maxWidth: 320 };
					},
					getActualWidth() {
						return 400;
					},
				},
				{
					getColId() {
						return "status_overall";
					},
					getColDef() {
						return { minWidth: 88, maxWidth: 115 };
					},
					getActualWidth() {
						return 70;
					},
				},
			];
		},
		autoSizeColumns({ columns }) {
			assert.deepEqual(columns, ["project_name", "status_overall"]);
		},
		setColumnWidths(nextWidths) {
			updates.push(...nextWidths);
		},
	};

	portfolio.autosize_grid_columns(api);

	assert.equal(updates.length, 2);
	assert.equal(updates[0].key, "project_name");
	assert.equal(updates[0].newWidth, 320);
	assert.equal(updates[1].key, "status_overall");
	assert.equal(updates[1].newWidth, 88);
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
	assert.equal(typeof state.gridOptions?.onFirstDataRendered, "function");
	assert.equal(typeof state.gridOptions?.onGridReady, "function");
	assert.equal(state.gridOptions?.defaultColDef?.resizable, true);
	assert.equal(classList.contains("ag-theme-quartz-dark"), true);
	assert.equal(classList.contains("ag-theme-quartz"), false);
});

test("open_project_form routes to Project form when row has project id", () => {
	const { portfolio, state } = loadPortfolioScript();

	portfolio.open_project_form({ project: "PROJ-001", project_name: "Alpha" });

	assert.deepEqual(state.setRouteCalls, [["Form", "Project", "PROJ-001"]]);
});

test("open_project_form ignores rows without project id", () => {
	const { portfolio, state } = loadPortfolioScript();

	portfolio.open_project_form({ project_name: "Alpha" });

	assert.equal(state.setRouteCalls.length, 0);
});

test("render_grid onRowDoubleClicked opens Project form", () => {
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

	portfolio.render_grid(frm, gridElement, [{ project: "PROJ-001", project_name: "Alpha" }]);

	assert.equal(typeof state.gridOptions?.onRowDoubleClicked, "function");

	state.gridOptions.onRowDoubleClicked({ data: { project: "PROJ-001" } });

	assert.deepEqual(state.setRouteCalls, [["Form", "Project", "PROJ-001"]]);
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
