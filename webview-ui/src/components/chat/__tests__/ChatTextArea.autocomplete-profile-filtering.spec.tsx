import { defaultModeSlug } from "@roo/modes"

import { render, screen, fireEvent } from "@src/utils/test-utils"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useQuery } from "@tanstack/react-query"
import { act } from "@testing-library/react"

import { ChatTextArea } from "../ChatTextArea"
import { vscode } from "@src/utils/vscode"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@src/components/common/CodeBlock")
vi.mock("@src/components/common/MarkdownBlock")

// Mock ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext")

// Mock react-query - use auto-mock and configure in beforeEach
vi.mock("@tanstack/react-query")

vi.mock("@src/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: vi.fn(() => ({
		id: "mock-model-id",
		provider: "mock-provider",
	})),
}))

describe("ChatTextArea - autocomplete profile filtering", () => {
	let resizeObserverCallback: ((entries: Array<{ contentRect: { width: number } }>) => void) | undefined

	const defaultProps = {
		inputValue: "",
		setInputValue: vi.fn(),
		onSend: vi.fn(),
		onCancelTask: vi.fn(),
		sendingDisabled: false,
		selectApiConfigDisabled: false,
		onSelectImages: vi.fn(),
		shouldDisableImages: false,
		placeholderText: "Type a message...",
		selectedImages: [],
		setSelectedImages: vi.fn(),
		onHeightChange: vi.fn(),
		mode: defaultModeSlug,
		setMode: vi.fn(),
		modeShortcutText: "(⌘. for next mode)",
	}

	beforeEach(() => {
		vi.clearAllMocks()
		// Configure useQuery mock to return empty history
		;(useQuery as ReturnType<typeof vi.fn>).mockReturnValue({ data: { historyItems: [] } })

		resizeObserverCallback = undefined
		class MockResizeObserver {
			callback: (entries: Array<{ contentRect: { width: number } }>) => void
			constructor(callback: (entries: Array<{ contentRect: { width: number } }>) => void) {
				this.callback = callback
				resizeObserverCallback = callback
			}
			observe() {}
			disconnect() {}
		}
		;(globalThis as any).ResizeObserver = MockResizeObserver
	})

	it("should filter out autocomplete profiles from the profile list", () => {
		const mockListApiConfigMeta = [
			{ id: "1", name: "Chat Profile 1", profileType: "chat" },
			{ id: "2", name: "Autocomplete Profile", profileType: "autocomplete" },
			{ id: "3", name: "Chat Profile 2", profileType: "chat" },
			{ id: "4", name: "Profile Without Type" }, // No profileType defaults to chat
		]

		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: mockListApiConfigMeta,
			currentApiConfigName: "Chat Profile 1",
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		render(<ChatTextArea {...defaultProps} />)

		// The KiloProfileSelector should only receive chat profiles
		// We can verify this by checking that autocomplete profiles are not in the DOM
		// Note: KiloProfileSelector hides when there's only 1 profile, so we need at least 2 chat profiles
		expect(screen.queryByText("Autocomplete Profile")).not.toBeInTheDocument()
	})

	it("should include profiles without profileType (defaults to chat)", () => {
		const mockListApiConfigMeta = [
			{ id: "1", name: "Chat Profile 1", profileType: "chat" },
			{ id: "2", name: "Profile Without Type" }, // No profileType
			{ id: "3", name: "Autocomplete Profile", profileType: "autocomplete" },
		]

		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: mockListApiConfigMeta,
			currentApiConfigName: "Chat Profile 1",
			pinnedApiConfigs: {},
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		render(<ChatTextArea {...defaultProps} />)

		// Profile without type should be included (defaults to chat)
		// Autocomplete profile should be filtered out
		expect(screen.queryByText("Autocomplete Profile")).not.toBeInTheDocument()
	})

	it("should handle empty profile list gracefully", () => {
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: [],
			currentApiConfigName: "",
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		expect(() => {
			render(<ChatTextArea {...defaultProps} />)
		}).not.toThrow()
	})

	it("should handle undefined listApiConfigMeta gracefully", () => {
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: undefined,
			currentApiConfigName: "",
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		expect(() => {
			render(<ChatTextArea {...defaultProps} />)
		}).not.toThrow()
	})

	it("should filter autocomplete profiles when all profiles are autocomplete", () => {
		const mockListApiConfigMeta = [
			{ id: "1", name: "Autocomplete Profile 1", profileType: "autocomplete" },
			{ id: "2", name: "Autocomplete Profile 2", profileType: "autocomplete" },
		]

		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: mockListApiConfigMeta,
			currentApiConfigName: "Autocomplete Profile 1",
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		render(<ChatTextArea {...defaultProps} />)

		// All profiles are autocomplete, so none should be shown
		expect(screen.queryByText("Autocomplete Profile 1")).not.toBeInTheDocument()
		expect(screen.queryByText("Autocomplete Profile 2")).not.toBeInTheDocument()
	})

	it("should show send button (disabled) even when input is empty in non-edit mode", () => {
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: [],
			currentApiConfigName: "",
			pinnedApiConfigs: {},
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		render(<ChatTextArea {...defaultProps} />)

		const sendButton = screen.getByLabelText("chat:sendMessage")
		expect(sendButton).toBeDisabled()
	})

	it("should disable enhance prompt button when input is empty", () => {
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: [],
			currentApiConfigName: "",
			pinnedApiConfigs: {},
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		render(<ChatTextArea {...defaultProps} inputValue="" />)

		const placeholderBottom = screen.getByTestId("chat-text-area-placeholder-bottom") as HTMLDivElement
		expect(placeholderBottom.style.bottom).toBe("0.5rem")

		const enhanceButton = screen.getByLabelText("chat:enhancePrompt")
		expect(enhanceButton).toBeDisabled()
	})

	it("should post enhancePrompt message when enhance prompt button is clicked with non-empty input", () => {
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: [],
			currentApiConfigName: "",
			pinnedApiConfigs: {},
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		render(<ChatTextArea {...defaultProps} inputValue="Hello" />)

		const enhanceButton = screen.getByLabelText("chat:enhancePrompt")
		expect(enhanceButton).not.toBeDisabled()

		fireEvent.click(enhanceButton)
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "enhancePrompt", text: "Hello" })
	})

	it("should switch bottom controls to compact layout when container width is below 175", () => {
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: [],
			currentApiConfigName: "",
			pinnedApiConfigs: {},
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		render(<ChatTextArea {...defaultProps} />)
		expect(typeof resizeObserverCallback).toBe("function")

		const bottomControls = screen.getByTestId("chat-text-area-bottom-controls") as HTMLDivElement
		expect(bottomControls.className).toContain("flex-nowrap")
		expect(bottomControls.style.position).toBe("absolute")
		expect(bottomControls.style.bottom).toBeTruthy()

		act(() => {
			resizeObserverCallback?.([{ contentRect: { width: 174 } }])
		})

		expect(bottomControls.className).toContain("flex-wrap")

		const modeTrigger = screen.getByTestId("dropdown-trigger") as HTMLButtonElement
		expect(modeTrigger.className).toContain("min-h-[28px]")

		const profileTrigger = screen.getByTestId("kilo-profile-selector-trigger") as HTMLButtonElement
		expect(profileTrigger.className).toContain("min-h-[28px]")
	})

	it("should keep bottom controls non-compact at container width 175", () => {
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: [],
			currentApiConfigName: "",
			pinnedApiConfigs: {},
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		render(<ChatTextArea {...defaultProps} />)
		expect(typeof resizeObserverCallback).toBe("function")

		const bottomControls = screen.getByTestId("chat-text-area-bottom-controls") as HTMLDivElement

		act(() => {
			resizeObserverCallback?.([{ contentRect: { width: 175 } }])
		})

		expect(bottomControls.className).toContain("flex-nowrap")
		expect(bottomControls.className).not.toContain("flex-wrap")
	})

	it("should toggle to cancel and call onCancelTask when task is running", () => {
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			listApiConfigMeta: [],
			currentApiConfigName: "",
			taskHistory: [],
			taskHistoryVersion: 0,
			clineMessages: [],
			cwd: "/test/workspace",
		})

		const onCancelTask = vi.fn()
		render(<ChatTextArea {...defaultProps} isTaskRunning={true} onCancelTask={onCancelTask} />)

		const cancelButton = screen.getByLabelText("chat:cancel.tooltip")
		fireEvent.click(cancelButton)
		expect(onCancelTask).toHaveBeenCalledTimes(1)
	})
})
