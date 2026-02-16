import { describe, it, expect, beforeEach, vi } from "vitest"
import { webviewMessageHandler } from "../webviewMessageHandler"

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
	changeLanguage: vi.fn(),
}))

vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
	},
	workspace: {
		workspaceFolders: undefined,
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
			update: vi.fn(),
		})),
	},
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
	Uri: {
		parse: vi.fn((str) => ({ toString: () => str })),
		file: vi.fn((path) => ({ fsPath: path })),
	},
	env: {
		openExternal: vi.fn(),
		clipboard: {
			writeText: vi.fn(),
		},
	},
	commands: {
		executeCommand: vi.fn(),
	},
}))

describe("webviewMessageHandler - sandbox env secrets", () => {
	let provider: any

	beforeEach(() => {
		vi.clearAllMocks()

		provider = {
			context: {
				secrets: {
					store: vi.fn(async () => {}),
					get: vi.fn(async () => undefined),
					delete: vi.fn(async () => {}),
				},
			},
			postStateToWebview: vi.fn(async () => {}),
			contextProxy: {
				getValue: vi.fn(),
				setValue: vi.fn(async () => {}),
				globalStorageUri: { fsPath: "/test/path" },
			},
			log: vi.fn(),
		}
	})

	it("stores env var in SecretStorage", async () => {
		await webviewMessageHandler(provider, {
			type: "setSandboxEnvVar",
			envName: "MY_API_KEY",
			envValue: "abc123",
		} as any)

		expect(provider.context.secrets.store).toHaveBeenCalledWith("sandbox-env:MY_API_KEY", "abc123")
		expect(provider.postStateToWebview).toHaveBeenCalled()
	})

	it("deletes env var when setting empty value", async () => {
		await webviewMessageHandler(provider, {
			type: "setSandboxEnvVar",
			envName: "MY_API_KEY",
			envValue: "",
		} as any)

		expect(provider.context.secrets.delete).toHaveBeenCalledWith("sandbox-env:MY_API_KEY")
		expect(provider.postStateToWebview).toHaveBeenCalled()
	})

	it("deletes env var via deleteSandboxEnvVar", async () => {
		await webviewMessageHandler(provider, {
			type: "deleteSandboxEnvVar",
			envName: "MY_API_KEY",
		} as any)

		expect(provider.context.secrets.delete).toHaveBeenCalledWith("sandbox-env:MY_API_KEY")
		expect(provider.postStateToWebview).toHaveBeenCalled()
	})
})

