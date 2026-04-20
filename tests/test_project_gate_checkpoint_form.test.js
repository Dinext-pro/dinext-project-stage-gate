const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const CHECKPOINT_SCRIPT_PATH =
	"/home/frappe/frappe-bench/apps/dinext_project_stage_gate/dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_gate_checkpoint/project_gate_checkpoint.js";

function loadCheckpointScript(translations = {}) {
	const script = fs.readFileSync(CHECKPOINT_SCRIPT_PATH, "utf8");
	const state = {
		throwCalls: [],
		handlers: {},
	};
	const locals = {
		"Project Gate Checklist Item": {
			ROW1: {
				is_mandatory: 1,
				item_title: "Gate review",
			},
		},
	};
	const context = {
		__(value) {
			return Object.prototype.hasOwnProperty.call(translations, value)
				? translations[value]
				: value;
		},
		cint(value) {
			return Number(value || 0);
		},
		locals,
		frappe: {
			ui: {
				form: {
					on(doctype, handlers) {
						state.handlers[doctype] = handlers;
					},
				},
			},
			throw(message) {
				state.throwCalls.push(message);
				throw new Error(message);
			},
		},
	};

	vm.runInNewContext(script, context);

	return {
		locals,
		state,
		checklistHandlers: state.handlers["Project Gate Checklist Item"],
	};
}

test("mandatory checklist removal uses English source string that can be translated", () => {
	const { checklistHandlers, state } = loadCheckpointScript({
		"Cannot delete mandatory checklist item: ": "Нельзя удалить обязательный пункт чеклиста: ",
	});

	assert.equal(typeof checklistHandlers.before_checklist_remove, "function");

	assert.throws(
		() =>
			checklistHandlers.before_checklist_remove(
				{},
				"Project Gate Checklist Item",
				"ROW1"
			),
		/Нельзя удалить обязательный пункт чеклиста: Gate review\./
	);
	assert.deepEqual(state.throwCalls, ["Нельзя удалить обязательный пункт чеклиста: Gate review."]);
});
