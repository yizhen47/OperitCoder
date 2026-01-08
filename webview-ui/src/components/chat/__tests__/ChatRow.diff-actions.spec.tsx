import React from "react"
import { render, screen } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { ChatRowContent } from "../ChatRow"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: any) => {
			const map: Record<string, string> = {
				"chat:fileOperations.wantsToEdit": "Roo wants to edit this file",
				"chat:reasoning.thinking": "Thinking",
			}
			if (key === "chat:reasoning.seconds") {
				return `${options?.count ?? 0}s`
			}
			return map[key] || key
		},
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	initReactI18next: { type: "3rdParty", init: () => {} },
}))

// Mock CodeBlock (avoid ESM/highlighter costs)
vi.mock("@src/components/common/CodeBlock", () => ({
	default: () => null,
}))

const queryClient = new QueryClient()

function renderChatRow(message: any, isExpanded = false) {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatRowContent
					message={message}
					isExpanded={isExpanded}
					isLast={false}
					isStreaming={false}
					onToggleExpand={() => {}}
					onSuggestionClick={() => {}}
					onBatchFileResponse={() => {}}
					onFollowUpUnmount={() => {}}
					isFollowUpAnswered={false}
				/>
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ChatRow - inline diff stats and actions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("shows + and - counts for editedExistingFile ask", () => {
		const diff = "@@ -1,1 +1,1 @@\n-old\n+new\n"
		const message: any = {
			type: "ask",
			ask: "tool",
			ts: Date.now(),
			partial: false,
			text: JSON.stringify({
				tool: "editedExistingFile",
				path: "src/file.ts",
				diff,
				diffStats: { added: 1, removed: 1 },
			}),
		}

		renderChatRow(message, false)

		// Plus/minus counts
		expect(screen.getByText("+1")).toBeInTheDocument()
		expect(screen.getByText("-1")).toBeInTheDocument()
	})

	it("derives counts from searchAndReplace diff", () => {
		const diff = "-a\n-b\n+c\n"
		const message: any = {
			type: "ask",
			ask: "tool",
			ts: Date.now(),
			partial: false,
			text: JSON.stringify({
				tool: "searchAndReplace",
				path: "src/file.ts",
				diff,
				diffStats: { added: 1, removed: 2 },
			}),
		}

		renderChatRow(message)

		expect(screen.getByText("+1")).toBeInTheDocument()
		expect(screen.getByText("-2")).toBeInTheDocument()
	})

	it("counts only added lines for newFileCreated (ignores diff headers)", () => {
		const content = "a\nb\nc"
		const message: any = {
			type: "ask",
			ask: "tool",
			ts: Date.now(),
			partial: false,
			text: JSON.stringify({
				tool: "newFileCreated",
				path: "src/new-file.ts",
				content,
				diffStats: { added: 3, removed: 0 },
			}),
		}

		renderChatRow(message)

		// Should only count the three content lines as additions
		expect(screen.getByText("+3")).toBeInTheDocument()
		expect(screen.getByText("-0")).toBeInTheDocument()
	})

	it("counts only added lines for newFileCreated with trailing newline", () => {
		const content = "a\nb\nc\n"
		const message: any = {
			type: "ask",
			ask: "tool",
			ts: Date.now(),
			partial: false,
			text: JSON.stringify({
				tool: "newFileCreated",
				path: "src/new-file.ts",
				content,
				diffStats: { added: 3, removed: 0 },
			}),
		}

		renderChatRow(message)

		// Trailing newline should not increase the added count
		expect(screen.getByText("+3")).toBeInTheDocument()
		expect(screen.getByText("-0")).toBeInTheDocument()
	})

	it("shows reasoning duration label for completed reasoning messages", () => {
		const now = Date.now()
		const message: any = {
			type: "say",
			say: "reasoning",
			ts: now,
			partial: false,
			text: "Reasoning text",
			metadata: {
				reasoningDurationMs: 12_000,
				reasoningStartedAtMs: now - 12_000,
			},
		}

		renderChatRow(message)

		// Should show seconds label even when not streaming
		expect(screen.getByText("12s")).toBeInTheDocument()
	})

	it("keeps reasoning seconds label visible while message is partial (refresh scenario)", () => {
		const message: any = {
			type: "say",
			say: "reasoning",
			ts: Date.now(),
			partial: true,
			text: "Reasoning text",
		}

		renderChatRow(message)

		// Should show a seconds label immediately (even if 0s)
		expect(screen.getByText(/\d+s/)).toBeInTheDocument()
	})
})
