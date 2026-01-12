// npx vitest run __tests__/example-packages-toggle.spec.ts

import { getExamplePackageToolsWithToggleLists } from "../core/prompts/tools/native-tools/example_packages"
import { __test__getExamplePackagesSection } from "../core/prompts/system"

vi.mock("../core/tool-packages", async () => {
	const actual = await vi.importActual<typeof import("../core/tool-packages")>("../core/tool-packages")
	return {
		...actual,
		scanExamplePackages: vi.fn(),
	}
})

import { scanExamplePackages, type ToolPackage } from "../core/tool-packages"

function pkg(name: string, enabledByDefault: boolean, toolNames: string[]): ToolPackage {
	return {
		name,
		enabledByDefault,
		description: "",
		targets: [],
		tools: toolNames.map((toolName) => ({
			name: toolName,
			description: "",
			parameters: [],
		})),
	} as unknown as ToolPackage
}

describe("sandbox package toggles", () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it("getExamplePackageToolsWithToggleLists honors enabledByDefault and enabled/disabled overrides", async () => {
		const mocked = vi.mocked(scanExamplePackages)
		mocked.mockResolvedValueOnce([
			pkg("alpha", true, ["t1"]),
			pkg("beta", false, ["t2"]),
			pkg("gamma", true, ["t3"]),
		])

		const tools = await getExamplePackageToolsWithToggleLists("/ext", {
			enabledExamplePackages: ["beta"],
			disabledExamplePackages: ["gamma"],
		})

		const names = tools
			.filter((t): t is Extract<(typeof tools)[number], { type: "function" }> => t.type === "function")
			.map((t) => t.function.name)
		expect(names).toContain("pkg--alpha--t1")
		expect(names).toContain("pkg--beta--t2")
		expect(names).not.toContain("pkg--gamma--t3")
	})

	it("system example packages section filters packages with same override logic", async () => {
		const mocked = vi.mocked(scanExamplePackages)
		mocked.mockResolvedValueOnce([
			pkg("alpha", true, ["t1"]),
			pkg("beta", false, ["t2"]),
			pkg("gamma", true, ["t3"]),
		])

		const modeConfig = {
			groups: ["mcp"],
		} as any

		const section = await __test__getExamplePackagesSection(
			"/ext",
			modeConfig,
			"en",
			["beta"],
			["gamma"],
		)

		expect(section).toContain("## alpha")
		expect(section).toContain("### pkg--alpha--t1")
		expect(section).toContain("## beta")
		expect(section).toContain("### pkg--beta--t2")
		expect(section).not.toContain("## gamma")
		expect(section).not.toContain("### pkg--gamma--t3")
	})
})
