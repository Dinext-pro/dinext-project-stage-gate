frappe.provide("dinext_project_stage_gate.portfolio");

(function () {
	const BOOTSTRAP_JS = "/assets/dinext_common/js/ag-grid/bootstrap.js";
	const GRID_CSS = "/assets/dinext_project_stage_gate/css/project_portfolio_grid.css";
	const GRID_ROOT_SELECTOR = ".portfolio-project-grid-root";
	const GRID_SELECTOR = ".portfolio-project-grid";
	const GRID_DARK_CLASS = "ag-theme-quartz-dark";
	const GRID_LIGHT_CLASS = "ag-theme-quartz";
	const GRID_CUSTOM_DARK_CLASS = "portfolio-project-grid-dark";

	let bootstrapPromise = null;
	let cssPromise = null;

	const portfolio = (dinext_project_stage_gate.portfolio =
		dinext_project_stage_gate.portfolio || {});

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

		if (frm.is_new() || !frm.doc.name || !frm.page?.wrapper) {
			return;
		}

		const shell = portfolio.ensure_shell(frm);
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

		const root = frm?.page?.wrapper?.find?.(GRID_ROOT_SELECTOR);
		if (root?.length) {
			root.remove();
		}
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
		const page = frm.page.wrapper;
		let root = page.find(GRID_ROOT_SELECTOR);
		if (!root.length) {
			root = $(
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
			portfolio.insert_shell_after_description(frm, root, page);
		}

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

	portfolio.insert_shell_after_description = function (frm, root, page) {
		const descriptionWrapper = portfolio.get_description_wrapper(frm);
		if (descriptionWrapper?.length && typeof descriptionWrapper.after === "function") {
			descriptionWrapper.after(root);
			return;
		}

		page.find(".layout-main-section").first().prepend(root);
	};

	portfolio.get_description_wrapper = function (frm) {
		return frm?.fields_dict?.description?.$wrapper || null;
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
				wrapHeaderText: true,
				autoHeaderHeight: true,
				minWidth: 110,
			},
			animateRows: true,
			headerHeight: 56,
			rowHeight: 44,
			suppressCellFocus: true,
			overlayNoRowsTemplate: `<span class="portfolio-project-grid-empty">${frappe.utils.escape_html(
				__("No projects in this portfolio yet.")
			)}</span>`,
			onSelectionChanged() {
				portfolio.update_remove_button_state(frm);
			},
		};

		frm._portfolioGridApi = window.agGrid.createGrid(container, gridOptions);
		portfolio.apply_theme(frm);
	};

	portfolio.get_column_defs = function () {
		return [
			{
				headerName: __("Project"),
				field: "project_name",
				pinned: "left",
				minWidth: 280,
				headerCheckboxSelection: true,
				checkboxSelection: true,
				cellRenderer(params) {
					return portfolio.render_project_cell(params.data);
				},
			},
			{
				headerName: __("Type"),
				field: "project_type",
				minWidth: 140,
			},
			{
				headerName: __("Priority"),
				field: "priority",
				minWidth: 120,
			},
			{
				headerName: __("Status"),
				children: [
					{ headerName: __("Overall"), field: "status_overall", minWidth: 130 },
					{ headerName: __("Schedule"), field: "status_schedule", minWidth: 130 },
					{ headerName: __("Budget"), field: "status_budget", minWidth: 130 },
					{ headerName: __("Resources"), field: "status_resources", minWidth: 130 },
					{ headerName: __("Risks"), field: "status_risks", minWidth: 130 },
				],
			},
			{
				headerName: __("Active Stage"),
				field: "active_stage",
				minWidth: 160,
			},
			{
				headerName: __("Customer"),
				field: "customer",
				minWidth: 180,
			},
			{
				headerName: __("Department"),
				field: "department",
				minWidth: 180,
			},
			{
				headerName: __("Project Manager"),
				field: "project_manager",
				minWidth: 190,
			},
			{
				headerName: __("Dates"),
				children: [
					{
						headerName: __("Start"),
						field: "expected_start_date",
						minWidth: 120,
						valueFormatter: portfolio.format_date_value,
					},
					{
						headerName: __("End"),
						field: "expected_end_date",
						minWidth: 120,
						valueFormatter: portfolio.format_date_value,
					},
					{
						headerName: __("Current %"),
						field: "progress_current_percent",
						minWidth: 110,
						valueFormatter: portfolio.format_percent_value,
					},
				],
			},
			{
				headerName: __("Work"),
				children: [
					{
						headerName: __("Plan %"),
						field: "work_plan_percent",
						minWidth: 110,
						valueFormatter: portfolio.format_percent_value,
					},
					{
						headerName: __("Actual %"),
						field: "work_actual_percent",
						minWidth: 110,
						valueFormatter: portfolio.format_percent_value,
					},
				],
			},
			{
				headerName: __("Labor"),
				children: [
					{
						headerName: __("Plan Total"),
						field: "labor_plan_total",
						minWidth: 130,
						valueFormatter: portfolio.format_number_value,
					},
					{
						headerName: __("Actual Total"),
						field: "labor_actual_total",
						minWidth: 130,
						valueFormatter: portfolio.format_number_value,
					},
					{
						headerName: __("Forecast Total"),
						field: "labor_forecast_total",
						minWidth: 140,
						valueFormatter: portfolio.format_number_value,
					},
					{
						headerName: __("Plan Today"),
						field: "labor_plan_today",
						minWidth: 130,
						valueFormatter: portfolio.format_number_value,
					},
					{
						headerName: __("Actual Today"),
						field: "labor_actual_today",
						minWidth: 130,
						valueFormatter: portfolio.format_number_value,
					},
				],
			},
			{
				headerName: __("P&L"),
				children: [
					{
						headerName: __("Plan Total"),
						field: "pl_plan_total",
						minWidth: 140,
						valueFormatter: portfolio.format_currency_value,
					},
					{
						headerName: __("Actual Total"),
						field: "pl_actual_total",
						minWidth: 140,
						valueFormatter: portfolio.format_currency_value,
					},
					{
						headerName: __("Forecast Total"),
						field: "pl_forecast_total",
						minWidth: 150,
						valueFormatter: portfolio.format_currency_value,
					},
					{
						headerName: __("Plan Today"),
						field: "pl_plan_today",
						minWidth: 140,
						valueFormatter: portfolio.format_currency_value,
					},
					{
						headerName: __("Actual Today"),
						field: "pl_actual_today",
						minWidth: 140,
						valueFormatter: portfolio.format_currency_value,
					},
				],
			},
			{
				headerName: __("Nearest Milestone"),
				children: [
					{
						headerName: __("Milestone"),
						field: "nearest_milestone_subject",
						minWidth: 220,
					},
					{
						headerName: __("Forecast Date"),
						field: "nearest_milestone_date",
						minWidth: 140,
						valueFormatter: portfolio.format_date_value,
					},
				],
			},
		];
	};

	portfolio.render_project_cell = function (row) {
		if (!row) {
			return "";
		}
		const projectName = frappe.utils.escape_html(row.project || "");
		const projectTitle = frappe.utils.escape_html(row.project_name || row.project || "");
		const stageStatus = row.stage_gate_status
			? `<div class="portfolio-project-grid-meta">${frappe.utils.escape_html(row.stage_gate_status)}</div>`
			: "";
		return `<div class="portfolio-project-grid-project-cell">
			<div class="portfolio-project-grid-project-title">${projectTitle}</div>
			<div class="portfolio-project-grid-project-code">${projectName}</div>
			${stageStatus}
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
			const grid = frm?.page?.wrapper?.find?.(GRID_SELECTOR);
			grid?.removeClass?.(`${GRID_LIGHT_CLASS} ${GRID_DARK_CLASS} ${GRID_CUSTOM_DARK_CLASS}`);
			grid?.addClass?.(isDark ? `${GRID_DARK_CLASS} ${GRID_CUSTOM_DARK_CLASS}` : GRID_LIGHT_CLASS);
		}
		if (frm?._portfolioGridApi?.refreshCells) {
			frm._portfolioGridApi.refreshCells({ force: true });
		}
	};

	portfolio.get_grid_element = function (frm) {
		const grid = frm?.page?.wrapper?.find?.(GRID_SELECTOR);
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
		const shell = frm?.page?.wrapper ? portfolio.ensure_shell(frm) : null;
		if (shell?.removeButton?.length) {
			shell.removeButton.prop("disabled", selected.length === 0);
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
