import type { ClineMessage } from "@roo-code/types"

type ToolRunGroupMessage = ClineMessage & {
	type: "say"
	say: "tool_run_group"
	groupMessages: ClineMessage[]
	toolCallCount: number
	hasReasoning: boolean
	isComplete: boolean
}

function isToolMessage(message: ClineMessage): boolean {
	return (
		(message.type === "ask" && message.ask === "tool") ||
		(message.type === "say" && (message.say as any) === "tool") ||
		(message.type === "ask" && message.ask === "use_mcp_server") ||
		(message.type === "say" && message.say === "mcp_server_response")
	)
}

function isReasoningMessage(message: ClineMessage): boolean {
	return message.type === "say" && message.say === "reasoning"
}

function isTargetMessage(message: ClineMessage): boolean {
	return isToolMessage(message) || isReasoningMessage(message)
}

export function groupToolCalls(messages: ClineMessage[], collapseThreshold = 3): ClineMessage[] {
	if (messages.length === 0) return messages

	const result: ClineMessage[] = []

	for (let i = 0; i < messages.length; i++) {
		const current = messages[i]!
		if (!isTargetMessage(current)) {
			result.push(current)
			continue
		}

		const groupMessages: ClineMessage[] = []
		let toolCallCount = 0
		let hasReasoning = false

		for (let j = i; j < messages.length; j++) {
			const next = messages[j]!
			if (!isTargetMessage(next)) break
			groupMessages.push(next)
			if (isReasoningMessage(next)) hasReasoning = true
			if (next.type === "ask" && (next.ask === "tool" || next.ask === "use_mcp_server")) toolCallCount++
		}

		const shouldGroup =
			(hasReasoning && toolCallCount >= 1) ||
			(!hasReasoning && toolCallCount >= collapseThreshold)

		if (!shouldGroup) {
			result.push(...groupMessages)
			i += groupMessages.length - 1
			continue
		}

		const ts = groupMessages[0]?.ts
		if (typeof ts !== "number") continue

		const isComplete = i + groupMessages.length < messages.length

		const groupMessage: ToolRunGroupMessage = {
			type: "say",
			say: "tool_run_group",
			ts,
			groupMessages,
			toolCallCount,
			hasReasoning,
			isComplete,
		} as any

		result.push(groupMessage as any)
		i += groupMessages.length - 1
	}

	return result
}
