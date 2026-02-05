import React from "react"
import { render, fireEvent } from "@/utils/test-utils"

import CodeAccordian from "../CodeAccordian"
import { vscode } from "@src/utils/vscode"

type CodeAccordianProps = React.ComponentProps<typeof CodeAccordian>

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("CodeAccordian", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should open file on header double click", async () => {
		const props: CodeAccordianProps = {
			path: "src/foo.ts",
			code: "diff --git a/src/foo.ts b/src/foo.ts",
			language: "diff",
			isExpanded: false,
			onToggleExpand: vi.fn(),
		}

		const { getByText } = render(<CodeAccordian {...props} />)

		const fileText = getByText("src/foo.ts")
		const header = fileText.closest("div") as HTMLElement
		expect(header).toBeTruthy()

		fireEvent.dblClick(header)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "openDiffView",
			text: "src/foo.ts",
			values: { diff: "diff --git a/src/foo.ts b/src/foo.ts" },
		})
	})

	it("should not toggle expand when header is double clicked", async () => {
		const onToggleExpand = vi.fn()

		const props: CodeAccordianProps = {
			path: "src/foo.ts",
			code: "diff --git a/src/foo.ts b/src/foo.ts",
			language: "diff",
			isExpanded: false,
			onToggleExpand,
		}

		const { getByText } = render(<CodeAccordian {...props} />)

		const fileText = getByText("src/foo.ts")
		const header = fileText.closest("div") as HTMLElement

		fireEvent.dblClick(header)

		await new Promise((r) => setTimeout(r, 250))
		expect(onToggleExpand).not.toHaveBeenCalled()
	})

	it("should prefer diff preview on header double click even when onJumpToFile is provided", async () => {
		const onJumpToFile = vi.fn()

		const props: CodeAccordianProps = {
			path: "src/foo.ts",
			code: "diff --git a/src/foo.ts b/src/foo.ts",
			language: "diff",
			isExpanded: false,
			onToggleExpand: vi.fn(),
			onJumpToFile,
		}

		const { getByText } = render(<CodeAccordian {...props} />)

		const fileText = getByText("src/foo.ts")
		const header = fileText.closest("div") as HTMLElement

		fireEvent.dblClick(header)

		expect(onJumpToFile).not.toHaveBeenCalled()
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "openDiffView",
			text: "src/foo.ts",
			values: { diff: "diff --git a/src/foo.ts b/src/foo.ts" },
		})
	})

	it("should normalize unified diff a/ prefix on header double click", async () => {
		const props: CodeAccordianProps = {
			path: "a/src/foo.ts",
			code: "diff --git a/src/foo.ts b/src/foo.ts",
			language: "diff",
			isExpanded: false,
			onToggleExpand: vi.fn(),
		}

		const { getByText } = render(<CodeAccordian {...props} />)

		const fileText = getByText("a/src/foo.ts")
		const header = fileText.closest("div") as HTMLElement

		fireEvent.dblClick(header)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "openDiffView",
			text: "src/foo.ts",
			values: { diff: "diff --git a/src/foo.ts b/src/foo.ts" },
		})
	})
})
