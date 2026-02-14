import React from "react"
import { render } from "@/utils/test-utils"
import { describe, it, expect } from "vitest"
import { ToolResultDisplay } from "../ToolResultDisplay"

describe("ToolResultDisplay - markdown images", () => {
	it("renders markdown image links as images", () => {
		const resultText = "Here is an image ![alt](https://example.com/a.png)"
		const { getByAltText } = render(<ToolResultDisplay resultText={resultText} />)

		expect(getByAltText("AI Generated Image")).toBeInTheDocument()
	})
})
