import React from "react"
import { render } from "@/utils/test-utils"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { ChatRowContent } from "../ChatRow"

const mockVscodePostMessage = vi.fn()

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: (...args: any[]) => mockVscodePostMessage(...args),
	},
}))

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:slashCommand.wantsToRun": "Roo wants to run slash command:",
				"chat:slashCommand.didRun": "Roo ran slash command:",
			}
			return translations[key] || key
		},
	}),
	Trans: ({ i18nKey, children }: { i18nKey: string; children?: React.ReactNode }) => {
		return <>{children || i18nKey}</>
	},
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

// Mock VSCodeBadge
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeBadge: ({ children, ...props }: { children: React.ReactNode }) => <span {...props}>{children}</span>,
}))

const queryClient = new QueryClient()

const renderChatRowWithProviders = (message: any, isExpanded = false) => {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatRowContent
					message={message}
					isExpanded={isExpanded}
					isLast={false}
					isStreaming={false}
					onToggleExpand={mockOnToggleExpand}
					onSuggestionClick={mockOnSuggestionClick}
					onBatchFileResponse={mockOnBatchFileResponse}
					onFollowUpUnmount={mockOnFollowUpUnmount}
					isFollowUpAnswered={false}
				/>
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

const mockOnToggleExpand = vi.fn()
const mockOnSuggestionClick = vi.fn()
const mockOnBatchFileResponse = vi.fn()
const mockOnFollowUpUnmount = vi.fn()

describe("ChatRow - runSlashCommand tool", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should open file when clicking readFile single-file tool row", () => {
		const message: any = {
			type: "ask",
			ask: "tool",
			ts: Date.now(),
			text: JSON.stringify({
				tool: "readFile",
				path: "src/index.ts",
				content: "src/index.ts",
			}),
			partial: false,
		}

		const { getByTestId } = renderChatRowWithProviders(message)
		getByTestId("tool-call-toggle").click()
		expect(mockVscodePostMessage).toHaveBeenCalledWith({
			type: "openFile",
			text: "src/index.ts",
		})
	})

	it("should display runSlashCommand ask message with command only", () => {
		const message: any = {
			type: "ask",
			ask: "tool",
			ts: Date.now(),
			text: JSON.stringify({
				tool: "runSlashCommand",
				command: "init",
			}),
			partial: false,
		}

		const { getByText } = renderChatRowWithProviders(message)

		expect(getByText("Roo wants to run slash command:")).toBeInTheDocument()
		expect(getByText("/init")).toBeInTheDocument()
	})

	it("should display runSlashCommand ask message with command and args", () => {
		const message: any = {
			type: "ask",
			ask: "tool",
			ts: Date.now(),
			text: JSON.stringify({
				tool: "runSlashCommand",
				command: "test",
				args: "focus on unit tests",
				description: "Run project tests",
				source: "project",
			}),
			partial: false,
		}

		const { getByText } = renderChatRowWithProviders(message, true) // Pass true to expand

		expect(getByText("Roo wants to run slash command:")).toBeInTheDocument()
		expect(getByText("/test")).toBeInTheDocument()
		expect(getByText("Arguments:")).toBeInTheDocument()
		expect(getByText("focus on unit tests")).toBeInTheDocument()
		expect(getByText("Run project tests")).toBeInTheDocument()
		expect(getByText("project")).toBeInTheDocument()
	})

	it("should display runSlashCommand say message", () => {
		const message: any = {
			type: "say",
			say: "tool",
			ts: Date.now(),
			text: JSON.stringify({
				tool: "runSlashCommand",
				command: "deploy",
				source: "global",
			}),
			partial: false,
		}

		const { getByText } = renderChatRowWithProviders(message)

		expect(getByText("Roo ran slash command:")).toBeInTheDocument()
		expect(getByText("/deploy")).toBeInTheDocument()
		expect(getByText("global")).toBeInTheDocument()
	})

	it("should display sandboxPackageTool say result and mark true in green", () => {
		const message: any = {
			type: "say",
			say: "tool",
			ts: Date.now(),
			text: JSON.stringify({
				tool: "sandboxPackageTool",
				packageName: "time",
				toolName: "get_time",
				content: "true",
				isError: false,
			}),
			partial: false,
		}

		const { getByTestId, getByText } = renderChatRowWithProviders(message)

		expect(getByText("sandboxPackageTool")).toBeInTheDocument()
		expect(getByText("time / get_time")).toBeInTheDocument()

		const collapsed = getByTestId("tool-result-collapsed")
		expect(collapsed).toBeInTheDocument()
		expect(collapsed).toHaveTextContent("true")
		// true should be green
		expect(collapsed).toHaveClass("text-vscode-charts-green")
	})

	it("should expand tool result when clicked and limit height", () => {
		const message: any = {
			type: "say",
			say: "tool",
			ts: Date.now(),
			text: JSON.stringify({
				tool: "sandboxPackageTool",
				packageName: "time",
				toolName: "get_time",
				content: "true",
				isError: false,
			}),
			partial: false,
		}

		const { getByTestId, queryByTestId } = renderChatRowWithProviders(message)
		// initially collapsed
		expect(getByTestId("tool-result-collapsed")).toBeInTheDocument()
		expect(queryByTestId("tool-result-expanded")).toBeNull()
		getByTestId("tool-result-toggle").click()
		const expanded = getByTestId("tool-result-expanded")
		expect(expanded).toBeInTheDocument()
		// max height + scroll
		expect(expanded).toHaveClass("max-h-40")
		expect(expanded).toHaveClass("overflow-y-auto")
	})

	it("should display sandboxPackageTool say result in grey when error", () => {
		const message: any = {
			type: "say",
			say: "tool",
			ts: Date.now(),
			text: JSON.stringify({
				tool: "sandboxPackageTool",
				packageName: "time",
				toolName: "get_time",
				content: "{\"status\":\"error\",\"message\":\"bad\"}",
				isError: true,
			}),
			partial: false,
		}

		const { getByText } = renderChatRowWithProviders(message)

		const contentEl = getByText("{\"status\":\"error\",\"message\":\"bad\"}")
		expect(contentEl).toBeInTheDocument()
		// Uses unified grey styling now; no per-status color.
		expect(contentEl).toHaveClass("text-xs")
	})

	it("should show running placeholder for sandboxPackageTool when partial", () => {
		const message: any = {
			type: "say",
			say: "tool",
			ts: Date.now(),
			text: JSON.stringify({
				tool: "sandboxPackageTool",
				packageName: "time",
				toolName: "get_time",
				content: "",
				isError: false,
			}),
			partial: true,
		}

		const { getByTestId, getByText } = renderChatRowWithProviders(message)

		expect(getByText("sandboxPackageTool")).toBeInTheDocument()
		expect(getByText("time / get_time")).toBeInTheDocument()
		const collapsed = getByTestId("tool-result-collapsed")
		expect(collapsed).toBeInTheDocument()
		expect(collapsed).toHaveTextContent("执行中")
	})

	it("should display sandboxPackageTool invocation-only say message without rendering result", () => {
		const message: any = {
			type: "say",
			say: "tool",
			ts: Date.now(),
			text: JSON.stringify({
				tool: "sandboxPackageTool",
				packageName: "time",
				toolName: "get_time",
				content: "",
				isError: false,
			}),
			partial: true,
		}

		const { getByText, queryByTestId } = renderChatRowWithProviders(message)

		expect(getByText("sandboxPackageTool")).toBeInTheDocument()
		expect(getByText("time / get_time")).toBeInTheDocument()
		// No result should be rendered for invocation-only messages.
		expect(queryByTestId("tool-result-collapsed")).toBeNull()
	})
})
