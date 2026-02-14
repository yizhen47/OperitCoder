import { describe, expect, it } from "vitest"
import type { ClineMessage } from "@roo-code/types"

import { groupToolCalls } from "../groupToolCalls"

function msg(partial: Partial<ClineMessage> & Pick<ClineMessage, "type" | "ts">): ClineMessage {
	return partial as any
}

describe("groupToolCalls", () => {
	it("inserts a tool_calls_group row when a text message is followed by >3 tool calls", () => {
		const input: ClineMessage[] = [
			msg({ type: "say", say: "text", ts: 1, text: "hi" }),
			msg({ type: "ask", ask: "tool", ts: 2, text: "{\"tool\":\"a\"}" }),
			msg({ type: "say", say: "tool" as any, ts: 3, text: "{\"tool\":\"a\",\"content\":\"ok\"}" }),
			msg({ type: "ask", ask: "tool", ts: 4, text: "{\"tool\":\"b\"}" }),
			msg({ type: "say", say: "tool" as any, ts: 5, text: "{\"tool\":\"b\",\"content\":\"ok\"}" }),
			msg({ type: "ask", ask: "tool", ts: 6, text: "{\"tool\":\"c\"}" }),
			msg({ type: "say", say: "tool" as any, ts: 7, text: "{\"tool\":\"c\",\"content\":\"ok\"}" }),
			msg({ type: "ask", ask: "tool", ts: 8, text: "{\"tool\":\"d\"}" }),
			msg({ type: "say", say: "tool" as any, ts: 9, text: "{\"tool\":\"d\",\"content\":\"ok\"}" }),
			msg({ type: "say", say: "text", ts: 10, text: "done" }),
		]

		const output = groupToolCalls(input, 3) as any[]

		expect(output).toHaveLength(3)
		expect(output[0].say).toBe("text")
		expect(output[1].say).toBe("tool_calls_group")
		expect(output[1].toolCallCount).toBe(4)
		expect(output[1].toolMessages).toHaveLength(8)
		expect(output[2].say).toBe("text")
	})

	it("does not group when tool call count is below threshold", () => {
		const input: ClineMessage[] = [
			msg({ type: "say", say: "text", ts: 1, text: "hi" }),
			msg({ type: "ask", ask: "tool", ts: 2, text: "{\"tool\":\"a\"}" }),
			msg({ type: "say", say: "tool" as any, ts: 3, text: "{\"tool\":\"a\",\"content\":\"ok\"}" }),
			msg({ type: "ask", ask: "tool", ts: 4, text: "{\"tool\":\"b\"}" }),
			msg({ type: "say", say: "tool" as any, ts: 5, text: "{\"tool\":\"b\",\"content\":\"ok\"}" }),
			msg({ type: "say", say: "text", ts: 8, text: "done" }),
		]

		const output = groupToolCalls(input, 3) as any[]
		expect(output.map((m) => m.ts)).toEqual(input.map((m) => m.ts))
	})
})
