import type { Mock } from "vitest"
import * as vscode from "vscode"
import { ClineProvider } from "../../core/webview/ClineProvider"

import { getVisibleProviderOrLog, registerCommands, setPanel } from "../registerCommands"

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

vi.mock("vscode", () => ({
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
	window: {
		createTextEditorDecorationType: vi.fn().mockReturnValue({ dispose: vi.fn() }),
	},
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/mock/workspace",
				},
			},
		],
	},
}))

vi.mock("../../core/webview/ClineProvider")

// Mock AgentManagerProvider to avoid spinning up the full implementation.
vi.mock("../../core/kilocode/agent-manager/AgentManagerProvider", () => ({
	AgentManagerProvider: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
	})),
}))

vi.mock("../../utils/commands", async () => {
	const actual = await vi.importActual<any>("../../utils/commands")
	return {
		...actual,
		getCommand: (id: string) => `operit-coder.${id}`,
	}
})

describe("getVisibleProviderOrLog", () => {
	let mockOutputChannel: vscode.OutputChannel

	beforeEach(() => {
		setPanel(undefined, "tab")
		setPanel(undefined, "sidebar")
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			hide: vi.fn(),
			name: "mock",
			replace: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		}
		vi.clearAllMocks()
	})

	it("returns the visible provider if found", () => {
		const mockProvider = {} as ClineProvider
		;(ClineProvider.getVisibleInstance as Mock).mockReturnValue(mockProvider)

		const result = getVisibleProviderOrLog(mockOutputChannel)

		expect(result).toBe(mockProvider)
		expect(mockOutputChannel.appendLine).not.toHaveBeenCalled()
	})

	it("logs and returns undefined if no provider found", () => {
		;(ClineProvider.getVisibleInstance as Mock).mockReturnValue(undefined)

		const result = getVisibleProviderOrLog(mockOutputChannel)

		expect(result).toBeUndefined()
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith("Cannot find any visible Operit Coder instances.")
	})

	it("prefers sidebar provider when tab panel is not active", () => {
		const mockActiveProvider = { id: "active" } as unknown as ClineProvider
		const mockSidebarProvider = { id: "sidebar" } as unknown as ClineProvider
		;(ClineProvider.getVisibleInstance as Mock).mockReturnValue(mockActiveProvider)
		;(ClineProvider as any).getInstanceForView = (ClineProvider as any).getInstanceForView ?? vi.fn()
		;((ClineProvider as any).getInstanceForView as Mock).mockReturnValue(mockSidebarProvider)

		const mockTabPanel = { active: false } as unknown as vscode.WebviewPanel
		const mockSidebarView = { visible: true } as unknown as vscode.WebviewView
		setPanel(mockTabPanel, "tab")
		setPanel(mockSidebarView, "sidebar")

		const result = getVisibleProviderOrLog(mockOutputChannel)
		expect(result).toBe(mockSidebarProvider)
	})

	it("prefers active tab provider when tab panel is active", () => {
		const mockActiveProvider = { id: "active" } as unknown as ClineProvider
		const mockSidebarProvider = { id: "sidebar" } as unknown as ClineProvider
		;(ClineProvider.getVisibleInstance as Mock).mockReturnValue(mockActiveProvider)
		;(ClineProvider as any).getInstanceForView = (ClineProvider as any).getInstanceForView ?? vi.fn()
		;((ClineProvider as any).getInstanceForView as Mock).mockReturnValue(mockSidebarProvider)

		const mockTabPanel = { active: true } as unknown as vscode.WebviewPanel
		const mockSidebarView = { visible: true } as unknown as vscode.WebviewView
		setPanel(mockTabPanel, "tab")
		setPanel(mockSidebarView, "sidebar")

		const result = getVisibleProviderOrLog(mockOutputChannel)
		expect(result).toBe(mockActiveProvider)
	})
})

describe("title bar command routing", () => {
	let registeredCallbacks: Map<string, (...args: any[]) => any>
	let mockRegisterCommand: any
	let mockExecuteCommand: any
	let mockContext: any
	let mockOutputChannel: vscode.OutputChannel

	beforeEach(() => {
		registeredCallbacks = new Map<string, (...args: any[]) => any>()
		mockRegisterCommand = vi.fn((commandId: string, cb: any) => {
			registeredCallbacks.set(commandId, cb)
			return { dispose: vi.fn() }
		})
		mockExecuteCommand = vi.fn().mockResolvedValue(undefined)
		;(vscode as any).commands = {
			executeCommand: mockExecuteCommand,
			registerCommand: mockRegisterCommand,
		}

		mockContext = { subscriptions: [] as any[] } as any
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			hide: vi.fn(),
			name: "mock",
			replace: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		}

		setPanel(undefined, "tab")
		setPanel(undefined, "sidebar")
		vi.clearAllMocks()
	})

	it("plusButtonClickedSidebar targets the sidebar provider", async () => {
		const mockSidebarProvider = {
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			refreshWorkspace: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
		} as any
		const mockTabProvider = {
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			refreshWorkspace: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
		} as any

		;(ClineProvider.getVisibleInstance as Mock).mockReturnValue(mockTabProvider)
		;(ClineProvider as any).getInstanceForView = (ClineProvider as any).getInstanceForView ?? vi.fn()
		;((ClineProvider as any).getInstanceForView as Mock).mockImplementation((view: any) => {
			return view?.active === true ? mockTabProvider : mockSidebarProvider
		})

		const mockTabPanel = { active: true } as unknown as vscode.WebviewPanel
		const mockSidebarView = { visible: true } as unknown as vscode.WebviewView
		setPanel(mockTabPanel, "tab")
		setPanel(mockSidebarView, "sidebar")

		registerCommands({ context: mockContext, outputChannel: mockOutputChannel, provider: {} as any })
		const cb = registeredCallbacks.get("operit-coder.plusButtonClickedSidebar")
		expect(cb).toBeTruthy()
		await cb?.()

		expect(mockSidebarProvider.removeClineFromStack).toHaveBeenCalled()
		expect(mockTabProvider.removeClineFromStack).not.toHaveBeenCalled()
	})

	it("plusButtonClickedTab targets the tab provider", async () => {
		const mockSidebarProvider = {
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			refreshWorkspace: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
		} as any
		const mockTabProvider = {
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			refreshWorkspace: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
		} as any

		;(ClineProvider.getVisibleInstance as Mock).mockReturnValue(mockSidebarProvider)
		;(ClineProvider as any).getInstanceForView = (ClineProvider as any).getInstanceForView ?? vi.fn()
		;((ClineProvider as any).getInstanceForView as Mock).mockImplementation((view: any) => {
			return view?.active === true ? mockTabProvider : mockSidebarProvider
		})

		const mockTabPanel = { active: true } as unknown as vscode.WebviewPanel
		const mockSidebarView = { visible: true } as unknown as vscode.WebviewView
		setPanel(mockTabPanel, "tab")
		setPanel(mockSidebarView, "sidebar")

		registerCommands({ context: mockContext, outputChannel: mockOutputChannel, provider: {} as any })
		const cb = registeredCallbacks.get("operit-coder.plusButtonClickedTab")
		expect(cb).toBeTruthy()
		await cb?.()

		expect(mockTabProvider.removeClineFromStack).toHaveBeenCalled()
		expect(mockSidebarProvider.removeClineFromStack).not.toHaveBeenCalled()
	})

	it("settingsButtonClickedSidebar targets the sidebar provider", async () => {
		const mockSidebarProvider = {
			postMessageToWebview: vi.fn(),
		} as any
		const mockTabProvider = {
			postMessageToWebview: vi.fn(),
		} as any

		;(ClineProvider.getVisibleInstance as Mock).mockReturnValue(mockTabProvider)
		;(ClineProvider as any).getInstanceForView = (ClineProvider as any).getInstanceForView ?? vi.fn()
		;((ClineProvider as any).getInstanceForView as Mock).mockImplementation((view: any) => {
			return view?.active === true ? mockTabProvider : mockSidebarProvider
		})

		setPanel({ active: true } as any, "tab")
		setPanel({ visible: true } as any, "sidebar")

		registerCommands({ context: mockContext, outputChannel: mockOutputChannel, provider: {} as any })
		const cb = registeredCallbacks.get("operit-coder.settingsButtonClickedSidebar")
		expect(cb).toBeTruthy()
		cb?.()

		expect(mockSidebarProvider.postMessageToWebview).toHaveBeenCalledWith({ type: "action", action: "settingsButtonClicked" })
		expect(mockTabProvider.postMessageToWebview).not.toHaveBeenCalledWith({ type: "action", action: "settingsButtonClicked" })
	})

	it("historyButtonClickedTab targets the tab provider", async () => {
		const mockSidebarProvider = {
			postMessageToWebview: vi.fn(),
		} as any
		const mockTabProvider = {
			postMessageToWebview: vi.fn(),
		} as any

		;(ClineProvider.getVisibleInstance as Mock).mockReturnValue(mockSidebarProvider)
		;(ClineProvider as any).getInstanceForView = (ClineProvider as any).getInstanceForView ?? vi.fn()
		;((ClineProvider as any).getInstanceForView as Mock).mockImplementation((view: any) => {
			return view?.active === true ? mockTabProvider : mockSidebarProvider
		})

		setPanel({ active: true } as any, "tab")
		setPanel({ visible: true } as any, "sidebar")

		registerCommands({ context: mockContext, outputChannel: mockOutputChannel, provider: {} as any })
		const cb = registeredCallbacks.get("operit-coder.historyButtonClickedTab")
		expect(cb).toBeTruthy()
		cb?.()

		expect(mockTabProvider.postMessageToWebview).toHaveBeenCalledWith({ type: "action", action: "historyButtonClicked" })
		expect(mockSidebarProvider.postMessageToWebview).not.toHaveBeenCalledWith({ type: "action", action: "historyButtonClicked" })
	})
})

describe("agentManagerOpen", () => {
	it("executes openInNewTab command", async () => {
		const mockExecuteCommand = vi.fn().mockResolvedValue(undefined)
		const registeredCallbacks = new Map<string, (...args: any[]) => any>()
		const mockRegisterCommand = vi.fn((commandId: string, cb: any) => {
			registeredCallbacks.set(commandId, cb)
			// Return a disposable
			return { dispose: vi.fn() }
		})

		;(vscode as any).commands = {
			executeCommand: mockExecuteCommand,
			registerCommand: mockRegisterCommand,
		}

		const mockContext = { subscriptions: [] as any[] } as any
		const mockOutputChannel = { appendLine: vi.fn() } as any
		const mockProvider = {} as any

		registerCommands({ context: mockContext, outputChannel: mockOutputChannel, provider: mockProvider })

		const agentManagerOpenCb = registeredCallbacks.get("operit-coder.agentManagerOpen")
		expect(agentManagerOpenCb).toBeTruthy()
		await agentManagerOpenCb?.()

		expect(mockExecuteCommand).toHaveBeenCalledWith("operit-coder.openInNewTab")
	})
})
