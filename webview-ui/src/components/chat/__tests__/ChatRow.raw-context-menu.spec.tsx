import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import ChatRow from "../ChatRow"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	initReactI18next: { type: "3rdParty", init: () => {} },
}))

// Mock clipboard
const mockWriteText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, "clipboard", {
	value: { writeText: mockWriteText },
	configurable: true,
})

function renderChatRow(message: any) {
	return render(
		<ExtensionStateContextProvider>
			<ChatRow
				message={message}
				isExpanded={false}
				isLast={false}
				isStreaming={false}
				onToggleExpand={() => {}}
				onHeightChange={() => {}}
				onSuggestionClick={() => {}}
				onBatchFileResponse={() => {}}
				onFollowUpUnmount={() => {}}
				isFollowUpAnswered={false}
			/>
		</ExtensionStateContextProvider>,
	)
}

describe("ChatRow - raw context menu", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("opens context menu on right-click and shows raw dialog", async () => {
		const ts = Date.now()
		const base: any = {
			type: "ask",
			ask: "command",
			ts,
			partial: false,
			text: "ls",
		}
		const output: any = {
			type: "say",
			say: "command_output",
			ts: ts + 1,
			partial: false,
			text: "file1.txt",
		}
		// Simulate the combined/rendered message that ChatView would pass to ChatRow
		const message: any = {
			...base,
			text: "ls\nOutput:file1.txt",
		}

		renderChatRow(message)
		fireEvent(
			window,
			new MessageEvent("message", {
				data: {
					type: "state",
					state: {
						apiConfiguration: {},
						clineMessages: [base, output],
					},
				},
			}),
		)

		const row = screen.getByTestId(`chat-row-${ts}`)
		fireEvent.contextMenu(row)

		expect(screen.getByTestId("message-raw-menu")).toBeInTheDocument()
		fireEvent.click(screen.getByText("全部复制"))
		expect(mockWriteText).toHaveBeenCalledWith("ls\nOutput:file1.txt")

		fireEvent.click(screen.getByText("查看源消息"))
		expect(await screen.findByText("消息原文")).toBeInTheDocument()
		expect(screen.getByText("Raw message.text")).toBeInTheDocument()
		// Should show source message selector buttons for combined sequences
		expect(screen.getByText("ask:command")).toBeInTheDocument()
		expect(screen.getByText("say:command_output")).toBeInTheDocument()
	})
})
