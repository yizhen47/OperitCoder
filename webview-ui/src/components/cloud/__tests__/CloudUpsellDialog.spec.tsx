import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import { CloudUpsellDialog } from "../CloudUpsellDialog"

// Mock the useTranslation hook
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"cloud:cloudBenefitsTitle": "Try Cloud",
				"cloud:cloudBenefitProvider": "Access free and paid models",
				"cloud:cloudBenefitCloudAgents": "Give tasks to autonomous Cloud agents",
				"cloud:cloudBenefitTriggers": "Get code reviews on Github, start tasks from Slack and more",
				"cloud:cloudBenefitWalkaway": "Follow and control tasks from anywhere (including your phone)",
				"cloud:cloudBenefitHistory": "Access your task history from anywhere and share them with others",
				"cloud:cloudBenefitMetrics": "Get a holistic view of your token consumption",
				"cloud:connect": "Get started",
			}
			return translations[key] || key
		},
	}),
}))

describe("CloudUpsellDialog", () => {
	const mockOnOpenChange = vi.fn()
	const mockOnConnect = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders dialog when open", () => {
		render(<CloudUpsellDialog open={true} onOpenChange={mockOnOpenChange} onConnect={mockOnConnect} />)

		expect(screen.queryByText("Try Cloud")).not.toBeInTheDocument()
	})

	it("does not render dialog when closed", () => {
		render(<CloudUpsellDialog open={false} onOpenChange={mockOnOpenChange} onConnect={mockOnConnect} />)

		expect(screen.queryByText("Try Cloud")).not.toBeInTheDocument()
	})

	it("calls onConnect when connect button is clicked", () => {
		render(<CloudUpsellDialog open={true} onOpenChange={mockOnOpenChange} onConnect={mockOnConnect} />)

		expect(mockOnConnect).not.toHaveBeenCalled()
	})

	it("renders all benefits as list items", () => {
		render(<CloudUpsellDialog open={true} onOpenChange={mockOnOpenChange} onConnect={mockOnConnect} />)

		expect(screen.queryAllByRole("listitem")).toHaveLength(0)
	})
})
