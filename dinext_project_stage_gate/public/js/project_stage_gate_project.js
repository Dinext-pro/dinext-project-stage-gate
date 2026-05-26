frappe.provide("dinext_project_stage_gate.project");

frappe.ui.form.on("Project", {
	refresh(frm) {
		frm._sg_prev_governance_model = frm.doc.governance_model;
		dinext_project_stage_gate.project.refresh_widget(frm);
	},
	after_save(frm) {
		frm._sg_prev_governance_model = frm.doc.governance_model;
	},
	governance_model(frm) {
		if (frm.is_new()) {
			frm._sg_prev_governance_model = frm.doc.governance_model;
			return;
		}
		const prev = frm._sg_prev_governance_model;
		const nextVal = frm.doc.governance_model;
		if (prev === nextVal) {
			return;
		}
		if (!frm.doc.current_stage_instance) {
			frm._sg_prev_governance_model = nextVal;
			return;
		}
		const message = __(
			"This will cancel the current stage gate chain: all Project Stage Instances, " +
				"Project Gate Checkpoints, and checklist items for this project will be set to Canceled. " +
				"Historical rows stay in the database but are hidden from the active roadmap. " +
				"You can assign a new Governance Model afterward or leave the project without one. Continue?"
		);
		frappe.confirm(
			message,
			() => {
				frm.set_value("confirm_governance_reset", 1).then(() => {
					frm._sg_prev_governance_model = nextVal;
				});
			},
			() => {
				frm.set_value("governance_model", prev).then(() => {
					frm._sg_prev_governance_model = prev;
				});
			}
		);
	},
});

$(document).on("form-unload", function (e, frm) {
	if (!frm.doc || frm.is_new()) {
		return;
	}
	const page = frm.page.wrapper;
	dinext_project_stage_gate.project.remove_widget(page);
});

dinext_project_stage_gate.project.refresh_widget = async function (frm) {
	if (!frm || !frm.page || !frm.page.wrapper) {
		return;
	}

	const page = frm.page.wrapper;
	dinext_project_stage_gate.project.remove_widget(page);

	if (!frm.doc.governance_model) {
		dinext_project_stage_gate.project.add_view_menu_items(frm);
		return;
	}

	if (!frm.doc.name || frm.is_new()) {
		return;
	}

	await dinext_project_stage_gate.project.ensure_assets();

	let widget = page.find(".stage-gate-widget-root");
	if (!widget.length) {
		widget = $('<section class="stage-gate-widget-root"></section>');
		page.find(".layout-main-section").first().prepend(widget);
	}

	try {
		const response = await frappe.call({
			method: "dinext_project_stage_gate.stage_gate.api.get_project_stage_chain",
			args: { project: frm.doc.name },
		});
		const stages = response.message || [];
		dinext_project_stage_gate.project.render_chain(widget, stages);
		dinext_project_stage_gate.project.add_view_menu_items(frm, stages);
	} catch (error) {
		console.error("Failed to load Stage-gate widget", error);
		dinext_project_stage_gate.project.remove_widget(page);
	}
};

dinext_project_stage_gate.project.remove_widget = function (page) {
	const widget = page.find(".stage-gate-widget-root");
	if (widget.length) {
		widget.remove();
	}
};

dinext_project_stage_gate.project.add_view_menu_items = function (frm, stages) {
	if (!frm || !frm.doc || frm.is_new() || !frm.doc.name) {
		return;
	}
	if (frm.doc.governance_model) {
		const ver = cint(frm.doc.stage_chain_version) || 1;
		const filters = {
			project: frm.doc.name,
			stage_chain_version: ver,
		};
		const has_stages = (stages || []).length > 0;
		const has_checkpoints = (stages || []).some((s) => (s.checkpoints || []).length > 0);

		if (has_stages && frappe.model.can_read("Project Stage Instance")) {
			frm.add_custom_button(
				__("Stage List"),
				() => {
					frappe.set_route("List", "Project Stage Instance", { ...filters });
				},
				__("View")
			);
		}
		if (has_checkpoints && frappe.model.can_read("Project Gate Checkpoint")) {
			frm.add_custom_button(
				__("Gate Checkpoint List"),
				() => {
					frappe.set_route("List", "Project Gate Checkpoint", { ...filters });
				},
				__("View")
			);
		}
	}
	if (frappe.perm.has_perm("Project Stage Gate Roadmap")) {
		frm.add_custom_button(
			"⇛" + " " + __("Roadmap"),
			() => {
				frappe.route_options = {
					project: frm.doc.name,
					roadmap_project_focus: 1,
					show_stages_and_checkpoints: 1,
					show_milestones: 1,
					active_only: frm.doc.is_active,
					task_types: ["Phase", "Stage", "Sprint"],
				};
				if (frm.doc.expected_start_date) {
					frappe.route_options.from_date = frm.doc.expected_start_date;
				}
				if (frm.doc.expected_end_date) {
					frappe.route_options.to_date = frm.doc.expected_end_date;
				}
				frappe.set_route("query-report", "Project Stage Gate Roadmap");
			},
			__("View")
		);
	}
};

dinext_project_stage_gate.project.ensure_assets = function () {
	if (dinext_project_stage_gate.project.assets_loaded) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		frappe.require(
			["/assets/dinext_project_stage_gate/css/project_stage_gate.css"],
			function () {
				dinext_project_stage_gate.project.assets_loaded = true;
				resolve();
			}
		);
	});
};

dinext_project_stage_gate.project.render_chain = function (widget, stages) {
	if (!stages.length) {
		widget.remove();
		return;
	}

	const items = [];
	let orderIndex = 0;

	stages.forEach((stage, index) => {
		const status = stage.status || "Planned";
		const statusLabel = dinext_project_stage_gate.project.translate_status(status);
		const gateStatus = stage.gate_result || stage.checkpoints?.[0]?.status || "Pending";
		const gateStatusLabel = dinext_project_stage_gate.project.translate_status(gateStatus);
		const title = frappe.utils.escape_html(stage.stage_name || stage.stage || __("Unnamed stage"));
		const stageName = frappe.utils.escape_html(stage.name || "");
		const tooltipParts = [`${__("Status")}: ${statusLabel}`];
		if (gateStatus) {
			tooltipParts.push(`${__("Gate")}: ${gateStatusLabel}`);
		}
		const tooltip = frappe.utils.escape_html(tooltipParts.join(" | "));

		items.push(`<button type="button" class="stage-gate-node stage-gate-status-${frappe.scrub(
			status
		)}" data-stage-instance="${stageName}" title="${tooltip}" aria-label="${title}" style="--stage-order: ${orderIndex};">
			<span class="stage-gate-node-label">${title}</span>
		</button>`);
		orderIndex += 1;

		(stage.checkpoints || []).forEach((checkpoint) => {
			const checkpointName = frappe.utils.escape_html(checkpoint.name || "");
			if (!checkpointName) {
				return;
			}
			const checkpointStatus = checkpoint.status || "Draft";
			const checkpointLevel = checkpoint.checkpoint_level || __("Gate");
			const checkpointStatusLabel = dinext_project_stage_gate.project.translate_status(checkpointStatus);
			const checkpointTooltip = frappe.utils.escape_html(
				`${checkpointLevel}: ${checkpointStatusLabel}`
			);
			const checkpointLabel = frappe.utils.escape_html(
				`${checkpointLevel} (${checkpointStatusLabel})`
			);

			items.push(`<button type="button" class="stage-gate-checkpoint stage-gate-cp-status-${frappe.scrub(
				checkpointStatus
			)}" data-checkpoint="${checkpointName}" title="${checkpointTooltip}" aria-label="${checkpointLabel}" style="--stage-order: ${orderIndex};">
				<span class="stage-gate-checkpoint-dot" aria-hidden="true"></span>
			</button>`);
			orderIndex += 1;
		});
	});

	widget.html(`<div class="stage-gate-chain">${items.join("")}</div>`);

	widget.find("[data-stage-instance]").on("click", function () {
		const stageInstance = $(this).data("stage-instance");
		if (stageInstance) {
			frappe.set_route("Form", "Project Stage Instance", stageInstance);
		}
	});

	widget.find("[data-checkpoint]").on("click", function () {
		const checkpointName = $(this).data("checkpoint");
		if (checkpointName) {
			frappe.set_route("Form", "Project Gate Checkpoint", checkpointName);
		}
	});
};

dinext_project_stage_gate.project.translate_status = function (value) {
	return value ? __(value) : value;
};
