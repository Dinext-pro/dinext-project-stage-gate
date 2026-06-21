const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const HOOKS_PATH = "/home/frappe/frappe-bench/apps/dinext_project_stage_gate/dinext_project_stage_gate/hooks.py";
const SCRIPT_PATH =
	"/home/frappe/frappe-bench/apps/dinext_project_stage_gate/dinext_project_stage_gate/public/js/project_portfolio_stage_gate.js";
const PALETTE_PATH =
	"/home/frappe/frappe-bench/apps/dinext_project_stage_gate/dinext_project_stage_gate/public/js/stage_gate_status_palette.js";

function loadPortfolioScript() {
	const paletteScript = fs.readFileSync(PALETTE_PATH, "utf8");
	const script = fs.readFileSync(SCRIPT_PATH, "utf8");
	const state = {
		handlers: {},
		setRouteCalls: [],
		alerts: [],
		msgprints: [],
		dbGetListCalls: [],
		bootVersions: {},
		allowedReports: {
			"Project Stage Gate Roadmap": {},
			"Project Budget Plan vs Forecast": {},
			"Profit and Loss Statement": {},
		},
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
				has_perm(doctype) {
					return Boolean(state.allowedReports[doctype]);
				},
			},
			defaults: {
				get_user_default(key) {
					if (key === "Company") {
						return "Test Company";
					}
					return null;
				},
			},
			datetime: {
				year_start() {
					return "2026-01-01";
				},
				year_end() {
					return "2026-12-31";
				},
			},
			db: {
				async get_list(doctype, options) {
					state.dbGetListCalls.push({ doctype, options });
					return state.dbGetListResult || [];
				},
			},
			utils: {
				escape_html(value) {
					return String(value)
						.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")
						.replace(/"/g, "&quot;");
				},
				guess_colour(value) {
					const map = {
						High: "red",
						Medium: "orange",
						Low: "green",
						Open: "orange",
						Completed: "green",
						Cancelled: "red",
					};
					return map[value] || "gray";
				},
				icon(icon_name, size = "sm") {
					return `<svg data-icon="${icon_name}" data-size="${size}"></svg>`;
				},
			},
			get_indicator(doc, doctype) {
				if (doctype === "Project" && doc.status) {
					return [doc.status, context.frappe.utils.guess_colour(doc.status)];
				}
				if (doctype === "Project Stage Instance" && doc.status) {
					const meta = context.frappe.get_meta("Project Stage Instance");
					const state = meta?.states?.find((entry) => entry.title === doc.status);
					if (state?.color) {
						return [doc.status, context.frappe.scrub(state.color, "-")];
					}
				}
				return null;
			},
			get_meta(doctype) {
				if (doctype === "Project Stage Instance") {
					return {
						states: [
							{ title: "Active", color: "Blue" },
							{ title: "Completed", color: "Green" },
							{ title: "Skipped", color: "Gray" },
							{ title: "Canceled", color: "Gray" },
							{ title: "Planned", color: "Gray" },
						],
					};
				}
				return { states: [] };
			},
			scrub(value, separator) {
				return String(value || "")
					.trim()
					.toLowerCase()
					.replace(/\s+/g, separator || "-");
			},
			require(_files, callback) {
				if (callback) {
					callback();
				}
			},
			call: async () => ({ message: { rows: [] } }),
			boot: {
				versions: state.bootVersions,
				user: {
					all_reports: state.allowedReports,
				},
			},
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
			if (typeof value === "string" && value.trim().startsWith("<button")) {
				return makeButtonElement(state);
			}
			if (typeof value === "string" && value.includes("portfolio-project-grid-root")) {
				return makeGridRootElement(state);
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

	vm.runInNewContext(paletteScript, context);
	vm.runInNewContext(script, context);

	return {
		state,
		refreshHandler: state.handlers["Project Portfolio"]?.refresh,
		context,
		portfolio: context.dinext_project_stage_gate.portfolio,
	};
}

function makeProjectsFieldWrapper(state, { gridElement } = {}) {
	return {
		length: 1,
		empty() {
			state.fieldEmptied = true;
			return this;
		},
		find(selector) {
			if (selector === ".portfolio-project-grid") {
				const element = gridElement || state.gridElement;
				if (!element) {
					return { length: 0, get() { return null; } };
				}
				return {
					length: 1,
					get(index) {
						return index === 0 ? element : null;
					},
				};
			}
			if (selector === '[data-action="remove-projects"]') {
				return {
					length: 1,
					prop(_name, value) {
						if (value !== undefined) {
							state.removeDisabled = value;
						}
						return this;
					},
				};
			}
			return { length: 0, get() { return null; } };
		},
	};
}

function attachProjectsField(frm, state, options = {}) {
	frm.fields_dict.custom_portfolio_projects = {
		$wrapper: makeProjectsFieldWrapper(state, options),
	};
}

function makeButtonElement(state) {
	const attrs = {};
	let html = "";
	let disabled = false;
	const element = {
		length: 1,
		attrs,
		attr(name, value) {
			if (value === undefined) {
				return attrs[name];
			}
			attrs[name] = value;
			return element;
		},
		html(value) {
			if (value === undefined) {
				return html;
			}
			html = value;
			return element;
		},
		on(_event, handler) {
			element.clickHandler = handler;
			return element;
		},
		prop(name, value) {
			if (name === "disabled") {
				if (value === undefined) {
					return disabled;
				}
				disabled = value;
			}
			return element;
		},
	};
	state.createdButtons = state.createdButtons || [];
	state.createdButtons.push(element);
	return element;
}

function makeGridRootElement(state) {
	const actionsChildren = [];
	const element = {
		appendTo(wrapper) {
			state.appendedToWrapper = wrapper;
			state.appendedRoot = element;
			return element;
		},
		find(selector) {
			if (selector === ".portfolio-project-grid-actions") {
				return makeActionsContainer(actionsChildren, state);
			}
			if (selector === '[data-action="remove-projects"]') {
				const removeButton = actionsChildren.find(
					(child) => child.attrs?.["data-action"] === "remove-projects"
				);
				return removeButton || { length: 0, prop() { return this; } };
			}
			return {
				length: 1,
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
				get(index) {
					if (selector === ".portfolio-project-grid") {
						return state.gridElement || { classList: makeClassList(), innerHTML: "" };
					}
					return null;
				},
			};
		},
	};
	return element;
}

function makeActionsContainer(children, state) {
	return {
		length: 1,
		append(child) {
			if (typeof child === "string") {
				children.push({ type: "html", value: child });
				if (child.includes("portfolio-project-grid-toolbar-divider")) {
					state.toolbarDividerAppended = true;
				}
				return this;
			}
			children.push({ type: "button", element: child, attrs: child.attrs || {} });
			return this;
		},
		find(selector) {
			if (selector === '[data-action="remove-projects"]') {
				const match = children.find(
					(child) => child.type === "button" && child.attrs["data-action"] === "remove-projects"
				);
				return match?.element || { length: 0, prop() { return this; } };
			}
			return { length: 0, prop() { return this; } };
		},
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

test("labor columns use the requested order and labels", () => {
	const { portfolio } = loadPortfolioScript();
	const laborGroup = portfolio.get_column_defs().find((colDef) => colDef.headerName === "Labor");

	assert.ok(laborGroup);
	assert.equal(
		laborGroup.children.map((colDef) => `${colDef.headerName}:${colDef.field}`).join("|"),
		[
			"Plan Total:labor_plan_total",
			"Plan Today:labor_plan_today",
			"Actual:labor_actual_total",
			"Forecast Total:labor_forecast_total",
		].join("|")
	);
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
	const { portfolio, context, state } = loadPortfolioScript();
	const classList = makeClassList();
	const gridElement = { classList };
	state.gridElement = gridElement;
	const frm = makeFormDoc();
	attachProjectsField(frm, state);
	context.document.documentElement.getAttribute = (name) =>
		name === "data-theme-mode" ? "dark" : null;

	portfolio.apply_theme(frm);

	assert.equal(classList.contains("ag-theme-quartz-dark"), true);
	assert.equal(classList.contains("ag-theme-quartz"), false);
	assert.equal(classList.contains("portfolio-project-grid-dark"), true);
});

test("grid shell mounts into custom_portfolio_projects HTML field", () => {
	const { portfolio, state } = loadPortfolioScript();
	const frm = makeFormDoc();
	attachProjectsField(frm, state);

	const shell = portfolio.ensure_shell(frm);

	assert.equal(state.fieldEmptied, true);
	assert.ok(state.appendedToWrapper);
	assert.ok(state.appendedRoot);
	assert.ok(shell);
	assert.ok(shell.grid);
});

test("ensure_shell returns null when HTML field is missing", () => {
	const { portfolio } = loadPortfolioScript();
	const frm = makeFormDoc();

	assert.equal(portfolio.ensure_shell(frm), null);
});

test("get_projects_field_wrapper returns custom_portfolio_projects wrapper", () => {
	const { portfolio, state } = loadPortfolioScript();
	const frm = makeFormDoc();
	attachProjectsField(frm, state);

	assert.equal(
		portfolio.get_projects_field_wrapper(frm),
		frm.fields_dict.custom_portfolio_projects.$wrapper
	);
});

test("saved Project Portfolio form adds roadmap and P&L buttons to View menu", () => {
	const { portfolio } = loadPortfolioScript();
	const frm = makeFormDoc();

	portfolio.add_view_menu_items(frm);

	assert.deepEqual(
		frm.getAddedButtons().map(({ label, group }) => ({ label, group })),
		[
			{ label: "Projects Stage Roadmap", group: "View" },
			{ label: "Profit and Loss Statement", group: "View" },
		]
	);
});

test("unsaved Project Portfolio form does not add View menu items", () => {
	const { portfolio } = loadPortfolioScript();
	const frm = makeFormDoc({ name: null, isNew: true });

	portfolio.add_view_menu_items(frm);

	assert.equal(frm.getAddedButtons().length, 0);
});

test("get_view_actions returns roadmap and P&L actions for saved portfolio", () => {
	const { portfolio } = loadPortfolioScript();
	const frm = makeFormDoc({ name: "PORT-001" });

	const actions = portfolio.get_view_actions(frm);

	assert.equal(actions.length, 2);
	assert.equal(actions[0].label, "Projects Stage Roadmap");
	assert.equal(actions[0].icon, "es-line-reports");
	assert.equal(actions[1].label, "Profit and Loss Statement");
	assert.equal(actions[1].icon, "es-line-chart");
});

test("is_projects_pl_installed detects dinext_projects_pl from boot.versions", () => {
	const { portfolio, state } = loadPortfolioScript();

	assert.equal(portfolio.is_projects_pl_installed(), false);

	state.bootVersions.dinext_projects_pl = "0.0.1";
	assert.equal(portfolio.is_projects_pl_installed(), true);
});

test("get_view_actions returns budget report when dinext_projects_pl is installed", () => {
	const { portfolio, state } = loadPortfolioScript();
	state.bootVersions.dinext_projects_pl = "0.0.1";
	const frm = makeFormDoc({ name: "PORT-001" });

	const actions = portfolio.get_view_actions(frm);

	assert.equal(actions.length, 2);
	assert.equal(actions[1].label, "Consolidated P&L by Projects");
	assert.equal(actions[1].icon, "es-line-chart");
});

test("get_view_actions omits roadmap without report access but keeps P&L action", () => {
	const { portfolio, state } = loadPortfolioScript();
	const frm = makeFormDoc({ name: "PORT-001" });
	delete state.allowedReports["Project Stage Gate Roadmap"];

	const actions = portfolio.get_view_actions(frm);

	assert.equal(actions.length, 1);
	assert.equal(actions[0].label, "Profit and Loss Statement");
});

test("make_toolbar_button renders icon and standard grid footer classes", () => {
	const { portfolio, state } = loadPortfolioScript();

	const button = portfolio.make_toolbar_button({
		label: "Add",
		icon: "es-line-add",
		btn_type: "secondary",
		data_action: "add-projects",
		click() {},
	});

	assert.match(button.html(), /data-icon="es-line-add"/);
	assert.match(button.html(), /Add/);
	assert.equal(button.attr("data-action"), "add-projects");
	assert.equal(state.createdButtons.length, 1);
});

test("roadmap button routes to query report with portfolio filter", () => {
	const { portfolio, state, context } = loadPortfolioScript();
	const frm = makeFormDoc({ name: "Портфель 2026" });

	portfolio.add_view_menu_items(frm);

	const [button] = frm.getAddedButtons();
	assert.ok(button, "Expected roadmap button to be registered");

	button.handler();

	assert.equal(context.frappe.route_options.portfolio, "Портфель 2026");
	assert.deepEqual(state.setRouteCalls, [["query-report", "Project Stage Gate Roadmap"]]);
});

test("open_project_budget_plan_vs_forecast routes with portfolio filter", () => {
	const { portfolio, state, context } = loadPortfolioScript();
	const frm = makeFormDoc({ name: "PORT-001" });

	portfolio.open_project_budget_plan_vs_forecast(frm);

	assert.equal(context.frappe.route_options.project_portfolio, "PORT-001");
	assert.equal(context.frappe.route_options.company, "Test Company");
	assert.equal(context.frappe.route_options.from_month, "1");
	assert.equal(context.frappe.route_options.to_month, "12");
	assert.deepEqual(state.setRouteCalls, [["query-report", "Project Budget Plan vs Forecast"]]);
});

test("open_profit_and_loss_statement loads portfolio projects and routes to P&L", async () => {
	const { portfolio, state, context } = loadPortfolioScript();
	state.dbGetListResult = [{ name: "PROJ-001" }, { name: "PROJ-002" }];
	const frm = makeFormDoc({ name: "PORT-001" });

	await portfolio.open_profit_and_loss_statement(frm);

	assert.equal(state.dbGetListCalls.length, 1);
	assert.equal(state.dbGetListCalls[0].doctype, "Project");
	assert.equal(
		state.dbGetListCalls[0].options.filters.custom_project_portfolio,
		"PORT-001"
	);
	assert.equal(state.dbGetListCalls[0].options.fields[0], "name");
	assert.equal(state.dbGetListCalls[0].options.limit, 0);
	assert.equal(context.frappe.route_options.project.length, 2);
	assert.equal(context.frappe.route_options.project[0], "PROJ-001");
	assert.equal(context.frappe.route_options.project[1], "PROJ-002");
	assert.equal(context.frappe.route_options.company, "Test Company");
	assert.equal(context.frappe.route_options.filter_based_on, "Date Range");
	assert.equal(context.frappe.route_options.period_start_date, "2026-01-01");
	assert.equal(context.frappe.route_options.period_end_date, "2026-12-31");
	assert.deepEqual(state.setRouteCalls, [["query-report", "Profit and Loss Statement"]]);
});

test("mount_toolbar_view_buttons adds divider and view action buttons", () => {
	const { portfolio, state } = loadPortfolioScript();
	const frm = makeFormDoc({ name: "PORT-001" });
	const container = makeActionsContainer([], state);

	portfolio.mount_toolbar_view_buttons(frm, container);

	assert.equal(state.toolbarDividerAppended, true);
	assert.equal(state.createdButtons.length, 2);
	assert.match(state.createdButtons[0].html(), /data-icon="es-line-reports"/);
	assert.match(state.createdButtons[0].html(), /Projects Stage Roadmap/);
	assert.match(state.createdButtons[1].html(), /data-icon="es-line-chart"/);
	assert.match(state.createdButtons[1].html(), /Profit and Loss Statement/);
});

test("mount_toolbar_view_buttons roadmap click routes to report", () => {
	const { portfolio, state, context } = loadPortfolioScript();
	const frm = makeFormDoc({ name: "PORT-001" });
	const container = makeActionsContainer([], state);

	portfolio.mount_toolbar_view_buttons(frm, container);

	state.createdButtons[0].clickHandler();

	assert.equal(context.frappe.route_options.portfolio, "PORT-001");
	assert.deepEqual(state.setRouteCalls, [["query-report", "Project Stage Gate Roadmap"]]);
});

test("ensure_shell mounts toolbar buttons with icons via make_toolbar_button", () => {
	const { portfolio, state } = loadPortfolioScript();
	const frm = makeFormDoc();
	attachProjectsField(frm, state);

	portfolio.ensure_shell(frm);

	assert.equal(state.createdButtons.length, 4);
	assert.match(state.createdButtons[0].html(), /data-icon="es-line-add"/);
	assert.match(state.createdButtons[1].html(), /data-icon="es-line-delete"/);
	assert.equal(state.toolbarDividerAppended, true);
	assert.match(state.createdButtons[2].html(), /data-icon="es-line-reports"/);
	assert.match(state.createdButtons[3].html(), /data-icon="es-line-chart"/);
	assert.match(state.createdButtons[3].html(), /Profit and Loss Statement/);
});

test("render_grid uses legacy AG Grid theme mode for CSS class theming", () => {
	const { portfolio, context, state } = loadPortfolioScript();
	const classList = makeClassList();
	const gridElement = { classList, innerHTML: "" };
	state.gridElement = gridElement;
	const frm = makeFormDoc();
	attachProjectsField(frm, state);
	context.document.documentElement.getAttribute = (name) =>
		name === "data-theme" ? "dark" : null;

	portfolio.render_grid(frm, gridElement, [{ project_name: "Alpha" }]);

	assert.equal(state.gridOptions?.theme, "legacy");
	assert.equal(state.gridOptions?.rowSelection?.mode, "multiRow");
	assert.equal(state.gridOptions?.rowSelection?.enableClickSelection, false);
	assert.equal(state.gridOptions?.rowSelection?.checkboxes, true);
	assert.equal(state.gridOptions?.rowSelection?.headerCheckbox, true);
	assert.equal(state.gridOptions?.selectionColumnDef?.pinned, "left");
	assert.equal(state.gridOptions?.selectionColumnDef?.lockPosition, "left");
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
	const { portfolio, state } = loadPortfolioScript();
	const classList = makeClassList();
	const gridElement = { classList, innerHTML: "" };
	state.gridElement = gridElement;
	const frm = makeFormDoc();
	attachProjectsField(frm, state);

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

test("render_indicator_pill escapes label text", () => {
	const { portfolio } = loadPortfolioScript();

	const html = portfolio.render_indicator_pill('<script>', "green");

	assert.match(html, /indicator-pill green/);
	assert.match(html, /&lt;script&gt;/);
	assert.doesNotMatch(html, /<script>/);
});

test("resolve_project_status_pill uses frappe.get_indicator", () => {
	const { portfolio } = loadPortfolioScript();
	const resolved = portfolio.resolve_project_status_pill("Open");

	assert.equal(resolved.label, "Open");
	assert.equal(resolved.colorClass, "orange");
});

test("resolve_priority_pill uses system guess_colour", () => {
	const { portfolio } = loadPortfolioScript();
	const resolved = portfolio.resolve_priority_pill("High");

	assert.equal(resolved.label, "High");
	assert.equal(resolved.colorClass, "red");
});

test("resolve_stage_status_pill prefers Project Stage Instance meta colors", () => {
	const { portfolio } = loadPortfolioScript();

	assert.equal(portfolio.resolve_stage_status_pill("Active").colorClass, "blue");
	assert.equal(portfolio.resolve_stage_status_pill("Completed").colorClass, "green");
});

test("resolve_stage_status_pill falls back to roadmap palette for uncovered statuses", () => {
	const { portfolio } = loadPortfolioScript();

	const resolved = portfolio.resolve_stage_status_pill("Waiting Gate");

	assert.equal(resolved.colorClass, undefined);
	assert.equal(resolved.background, "#8f9aa8");
	assert.equal(resolved.color, "#ffffff");
});

test("render_active_stage_cell colors pill from stage_gate_status", () => {
	const { portfolio } = loadPortfolioScript();

	const html = portfolio.render_active_stage_cell({
		data: {
			active_stage: "Discovery",
			stage_gate_status: "Active",
		},
	});

	assert.match(html, /Discovery/);
	assert.match(html, /indicator-pill blue/);
});

test("overall status priority and active stage use pill renderers; rag columns stay plain", () => {
	const { portfolio } = loadPortfolioScript();
	const leaves = portfolio.collect_leaf_column_defs(portfolio.get_column_defs());
	const byField = Object.fromEntries(leaves.map((colDef) => [colDef.field, colDef]));

	assert.equal(typeof byField.status_overall.cellRenderer, "function");
	assert.equal(typeof byField.priority.cellRenderer, "function");
	assert.equal(typeof byField.active_stage.cellRenderer, "function");
	assert.equal(byField.status_schedule.cellRenderer, undefined);
	assert.equal(byField.status_budget.cellRenderer, undefined);
	assert.equal(byField.status_resources.cellRenderer, undefined);
	assert.equal(byField.status_risks.cellRenderer, undefined);
	assert.equal(byField.status_schedule.valueFormatter, portfolio.format_rag_status_value);
});

test("format_rag_status_value returns plain text", () => {
	const { portfolio } = loadPortfolioScript();

	assert.equal(portfolio.format_rag_status_value({ value: "🟢 В норме" }), "🟢 В норме");
	assert.equal(portfolio.format_rag_status_value({ value: null }), "");
	assert.equal(portfolio.format_rag_status_value({ value: "" }), "");
});

test("format_currency_value returns plain currency text without html wrapper", () => {
	const { portfolio, context } = loadPortfolioScript();
	const captured = [];
	context.frappe.format = (value, df, options) => {
		captured.push({ df, options });
		if (options?.only_value) {
			return `RUB ${value}`;
		}

		return `<div style='text-align: right'>RUB ${value}</div>`;
	};

	const formatted = portfolio.format_currency_value({ value: 1234.5 });

	assert.equal(formatted, "RUB 1234.5");
	assert.equal(captured[0]?.options?.only_value, true);
	assert.equal(captured[0]?.df?.fieldtype, "Currency");
	assert.equal(formatted.includes("<div"), false);
	assert.equal(portfolio.format_currency_value({ value: null }), "");
	assert.equal(portfolio.format_currency_value({ value: "" }), "");
});

test("render_project_status_cell renders colored pill for overall status", () => {
	const { portfolio } = loadPortfolioScript();

	const html = portfolio.render_project_status_cell({ value: "Open" });

	assert.match(html, /indicator-pill orange/);
	assert.match(html, /Open/);
});

test("nearest open milestone group exposes expected children", () => {
	const { portfolio } = loadPortfolioScript();
	const milestoneGroup = portfolio
		.get_column_defs()
		.find((colDef) => colDef.headerName === "Nearest Open Milestone");

	assert.ok(milestoneGroup);
	assert.equal(
		milestoneGroup.children.map((colDef) => `${colDef.headerName}:${colDef.field}`).join("|"),
		"Milestone:nearest_milestone_subject|Forecast Date:nearest_milestone_date"
	);
});

test("centered columns expose portfolio-project-grid-cell-center class", () => {
	const { portfolio } = loadPortfolioScript();
	const leaves = portfolio.collect_leaf_column_defs(portfolio.get_column_defs());
	const byField = Object.fromEntries(leaves.map((colDef) => [colDef.field, colDef]));
	const centeredFields = [
		"project_type",
		"priority",
		"status_overall",
		"active_stage",
		"expected_start_date",
		"expected_end_date",
		"progress_current_percent",
		"work_plan_percent",
		"work_actual_percent",
		"labor_plan_total",
		"labor_actual_total",
		"labor_forecast_total",
		"labor_plan_today",
		"pl_plan_total",
		"pl_actual_total",
		"pl_forecast_total",
		"pl_plan_today",
		"nearest_milestone_date",
	];

	for (const field of centeredFields) {
		assert.equal(
			byField[field].cellClass,
			"portfolio-project-grid-cell-center",
			`Expected ${field} to be centered`
		);
	}

	assert.notEqual(byField.customer.cellClass, "portfolio-project-grid-cell-center");
	assert.notEqual(byField.status_schedule.cellClass, "portfolio-project-grid-cell-center");
});

test("resolve_stage_status_pill switches palette when theme changes", () => {
	const { portfolio, context } = loadPortfolioScript();
	context.document.documentElement.getAttribute = (name) =>
		name === "data-theme" ? "light" : null;

	const lightResolved = portfolio.resolve_stage_status_pill("Waiting Gate");
	assert.equal(lightResolved.background, "#8f9aa8");

	context.document.documentElement.getAttribute = (name) =>
		name === "data-theme" ? "dark" : null;

	const darkResolved = portfolio.resolve_stage_status_pill("Waiting Gate");
	assert.equal(darkResolved.background, "#636f7c");
});

test("apply_theme refreshes grid cells after theme change", () => {
	const { portfolio, context, state } = loadPortfolioScript();
	const classList = makeClassList();
	const refreshCalls = [];
	const gridElement = { classList };
	state.gridElement = gridElement;
	const frm = makeFormDoc();
	frm._portfolioGridApi = {
		refreshCells() {
			refreshCalls.push(true);
		},
	};
	attachProjectsField(frm, state);
	context.document.documentElement.getAttribute = (name) =>
		name === "data-theme" ? "dark" : null;

	portfolio.apply_theme(frm);

	assert.equal(refreshCalls.length, 1);
	assert.equal(classList.contains("ag-theme-quartz-dark"), true);
});
