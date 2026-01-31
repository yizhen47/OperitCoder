import { render, screen } from "@/utils/test-utils"

import { ReasoningBlock } from "../ReasoningBlock"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: any) => {
			if (key === "chat:reasoning.seconds") {
				return `${options?.count ?? 0}s`
			}
			if (key === "chat:reasoning.thinking") {
				return "Thinking"
			}
			return key
		},
	}),
}))

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		reasoningBlockCollapsed: true,
	}),
}))

describe("ReasoningBlock spacing", () => {
	it("should not apply margin/background/border to the content container when collapsed", async () => {
		render(
			<ReasoningBlock
				content="Some reasoning"
				ts={Date.now()}
				isPartial={false}
			/>,
		)

		await screen.findByText("Thinking")

		const content = screen.getByTestId("reasoning-content")
		expect(content.className).toContain("mt-0")
		expect(content.className).toContain("border-0")
		expect(content.className).toContain("bg-transparent")
	})
})
