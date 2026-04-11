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
		dinext_project_stage_gate.project.render_empty(widget, __("Save the project to initialize Stage-gate."));
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
		dinext_project_stage_gate.project.render_empty(widget, __("Unable to load Stage-gate data."));
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

dinext_project_stage_gate.project.render_empty = function (widget, message) {
	widget.html(
		`<div class="stage-gate-widget-header">
			<div>
				<div class="stage-gate-widget-title">${__("Stage-gate")}</div>
				<div class="stage-gate-widget-subtitle">${frappe.utils.escape_html(message)}</div>
			</div>
		</div>`
	);
};

dinext_project_stage_gate.project.render_chain = function (widget, stages) {
	if (!stages.length) {
		widget.remove();
		return;
	}

	const items = stages
		.map((stage) => {
			const status = stage.status || "Planned";
			const gateStatus = stage.gate_result || stage.checkpoints?.[0]?.status || __("Pending");
			const title = frappe.utils.escape_html(stage.stage_name || stage.stage || __("Unnamed stage"));
			const stageName = frappe.utils.escape_html(stage.name || "");
			const tooltip = frappe.utils.escape_html(
				(stage.checkpoints || [])
					.map(
						(checkpoint) =>
							`${checkpoint.checkpoint_level || __("Gate")}: ${checkpoint.status}`
					)
					.join(" | ") || gateStatus
			);

			return `<button type="button" class="stage-gate-node stage-gate-status-${frappe.scrub(
				status
			)}" data-stage-instance="${stageName}" title="${tooltip}">
				<span class="stage-gate-node-label">${title}</span>
				<span class="stage-gate-node-meta">${frappe.utils.escape_html(status)}</span>
				<span class="stage-gate-node-gate">${frappe.utils.escape_html(gateStatus)}</span>
			</button>`;
		})
		.join('<span class="stage-gate-connector" aria-hidden="true"></span>');

	widget.html(
		`<div class="stage-gate-widget-header">
			<div>
				<div class="stage-gate-widget-title">${__("Stage-gate")}</div>
				<div class="stage-gate-widget-subtitle">${__("Current lifecycle status across configured stages.")}</div>
			</div>
		</div>
		<div class="stage-gate-chain">${items}</div>`
	);

	widget.find("[data-stage-instance]").on("click", function () {
		const stageInstance = $(this).data("stage-instance");
		if (stageInstance) {
			frappe.set_route("Form", "Project Stage Instance", stageInstance);
		}
	});
};

