import React from "react"

import { render } from "@/utils/test-utils"

import { Markdown } from "../Markdown"

vi.mock("@src/utils/clipboard", () => ({
	useCopyToClipboard: () => ({
		copyWithFeedback: vi.fn().mockResolvedValue(true),
		showCopyFeedback: false,
	}),
}))

// The VSCode toolkit components are not needed for this test; stub them.
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

describe("Markdown", () => {
	it("does not mutate DOM during streaming updates (rerender + unmount)", () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		const { rerender, unmount } = render(<Markdown markdown="Hello" partial={true} />)
		rerender(<Markdown markdown="Hello world" partial={true} />)
		rerender(<Markdown markdown="Hello world!" partial={true} />)
		unmount()

		expect(
			consoleErrorSpy.mock.calls.some((call) =>
				String(call[0]).includes("Failed to execute 'removeChild'"),
			),
		).toBe(false)

		consoleErrorSpy.mockRestore()
	})
})
