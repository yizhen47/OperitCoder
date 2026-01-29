import { useTranslation } from "react-i18next"

import { render, screen } from "@/utils/test-utils"

import { CloudTaskButton } from "../CloudTaskButton"

// Mock the qrcode library
vi.mock("qrcode", () => ({
	default: {
		toCanvas: vi.fn((_canvas, _text, _options, callback) => {
			// Simulate successful QR code generation
			if (callback) {
				callback(null)
			}
		}),
	},
}))

// Mock react-i18next
vi.mock("react-i18next")

// Mock the cloud config
vi.mock("@roo-code/cloud/src/config", () => ({
	getRooCodeApiUrl: vi.fn(() => "https://app.example.com"),
}))

// Mock the extension state context
vi.mock("@/context/ExtensionStateContext", () => ({
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => children,
	useExtensionState: vi.fn(),
}))

// Mock clipboard utility
vi.mock("@/utils/clipboard", () => ({
	useCopyToClipboard: () => ({
		copyWithFeedback: vi.fn(),
		showCopyFeedback: false,
	}),
}))

const mockUseTranslation = vi.mocked(useTranslation)
const { useExtensionState } = await import("@/context/ExtensionStateContext")
const mockUseExtensionState = vi.mocked(useExtensionState)

describe("CloudTaskButton", () => {
	const mockT = vi.fn((key: string) => key)
	const mockItem = {
		id: "test-task-id",
		number: 1,
		ts: Date.now(),
		task: "Test Task",
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.01,
	}

	beforeEach(() => {
		vi.clearAllMocks()

		mockUseTranslation.mockReturnValue({
			t: mockT,
			i18n: {} as any,
			ready: true,
		} as any)

		// Default extension state with bridge enabled
		mockUseExtensionState.mockReturnValue({
			cloudUserInfo: {
				id: "test-user",
				email: "test@example.com",
				extensionBridgeEnabled: true,
			},
			cloudApiUrl: "https://app.example.com",
		} as any)
	})

	test("renders cloud task button when extension bridge is enabled", () => {
		render(<CloudTaskButton item={mockItem} />)

		expect(screen.queryByTestId("cloud-task-button")).not.toBeInTheDocument()
	})

	test("does not render when extension bridge is disabled", () => {
		mockUseExtensionState.mockReturnValue({
			cloudUserInfo: {
				id: "test-user",
				email: "test@example.com",
				extensionBridgeEnabled: false,
			},
			cloudApiUrl: "https://app.roocode.com",
		} as any)

		render(<CloudTaskButton item={mockItem} />)

		expect(screen.queryByTestId("cloud-task-button")).not.toBeInTheDocument()
	})

	test("does not render when cloudUserInfo is null", () => {
		mockUseExtensionState.mockReturnValue({
			cloudUserInfo: null,
			cloudApiUrl: "https://app.roocode.com",
		} as any)

		render(<CloudTaskButton item={mockItem} />)

		expect(screen.queryByTestId("cloud-task-button")).not.toBeInTheDocument()
	})

	test("does not render when item has no id", () => {
		const itemWithoutId = { ...mockItem, id: undefined }
		render(<CloudTaskButton item={itemWithoutId as any} />)

		expect(screen.queryByTestId("cloud-task-button")).not.toBeInTheDocument()
	})
})
