frappe.provide("dinext_project_stage_gate.project");

frappe.ui.form.on("Project", {
	refresh(frm) {
		dinext_project_stage_gate.project.refresh_widget(frm);
	},
});

dinext_project_stage_gate.project.refresh_widget = async function (frm) {
	if (!frm || !frm.page || !frm.page.wrapper) {
		return;
	}

	const page = frm.page.wrapper;
	if (!frm.doc.governance_model) {
		dinext_project_stage_gate.project.remove_widget(page);
		return;
	}

	await dinext_project_stage_gate.project.ensure_assets();

	let widget = page.find(".stage-gate-widget-root");
	if (!widget.length) {
		widget = $('<section class="stage-gate-widget-root"></section>');
		page.find(".layout-main-section").first().prepend(widget);
	}

	if (!frm.doc.name || frm.is_new()) {
		dinext_project_stage_gate.project.remove_widget(page);		
		return;
	}

	try {
		const response = await frappe.call({
			method: "dinext_project_stage_gate.stage_gate.api.get_project_stage_chain",
			args: { project: frm.doc.name },
		});
		dinext_project_stage_gate.project.render_chain(widget, response.message || []);
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

	const items = stages
		.map((stage, index) => {
			const status = stage.status || "Planned";
			const statusLabel = dinext_project_stage_gate.project.translate_status(status);
			const gateStatus = stage.gate_result || stage.checkpoints?.[0]?.status || "Pending";
			const gateStatusLabel = dinext_project_stage_gate.project.translate_status(gateStatus);
			const title = frappe.utils.escape_html(stage.stage_name || stage.stage || __("Unnamed stage"));
			const stageName = frappe.utils.escape_html(stage.name || "");
			const tooltipParts = [
				`${__("Status")}: ${statusLabel}`,
				`${__("Gate")}: ${gateStatusLabel}`,
			];
			const checkpointSummary = (stage.checkpoints || [])
				.map(
					(checkpoint) =>
						`${checkpoint.checkpoint_level || __("Gate")}: ${dinext_project_stage_gate.project.translate_status(checkpoint.status)}`
				)
				.join(" | ");
			if (checkpointSummary) {
				tooltipParts.push(checkpointSummary);
			}
			const tooltip = frappe.utils.escape_html(tooltipParts.join(" | "));

			return `<button type="button" class="stage-gate-node stage-gate-status-${frappe.scrub(
				status
			)}" data-stage-instance="${stageName}" title="${tooltip}" aria-label="${title}" style="--stage-order: ${index};">
				<span class="stage-gate-node-label">${title}</span>
			</button>`;
		})
		.join("");

	widget.html(
		`<div class="stage-gate-chain">${items}</div>`
	);

	widget.find("[data-stage-instance]").on("click", function () {
		const stageInstance = $(this).data("stage-instance");
		if (stageInstance) {
			frappe.set_route("Form", "Project Stage Instance", stageInstance);
		}
	});
};

dinext_project_stage_gate.project.translate_status = function (value) {
	return value ? __(value) : value;
};

