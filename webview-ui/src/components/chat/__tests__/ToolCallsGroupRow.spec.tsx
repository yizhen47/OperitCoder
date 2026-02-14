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
	it("defaults to expanded while active, then auto-collapses when done", () => {
		const { queryByTestId, rerender } = render(
			<ToolCallsGroupRow
				toolMessages={[toolMsg(1, false)]}
				toolCallCount={4}
				renderToolMessage={() => <div data-testid="tool-row" />}
			/>,
		)

		expect(queryByTestId("tool-calls-group-expanded")).toBeInTheDocument()

		rerender(
			<ToolCallsGroupRow
				toolMessages={[toolMsg(1, false), toolResultMsg(2, false)]}
				toolCallCount={4}
				renderToolMessage={() => <div data-testid="tool-row" />}
			/>,
		)

		expect(queryByTestId("tool-calls-group-expanded")).not.toBeInTheDocument()
	})

	it("treats a pending ask:tool as active (expanded by default)", () => {
		const { queryByTestId } = render(
			<ToolCallsGroupRow toolMessages={[toolMsg(1, false)]} toolCallCount={4} renderToolMessage={() => <div />} />,
		)

		expect(queryByTestId("tool-calls-group-expanded")).toBeInTheDocument()
	})

	it("toggles expansion on click", () => {
		const { getByTestId, queryByTestId } = render(
			<ToolCallsGroupRow toolMessages={[toolResultMsg(1, false)]} toolCallCount={4} renderToolMessage={() => <div />} />,
		)

		expect(queryByTestId("tool-calls-group-expanded")).not.toBeInTheDocument()
		fireEvent.click(getByTestId("tool-calls-group-toggle"))
		expect(queryByTestId("tool-calls-group-expanded")).toBeInTheDocument()
	})
})
