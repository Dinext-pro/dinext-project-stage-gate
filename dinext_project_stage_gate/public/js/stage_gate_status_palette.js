frappe.provide("dinext_project_stage_gate.status_palette");

(function () {
	const palette = (dinext_project_stage_gate.status_palette =
		dinext_project_stage_gate.status_palette || {});

	const STAGE_HEX = {
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

	const CHECKPOINT_HEX = {
		light: {
			Draft: "#8f9aa8",
			"In Review": "#8ba0c9",
			Approved: "#739b7f",
			Rejected: "#c08b8b",
			Canceled: "#9787b0",
		},
		dark: {
			Draft: "#6a7d92",
			"In Review": "#5f7fbf",
			Approved: "#4e7d5c",
			Rejected: "#a85c5c",
			Canceled: "#6b5b8f",
		},
	};

	palette.getStageHexPalette = function (isDark) {
		return isDark ? STAGE_HEX.dark : STAGE_HEX.light;
	};

	palette.getStageHex = function (stageStatus, isDark) {
		const map = palette.getStageHexPalette(isDark);
		return map[stageStatus] || map.Planned || "#8f9aa8";
	};

	palette.getContrastTextColor = function (fill) {
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

	palette.buildRoadmapStatusPalette = function () {
		const toStage = (hexMap) =>
			Object.fromEntries(
				Object.entries(hexMap).map(([key, fill]) => [key, { fill, stroke: fill }])
			);

		return {
			light: {
				stage: toStage(STAGE_HEX.light),
				checkpoint: { ...CHECKPOINT_HEX.light },
				fallbackStage: { fill: "#8f9aa8", stroke: "#8f9aa8" },
				fallbackCheckpoint: "#8f9aa8",
			},
			dark: {
				stage: toStage(STAGE_HEX.dark),
				checkpoint: { ...CHECKPOINT_HEX.dark },
				fallbackStage: { fill: "#636f7c", stroke: "#636f7c" },
				fallbackCheckpoint: "#6a7d92",
			},
		};
	};
})();
