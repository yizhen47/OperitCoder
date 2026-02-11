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

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	Trans: ({ i18nKey, children }: { i18nKey: string; children?: React.ReactNode }) => {
		return <>{children || i18nKey}</>
	},
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

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

describe("ChatRow - MCP compact rendering", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders MCP tool call as compact row with response", () => {
		const message: any = {
			type: "ask",
			ask: "use_mcp_server",
			ts: Date.now(),
			text: JSON.stringify({
				type: "use_mcp_tool",
				serverName: "playwright",
				toolName: "browser_navigate",
				arguments: "{\"url\":\"https://example.com\"}",
				response: "OK",
			}),
			partial: false,
		}

		const { getByText, getByTestId } = renderChatRowWithProviders(message)

		expect(getByText("browser_navigate")).toBeInTheDocument()
		expect(getByText("server: playwright")).toBeInTheDocument()
		const collapsed = getByTestId("tool-result-collapsed")
		expect(collapsed).toBeInTheDocument()
		expect(collapsed).toHaveTextContent("OK")
	})

	it("renders MCP resource access as compact row with uri", () => {
		const message: any = {
			type: "ask",
			ask: "use_mcp_server",
			ts: Date.now(),
			text: JSON.stringify({
				type: "access_mcp_resource",
				serverName: "filesystem",
				uri: "file:///tmp/readme.md",
				response: "Error: missing",
			}),
			partial: false,
		}

		const { getByText, getByTestId } = renderChatRowWithProviders(message)

		expect(getByText("mcp_resource")).toBeInTheDocument()
		expect(getByText("server: filesystem | uri: file:///tmp/readme.md")).toBeInTheDocument()
		const collapsed = getByTestId("tool-result-collapsed")
		expect(collapsed).toBeInTheDocument()
		expect(collapsed).toHaveClass("text-vscode-errorForeground")
	})
})
