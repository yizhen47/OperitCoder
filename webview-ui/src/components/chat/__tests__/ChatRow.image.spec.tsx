import React from "react"
import { render } from "@/utils/test-utils"
import { describe, it, expect, vi } from "vitest"
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
	Trans: ({ children }: { children?: React.ReactNode }) => {
		return <>{children}</>
	},
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

const queryClient = new QueryClient()

const renderChatRowWithProviders = (message: any) => {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatRowContent
					message={message}
					isExpanded={false}
					isLast={false}
					isStreaming={false}
					onToggleExpand={vi.fn()}
					onSuggestionClick={vi.fn()}
					onBatchFileResponse={vi.fn()}
					onFollowUpUnmount={vi.fn()}
					isFollowUpAnswered={false}
				/>
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ChatRow - image say", () => {
	it("should render image from image payload", () => {
		const message: any = {
			type: "say",
			say: "image",
			ts: Date.now(),
			text: JSON.stringify({
				imageUri: "https://example.com/example.png",
				imagePath: "/tmp/example.png",
			}),
			partial: false,
		}

		const { getByAltText } = renderChatRowWithProviders(message)

		expect(getByAltText("AI Generated Image")).toBeInTheDocument()
	})
})
