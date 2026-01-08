import { render, screen, act } from "@/utils/test-utils"

import {
	ProviderSettings,
	ExperimentId,
	openRouterDefaultModelId, // kilocode_change
	type ClineMessage,
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
} from "@roo-code/types"

import { ExtensionState } from "@roo/ExtensionMessage"

import { ExtensionStateContextProvider, useExtensionState, mergeExtensionState } from "../ExtensionStateContext"

const TestComponent = () => {
	const {
		allowedCommands,
		setAllowedCommands,
		soundEnabled,
		showRooIgnoredFiles,
		setShowRooIgnoredFiles,
		autoApprovalEnabled,
		alwaysAllowReadOnly,
		alwaysAllowWrite,
	} = useExtensionState()
	return (
		<div>
			<div data-testid="allowed-commands">{JSON.stringify(allowedCommands)}</div>
			<div data-testid="sound-enabled">{JSON.stringify(soundEnabled)}</div>
			<div data-testid="show-rooignored-files">{JSON.stringify(showRooIgnoredFiles)}</div>
			<div data-testid="auto-approval-enabled">{JSON.stringify(autoApprovalEnabled)}</div>
			<div data-testid="always-allow-read-only">{JSON.stringify(alwaysAllowReadOnly)}</div>
			<div data-testid="always-allow-write">{JSON.stringify(alwaysAllowWrite)}</div>
			<button data-testid="update-button" onClick={() => setAllowedCommands(["npm install", "git status"])}>
				Update Commands
			</button>
			<button data-testid="toggle-rooignore-button" onClick={() => setShowRooIgnoredFiles(!showRooIgnoredFiles)}>
				Update Commands
			</button>
		</div>
	)
}

const StreamingMessageUpdatedTestComponent = () => {
	const { clineMessages } = useExtensionState()
	const last = clineMessages.at(-1)
	return (
		<div>
			<div data-testid="last-message-text">{last?.text ?? ""}</div>
			<div data-testid="last-message-partial">{String(last?.partial === true)}</div>
		</div>
	)
}

const ApiConfigTestComponent = () => {
	const { apiConfiguration, setApiConfiguration } = useExtensionState()

	return (
		<div>
			<div data-testid="api-configuration">{JSON.stringify(apiConfiguration)}</div>
			<button
				data-testid="update-api-config-button"
				onClick={() => setApiConfiguration({ apiModelId: "new-model", apiProvider: "anthropic" })}>
				Update API Config
			</button>
			<button data-testid="partial-update-button" onClick={() => setApiConfiguration({ modelTemperature: 0.7 })}>
				Partial Update
			</button>
		</div>
	)
}

describe("ExtensionStateContext", () => {
	it("initializes with empty allowedCommands array", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		expect(JSON.parse(screen.getByTestId("allowed-commands").textContent!)).toEqual([])
	})

	it("initializes with soundEnabled set to false", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		expect(JSON.parse(screen.getByTestId("sound-enabled").textContent!)).toBe(false)
	})

	it("initializes with showRooIgnoredFiles set to true", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		expect(JSON.parse(screen.getByTestId("show-rooignored-files").textContent!)).toBe(true)
	})

	it("initializes with autoApprovalEnabled set to true", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		expect(JSON.parse(screen.getByTestId("auto-approval-enabled").textContent!)).toBe(true)
	})

	it("initializes with alwaysAllowReadOnly set to true", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		expect(JSON.parse(screen.getByTestId("always-allow-read-only").textContent!)).toBe(true)
	})

	it("initializes with alwaysAllowWrite set to true", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		expect(JSON.parse(screen.getByTestId("always-allow-write").textContent!)).toBe(true)
	})

	it("updates showRooIgnoredFiles through setShowRooIgnoredFiles", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		act(() => {
			screen.getByTestId("toggle-rooignore-button").click()
		})

		expect(JSON.parse(screen.getByTestId("show-rooignored-files").textContent!)).toBe(false)
	})

	it("updates allowedCommands through setAllowedCommands", () => {
		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		act(() => {
			screen.getByTestId("update-button").click()
		})

		expect(JSON.parse(screen.getByTestId("allowed-commands").textContent!)).toEqual(["npm install", "git status"])
	})

	it("throws error when used outside provider", () => {
		// Suppress console.error for this test since we expect an error
		const consoleSpy = vi.spyOn(console, "error")
		consoleSpy.mockImplementation(() => {})

		expect(() => {
			render(<TestComponent />)
		}).toThrow("useExtensionState must be used within an ExtensionStateContextProvider")

		consoleSpy.mockRestore()
	})

	it("updates apiConfiguration through setApiConfiguration", () => {
		render(
			<ExtensionStateContextProvider>
				<ApiConfigTestComponent />
			</ExtensionStateContextProvider>,
		)

		const initialContent = screen.getByTestId("api-configuration").textContent!
		expect(initialContent).toBeDefined()

		act(() => {
			screen.getByTestId("update-api-config-button").click()
		})

		const updatedContent = screen.getByTestId("api-configuration").textContent!
		const updatedConfig = JSON.parse(updatedContent || "{}")

		expect(updatedConfig).toEqual(
			expect.objectContaining({
				apiModelId: "new-model",
				apiProvider: "anthropic",
			}),
		)
	})

	it("correctly merges partial updates to apiConfiguration", () => {
		render(
			<ExtensionStateContextProvider>
				<ApiConfigTestComponent />
			</ExtensionStateContextProvider>,
		)

		// First set the initial configuration
		act(() => {
			screen.getByTestId("update-api-config-button").click()
		})

		// Verify initial update
		const initialContent = screen.getByTestId("api-configuration").textContent!
		const initialConfig = JSON.parse(initialContent || "{}")
		expect(initialConfig).toEqual(
			expect.objectContaining({
				apiModelId: "new-model",
				apiProvider: "anthropic",
			}),
		)

		// Now perform a partial update
		act(() => {
			screen.getByTestId("partial-update-button").click()
		})

		// Verify that the partial update was merged with the existing configuration
		const updatedContent = screen.getByTestId("api-configuration").textContent!
		const updatedConfig = JSON.parse(updatedContent || "{}")
		expect(updatedConfig).toEqual(
			expect.objectContaining({
				apiModelId: "new-model", // Should retain this from previous update
				apiProvider: "anthropic", // Should retain this from previous update
				modelTemperature: 0.7, // Should add this from partial update
			}),
		)
	})

	it("delays messageUpdated for streaming text partials by 200ms", async () => {
		vi.useFakeTimers()

		render(
			<ExtensionStateContextProvider>
				<StreamingMessageUpdatedTestComponent />
			</ExtensionStateContextProvider>,
		)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "state",
						state: {
							apiConfiguration: {},
							clineMessages: [
								{
									ts: 1,
									type: "say",
									say: "text",
									text: "a",
									partial: true,
								} satisfies ClineMessage,
							],
						},
					},
				}),
			)
		})

		expect(screen.getByTestId("last-message-text").textContent).toBe("a")
		expect(screen.getByTestId("last-message-partial").textContent).toBe("true")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "messageUpdated",
						clineMessage: {
							ts: 1,
							type: "say",
							say: "text",
							text: "ab",
							partial: true,
						} satisfies ClineMessage,
					},
				}),
			)
		})

		// not updated immediately
		expect(screen.getByTestId("last-message-text").textContent).toBe("a")

		act(() => {
			vi.advanceTimersByTime(199)
		})
		expect(screen.getByTestId("last-message-text").textContent).toBe("a")

		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(screen.getByTestId("last-message-text").textContent).toBe("ab")

		vi.useRealTimers()
	})

	it("applies messageUpdated immediately when streaming text becomes complete", async () => {
		vi.useFakeTimers()

		render(
			<ExtensionStateContextProvider>
				<StreamingMessageUpdatedTestComponent />
			</ExtensionStateContextProvider>,
		)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "state",
						state: {
							apiConfiguration: {},
							clineMessages: [
								{
									ts: 2,
									type: "say",
									say: "text",
									text: "a",
									partial: true,
								} satisfies ClineMessage,
							],
						},
					},
				}),
			)
		})

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "messageUpdated",
						clineMessage: {
							ts: 2,
							type: "say",
							say: "text",
							text: "ab",
							partial: true,
						} satisfies ClineMessage,
					},
				}),
			)
		})

		act(() => {
			vi.advanceTimersByTime(100)
		})

		// still buffered
		expect(screen.getByTestId("last-message-text").textContent).toBe("a")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "messageUpdated",
						clineMessage: {
							ts: 2,
							type: "say",
							say: "text",
							text: "abc",
							partial: false,
						} satisfies ClineMessage,
					},
				}),
			)
		})

		// complete update should apply immediately (and cancel pending timer)
		expect(screen.getByTestId("last-message-text").textContent).toBe("abc")
		expect(screen.getByTestId("last-message-partial").textContent).toBe("false")

		act(() => {
			vi.advanceTimersByTime(500)
		})
		expect(screen.getByTestId("last-message-text").textContent).toBe("abc")

		vi.useRealTimers()
	})
})

describe("mergeExtensionState", () => {
	it("should correctly merge extension states", () => {
		const baseState: ExtensionState = {
			version: "",
			mcpEnabled: false,
			enableMcpServerCreation: false,
			clineMessages: [],
			taskHistoryFullLength: 0, // kilocode_change
			taskHistoryVersion: 0, // kilocode_change
			shouldShowAnnouncement: false,
			enableCheckpoints: true,
			writeDelayMs: 1000,
			requestDelaySeconds: 5,
			mode: "default",
			experiments: {} as Record<ExperimentId, boolean>,
			customModes: [],
			maxOpenTabsContext: 20,
			maxWorkspaceFiles: 100,
			apiConfiguration: { providerId: "openrouter" } as ProviderSettings,
			telemetrySetting: "unset",
			showRooIgnoredFiles: true,
			renderContext: "sidebar",
			maxReadFileLine: 500,
			showAutoApproveMenu: false,
			// kilocode_change: cloudUserInfo removed
			// kilocode_change: organizationAllowList removed
			autoCondenseContext: true,
			autoCondenseContextPercent: 100,
			// kilocode_change: cloudIsAuthenticated removed
			// kilocode_change: sharingEnabled removed
			profileThresholds: {},
			hasOpenedModeSelector: false, // Add the new required property
			maxImageFileSize: 5,
			maxTotalImageSize: 20,
			kilocodeDefaultModel: openRouterDefaultModelId,
			remoteControlEnabled: false,
			taskSyncEnabled: false,
			featureRoomoteControlEnabled: false,
			isBrowserSessionActive: false,
			checkpointTimeout: DEFAULT_CHECKPOINT_TIMEOUT_SECONDS, // Add the checkpoint timeout property
		}

		const prevState: ExtensionState = {
			...baseState,
			apiConfiguration: { modelMaxTokens: 1234, modelMaxThinkingTokens: 123 },
			experiments: {} as Record<ExperimentId, boolean>,
			checkpointTimeout: DEFAULT_CHECKPOINT_TIMEOUT_SECONDS - 5,
		}

		const newState: ExtensionState = {
			...baseState,
			apiConfiguration: { modelMaxThinkingTokens: 456, modelTemperature: 0.3 },
			experiments: {
				powerSteering: true,
				multiFileApplyDiff: true,
				preventFocusDisruption: false,
				morphFastApply: false, // kilocode_change
				speechToText: false, // kilocode_change
				newTaskRequireTodos: false,
				imageGeneration: false,
				runSlashCommand: false,
				nativeToolCalling: false,
				multipleNativeToolCalls: false,
			} as Record<ExperimentId, boolean>,
			checkpointTimeout: DEFAULT_CHECKPOINT_TIMEOUT_SECONDS + 5,
		}

		const result = mergeExtensionState(prevState, newState)

		expect(result.apiConfiguration).toEqual({
			modelMaxThinkingTokens: 456,
			modelTemperature: 0.3,
		})

		expect(result.experiments).toEqual({
			powerSteering: true,
			multiFileApplyDiff: true,
			preventFocusDisruption: false,
			morphFastApply: false, // kilocode_change
			speechToText: false, // kilocode_change
			newTaskRequireTodos: false,
			imageGeneration: false,
			runSlashCommand: false,
			nativeToolCalling: false,
			multipleNativeToolCalls: false,
		})
	})
})
