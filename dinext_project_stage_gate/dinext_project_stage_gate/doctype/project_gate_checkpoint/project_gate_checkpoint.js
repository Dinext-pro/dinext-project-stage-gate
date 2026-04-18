// Copyright (c) 2026, Dinext and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Gate Checkpoint", {
	refresh(frm) {
		_apply_checklist_delete_all_hidden(frm);
	},
});

frappe.ui.form.on("Project Gate Checklist Item", {
	before_checklist_remove(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (cint(row.is_mandatory)) {
			frappe.throw(
				__(
					"Нельзя удалить обязательный пункт чеклиста: "					
				) + row.item_title + "."
			);
		}
	},
});

function _apply_checklist_delete_all_hidden(frm) {
	const grid = frm.fields_dict.checklist && frm.fields_dict.checklist.grid;
	if (!grid || grid._dinext_hide_delete_all_applied) {
		return;
	}
	const orig_refresh_remove = grid.refresh_remove_rows_button.bind(grid);
	grid.refresh_remove_rows_button = () => {
		orig_refresh_remove();
		if (grid.remove_all_rows_button && grid.remove_all_rows_button.length) {
			grid.remove_all_rows_button.addClass("hidden").hide();
		}
	};
	grid._dinext_hide_delete_all_applied = true;
	grid.refresh_remove_rows_button();
}
