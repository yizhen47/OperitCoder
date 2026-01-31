import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { vscode } from "@/utils/vscode"
import { KiloProfileSelector } from "../KiloProfileSelector"
import type { ProviderSettings } from "@roo-code/types"

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock Popover components to be testable (keep content always rendered)
vi.mock("@/components/ui", () => ({
	Popover: ({ children }: any) => <div data-testid="popover-root">{children}</div>,
	PopoverTrigger: ({ children, ...props }: any) => (
		<button data-testid="dropdown-trigger" {...props}>
			{children}
		</button>
	),
	PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
	StandardTooltip: ({ children }: any) => <>{children}</>,
	Button: ({ children, onClick, ...props }: any) => (
		<button onClick={onClick} {...props}>
			{children}
		</button>
	),
}))

const mockUseProviderModels = vi.fn()
vi.mock("../../hooks/useProviderModels", () => ({
	useProviderModels: (config: ProviderSettings) => mockUseProviderModels(config),
}))

describe("KiloProfileSelector", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUseProviderModels.mockReset()
		mockUseProviderModels.mockReturnValue({
			provider: "anthropic",
			providerModels: {
				"model-1": { displayName: "Model 1" },
				"model-2": { displayName: "Model 2" },
			},
			providerDefaultModel: "model-1",
			isLoading: false,
			isError: false,
		})
	})

	const baseApiConfiguration: ProviderSettings = {
		apiProvider: "anthropic",
		apiModelId: "model-1",
	}

	test("selecting current config opens model panel and selecting a model persists via setApiConfigModelById", async () => {
		render(
			<KiloProfileSelector
				currentConfigId="config1"
				currentModelId="model-1"
				currentApiConfigName="Config 1"
				apiConfiguration={baseApiConfiguration}
				displayName="Config 1"
				listApiConfigMeta={[
					{ id: "config1", name: "Config 1" },
					{ id: "config2", name: "Config 2" },
				]}
				pinnedApiConfigs={{}}
				togglePinnedApiConfig={vi.fn()}
				initiallyOpen={true}
			/>,
		)

		fireEvent.click(screen.getByText("Config 1"))

		// Model panel should render models from useProviderModels
		expect(await screen.findByText("Model 2")).toBeInTheDocument()
		fireEvent.click(screen.getByText("Model 2"))

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "setApiConfigModelById",
			values: { configId: "config1", modelId: "model-2" },
		})
	})

	test("selecting a different config triggers loadApiConfigurationById and shows loading while switching", async () => {
		render(
			<KiloProfileSelector
				currentConfigId="config1"
				currentModelId="model-1"
				currentApiConfigName="Config 1"
				apiConfiguration={baseApiConfiguration}
				displayName="Config 1"
				listApiConfigMeta={[
					{ id: "config1", name: "Config 1" },
					{ id: "config2", name: "Config 2" },
				]}
				pinnedApiConfigs={{}}
				togglePinnedApiConfig={vi.fn()}
				initiallyOpen={true}
			/>,
		)

		fireEvent.click(screen.getByText("Config 2"))

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "loadApiConfigurationById", text: "config2" })
		})

		// While config is switching, the model panel should show loading
		expect(screen.getByText("common:ui.loading")).toBeInTheDocument()
	})

	test("clicking edit navigates to settings providers and targets the current profile", () => {
		render(
			<KiloProfileSelector
				currentConfigId="config1"
				currentModelId="model-1"
				currentApiConfigName="Config 1"
				apiConfiguration={baseApiConfiguration}
				displayName="Config 1"
				listApiConfigMeta={[
					{ id: "config1", name: "Config 1" },
					{ id: "config2", name: "Config 2" },
				]}
				pinnedApiConfigs={{}}
				togglePinnedApiConfig={vi.fn()}
				initiallyOpen={true}
			/>,
		)

		fireEvent.click(screen.getByText("chat:edit"))

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "switchTab",
			tab: "settings",
			values: {
				section: "providers",
				editingProfile: "Config 1",
			},
		})
	})
})
