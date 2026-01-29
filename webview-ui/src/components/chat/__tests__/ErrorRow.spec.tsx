import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { ErrorRow } from "../ErrorRow"

// Mock react-i18next with initReactI18next for i18n setup
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:error": "Error",
				"chat:troubleMessage": "Trouble",
				"chat:apiRequest.failed": "API Request Failed",
				"chat:apiRequest.streamingFailed": "Streaming Failed",
				"chat:apiRequest.cancelled": "Cancelled",
				"chat:diffError.title": "Diff Error",
			}
			return translations[key] || key
		},
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

// Mock clipboard hook
vi.mock("@src/utils/clipboard", () => ({
	useCopyToClipboard: () => ({
		copyWithFeedback: vi.fn().mockResolvedValue(true),
	}),
}))

describe("ErrorRow", () => {
	describe("basic rendering", () => {
		it("renders error message", () => {
			render(<ErrorRow type="error" message="Test error message" />)
			expect(screen.getByText("Error")).toBeInTheDocument()
			expect(screen.getByText("Test error message")).toBeInTheDocument()
		})

		it("renders custom title when provided", () => {
			render(<ErrorRow type="error" title="Custom Title" message="Test message" />)
			expect(screen.getByText("Custom Title")).toBeInTheDocument()
		})

		it("renders additional content when provided", () => {
			render(
				<ErrorRow
					type="error"
					message="Test message"
					additionalContent={<div data-testid="additional">Additional content</div>}
				/>,
			)
			expect(screen.getByTestId("additional")).toBeInTheDocument()
		})
	})

	describe("error types", () => {
		it("renders mistake_limit type with correct title", () => {
			render(<ErrorRow type="mistake_limit" message="Test message" />)
			expect(screen.getByText("Trouble")).toBeInTheDocument()
		})

		it("renders api_failure type with correct title", () => {
			render(<ErrorRow type="api_failure" message="Test message" />)
			expect(screen.getByText("API Request Failed")).toBeInTheDocument()
		})

		it("renders streaming_failed type with correct title", () => {
			render(<ErrorRow type="streaming_failed" message="Test message" />)
			expect(screen.getByText("Streaming Failed")).toBeInTheDocument()
		})

		it("renders cancelled type with correct title", () => {
			render(<ErrorRow type="cancelled" message="Test message" />)
			expect(screen.getByText("Cancelled")).toBeInTheDocument()
		})
	})
})
