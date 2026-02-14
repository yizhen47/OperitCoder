import React from "react"
import { describe, expect, it } from "vitest"
import { render, fireEvent } from "@/utils/test-utils"
import type { ClineMessage } from "@roo-code/types"

import { ToolCallsGroupRow } from "../ToolCallsGroupRow"

function toolMsg(ts: number, partial?: boolean): ClineMessage {
	return { type: "ask", ask: "tool", ts, partial, text: "{\"tool\":\"x\"}" } as any
}

function toolResultMsg(ts: number, partial?: boolean): ClineMessage {
	return { type: "say", say: "tool" as any, ts, partial, text: "{\"tool\":\"x\",\"content\":\"ok\"}" } as any
}

describe("ToolCallsGroupRow", () => {
	it("stays expanded while incomplete and auto-collapses when complete", () => {
		const { queryByTestId, rerender } = render(
			<ToolCallsGroupRow
				groupMessages={[toolMsg(1, false)]}
				toolCallCount={3}
				hasReasoning={false}
				isComplete={false}
				renderToolMessage={() => <div data-testid="tool-row" />}
			/>,
		)

		expect(queryByTestId("tool-calls-group-expanded")).toBeInTheDocument()

		rerender(
			<ToolCallsGroupRow
				groupMessages={[toolMsg(1, false), toolResultMsg(2, false)]}
				toolCallCount={3}
				hasReasoning={false}
				isComplete={true}
				renderToolMessage={() => <div data-testid="tool-row" />}
			/>,
		)

		expect(queryByTestId("tool-calls-group-expanded")).not.toBeInTheDocument()
	})

	it("click enters user override and prevents later auto-collapse", () => {
		const { getByTestId, queryByTestId, rerender } = render(
			<ToolCallsGroupRow
				groupMessages={[toolResultMsg(1, false)]}
				toolCallCount={3}
				hasReasoning={false}
				isComplete={false}
				renderToolMessage={() => <div data-testid="tool-row" />}
			/>,
		)

		expect(queryByTestId("tool-calls-group-expanded")).toBeInTheDocument()
		fireEvent.click(getByTestId("tool-calls-group-toggle"))
		expect(queryByTestId("tool-calls-group-expanded")).not.toBeInTheDocument()

		rerender(
			<ToolCallsGroupRow
				groupMessages={[toolResultMsg(1, false)]}
				toolCallCount={3}
				hasReasoning={false}
				isComplete={true}
				renderToolMessage={() => <div data-testid="tool-row" />}
			/>,
		)

		expect(queryByTestId("tool-calls-group-expanded")).not.toBeInTheDocument()
	})
})
