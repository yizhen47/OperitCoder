import React from "react"
import { render, screen } from "@/utils/test-utils"
import { describe, it, expect, vi } from "vitest"

import McpView from "../McpView"

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		mcpServers: [],
		alwaysAllowMcp: false,
		mcpEnabled: true,
		enableMcpServerCreation: false,
		setEnableMcpServerCreation: vi.fn(),
	}),
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	VSCodePanels: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	VSCodePanelTab: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	VSCodePanelView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

describe("McpView compact controls", () => {
	it("renders icon-only MCP action buttons", () => {
		render(<McpView hideHeader onDone={() => {}} />)

		expect(screen.getByRole("button", { name: "mcp:editGlobalMCP" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "mcp:editProjectMCP" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "mcp:refreshMCP" })).toBeInTheDocument()

		expect(screen.queryByText("mcp:editGlobalMCP")).toBeNull()
		expect(screen.queryByText("mcp:editProjectMCP")).toBeNull()
		expect(screen.queryByText("mcp:refreshMCP")).toBeNull()
	})
})
