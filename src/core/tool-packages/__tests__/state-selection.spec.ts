import type { ToolPackage } from "../types"
import { evaluateStateCondition, resolveToolPackageToolsForCapabilities } from "../state-selection"

describe("tool-packages state selection", () => {
	it("evaluates basic boolean capability paths", () => {
		expect(evaluateStateCondition("ui.virtual_display", { ui: { virtual_display: true } })).toBe(true)
		expect(evaluateStateCondition("ui.virtual_display", { ui: { virtual_display: false } })).toBe(false)
	})

	it("supports membership checks with 'in' operator", () => {
		const caps = { android: { permission_level: "ROOT" } }
		expect(evaluateStateCondition("android.permission_level in ['ADMIN','ROOT']", caps)).toBe(true)
		expect(evaluateStateCondition("android.permission_level in ['ADMIN','USER']", caps)).toBe(false)
	})

	it("selects the first matching state and merges tools per rules", () => {
		const pkg: ToolPackage = {
			name: "pkg",
			description: "",
			tools: [
				{ name: "a", description: "", parameters: [], script: "// a" },
				{ name: "b", description: "", parameters: [], script: "// b" },
			],
			states: [
				{
					id: "state1",
					condition: "ui.virtual_display",
					inheritTools: true,
					excludeTools: ["a"],
					tools: [
						{ name: "b", description: "override", parameters: [], script: "// b2" },
						{ name: "c", description: "", parameters: [], script: "// c" },
					],
				},
			],
			env: [],
		}

		const resolved = resolveToolPackageToolsForCapabilities(pkg, { ui: { virtual_display: true } })
		expect(resolved.activeStateId).toBe("state1")
		expect(resolved.tools.map((t) => t.name)).toEqual(["b", "c"])
		expect(resolved.tools.find((t) => t.name === "b")?.script).toBe("// b2")
	})

	it("falls back to top-level tools when no state matches", () => {
		const pkg: ToolPackage = {
			name: "pkg",
			description: "",
			tools: [{ name: "top", description: "", parameters: [], script: "// top" }],
			states: [{ id: "state1", condition: "ui.virtual_display", inheritTools: true, tools: [] }],
			env: [],
		}

		const resolved = resolveToolPackageToolsForCapabilities(pkg, { ui: { virtual_display: false } })
		expect(resolved.activeStateId).toBeUndefined()
		expect(resolved.tools.map((t) => t.name)).toEqual(["top"])
	})
})

