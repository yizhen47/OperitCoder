// pnpm --filter @roo-code/vscode-webview test src/components/settings/__tests__/SettingsView.spec.tsx

import React, { createContext, useContext, useState } from "react"
import { render, screen, fireEvent, within } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { vscode } from "@/utils/vscode"
import { ExtensionStateContextProvider } from "@/context/ExtensionStateContext"

import SettingsView from "../SettingsView"

vi.mock("@src/utils/vscode", () => ({ vscode: { postMessage: vi.fn() } }))

// kilocode_change start
// Mock the validate functions to prevent validation errors
vi.mock("@src/utils/validate", () => ({
	validateApiConfiguration: vi.fn().mockReturnValue(undefined),
	validateApiConfigurationExcludingModelErrors: vi.fn().mockReturnValue(undefined),
	validateModelId: vi.fn().mockReturnValue(undefined),
	getModelValidationError: vi.fn().mockReturnValue(undefined),
}))
// kilocode_change end

// Mock ApiConfigManager component
vi.mock("../ApiConfigManager", () => ({
	__esModule: true,
	default: ({ currentApiConfigName }: any) => (
		<div data-testid="api-config-management">
			<span>Current config: {currentApiConfigName}</span>
		</div>
	),
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick, appearance, "data-testid": dataTestId }: any) =>
		appearance === "icon" ? (
			<button
				onClick={onClick}
				className="codicon codicon-close"
				aria-label="Remove command"
				data-testid={dataTestId}>
				<span className="codicon codicon-close" />
			</button>
		) : (
			<button onClick={onClick} data-appearance={appearance} data-testid={dataTestId}>
				{children}
			</button>
		),
	VSCodeCheckbox: ({ children, onChange, checked, "data-testid": dataTestId }: any) => (
		<label>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange({ target: { checked: e.target.checked } })}
				aria-label={typeof children === "string" ? children : undefined}
				data-testid={dataTestId}
			/>
			{children}
		</label>
	),
	VSCodeTextField: ({ value, onInput, placeholder, "data-testid": dataTestId }: any) => (
		<input
			type="text"
			value={value}
			onChange={(e) => onInput({ target: { value: e.target.value } })}
			placeholder={placeholder}
			data-testid={dataTestId}
		/>
	),
	VSCodeLink: ({ children, href }: any) => <a href={href || "#"}>{children}</a>,
	VSCodeRadio: ({ value, checked, onChange }: any) => (
		<input type="radio" value={value} checked={checked} onChange={onChange} />
	),
	VSCodeRadioGroup: ({ children, onChange }: any) => <div onChange={onChange}>{children}</div>,
	VSCodeTextArea: ({ value, onChange, rows, className, "data-testid": dataTestId }: any) => (
		<textarea
			value={value}
			onChange={onChange}
			rows={rows}
			className={className}
			data-testid={dataTestId}
			role="textbox"
		/>
	),
	// kilocode_change start
	VSCodeDropdown: ({ children, value, onChange, className, "data-testid": dataTestId }: any) => (
		<select value={value} onChange={onChange} className={className} data-testid={dataTestId}>
			{children}
		</select>
	),
	VSCodeOption: ({ children, value, className }: any) => (
		<option value={value} className={className}>
			{children}
		</option>
	),
	// kilocode_change end
}))

vi.mock("../../../components/common/Tab", () => ({
	...vi.importActual("../../../components/common/Tab"),
	Tab: ({ children }: any) => <div data-testid="tab-container">{children}</div>,
	TabHeader: ({ children }: any) => <div data-testid="tab-header">{children}</div>,
	TabContent: ({ children }: any) => <div data-testid="tab-content">{children}</div>,
	TabList: ({ children, value, onValueChange, "data-testid": dataTestId }: any) => {
		// Store onValueChange in a global variable so TabTrigger can access it
		;(window as any).__onValueChange = onValueChange
		return (
			<div data-testid={dataTestId} data-value={value}>
				{children}
			</div>
		)
	},
	TabTrigger: ({ children, value, "data-testid": dataTestId, onClick, isSelected }: any) => {
		// This function simulates clicking on a tab and making its content visible
		const handleClick = () => {
			if (onClick) onClick()
			// Access onValueChange from the global variable
			const onValueChange = (window as any).__onValueChange
			if (onValueChange) onValueChange(value)
			// Make all tab contents invisible
			document.querySelectorAll("[data-tab-content]").forEach((el) => {
				;(el as HTMLElement).style.display = "none"
			})
			// Make this tab's content visible
			const tabContent = document.querySelector(`[data-tab-content="${value}"]`)
			if (tabContent) {
				;(tabContent as HTMLElement).style.display = "block"
			}
		}

		return (
			<button data-testid={dataTestId} data-value={value} data-selected={isSelected} onClick={handleClick}>
				{children}
			</button>
		)
	},
}))

vi.mock("@src/components/ui", async (importOriginal) => {
	const actual = await importOriginal<any>()

	const CollapsibleContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null)

	return {
		...actual,
	Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
	PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
	PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
	Command: ({ children }: any) => <div data-testid="command">{children}</div>,
	CommandInput: ({ value, onValueChange }: any) => (
		<input data-testid="command-input" value={value} onChange={(e) => onValueChange(e.target.value)} />
	),
	CommandGroup: ({ children }: any) => <div data-testid="command-group">{children}</div>,
	CommandItem: ({ children, onSelect }: any) => (
		<div data-testid="command-item" onClick={onSelect}>
			{children}
		</div>
	),
	CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>,
	CommandEmpty: ({ children }: any) => <div data-testid="command-empty">{children}</div>,
	Slider: ({ value, onValueChange, "data-testid": dataTestId }: any) => (
		<input
			type="range"
			value={value[0]}
			onChange={(e) => onValueChange([parseFloat(e.target.value)])}
			data-testid={dataTestId}
		/>
	),
	// kilocode_change start
	DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
	DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-menu-trigger">{children}</div>,
	DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-menu-content">{children}</div>,
	DropdownMenuItem: ({ children, onClick }: any) => (
		<div data-testid="dropdown-menu-item" onClick={onClick}>
			{children}
		</div>
	),
		// kilocode_change end
		ToggleSwitch: ({ checked, onChange, "data-testid": dataTestId, ...rest }: any) => (
			<input
				type="checkbox"
				checked={checked}
				onChange={() => onChange?.()}
				data-testid={dataTestId}
				{...rest}
			/>
		),
		Button: ({ children, onClick, variant, className, "data-testid": dataTestId }: any) => (
			<button onClick={onClick} data-variant={variant} className={className} data-testid={dataTestId}>
				{children}
			</button>
	),
	StandardTooltip: ({ children, content }: any) => <div title={content}>{children}</div>,
	Input: ({ value, onChange, placeholder, "data-testid": dataTestId }: any) => (
		<input type="text" value={value} onChange={onChange} placeholder={placeholder} data-testid={dataTestId} />
	),
	Select: ({ children, value, onValueChange }: any) => (
		<div data-testid="select" data-value={value}>
			<button onClick={() => onValueChange && onValueChange("test-change")}>{value}</button>
			{children}
		</div>
	),
	SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
	SelectGroup: ({ children }: any) => <div data-testid="select-group">{children}</div>,
	SelectItem: ({ children, value }: any) => (
		<div data-testid={`select-item-${value}`} data-value={value}>
			{children}
		</div>
	),
	SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
	SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
	SelectSeparator: () => <div data-testid="select-separator" />, // kilocode_change
	SearchableSelect: ({ value, onValueChange, options, placeholder }: any) => (
		<select value={value} onChange={(e) => onValueChange(e.target.value)} data-testid="searchable-select">
			{placeholder && <option value="">{placeholder}</option>}
			{options?.map((opt: any) => (
				<option key={opt.value} value={opt.value}>
					{opt.label}
				</option>
			))}
		</select>
	),
	AlertDialog: ({ children, open }: any) => (
		<div data-testid="alert-dialog" data-open={open}>
			{children}
		</div>
	),
	AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
	AlertDialogHeader: ({ children }: any) => <div data-testid="alert-dialog-header">{children}</div>,
	AlertDialogTitle: ({ children }: any) => <div data-testid="alert-dialog-title">{children}</div>,
	AlertDialogDescription: ({ children }: any) => <div data-testid="alert-dialog-description">{children}</div>,
	AlertDialogFooter: ({ children }: any) => <div data-testid="alert-dialog-footer">{children}</div>,
	AlertDialogAction: ({ children, onClick }: any) => (
		<button data-testid="alert-dialog-action" onClick={onClick}>
			{children}
		</button>
	),
		AlertDialogCancel: ({ children, onClick }: any) => (
			<button data-testid="alert-dialog-cancel" onClick={onClick}>
				{children}
			</button>
		),
		// Add Collapsible components
		Collapsible: ({ children, defaultOpen }: any) => {
			const [open, setOpen] = useState(Boolean(defaultOpen))
			return (
				<CollapsibleContext.Provider value={{ open, setOpen }}>
					<div className="collapsible-mock" data-open={open}>
						{children}
					</div>
				</CollapsibleContext.Provider>
			)
		},
		CollapsibleTrigger: ({ children, asChild }: any) => {
			const ctx = useContext(CollapsibleContext)
			const toggle = () => ctx?.setOpen(!ctx.open)

			if (asChild && React.isValidElement(children)) {
				const existingOnClick = (children as any).props?.onClick
				return React.cloneElement(children as any, {
					onClick: (...args: any[]) => {
						existingOnClick?.(...args)
						toggle()
					},
				})
			}

			return (
				<button type="button" onClick={toggle}>
					{children}
				</button>
			)
		},
		CollapsibleContent: ({ children, className }: any) => {
			const ctx = useContext(CollapsibleContext)
			if (!ctx?.open) return null
			return <div className={`collapsible-content-mock ${className || ""}`}>{children}</div>
		},
	}
})

// Mock window.postMessage to trigger state hydration
const mockPostMessage = (state: any) => {
	window.postMessage(
		{
			type: "state",
			state: {
				version: "1.0.0",
				clineMessages: [],
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				alwaysAllowExecute: false,
				ttsEnabled: false,
				ttsSpeed: 1,
				soundEnabled: false,
				soundVolume: 0.5,
				...state,
			},
		},
		"*",
	)
}

// kilocode_change on next line, initial state initialization to work with localized checkboxes
const renderSettingsView = (initialState = {}) => {
	const onDone = vi.fn()
	const queryClient = new QueryClient()

	const result = render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<SettingsView onDone={onDone} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)

	// Hydrate initial state.
	mockPostMessage(initialState)

	// Helper function to activate a tab and ensure its content is visible
	const activateTab = (tabId: string) => {
		// Skip trying to find and click the tab, just directly render with the target section
		// This bypasses the actual tab clicking mechanism but ensures the content is shown
		result.rerender(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<SettingsView onDone={onDone} targetSection={tabId} />
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)
	}

	return { onDone, activateTab }
}

describe("SettingsView - Sound Settings", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("toggles settings search and filters visible tabs", async () => {
		renderSettingsView({ language: "en" })

		// Initially multiple tabs are visible
		expect(await screen.findByTestId("tab-notifications")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("settings-search-toggle"))
		const input = await screen.findByTestId("settings-search-input")

		fireEvent.change(input, { target: { value: "term" } })

		// Active tab is pinned + matching tab is shown
		expect(screen.getByTestId("tab-providers")).toBeInTheDocument()
		expect(screen.getByTestId("tab-terminal")).toBeInTheDocument()
		expect(screen.queryByTestId("tab-notifications")).not.toBeInTheDocument()

		// Close search clears filter
		fireEvent.click(screen.getByTestId("settings-search-toggle"))
		expect(screen.queryByTestId("settings-search-input")).not.toBeInTheDocument()
		expect(await screen.findByTestId("tab-notifications")).toBeInTheDocument()
	})

	it("toggles sandbox package and sends message to VSCode", async () => {
		const { activateTab } = renderSettingsView({
			examplePackages: [{ name: "alpha", enabledByDefault: true, toolCount: 1 }],
			enabledExamplePackages: [],
			disabledExamplePackages: [],
		})

		activateTab("examplePackages")

		const toggle = await screen.findByTestId("sandbox-package-toggle-alpha")
		fireEvent.click(toggle)

		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "toggleExamplePackage",
				packageName: "alpha",
				disabled: true,
			}),
		)
	})

	it("renders sandbox package description and expands to show tools", async () => {
		const { activateTab } = renderSettingsView({
			language: "en",
			examplePackages: [
				{
					name: "alpha",
					displayName: "Alpha Package",
					enabledByDefault: true,
					toolCount: 1,
					description: { en: "Alpha package description" },
					tools: [
						{
							name: "do_thing",
							description: { en: "Does a thing" },
							parameters: [{ name: "q", type: "string", required: true, description: { en: "Query" } }],
						},
					],
				},
			],
			enabledExamplePackages: [],
			disabledExamplePackages: [],
		})

		activateTab("examplePackages")

		expect(await screen.findByText("Alpha package description")).toBeInTheDocument()

		// Tools panel should not be present before expand.
		expect(screen.queryByTestId("sandbox-package-tools-alpha")).not.toBeInTheDocument()

		fireEvent.click(await screen.findByTestId("sandbox-package-card-alpha"))

		expect(await screen.findByTestId("sandbox-package-tools-alpha")).toBeInTheDocument()
		expect(screen.getByText("do_thing")).toBeInTheDocument()
		expect(screen.getByText("Does a thing")).toBeInTheDocument()
		expect(screen.getByText("Query")).toBeInTheDocument()
		expect(screen.getByText(/\(\s*q\s*,/)).toBeInTheDocument()
		expect(screen.getByText(/string/)).toBeInTheDocument()
		expect(screen.getByText(/settings:examplePackages\.parameter\.required/)).toBeInTheDocument()
	})

	it("renders sandbox package env vars and sends setSandboxEnvVar message", async () => {
		const { activateTab } = renderSettingsView({
			language: "en",
			examplePackages: [
				{
					name: "alpha",
					displayName: "Alpha Package",
					enabledByDefault: true,
					toolCount: 1,
					env: [{ name: "MY_API_KEY", required: true, description: { en: "API key" } }],
					tools: [{ name: "do_thing" }],
				},
			],
			sandboxEnvStatus: { MY_API_KEY: false },
			enabledExamplePackages: [],
			disabledExamplePackages: [],
		})

		activateTab("examplePackages")

		fireEvent.click(await screen.findByTestId("sandbox-package-card-alpha"))

		const envSection = await screen.findByTestId("sandbox-package-env-alpha")
		expect(within(envSection).getByText("settings:examplePackages.envLabel")).toBeInTheDocument()

		const input = within(envSection).getByPlaceholderText("settings:examplePackages.envPlaceholder")
		fireEvent.change(input, { target: { value: "secret" } })

		const saveButton = within(envSection).getByRole("button", { name: "settings:examplePackages.envSave" })
		fireEvent.click(saveButton)

		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "setSandboxEnvVar",
				envName: "MY_API_KEY",
				envValue: "secret",
			}),
		)
	})

	it("renders global sandbox env section and sends setSandboxEnvVar message", async () => {
		const { activateTab } = renderSettingsView({
			language: "en",
			examplePackages: [
				{
					name: "alpha",
					displayName: "Alpha Package",
					enabledByDefault: true,
					toolCount: 1,
					env: [{ name: "MY_API_KEY", required: true, description: { en: "API key" } }],
					tools: [{ name: "do_thing" }],
				},
			],
			sandboxEnvStatus: { MY_API_KEY: false },
			enabledExamplePackages: [],
			disabledExamplePackages: [],
		})

		activateTab("examplePackages")

		fireEvent.click(await screen.findByTestId("sandbox-env-global-trigger"))
		const envSection = await screen.findByTestId("sandbox-env-global")
		const input = within(envSection).getByPlaceholderText("settings:examplePackages.envPlaceholder")
		fireEvent.change(input, { target: { value: "secret" } })

		const saveButton = within(envSection).getByRole("button", { name: "settings:examplePackages.envSave" })
		fireEvent.click(saveButton)

		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "setSandboxEnvVar",
				envName: "MY_API_KEY",
				envValue: "secret",
			}),
		)
	})

	it("configures sandbox visit_web browser settings and persists on save", async () => {
		const { activateTab } = renderSettingsView({
			language: "en",
			experiments: {},
			visitWebBrowserType: "auto",
			visitWebBrowserExecutablePath: "",
		})

		activateTab("experimental")

		const trigger = await screen.findByTestId("visit-web-browser-trigger")
		expect(screen.queryByTestId("visit-web-browser-content")).not.toBeInTheDocument()

		fireEvent.click(trigger)
		const content = await screen.findByTestId("visit-web-browser-content")

		const dropdown = within(content).getByTestId("visit-web-browser-type")
		fireEvent.change(dropdown, { target: { value: "custom" } })

		const pathInput = within(content).getByTestId("visit-web-browser-executable-path")
		fireEvent.change(pathInput, { target: { value: "C:\\\\Browser\\\\chrome.exe" } })

		const saveButtons = screen.getAllByTestId("save-button")
		fireEvent.click(saveButtons[0])

		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "updateSettings",
				updatedSettings: expect.objectContaining({
					visitWebBrowserType: "custom",
					visitWebBrowserExecutablePath: "C:\\\\Browser\\\\chrome.exe",
				}),
			}),
		)
	})

	it("initializes with tts disabled by default", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the notifications tab
		activateTab("notifications")

		const ttsCheckbox = screen.getByTestId("tts-enabled-checkbox")
		expect(ttsCheckbox).not.toBeChecked()

		// Speed slider should not be visible when tts is disabled
		expect(screen.queryByTestId("tts-speed-slider")).not.toBeInTheDocument()
	})

	it("initializes with sound disabled by default", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the notifications tab
		activateTab("notifications")

		const soundCheckbox = screen.getByTestId("sound-enabled-checkbox")
		expect(soundCheckbox).not.toBeChecked()

		// Volume slider should not be visible when sound is disabled
		expect(screen.queryByTestId("sound-volume-slider")).not.toBeInTheDocument()
	})

	it("toggles tts setting and sends message to VSCode", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the notifications tab
		activateTab("notifications")

		const ttsCheckbox = screen.getByTestId("tts-enabled-checkbox")

		// Enable tts
		fireEvent.click(ttsCheckbox)
		expect(ttsCheckbox).toBeChecked()

		// Click Save to save settings
		const saveButton = screen.getByTestId("save-button")
		fireEvent.click(saveButton)

		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "updateSettings",
				updatedSettings: expect.objectContaining({
					ttsEnabled: true,
				}),
			}),
		)
	})

	it("toggles sound setting and sends message to VSCode", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the notifications tab
		activateTab("notifications")

		const soundCheckbox = screen.getByTestId("sound-enabled-checkbox")

		// Enable sound
		fireEvent.click(soundCheckbox)
		expect(soundCheckbox).toBeChecked()

		// Click Save to save settings
		const saveButton = screen.getByTestId("save-button")
		fireEvent.click(saveButton)

		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "updateSettings",
				updatedSettings: expect.objectContaining({
					soundEnabled: true,
				}),
			}),
		)
	})

	it("shows tts slider when sound is enabled", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the notifications tab
		activateTab("notifications")

		// Enable tts
		const ttsCheckbox = screen.getByTestId("tts-enabled-checkbox")
		fireEvent.click(ttsCheckbox)

		// Speed slider should be visible
		const speedSlider = screen.getByTestId("tts-speed-slider")
		expect(speedSlider).toBeInTheDocument()
		expect(speedSlider).toHaveValue("1")
	})

	it("shows volume slider when sound is enabled", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the notifications tab
		activateTab("notifications")

		// Enable sound
		const soundCheckbox = screen.getByTestId("sound-enabled-checkbox")
		fireEvent.click(soundCheckbox)

		// Volume slider should be visible
		const volumeSlider = screen.getByTestId("sound-volume-slider")
		expect(volumeSlider).toBeInTheDocument()
		expect(volumeSlider).toHaveValue("0.5")
	})

	it("updates speed and sends message to VSCode when slider changes", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the notifications tab
		activateTab("notifications")

		// Enable tts
		const ttsCheckbox = screen.getByTestId("tts-enabled-checkbox")
		fireEvent.click(ttsCheckbox)

		// Change speed
		const speedSlider = screen.getByTestId("tts-speed-slider")
		fireEvent.change(speedSlider, { target: { value: "0.75" } })

		// Click Save to save settings
		const saveButton = screen.getByTestId("save-button")
		fireEvent.click(saveButton)

		// Verify message sent to VSCode
		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "updateSettings",
				updatedSettings: expect.objectContaining({
					ttsSpeed: 0.75,
				}),
			}),
		)
	})

	it("updates volume and sends message to VSCode when slider changes", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the notifications tab
		activateTab("notifications")

		// Enable sound
		const soundCheckbox = screen.getByTestId("sound-enabled-checkbox")
		fireEvent.click(soundCheckbox)

		// Change volume
		const volumeSlider = screen.getByTestId("sound-volume-slider")
		fireEvent.change(volumeSlider, { target: { value: "0.75" } })

		// Click Save to save settings - use getAllByTestId to handle multiple elements
		const saveButtons = screen.getAllByTestId("save-button")
		fireEvent.click(saveButtons[0])

		// Verify message sent to VSCode
		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "updateSettings",
				updatedSettings: expect.objectContaining({
					soundVolume: 0.75,
				}),
			}),
		)
	})
})

describe("SettingsView - API Configuration", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders ApiConfigManagement with correct props", () => {
		renderSettingsView()

		expect(screen.getByTestId("api-config-management")).toBeInTheDocument()
	})
})

describe("SettingsView - Allowed Commands", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("shows allowed commands section when alwaysAllowExecute is enabled", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the autoApprove tab
		activateTab("autoApprove")

		// Enable always allow execute
		const executeCheckbox = screen.getByTestId("always-allow-execute-toggle")
		fireEvent.click(executeCheckbox)
		// Verify allowed commands section appears
		expect(screen.getByTestId("allowed-commands-heading")).toBeInTheDocument()
		expect(screen.getByTestId("command-input")).toBeInTheDocument()
	})

	it("adds new command to the list", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the autoApprove tab
		activateTab("autoApprove")

		// Enable always allow execute
		const executeCheckbox = screen.getByTestId("always-allow-execute-toggle")
		fireEvent.click(executeCheckbox)

		// Add a new command
		const input = screen.getByTestId("command-input")
		fireEvent.change(input, { target: { value: "npm test" } })

		const addButton = screen.getByTestId("add-command-button")
		fireEvent.click(addButton)

		// Verify command was added
		expect(screen.getByText("npm test")).toBeInTheDocument()

		// Verify VSCode message was sent
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updateSettings",
			updatedSettings: {
				allowedCommands: ["npm test"],
			},
		})
	})

	it("removes command from the list", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the autoApprove tab
		activateTab("autoApprove")

		// Enable always allow execute
		const executeCheckbox = screen.getByTestId("always-allow-execute-toggle")
		fireEvent.click(executeCheckbox)

		// Add a command
		const input = screen.getByTestId("command-input")
		fireEvent.change(input, { target: { value: "npm test" } })
		const addButton = screen.getByTestId("add-command-button")
		fireEvent.click(addButton)

		// Remove the command
		const removeButton = screen.getByTestId("remove-command-0")
		fireEvent.click(removeButton)

		// Verify command was removed
		expect(screen.queryByText("npm test")).not.toBeInTheDocument()

		// Verify VSCode message was sent
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateSettings",
			updatedSettings: {
				allowedCommands: [],
			},
		})
	})

	describe("SettingsView - Tab Navigation", () => {
		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("renders with providers tab active by default", () => {
			renderSettingsView()

			// Check that the tab list is rendered
			const tabList = screen.getByTestId("settings-tab-list")
			expect(tabList).toBeInTheDocument()

			// Check that providers content is visible
			expect(screen.getByTestId("api-config-management")).toBeInTheDocument()
		})

		it("shows unsaved changes dialog when clicking Done with unsaved changes", () => {
			// Render once and get the activateTab helper
			const { activateTab } = renderSettingsView()

			// Activate the notifications tab
			activateTab("notifications")

			// Make a change to create unsaved changes
			const soundCheckbox = screen.getByTestId("sound-enabled-checkbox")
			fireEvent.click(soundCheckbox)

			// Click the Done button
			const doneButton = screen.getByText("settings:common.done")
			fireEvent.click(doneButton)

			// Check that unsaved changes dialog is shown
			expect(screen.getByText("settings:unsavedChangesDialog.title")).toBeInTheDocument()
		})

		it("renders with targetSection prop", () => {
			// Render with a specific target section
			render(
				<ExtensionStateContextProvider>
					<QueryClientProvider client={new QueryClient()}>
						<SettingsView onDone={vi.fn()} targetSection="notifications" />
					</QueryClientProvider>
				</ExtensionStateContextProvider>,
			)

			// Hydrate initial state
			mockPostMessage({})

			// Verify non-providers content is visible and API config is not
			expect(screen.queryByTestId("api-config-management")).not.toBeInTheDocument()
		})
	})
})

describe("SettingsView - Duplicate Commands", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("prevents duplicate commands", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the autoApprove tab
		activateTab("autoApprove")

		// Enable always allow execute
		const executeCheckbox = screen.getByTestId("always-allow-execute-toggle")
		fireEvent.click(executeCheckbox)

		// Add a command twice
		const input = screen.getByTestId("command-input")
		const addButton = screen.getByTestId("add-command-button")

		// First addition
		fireEvent.change(input, { target: { value: "npm test" } })
		fireEvent.click(addButton)

		// Second addition attempt
		fireEvent.change(input, { target: { value: "npm test" } })
		fireEvent.click(addButton)

		// Verify command appears only once
		const commands = screen.getAllByText("npm test")
		expect(commands).toHaveLength(1)
	})

	it("saves allowed commands when clicking Save", () => {
		// Render once and get the activateTab helper
		const { activateTab } = renderSettingsView()

		// Activate the autoApprove tab
		activateTab("autoApprove")

		// Enable always allow execute
		const executeCheckbox = screen.getByTestId("always-allow-execute-toggle")
		fireEvent.click(executeCheckbox)

		// Add a command
		const input = screen.getByTestId("command-input")
		fireEvent.change(input, { target: { value: "npm test" } })
		const addButton = screen.getByTestId("add-command-button")
		fireEvent.click(addButton)

		// Click Save - use getAllByTestId to handle multiple elements
		const saveButtons = screen.getAllByTestId("save-button")
		fireEvent.click(saveButtons[0])

		// Verify VSCode messages were sent
		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "updateSettings",
				updatedSettings: expect.objectContaining({
					allowedCommands: ["npm test"],
				}),
			}),
		)
	})
})
