import type { ClineMessage } from "@roo-code/types"

type ToolCallsGroupMessage = ClineMessage & {
	type: "say"
	say: "tool_calls_group"
	toolMessages: ClineMessage[]
	toolCallCount: number
}

function isToolMessage(message: ClineMessage): boolean {
	return (
		(message.type === "ask" && message.ask === "tool") ||
		(message.type === "say" && (message.say as any) === "tool") ||
		(message.type === "ask" && message.ask === "use_mcp_server") ||
		(message.type === "say" && message.say === "mcp_server_response")
	)
}

export function groupToolCalls(messages: ClineMessage[], collapseThreshold = 3): ClineMessage[] {
	if (messages.length === 0) return messages

	const result: ClineMessage[] = []

	for (let i = 0; i < messages.length; i++) {
		const current = messages[i]!
		if (!isToolMessage(current)) {
			result.push(current)
			continue
		}

		const toolMessages: ClineMessage[] = []
		let toolCallCount = 0

		for (let j = i; j < messages.length; j++) {
			const next = messages[j]!
			if (!isToolMessage(next)) break
			toolMessages.push(next)
			if (next.type === "ask" && (next.ask === "tool" || next.ask === "use_mcp_server")) toolCallCount++
		}

		if (toolCallCount < collapseThreshold) {
			result.push(...toolMessages)
			i += toolMessages.length - 1
			continue
		}

		const ts = toolMessages[0]?.ts
		if (typeof ts !== "number") continue

		const groupMessage: ToolCallsGroupMessage = {
			type: "say",
			say: "tool_calls_group",
			ts,
			toolMessages,
			toolCallCount,
		} as any

		result.push(groupMessage as any)
		i += toolMessages.length - 1
	}

	return result
}
