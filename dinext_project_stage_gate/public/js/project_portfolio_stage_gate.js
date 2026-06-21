frappe.provide("dinext_project_stage_gate.portfolio");

(function () {
	const BOOTSTRAP_JS = "/assets/dinext_common/js/ag-grid/bootstrap.js";
	const GRID_CSS = "/assets/dinext_project_stage_gate/css/project_portfolio_grid.css";
	const PROJECTS_HTML_FIELD = "custom_portfolio_projects";
	const GRID_SELECTOR = ".portfolio-project-grid";
	const GRID_DARK_CLASS = "ag-theme-quartz-dark";
	const GRID_LIGHT_CLASS = "ag-theme-quartz";
	const GRID_CUSTOM_DARK_CLASS = "portfolio-project-grid-dark";

	let bootstrapPromise = null;
	let cssPromise = null;

	const portfolio = (dinext_project_stage_gate.portfolio =
		dinext_project_stage_gate.portfolio || {});

	portfolio.width_tier = {
		project: { minWidth: 180, maxWidth: 320 },
		text: { minWidth: 100, maxWidth: 200 },
		textWide: { minWidth: 120, maxWidth: 260 },
		status: { minWidth: 88, maxWidth: 115 },
		stage: { minWidth: 120, maxWidth: 220 },
		date: { minWidth: 96, maxWidth: 118 },
		percent: { minWidth: 88, maxWidth: 108 },
		number: { minWidth: 96, maxWidth: 132 },
		currency: { minWidth: 100, maxWidth: 152 },
		milestone: { minWidth: 160, maxWidth: 280 },
	};

	portfolio.with_width = function (colDef, tier) {
		const bounds = portfolio.width_tier[tier] || portfolio.width_tier.text;
		return { ...colDef, ...bounds };
	};

	portfolio.CENTERED_CELL_CLASS = "portfolio-project-grid-cell-center";

	portfolio.with_centered = function (colDef, tier) {
		return portfolio.with_width(
			{
				...colDef,
				cellClass: portfolio.CENTERED_CELL_CLASS,
			},
			tier
		);
	};

	portfolio.render_indicator_pill = function (label, colorClass, styleOptions = {}) {
		if (label === null || label === undefined || label === "") {
			return "";
		}
		const text = frappe.utils.escape_html(__(String(label)));
		const background = styleOptions.background;
		const textColor = styleOptions.color;
		if (background) {
			const bg = frappe.utils.escape_html(background);
			const fg = frappe.utils.escape_html(textColor || portfolio.get_contrast_text_color(background));
			return `<span class="portfolio-project-grid-pill indicator-pill no-indicator-dot ellipsis" style="background:${bg};color:${fg};">${text}</span>`;
		}
		const cls = frappe.utils.escape_html(colorClass || "gray");
		return `<span class="portfolio-project-grid-pill indicator-pill ${cls} no-indicator-dot ellipsis">${text}</span>`;
	};

	// Stage-gate status hex fallback — keep aligned with project_stage_gate.css / roadmap statusPalette.
	portfolio.stage_status_palette = {
		light: {
			Planned: "#8f9aa8",
			"Waiting Gate": "#8f9aa8",
			Active: "#7f95c1",
			Skipped: "#b6b9bd",
			Completed: "#739b7f",
			Approved: "#739b7f",
			Rejected: "#c08b8b",
			Blocked: "#c08b8b",
			Canceled: "#9787b0",
		},
		dark: {
			Planned: "#636f7c",
			"Waiting Gate": "#636f7c",
			Active: "#4f6fa8",
			Skipped: "#5c708a",
			Completed: "#4e7d5c",
			Approved: "#4e7d5c",
			Rejected: "#a85c5c",
			Blocked: "#a85c5c",
			Canceled: "#6b5b8f",
		},
	};

	portfolio.meta_color_to_indicator_class = function (color) {
		if (!color) {
			return "gray";
		}
		if (typeof frappe.scrub === "function") {
			return frappe.scrub(color, "-");
		}
		return String(color).trim().toLowerCase().replace(/\s+/g, "-");
	};

	portfolio.get_contrast_text_color = function (fill) {
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

	portfolio.resolve_project_status_pill = function (status) {
		if (!status) {
			return null;
		}
		if (typeof frappe.get_indicator === "function") {
			const indicator = frappe.get_indicator({ doctype: "Project", status }, "Project");
			if (indicator) {
				return { label: indicator[0], colorClass: indicator[1] };
			}
		}
		return {
			label: status,
			colorClass:
				typeof frappe.utils.guess_colour === "function"
					? frappe.utils.guess_colour(status)
					: "gray",
		};
	};

	portfolio.resolve_priority_pill = function (priority) {
		if (!priority) {
			return null;
		}
		return {
			label: priority,
			colorClass:
				typeof frappe.utils.guess_colour === "function"
					? frappe.utils.guess_colour(priority)
					: "gray",
		};
	};

	portfolio.resolve_stage_status_pill = function (stageStatus) {
		if (!stageStatus) {
			return { colorClass: "gray" };
		}
		const meta = typeof frappe.get_meta === "function" ? frappe.get_meta("Project Stage Instance") : null;
		const state = meta?.states?.find((entry) => entry.title === stageStatus);
		if (state?.color) {
			return { colorClass: portfolio.meta_color_to_indicator_class(state.color) };
		}
		const themeKey = portfolio.is_dark_theme() ? "dark" : "light";
		const palette = portfolio.stage_status_palette[themeKey] || portfolio.stage_status_palette.light;
		const background = palette[stageStatus] || palette.Planned || "#8f9aa8";
		return {
			background,
			color: portfolio.get_contrast_text_color(background),
		};
	};

	portfolio.render_priority_cell = function (params) {
		const resolved = portfolio.resolve_priority_pill(params?.value);
		if (!resolved) {
			return "";
		}
		return portfolio.render_indicator_pill(resolved.label, resolved.colorClass);
	};

	portfolio.render_project_status_cell = function (params) {
		const resolved = portfolio.resolve_project_status_pill(params?.value);
		if (!resolved) {
			return "";
		}
		return portfolio.render_indicator_pill(resolved.label, resolved.colorClass);
	};

	portfolio.render_active_stage_cell = function (params) {
		const row = params?.data;
		const label = row?.active_stage;
		if (!label) {
			return "";
		}
		const resolved = portfolio.resolve_stage_status_pill(row?.stage_gate_status);
		if (resolved.background) {
			return portfolio.render_indicator_pill(label, null, resolved);
		}
		return portfolio.render_indicator_pill(label, resolved.colorClass);
	};

	portfolio.collect_leaf_column_defs = function (columnDefs, leaves = []) {
		(columnDefs || []).forEach((colDef) => {
			if (Array.isArray(colDef.children) && colDef.children.length) {
				portfolio.collect_leaf_column_defs(colDef.children, leaves);
				return;
			}
			leaves.push(colDef);
		});
		return leaves;
	};

	portfolio.autosize_grid_columns = function (api) {
		if (!api) {
			return;
		}

		const columns =
			(typeof api.getColumns === "function" && api.getColumns()) ||
			(typeof api.getAllGridColumns === "function" && api.getAllGridColumns()) ||
			[];

		if (!columns.length) {
			return;
		}

		const colIds = columns.map((column) => column.getColId());

		if (typeof api.autoSizeColumns === "function") {
			api.autoSizeColumns({ columns: colIds, skipHeader: false });
		} else if (typeof api.autoSizeAllColumns === "function") {
			api.autoSizeAllColumns(false);
		}

		const widthUpdates = [];
		columns.forEach((column) => {
			const colDef = column.getColDef?.() || {};
			const minWidth = Number(colDef.minWidth) || 90;
			const maxWidth = Number(colDef.maxWidth);
			const actualWidth = column.getActualWidth?.() ?? minWidth;
			let newWidth = Math.max(minWidth, actualWidth);
			if (Number.isFinite(maxWidth) && maxWidth > 0) {
				newWidth = Math.min(newWidth, maxWidth);
			}
			if (newWidth !== actualWidth) {
				widthUpdates.push({ key: column.getColId(), newWidth });
			}
		});

		if (widthUpdates.length && typeof api.setColumnWidths === "function") {
			api.setColumnWidths(widthUpdates);
		}
	};

	portfolio.schedule_autosize_grid_columns = function (api) {
		if (!api) {
			return;
		}
		requestAnimationFrame(() => {
			portfolio.autosize_grid_columns(api);
		});
	};

	frappe.ui.form.on("Project Portfolio", {
		refresh(frm) {
			return portfolio.refresh(frm);
		},
	});

	$(document).on("form-unload", function (_event, frm) {
		if (frm?.doctype === "Project Portfolio") {
			portfolio.teardown(frm);
		}
	});

	portfolio.refresh = async function (frm) {
		if (!frm || !frm.doc) {
			return;
		}

		portfolio.teardown(frm);
		portfolio.add_roadmap_button(frm);

		if (frm.is_new() || !frm.doc.name) {
			return;
		}

		const shell = portfolio.ensure_shell(frm);
		if (!shell) {
			return;
		}
		portfolio.apply_theme(frm);
		portfolio.set_status_text(shell, __("Loading projects..."));

		try {
			await portfolio.ensure_assets();
			const response = await portfolio.call(
				"dinext_project_stage_gate.stage_gate.api.get_portfolio_project_grid",
				{ portfolio: frm.doc.name }
			);
			const rows = response.rows || [];
			portfolio.render_grid(frm, shell.grid.get(0), rows);
			portfolio.apply_theme(frm);
			portfolio.bind_theme_observer(frm);
			portfolio.update_remove_button_state(frm);
			portfolio.set_status_text(
				shell,
				rows.length
					? __("Loaded {0} projects", [rows.length])
					: __("No projects in this portfolio yet.")
			);
		} catch (error) {
			console.error("Failed to load Project Portfolio grid", error);
			portfolio.render_error(shell, __("Failed to load portfolio projects."));
		}
	};

	portfolio.teardown = function (frm) {
		if (frm?._portfolioThemeObserver) {
			frm._portfolioThemeObserver.disconnect();
			frm._portfolioThemeObserver = null;
		}

		portfolio.destroy_grid(frm);

		const fieldWrapper = portfolio.get_projects_field_wrapper(frm);
		if (fieldWrapper?.length && typeof fieldWrapper.empty === "function") {
			fieldWrapper.empty();
		}
	};

	portfolio.get_projects_field_wrapper = function (frm) {
		return frm?.fields_dict?.[PROJECTS_HTML_FIELD]?.$wrapper || null;
	};

	portfolio.destroy_grid = function (frm) {
		if (frm?._portfolioGridApi?.destroy) {
			frm._portfolioGridApi.destroy();
		}
		frm._portfolioGridApi = null;
	};

	portfolio.ensure_assets = async function () {
		await portfolio.load_bootstrap();
		await portfolio.load_grid_css();
		if (!window.DinextAgGrid || typeof window.DinextAgGrid.ensure !== "function") {
			throw new Error(__("DinextAgGrid bootstrap is unavailable"));
		}
		await window.DinextAgGrid.ensure();
	};

	portfolio.load_bootstrap = function () {
		if (window.DinextAgGrid && typeof window.DinextAgGrid.ensure === "function") {
			return Promise.resolve();
		}

		if (!bootstrapPromise) {
			bootstrapPromise = new Promise((resolve, reject) => {
				const existing = document.querySelector(`script[src="${BOOTSTRAP_JS}"]`);
				if (existing) {
					existing.addEventListener("load", resolve, { once: true });
					existing.addEventListener("error", reject, { once: true });
					if (window.DinextAgGrid) {
						resolve();
					}
					return;
				}

				const script = document.createElement("script");
				script.src = BOOTSTRAP_JS;
				script.onload = resolve;
				script.onerror = reject;
				document.head.appendChild(script);
			});
		}

		return bootstrapPromise;
	};

	portfolio.load_grid_css = function () {
		if (!cssPromise) {
			cssPromise = new Promise((resolve) => {
				frappe.require([GRID_CSS], function () {
					resolve();
				});
			});
		}
		return cssPromise;
	};

	portfolio.ensure_shell = function (frm) {
		const fieldWrapper = portfolio.get_projects_field_wrapper(frm);
		if (!fieldWrapper?.length) {
			return null;
		}

		fieldWrapper.empty();
		const root = $(
			`<section class="portfolio-project-grid-root">
				<div class="portfolio-project-grid-toolbar">
					<div class="portfolio-project-grid-actions">
						<button type="button" class="btn btn-primary btn-sm" data-action="add-projects">${__("Add")}</button>
						<button type="button" class="btn btn-default btn-sm" data-action="remove-projects" disabled>${__("Remove")}</button>
					</div>
					<div class="portfolio-project-grid-status text-muted small"></div>
				</div>
				<div class="portfolio-project-grid-surface">
					<div class="portfolio-project-grid"></div>
				</div>
			</section>`
		);
		root.appendTo(fieldWrapper);

		root.find('[data-action="add-projects"]').off("click").on("click", () => {
			portfolio.open_add_dialog(frm);
		});
		root.find('[data-action="remove-projects"]').off("click").on("click", () => {
			portfolio.remove_selected_projects(frm);
		});

		return {
			root,
			grid: root.find(".portfolio-project-grid"),
			status: root.find(".portfolio-project-grid-status"),
			removeButton: root.find('[data-action="remove-projects"]'),
		};
	};

	portfolio.set_status_text = function (shell, text) {
		if (shell?.status?.length) {
			shell.status.text(text || "");
		}
	};

	portfolio.render_error = function (shell, message) {
		if (shell?.grid?.length) {
			shell.grid.html(`<div class="portfolio-project-grid-empty">${frappe.utils.escape_html(message)}</div>`);
		}
		portfolio.set_status_text(shell, message);
	};

	portfolio.call = async function (method, args) {
		const response = await frappe.call({ method, args });
		return response.message || {};
	};

	portfolio.render_grid = function (frm, container, rows) {
		if (!container) {
			return;
		}

		portfolio.destroy_grid(frm);
		container.innerHTML = "";
		portfolio.apply_theme(frm);

		const gridOptions = {
			theme: "legacy",
			rowData: rows,
			columnDefs: portfolio.get_column_defs(),
			rowSelection: "multiple",
			suppressRowClickSelection: true,
			defaultColDef: {
				sortable: true,
				resizable: true,
				filter: false,
				wrapHeaderText: false,
				autoHeaderHeight: false,
				minWidth: 90,
			},
			animateRows: true,
			headerHeight: 36,
			rowHeight: 32,
			suppressCellFocus: true,
			overlayNoRowsTemplate: `<span class="portfolio-project-grid-empty">${frappe.utils.escape_html(
				__("No projects in this portfolio yet.")
			)}</span>`,
			onSelectionChanged() {
				portfolio.update_remove_button_state(frm);
			},
			onRowDoubleClicked(params) {
				portfolio.open_project_form(params?.data);
			},
			onFirstDataRendered() {
				portfolio.schedule_autosize_grid_columns(frm._portfolioGridApi);
			},
			onGridReady(params) {
				frm._portfolioGridApi = params.api;
				portfolio.schedule_autosize_grid_columns(params.api);
			},
		};

		frm._portfolioGridApi = window.agGrid.createGrid(container, gridOptions);
		portfolio.apply_theme(frm);
		portfolio.schedule_autosize_grid_columns(frm._portfolioGridApi);
	};

	portfolio.get_column_defs = function () {
		return [
			portfolio.with_width(
				{
					headerName: __("Project"),
					field: "project_name",
					pinned: "left",
					headerCheckboxSelection: true,
					checkboxSelection: true,
					cellRenderer(params) {
						return portfolio.render_project_cell(params.data);
					},
				},
				"project"
			),
			portfolio.with_centered(
				{
					headerName: __("Type"),
					field: "project_type",
				},
				"text"
			),
			portfolio.with_centered(
				{
					headerName: __("Priority"),
					field: "priority",
					cellRenderer: portfolio.render_priority_cell,
				},
				"text"
			),
			{
				headerName: __("Status"),
				children: [
					portfolio.with_centered(
						{
							headerName: __("Overall"),
							field: "status_overall",
							cellRenderer: portfolio.render_project_status_cell,
						},
						"status"
					),
					portfolio.with_width({ headerName: __("Schedule"), field: "status_schedule" }, "status"),
					portfolio.with_width({ headerName: __("Budget"), field: "status_budget" }, "status"),
					portfolio.with_width({ headerName: __("Resources"), field: "status_resources" }, "status"),
					portfolio.with_width({ headerName: __("Risks"), field: "status_risks" }, "status"),
				],
			},
			portfolio.with_centered(
				{
					headerName: __("Active Stage"),
					field: "active_stage",
					cellRenderer: portfolio.render_active_stage_cell,
				},
				"stage"
			),
			portfolio.with_width(
				{
					headerName: __("Customer"),
					field: "customer",
				},
				"textWide"
			),
			portfolio.with_width(
				{
					headerName: __("Department"),
					field: "department",
				},
				"textWide"
			),
			portfolio.with_width(
				{
					headerName: __("Project Manager"),
					field: "project_manager",
				},
				"textWide"
			),
			{
				headerName: __("Dates"),
				children: [
					portfolio.with_centered(
						{
							headerName: __("Start"),
							field: "expected_start_date",
							valueFormatter: portfolio.format_date_value,
						},
						"date"
					),
					portfolio.with_centered(
						{
							headerName: __("End"),
							field: "expected_end_date",
							valueFormatter: portfolio.format_date_value,
						},
						"date"
					),
					portfolio.with_centered(
						{
							headerName: __("Current %"),
							field: "progress_current_percent",
							valueFormatter: portfolio.format_percent_value,
						},
						"percent"
					),
				],
			},
			{
				headerName: __("Work"),
				children: [
					portfolio.with_centered(
						{
							headerName: __("Plan %"),
							field: "work_plan_percent",
							valueFormatter: portfolio.format_percent_value,
						},
						"percent"
					),
					portfolio.with_centered(
						{
							headerName: __("Actual %"),
							field: "work_actual_percent",
							valueFormatter: portfolio.format_percent_value,
						},
						"percent"
					),
				],
			},
			{
				headerName: __("Labor"),
				children: [
					portfolio.with_centered(
						{
							headerName: __("Plan Total"),
							field: "labor_plan_total",
							valueFormatter: portfolio.format_number_value,
						},
						"number"
					),
					portfolio.with_centered(
						{
							headerName: __("Actual Total"),
							field: "labor_actual_total",
							valueFormatter: portfolio.format_number_value,
						},
						"number"
					),
					portfolio.with_centered(
						{
							headerName: __("Forecast Total"),
							field: "labor_forecast_total",
							valueFormatter: portfolio.format_number_value,
						},
						"number"
					),
					portfolio.with_centered(
						{
							headerName: __("Plan Today"),
							field: "labor_plan_today",
							valueFormatter: portfolio.format_number_value,
						},
						"number"
					),
					portfolio.with_centered(
						{
							headerName: __("Actual Today"),
							field: "labor_actual_today",
							valueFormatter: portfolio.format_number_value,
						},
						"number"
					),
				],
			},
			{
				headerName: __("P&L"),
				children: [
					portfolio.with_centered(
						{
							headerName: __("Plan Total"),
							field: "pl_plan_total",
							valueFormatter: portfolio.format_currency_value,
						},
						"currency"
					),
					portfolio.with_centered(
						{
							headerName: __("Actual Total"),
							field: "pl_actual_total",
							valueFormatter: portfolio.format_currency_value,
						},
						"currency"
					),
					portfolio.with_centered(
						{
							headerName: __("Forecast Total"),
							field: "pl_forecast_total",
							valueFormatter: portfolio.format_currency_value,
						},
						"currency"
					),
					portfolio.with_centered(
						{
							headerName: __("Plan Today"),
							field: "pl_plan_today",
							valueFormatter: portfolio.format_currency_value,
						},
						"currency"
					),
					portfolio.with_centered(
						{
							headerName: __("Actual Today"),
							field: "pl_actual_today",
							valueFormatter: portfolio.format_currency_value,
						},
						"currency"
					),
				],
			},
			{
				headerName: __("Nearest Milestone"),
				children: [
					portfolio.with_width(
						{
							headerName: __("Milestone"),
							field: "nearest_milestone_subject",
						},
						"milestone"
					),
					portfolio.with_width(
						{
							headerName: __("Forecast Date"),
							field: "nearest_milestone_date",
							valueFormatter: portfolio.format_date_value,
						},
						"date"
					),
				],
			},
		];
	};

	portfolio.open_project_form = function (row) {
		const projectId = row?.project || row?.name;
		if (!projectId) {
			return;
		}
		frappe.set_route("Form", "Project", projectId);
	};

	portfolio.render_project_cell = function (row) {
		if (!row) {
			return "";
		}
		const projectName = frappe.utils.escape_html(row.project || "");
		const projectTitle = frappe.utils.escape_html(row.project_name || row.project || "");
		const stageStatusAttr = row.stage_gate_status
			? ` title="${frappe.utils.escape_html(row.stage_gate_status)}"`
			: "";
		return `<div class="portfolio-project-grid-project-cell"${stageStatusAttr}>
			<div class="portfolio-project-grid-project-title">${projectTitle}</div>
			<div class="portfolio-project-grid-project-code">${projectName}</div>
		</div>`;
	};

	portfolio.format_date_value = function (params) {
		const value = params?.value;
		if (!value) {
			return "";
		}
		if (frappe.datetime?.str_to_user) {
			return frappe.datetime.str_to_user(value);
		}
		return value;
	};

	portfolio.format_percent_value = function (params) {
		const value = params?.value;
		if (value === null || value === undefined || value === "") {
			return "";
		}
		return `${Number(value).toFixed(1)}%`;
	};

	portfolio.format_number_value = function (params) {
		const value = params?.value;
		if (value === null || value === undefined || value === "") {
			return "";
		}
		return Number(value).toFixed(1);
	};

	portfolio.format_currency_value = function (params) {
		const value = params?.value;
		if (value === null || value === undefined || value === "") {
			return "";
		}
		if (typeof frappe.format === "function") {
			return frappe.format(value, { fieldtype: "Currency" });
		}
		return Number(value).toFixed(2);
	};

	portfolio.is_dark_theme = function () {
		const root = document?.documentElement;
		if (!root) {
			return false;
		}

		const resolvedTheme = root.getAttribute?.("data-theme");
		if (resolvedTheme) {
			return resolvedTheme === "dark";
		}

		const selectedTheme = root.getAttribute?.("data-theme-mode");
		if (selectedTheme === "dark") {
			return true;
		}
		if (selectedTheme === "automatic") {
			return Boolean(frappe.ui?.dark_theme_media_query?.matches);
		}

		const deskTheme = String(frappe.boot?.user?.desk_theme || "").toLowerCase();
		return deskTheme.includes("dark");
	};

	portfolio.apply_theme = function (frm) {
		const gridElement = portfolio.get_grid_element(frm);
		if (!gridElement) {
			return;
		}
		const isDark = portfolio.is_dark_theme();
		if (gridElement.classList?.toggle) {
			gridElement.classList.toggle(GRID_LIGHT_CLASS, !isDark);
			gridElement.classList.toggle(GRID_DARK_CLASS, isDark);
			gridElement.classList.toggle(GRID_CUSTOM_DARK_CLASS, isDark);
		} else {
			const grid = portfolio.get_projects_field_wrapper(frm)?.find?.(GRID_SELECTOR);
			grid?.removeClass?.(`${GRID_LIGHT_CLASS} ${GRID_DARK_CLASS} ${GRID_CUSTOM_DARK_CLASS}`);
			grid?.addClass?.(isDark ? `${GRID_DARK_CLASS} ${GRID_CUSTOM_DARK_CLASS}` : GRID_LIGHT_CLASS);
		}
		if (frm?._portfolioGridApi?.refreshCells) {
			frm._portfolioGridApi.refreshCells({ force: true });
		}
	};

	portfolio.get_grid_element = function (frm) {
		const grid = portfolio.get_projects_field_wrapper(frm)?.find?.(GRID_SELECTOR);
		if (!grid?.length || typeof grid.get !== "function") {
			return null;
		}
		return grid.get(0) || null;
	};

	portfolio.bind_theme_observer = function (frm) {
		if (!window.MutationObserver || !document?.documentElement) {
			return;
		}
		if (frm._portfolioThemeObserver) {
			frm._portfolioThemeObserver.disconnect();
		}
		frm._portfolioThemeObserver = new MutationObserver(() => {
			portfolio.apply_theme(frm);
		});
		frm._portfolioThemeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme", "data-theme-mode"],
		});
	};

	portfolio.update_remove_button_state = function (frm) {
		const selected = frm?._portfolioGridApi?.getSelectedRows?.() || [];
		const removeButton = portfolio.get_projects_field_wrapper(frm)?.find?.(
			'[data-action="remove-projects"]'
		);
		if (removeButton?.length) {
			removeButton.prop("disabled", selected.length === 0);
		}
	};

	portfolio.add_roadmap_button = function (frm) {
		if (!frm || frm.is_new() || !frm.doc?.name || !frappe.perm.has_perm("Project Stage Gate Roadmap")) {
			return;
		}
		frm.add_custom_button(
			__("Projects Stage Roadmap"),
			() => {
				frappe.route_options = { portfolio: frm.doc.name };
				frappe.set_route("query-report", "Project Stage Gate Roadmap");
			},
			__("View")
		);
	};

	portfolio.open_add_dialog = async function (frm) {
		const response = await portfolio.call(
			"dinext_project_stage_gate.stage_gate.api.get_unassigned_projects",
			{}
		);
		const projects = response.projects || [];
		if (!projects.length) {
			frappe.msgprint(__("No projects are available for adding."));
			return;
		}

		const dialog = new frappe.ui.Dialog({
			title: __("Add Projects"),
			fields: [
				{
					fieldname: "projects",
					fieldtype: "MultiCheck",
					label: __("Projects"),
					columns: 1,
					options: projects.map((project) => ({
						label: portfolio.format_project_option(project),
						value: project.name,
					})),
				},
			],
			primary_action_label: __("Add"),
			primary_action: async (values) => {
				const selectedProjects = values.projects || [];
				if (!selectedProjects.length) {
					frappe.msgprint(__("Select at least one project."));
					return;
				}

				const result = await portfolio.call(
					"dinext_project_stage_gate.stage_gate.api.add_projects_to_portfolio",
					{
						portfolio: frm.doc.name,
						projects: selectedProjects,
					}
				);
				dialog.hide();
				portfolio.show_action_result(result, __("Added"), __("added"));
				await portfolio.refresh(frm);
			},
		});
		dialog.show();
	};

	portfolio.format_project_option = function (project) {
		const parts = [project.project_name || project.name];
		if (project.project_type) {
			parts.push(project.project_type);
		}
		if (project.customer) {
			parts.push(project.customer);
		}
		return parts.join(" / ");
	};

	portfolio.remove_selected_projects = function (frm) {
		const selectedRows = frm?._portfolioGridApi?.getSelectedRows?.() || [];
		if (!selectedRows.length) {
			frappe.msgprint(__("Select at least one row to remove."));
			return;
		}

		frappe.confirm(
			__("Remove the selected projects from this portfolio?"),
			async () => {
				const result = await portfolio.call(
					"dinext_project_stage_gate.stage_gate.api.remove_projects_from_portfolio",
					{
						portfolio: frm.doc.name,
						projects: selectedRows.map((row) => row.project),
					}
				);
				portfolio.show_action_result(result, __("Removed"), __("removed"));
				await portfolio.refresh(frm);
			}
		);
	};

	portfolio.show_action_result = function (result, successVerb, successVerbLower) {
		const updated = result?.updated || [];
		const skipped = result?.skipped || [];
		if (updated.length) {
			frappe.show_alert({
				message: __("{0} {1} projects", [successVerb, updated.length]),
				indicator: "green",
			});
		}
		if (skipped.length) {
			const lines = skipped.map((item) => `${item.project}: ${portfolio.describe_skip_reason(item.reason)}`);
			frappe.msgprint({
				title: __("Some projects were skipped"),
				indicator: "orange",
				message: `<div>${frappe.utils.escape_html(
					__("Successfully {0}: {1}", [successVerbLower, updated.length])
				)}</div><ul>${lines
					.map((line) => `<li>${frappe.utils.escape_html(line)}</li>`)
					.join("")}</ul>`,
			});
		}
	};

	portfolio.describe_skip_reason = function (reason) {
		const labels = {
			no_project_write_permission: __("No write permission"),
			already_assigned: __("Already assigned to another portfolio"),
			already_in_portfolio: __("Already in this portfolio"),
			not_in_portfolio: __("Project is not linked to this portfolio"),
		};
		return labels[reason] || reason || "";
	};
})();
