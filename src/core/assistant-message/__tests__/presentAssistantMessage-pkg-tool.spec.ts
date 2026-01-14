// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage-pkg-tool.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { presentAssistantMessage } from "../presentAssistantMessage"

vi.mock("../../task/Task")
vi.mock("../../tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
}))
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

vi.mock("../../tool-packages", () => ({
	scanExamplePackages: vi.fn(),
}))

vi.mock("../../tool-packages/runtime/sandbox", () => ({
	executeSandboxedTool: vi.fn(),
}))

describe("presentAssistantMessage - pkg_tool_use", () => {
	let mockTask: any

	beforeEach(() => {
		mockTask = {
			taskId: "test-task-id",
			instanceId: "test-instance",
			abort: false,
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [],
			userMessageContent: [],
			userMessageContentReady: false,
			didCompleteReadingStream: true,
			didRejectTool: false,
			didAlreadyUseTool: false,
			diffEnabled: false,
			consecutiveMistakeCount: 0,
			providerRef: {
				deref: () => ({
					getState: vi.fn().mockResolvedValue({
						mode: "code",
						customModes: [],
					}),
					context: { extensionPath: "c:/ext" },
				}),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			checkpointSave: vi.fn().mockResolvedValue(undefined),
			currentStreamingDidCheckpoint: false,
		}
	})

	it("should execute pkg_tool_use and push a tool_result", async () => {
		const { scanExamplePackages } = await import("../../tool-packages")
		const { executeSandboxedTool } = await import("../../tool-packages/runtime/sandbox")

		;(scanExamplePackages as any).mockResolvedValue([
			{
				name: "time",
				enabledByDefault: true,
				sourcePath: "c:/ext/src/examples/time.js",
				tools: [
					{
						name: "get_time",
						script: "exports.get_time = async () => ({ ok: true })",
						parameters: [],
					},
				],
			},
		])

		;(executeSandboxedTool as any).mockResolvedValue({ ok: true })

		const toolCallId = "tool_call_pkg_123"
		mockTask.cwd = "/test"
		mockTask.assistantMessageContent = [
			{
				type: "pkg_tool_use",
				id: toolCallId,
				name: "pkg--time--get_time",
				packageName: "time",
				toolName: "get_time",
				arguments: {},
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("【Pkg Sandbox】开始调用"),
		)
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("【Pkg Sandbox】调用完成"),
		)

		const toolResult = mockTask.userMessageContent.find(
			(item: any) => item.type === "tool_result" && item.tool_use_id === toolCallId,
		)
		expect(toolResult).toBeDefined()
		expect(toolResult.content).toContain('"ok":true')
		expect(mockTask.ask).toHaveBeenCalledTimes(1)
		expect(mockTask.ask).toHaveBeenCalledWith("tool", expect.any(String), false, undefined, false)
		const approvalMessage = mockTask.ask.mock.calls[0]?.[1]
		const parsed = JSON.parse(approvalMessage || "{}")
		expect(parsed).toMatchObject({
			tool: "sandboxPackageTool",
			packageName: "time",
			toolName: "get_time",
			arguments: JSON.stringify({}),
		})
	})
})
