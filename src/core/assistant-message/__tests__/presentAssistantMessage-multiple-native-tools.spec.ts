// kilocode_change - new file
import { beforeEach, describe, expect, it, vi } from "vitest"

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

describe("presentAssistantMessage - Multiple Native Tools", () => {
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
			didCompleteReadingStream: true,
			didRejectTool: false,
			didAlreadyUseTool: false,
			diffEnabled: false,
			consecutiveMistakeCount: 0,
			clineMessages: [],
			api: {
				getModel: () => ({ id: "test-model", info: {} }),
			},
			browserSession: {
				closeBrowser: vi.fn().mockResolvedValue(undefined),
			},
			cwd: process.cwd(),
			recordToolUsage: vi.fn(),
			recordToolError: vi.fn(),
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({ allowExecution: true }),
			},
			providerRef: {
				deref: () => ({
					getState: vi.fn().mockResolvedValue({
						mode: "code",
						customModes: [],
						experiments: {
							multipleNativeToolCalls: true,
						},
					}),
				}),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
		}
	})

	it("executes two native read tools in one message", async () => {
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_1",
				name: "fetch_instructions",
				params: { task: "create_project" },
				partial: false,
				nativeArgs: { task: "create_project" },
			},
			{
				type: "tool_use",
				id: "tool_2",
				name: "fetch_instructions",
				params: { task: "apply_diff" },
				partial: false,
				nativeArgs: { task: "apply_diff" },
			},
		]

		await presentAssistantMessage(mockTask)

		const deadline = Date.now() + 3000
		while (!mockTask.userMessageContentReady && Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, 25))
		}

		const toolResults = mockTask.userMessageContent.filter((block: any) => block.type === "tool_result")
		expect(toolResults.length).toBe(2)
		expect(toolResults.map((result: any) => result.tool_use_id)).toEqual(expect.arrayContaining(["tool_1", "tool_2"]))
		expect(mockTask.userMessageContentReady).toBe(true)
	})
})
