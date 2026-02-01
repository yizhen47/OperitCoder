import React from "react"
import { render } from "@/utils/test-utils"

import BottomControls from "../BottomControls"

vi.mock("../rules/KiloRulesToggleModal", () => ({
	default: () => <div data-testid="kilo-rules-toggle-modal" />,
}))

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("BottomControls", () => {
	it("does not render a layout spacer that adds bottom gap", () => {
		const { container } = render(<BottomControls />)

		// No element with fixed height like h-6 should exist.
		expect(container.querySelector(".h-6")).toBeNull()
	})

	it("renders KiloRulesToggleModal mount", () => {
		const { getByTestId } = render(<BottomControls />)
		expect(getByTestId("kilo-rules-toggle-modal")).toBeInTheDocument()
	})
})
