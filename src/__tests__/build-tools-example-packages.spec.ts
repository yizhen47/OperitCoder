// pnpm test __tests__/build-tools-example-packages.spec.ts

import type OpenAI from "openai"

import { buildNativeToolsArray } from "../core/task/build-tools"

type MockedTool = OpenAI.Chat.ChatCompletionTool

vi.mock("../core/prompts/tools/filter-tools-for-mode", () => ({
	filterNativeToolsForMode: () => [],
	filterMcpToolsForMode: () => [],
	filterExampleToolsForMode: (tools: MockedTool[]) => tools,
}))

vi.mock("../services/code-index/manager", () => ({
	CodeIndexManager: {
		getInstance: () => ({}),
	},
}))

vi.mock("../core/prompts/tools/native-tools", () => {
	const mkTool = (name: string): MockedTool => ({
		type: "function",
		function: {
			name,
			description: "",
			parameters: { type: "object", properties: {}, additionalProperties: false },
		},
	})

	return {
		getNativeTools: () => [],
		getMcpServerTools: () => [],
		getExamplePackageToolsWithToggleLists: async (
			_extensionPath: string,
			options?: {
				enabledExamplePackages?: string[]
				disabledExamplePackages?: string[]
				activatedExamplePackages?: string[]
			},
		): Promise<MockedTool[]> => {
			const disabled = new Set((options?.disabledExamplePackages ?? []).map((x) => String(x).toLowerCase()))
			const enabledOverride = new Set((options?.enabledExamplePackages ?? []).map((x) => String(x).toLowerCase()))
			const activated = new Set((options?.activatedExamplePackages ?? []).map((x) => String(x).toLowerCase()))

			const alphaEnabled = enabledOverride.has("alpha") || !disabled.has("alpha")
			const betaEnabled = enabledOverride.has("beta") || !disabled.has("beta")
			const alphaActivated = activated.has("alpha")
			const betaActivated = activated.has("beta")

			const result: MockedTool[] = []
			if (alphaEnabled && alphaActivated) {
				result.push(mkTool("pkg--alpha--t1"))
			}
			if (betaEnabled && betaActivated) {
				result.push(mkTool("pkg--beta--t2"))
			}

			return result
		},
	}
})

describe("buildNativeToolsArray example package toggles", () => {
	it("does not include disabled example package tools in the native tools list", async () => {
		const provider = {
			context: { extensionPath: "/ext" },
			getMcpHub: () => undefined,
		} as any

		const tools = await buildNativeToolsArray({
			provider,
			cwd: "/cwd",
			mode: "code",
			customModes: [],
			experiments: {},
			apiConfiguration: { todoListEnabled: true } as any,
			maxReadFileLine: -1,
			browserToolEnabled: false,
			state: {
				enabledExamplePackages: [],
				disabledExamplePackages: ["alpha"],
			} as any,
			activatedExamplePackages: ["beta"],
			modelInfo: undefined,
			diffEnabled: true,
		})

		const names = tools
			.filter((t): t is Extract<(typeof tools)[number], { type: "function" }> => t.type === "function")
			.map((t) => t.function.name)

		expect(names).not.toContain("pkg--alpha--t1")
		expect(names).toContain("pkg--beta--t2")
	})
})
