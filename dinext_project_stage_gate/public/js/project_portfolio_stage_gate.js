frappe.provide("dinext_project_stage_gate.portfolio");

(function () {
	const GRID_CUSTOM_DARK_CLASS = "portfolio-project-grid-dark";
	const DINEXT_PORTFOLIO_GRID_TRANSLATION_CONTEXT = "Dinext.PortfolioGrid";
	const DINEXT_STAGE_GATE_TRANSLATION_CONTEXT = "Dinext.StageGateModel";
	const BOOTSTRAP_JS = "/assets/dinext_common/js/ag-grid/bootstrap.js";
	const PALETTE_JS = "/assets/dinext_project_stage_gate/js/stage_gate_status_palette.js";

	let bootstrapPromise = null;
	let cssPromise = null;
	let palettePromise = null;

	const portfolio = (dinext_project_stage_gate.portfolio =
		dinext_project_stage_gate.portfolio || {});

	portfolio.t = function (text, args) {
		return args ? __(text, args, DINEXT_PORTFOLIO_GRID_TRANSLATION_CONTEXT) : __(text, null, DINEXT_PORTFOLIO_GRID_TRANSLATION_CONTEXT);
	};

	portfolio.translate_stage_status = function (value) {
		return value ? __(value, null, DINEXT_STAGE_GATE_TRANSLATION_CONTEXT) : value;
	};

	portfolio.get_status_palette = function () {
		return dinext_project_stage_gate.status_palette || null;
	};

	const GRID_CSS = "/assets/dinext_project_stage_gate/css/project_portfolio_grid.css";
	const PROJECTS_HTML_FIELD = "custom_portfolio_projects";
	const GRID_SELECTOR = ".portfolio-project-grid";
	const GRID_DARK_CLASS = "ag-theme-quartz-dark";
	const GRID_LIGHT_CLASS = "ag-theme-quartz";

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

	portfolio.render_indicator_pill = function (label, colorClass, styleOptions = {}, translateLabel = true) {
		if (label === null || label === undefined || label === "") {
			return "";
		}
		const text = frappe.utils.escape_html(translateLabel ? __(String(label)) : String(label));
		const background = styleOptions.background;
		const textColor = styleOptions.color;
		if (background) {
			const bg = frappe.utils.escape_html(background);
			const palette = portfolio.get_status_palette();
			const fg = frappe.utils.escape_html(
				textColor || (palette?.getContrastTextColor ? palette.getContrastTextColor(background) : "#ffffff")
			);
			return `<span class="portfolio-project-grid-pill indicator-pill no-indicator-dot ellipsis" style="background:${bg};color:${fg};">${text}</span>`;
		}
		const cls = frappe.utils.escape_html(colorClass || "gray");
		return `<span class="portfolio-project-grid-pill indicator-pill ${cls} no-indicator-dot ellipsis">${text}</span>`;
	};

	portfolio.get_contrast_text_color = function (fill) {
		const palette = portfolio.get_status_palette();
		if (palette?.getContrastTextColor) {
			return palette.getContrastTextColor(fill);
		}
		return "#ffffff";
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

	portfolio.resolve_stage_status_pill = function (stageStatus) {
		if (!stageStatus) {
			return { colorClass: "gray" };
		}
		const meta = typeof frappe.get_meta === "function" ? frappe.get_meta("Project Stage Instance") : null;
		const state = meta?.states?.find((entry) => entry.title === stageStatus);
		if (state?.color) {
			return { colorClass: portfolio.meta_color_to_indicator_class(state.color) };
		}
		const isDark = portfolio.is_dark_theme();
		const palette = portfolio.get_status_palette();
		const background = palette?.getStageHex
			? palette.getStageHex(stageStatus, isDark)
			: "#8f9aa8";
		return {
			background,
			color: portfolio.get_contrast_text_color(background),
		};
	};

	portfolio.format_rag_status_value = function (params) {
		const value = params?.value;
		if (value === null || value === undefined || value === "") {
			return "";
		}
		return String(value);
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
		portfolio.add_view_menu_items(frm);

		if (frm.is_new() || !frm.doc.name) {
			return;
		}

		const shell = portfolio.ensure_shell(frm);
		if (!shell) {
			return;
		}
		portfolio.apply_theme(frm);
		portfolio.set_status_text(shell, portfolio.t("Loading projects..."));

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
					? portfolio.t("Loaded {0} projects", [rows.length])
					: portfolio.t("No projects in this portfolio yet.")
			);
		} catch (error) {
			console.error("Failed to load Project Portfolio grid", error);
			portfolio.render_error(shell, portfolio.t("Failed to load portfolio projects."));
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
		await portfolio.load_palette();
		await portfolio.load_bootstrap();
		await portfolio.load_grid_css();
		if (!window.DinextAgGrid || typeof window.DinextAgGrid.ensure !== "function") {
			throw new Error(portfolio.t("DinextAgGrid bootstrap is unavailable"));
		}
		await window.DinextAgGrid.ensure();
	};

	portfolio.load_palette = function () {
		if (dinext_project_stage_gate.status_palette?.getStageHex) {
			return Promise.resolve();
		}
		if (!palettePromise) {
			palettePromise = new Promise((resolve) => {
				frappe.require([PALETTE_JS], function () {
					resolve();
				});
			});
		}
		return palettePromise;
	};

	portfolio.load_bootstrap = function () {
		if (window.DinextAgGrid && typeof window.DinextAgGrid.ensure === "function") {
			return Promise.resolve();
		}

		if (!bootstrapPromise) {
			bootstrapPromise = new Promise((resolve, reject) => {
				frappe.require([BOOTSTRAP_JS], function () {
					if (window.DinextAgGrid && typeof window.DinextAgGrid.ensure === "function") {
						resolve();
						return;
					}
					reject(new Error(portfolio.t("DinextAgGrid bootstrap is unavailable")));
				});
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
					<div class="portfolio-project-grid-actions"></div>
					<div class="portfolio-project-grid-status text-muted small"></div>
				</div>
				<div class="portfolio-project-grid-surface">
					<div class="portfolio-project-grid"></div>
				</div>
			</section>`
		);
		root.appendTo(fieldWrapper);

		const $actions = root.find(".portfolio-project-grid-actions");
		$actions.append(
			portfolio.make_toolbar_button({
				label: portfolio.t("Add"),
				icon: "es-line-add",
				btn_type: "secondary",
				data_action: "add-projects",
				click: () => portfolio.open_add_dialog(frm),
			})
		);
		$actions.append(
			portfolio.make_toolbar_button({
				label: portfolio.t("Remove"),
				icon: "es-line-delete",
				btn_type: "danger",
				disabled: true,
				data_action: "remove-projects",
				click: () => portfolio.remove_selected_projects(frm),
			})
		);
		portfolio.mount_toolbar_view_buttons(frm, $actions);

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
			rowSelection: {
				mode: "multiRow",
				enableClickSelection: false,
				checkboxes: true,
				headerCheckbox: true,
			},
			selectionColumnDef: {
				pinned: "left",
				lockPosition: "left",
				width: 48,
				maxWidth: 48,
				minWidth: 48,
				resizable: false,
				sortable: false,
			},
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
				portfolio.t("No projects in this portfolio yet.")
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
					headerName: portfolio.t("Project"),
					field: "project_name",
					pinned: "left",
					cellRenderer(params) {
						return portfolio.render_project_cell(params.data);
					},
				},
				"project"
			),
			portfolio.with_centered(
				{
					headerName: portfolio.t("Type"),
					field: "project_type",
				},
				"text"
			),
			portfolio.with_centered(
				{
					headerName: portfolio.t("Priority"),
					field: "priority",
					cellRenderer: portfolio.render_priority_cell,
				},
				"text"
			),
			{
				headerName: portfolio.t("Status"),
				children: [
					portfolio.with_centered(
						{
							headerName: portfolio.t("Overall"),
							field: "status_overall",
							cellRenderer: portfolio.render_project_status_cell,
						},
						"status"
					),
					portfolio.with_width(
						{
							headerName: portfolio.t("Schedule"),
							field: "status_schedule",
							valueFormatter: portfolio.format_rag_status_value,
						},
						"status"
					),
					portfolio.with_width(
						{
							headerName: portfolio.t("Budget"),
							field: "status_budget",
							valueFormatter: portfolio.format_rag_status_value,
						},
						"status"
					),
					portfolio.with_width(
						{
							headerName: portfolio.t("Resources"),
							field: "status_resources",
							valueFormatter: portfolio.format_rag_status_value,
						},
						"status"
					),
					portfolio.with_width(
						{
							headerName: portfolio.t("Risks"),
							field: "status_risks",
							valueFormatter: portfolio.format_rag_status_value,
						},
						"status"
					),
				],
			},
			portfolio.with_centered(
				{
					headerName: portfolio.t("Active Stage"),
					field: "active_stage",
					cellRenderer: portfolio.render_active_stage_cell,
				},
				"stage"
			),
			portfolio.with_width(
				{
					headerName: portfolio.t("Customer"),
					field: "customer",
				},
				"textWide"
			),
			portfolio.with_width(
				{
					headerName: portfolio.t("Department"),
					field: "department",
				},
				"textWide"
			),
			portfolio.with_width(
				{
					headerName: portfolio.t("Project Manager"),
					field: "project_manager",
				},
				"textWide"
			),
			{
				headerName: portfolio.t("Dates"),
				children: [
					portfolio.with_centered(
						{
							headerName: portfolio.t("Start"),
							field: "expected_start_date",
							valueFormatter: portfolio.format_date_value,
						},
						"date"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("End"),
							field: "expected_end_date",
							valueFormatter: portfolio.format_date_value,
						},
						"date"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("Current %"),
							field: "progress_current_percent",
							valueFormatter: portfolio.format_percent_value,
						},
						"percent"
					),
				],
			},
			{
				headerName: portfolio.t("Work"),
				children: [
					portfolio.with_centered(
						{
							headerName: portfolio.t("Plan %"),
							field: "work_plan_percent",
							valueFormatter: portfolio.format_percent_value,
						},
						"percent"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("Actual %"),
							field: "work_actual_percent",
							valueFormatter: portfolio.format_percent_value,
						},
						"percent"
					),
				],
			},
			{
				headerName: portfolio.t("Labor"),
				children: [
					portfolio.with_centered(
						{
							headerName: portfolio.t("Plan Total"),
							field: "labor_plan_total",
							valueFormatter: portfolio.format_number_value,
						},
						"number"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("Plan Today"),
							field: "labor_plan_today",
							valueFormatter: portfolio.format_number_value,
						},
						"number"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("Actual"),
							field: "labor_actual_total",
							valueFormatter: portfolio.format_number_value,
						},
						"number"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("Forecast Total"),
							field: "labor_forecast_total",
							valueFormatter: portfolio.format_number_value,
						},
						"number"
					),
				],
			},
			{
				headerName: portfolio.t("P&L"),
				children: [
					portfolio.with_centered(
						{
							headerName: portfolio.t("Plan Total"),
							field: "pl_plan_total",
							valueFormatter: portfolio.format_currency_value,
						},
						"currency"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("Actual Total"),
							field: "pl_actual_total",
							valueFormatter: portfolio.format_currency_value,
						},
						"currency"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("Forecast Total"),
							field: "pl_forecast_total",
							valueFormatter: portfolio.format_currency_value,
						},
						"currency"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("Plan Today"),
							field: "pl_plan_today",
							valueFormatter: portfolio.format_currency_value,
						},
						"currency"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("Actual Today"),
							field: "pl_actual_today",
							valueFormatter: portfolio.format_currency_value,
						},
						"currency"
					),
				],
			},
			{
				headerName: portfolio.t("Nearest Open Milestone"),
				children: [
					portfolio.with_width(
						{
							headerName: portfolio.t("Milestone"),
							field: "nearest_milestone_subject",
						},
						"milestone"
					),
					portfolio.with_centered(
						{
							headerName: portfolio.t("Forecast Date"),
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
			? ` title="${frappe.utils.escape_html(portfolio.translate_stage_status(row.stage_gate_status))}"`
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
			return frappe.format(value, { fieldtype: "Currency" }, { only_value: true });
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

	portfolio.make_toolbar_button = function ({
		label,
		icon,
		btn_type = "secondary",
		disabled,
		click,
		data_action,
	}) {
		const $btn = $(`<button type="button" class="btn btn-xs btn-${btn_type}">`)
			.attr("data-label", label)
			.html(`${frappe.utils.icon(icon, "xs")} ${label}`)
			.on("click", click);
		if (data_action) {
			$btn.attr("data-action", data_action);
		}
		if (disabled) {
			$btn.prop("disabled", true);
		}
		return $btn;
	};

	portfolio.open_projects_stage_roadmap = function (frm) {
		frappe.route_options = { portfolio: frm.doc.name };
		frappe.set_route("query-report", "Project Stage Gate Roadmap");
	};

	portfolio.get_view_actions = function (frm) {
		if (!frm || frm.is_new() || !frm.doc?.name || !frappe.perm.has_perm("Project Stage Gate Roadmap")) {
			return [];
		}
		return [
			{
				label: __("Projects Stage Roadmap"),
				icon: "es-line-reports",
				handler: () => portfolio.open_projects_stage_roadmap(frm),
			},
		];
	};

	portfolio.add_view_menu_items = function (frm) {
		portfolio.get_view_actions(frm).forEach(({ label, handler }) => {
			frm.add_custom_button(label, handler, __("View"));
		});
	};

	portfolio.mount_toolbar_view_buttons = function (frm, $container) {
		const actions = portfolio.get_view_actions(frm);
		if (!actions.length || !$container?.length) {
			return;
		}
		$container.append('<span class="portfolio-project-grid-toolbar-divider" aria-hidden="true"></span>');
		actions.forEach(({ label, icon, handler }) => {
			$container.append(
				portfolio.make_toolbar_button({
					label,
					icon,
					btn_type: "secondary",
					click: handler,
				})
			);
		});
	};

	portfolio.open_add_dialog = async function (frm) {
		const response = await portfolio.call(
			"dinext_project_stage_gate.stage_gate.api.get_unassigned_projects",
			{}
		);
		const projects = response.projects || [];
		if (!projects.length) {
			frappe.msgprint(portfolio.t("No projects are available for adding."));
			return;
		}

		const dialog = new frappe.ui.Dialog({
			title: portfolio.t("Add Projects"),
			fields: [
				{
					fieldname: "projects",
					fieldtype: "MultiCheck",
					label: portfolio.t("Projects"),
					columns: 1,
					options: projects.map((project) => ({
						label: portfolio.format_project_option(project),
						value: project.name,
					})),
				},
			],
			primary_action_label: portfolio.t("Add"),
			primary_action: async (values) => {
				const selectedProjects = values.projects || [];
				if (!selectedProjects.length) {
					frappe.msgprint(portfolio.t("Select at least one project."));
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
				portfolio.show_action_result(result, portfolio.t("Added"), portfolio.t("added"));
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
			frappe.msgprint(portfolio.t("Select at least one row to remove."));
			return;
		}

		frappe.confirm(
			portfolio.t("Remove the selected projects from this portfolio?"),
			async () => {
				const result = await portfolio.call(
					"dinext_project_stage_gate.stage_gate.api.remove_projects_from_portfolio",
					{
						portfolio: frm.doc.name,
						projects: selectedRows.map((row) => row.project),
					}
				);
				portfolio.show_action_result(result, portfolio.t("Removed"), portfolio.t("removed"));
				await portfolio.refresh(frm);
			}
		);
	};

	portfolio.show_action_result = function (result, successVerb, successVerbLower) {
		const updated = result?.updated || [];
		const skipped = result?.skipped || [];
		if (updated.length) {
			frappe.show_alert({
				message: portfolio.t("{0} {1} projects", [successVerb, updated.length]),
				indicator: "green",
			});
		}
		if (skipped.length) {
			const lines = skipped.map((item) => `${item.project}: ${portfolio.describe_skip_reason(item.reason)}`);
			frappe.msgprint({
				title: portfolio.t("Some projects were skipped"),
				indicator: "orange",
				message: `<div>${frappe.utils.escape_html(
					portfolio.t("Successfully {0}: {1}", [successVerbLower, updated.length])
				)}</div><ul>${lines
					.map((line) => `<li>${frappe.utils.escape_html(line)}</li>`)
					.join("")}</ul>`,
			});
		}
	};

	portfolio.describe_skip_reason = function (reason) {
		const labels = {
			no_project_write_permission: portfolio.t("No write permission"),
			already_assigned: portfolio.t("Already assigned to another portfolio"),
			already_in_portfolio: portfolio.t("Already in this portfolio"),
			not_in_portfolio: portfolio.t("Project is not linked to this portfolio"),
		};
		return labels[reason] || reason || "";
	};
})();
