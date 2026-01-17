import * as vscode from "vscode"
import * as os from "os"

import type {
	ModeConfig,
	PromptComponent,
	CustomModePrompts,
	TodoItem,
	Experiments, // kilocode_change
} from "@roo-code/types"

import type { SystemPromptSettings } from "./types"

import { Mode, modes, defaultModeSlug, getModeBySlug, getGroupName, getModeSelection } from "../../shared/modes"
import { DiffStrategy } from "../../shared/tools"
import { formatLanguage } from "../../shared/language"
import { isEmpty } from "../../utils/object"
import { McpHub } from "../../services/mcp/McpHub"
import { CodeIndexManager } from "../../services/code-index/manager"
import { SkillsManager } from "../../services/skills/SkillsManager"
 
// kilocode_change start
import * as path from "path"
import { scanExamplePackages, type ToolPackage } from "../tool-packages"
import { buildExampleToolName } from "../../utils/example-tool-name"
import { sanitizeMcpName } from "../../utils/mcp-name"
// kilocode_change end

import { PromptVariables, loadSystemPromptFile } from "./sections/custom-system-prompt"

import { getToolDescriptionsForMode } from "./tools"
import { getEffectiveProtocol, isNativeProtocol } from "@roo-code/types"
import {
	getRulesSection,
	getSystemInfoSection,
	getObjectiveSection,
	getSharedToolUseSection,
	getMcpServersSection,
	getToolUseGuidelinesSection,
	getCapabilitiesSection,
	getModesSection,
	addCustomInstructions,
	markdownFormattingSection,
	getSkillsSection,
} from "./sections"
import { type ClineProviderState } from "../webview/ClineProvider" // kilocode_change

// Helper function to get prompt component, filtering out empty objects
export function getPromptComponent(
	customModePrompts: CustomModePrompts | undefined,
	mode: string,
): PromptComponent | undefined {
	const component = customModePrompts?.[mode]
	// Return undefined if component is empty
	if (isEmpty(component)) {
		return undefined
	}
	return component
}

async function generatePrompt(
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mode: Mode,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	promptComponent?: PromptComponent,
	customModeConfigs?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
	skillsManager?: SkillsManager,
	clineProviderState?: ClineProviderState, // kilocode_change
): Promise<string> {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	// Get the full mode config to ensure we have the role definition (used for groups, etc.)
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	const { roleDefinition, baseInstructions } = getModeSelection(mode, promptComponent, customModeConfigs)

	// Check if MCP functionality should be included
	const hasMcpGroup = modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
	const hasMcpServers = mcpHub && mcpHub.getServers().length > 0
	const shouldIncludeMcp = hasMcpGroup && hasMcpServers

	const codeIndexManager = CodeIndexManager.getInstance(context, cwd)

	// Determine the effective protocol (defaults to 'xml')
	const effectiveProtocol = getEffectiveProtocol(settings?.toolProtocol)

	// kilocode_change start
	const examplePackagesSection = await getExamplePackagesSection(
		context.extensionPath,
		modeConfig,
		language,
		clineProviderState?.enabledExamplePackages,
		clineProviderState?.disabledExamplePackages,
	)
	// kilocode_change end

	const [modesSection, mcpServersSection, skillsSection] = await Promise.all([
		getModesSection(context),
		shouldIncludeMcp
			? getMcpServersSection(
					mcpHub,
					effectiveDiffStrategy,
					enableMcpServerCreation,
					!isNativeProtocol(effectiveProtocol),
				)
			: Promise.resolve(""),
		getSkillsSection(skillsManager, mode as string),
	])

	// Build tools catalog section only for XML protocol
	const toolsCatalog = isNativeProtocol(effectiveProtocol)
		? ""
		: `\n\n${getToolDescriptionsForMode(
				mode,
				cwd,
				supportsComputerUse,
				codeIndexManager,
				effectiveDiffStrategy,
				browserViewportSize,
				shouldIncludeMcp ? mcpHub : undefined,
				customModeConfigs,
				experiments,
				partialReadsEnabled,
				settings,
				enableMcpServerCreation,
				modelId,
				clineProviderState, // kilocode_change
			)}`

	const basePrompt = `${roleDefinition}

${markdownFormattingSection()}

${getSharedToolUseSection(effectiveProtocol)}${toolsCatalog}${examplePackagesSection ? `\n\n${examplePackagesSection}` : ""}

${getToolUseGuidelinesSection(effectiveProtocol)}

${mcpServersSection}

${getCapabilitiesSection(cwd, shouldIncludeMcp ? mcpHub : undefined)}

${modesSection}
${skillsSection ? `\n${skillsSection}` : ""}
${getRulesSection(cwd, settings, clineProviderState /* kilocode_change */)}

${getSystemInfoSection(cwd)}

${getObjectiveSection()}

${await addCustomInstructions(baseInstructions, globalCustomInstructions || "", cwd, mode, {
	language: language ?? formatLanguage(vscode.env.language),
	rooIgnoreInstructions,
	localRulesToggleState: context.workspaceState.get("localRulesToggles"), // kilocode_change
	globalRulesToggleState: context.globalState.get("globalRulesToggles"), // kilocode_change
	settings,
})}`

	return basePrompt
}

// kilocode_change start
async function getExamplePackagesSection(
	extensionPath: string,
	modeConfig: ReturnType<typeof getModeSelection> extends any ? ModeConfig : ModeConfig,
	language?: string,
	enabledExamplePackages?: string[],
	disabledExamplePackages?: string[],
): Promise<string> {
	// Example packages are gated by the mcp group (same as pkg-- tool availability)
	const hasMcpGroup = modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
	if (!hasMcpGroup) {
		return ""
	}

	const localizeText = (value: unknown): string => {
		if (!value) {
			return ""
		}
		if (typeof value === "string") {
			return value
		}
		if (typeof value === "object") {
			const record = value as Record<string, string>
			const lang = String(language ?? "").toLowerCase()
			const candidates = [
				lang,
				lang.split("-")[0],
				"en",
				"en-us",
				"zh",
				"zh-cn",
			]
			for (const key of candidates) {
				if (key && typeof record[key] === "string") {
					return record[key]
				}
			}
			const first = Object.values(record).find((v) => typeof v === "string")
			return first ?? ""
		}
		return ""
	}

	const primaryExamplesDir = path.join(extensionPath, "dist", "examples")
	const isDevExtensionLayout = path.basename(extensionPath).toLowerCase() === "src" // kilocode_change
	const fallbackExamplesDir = isDevExtensionLayout
		? path.join(extensionPath, "examples")
		: path.join(extensionPath, "src", "examples")

	let packages: ToolPackage[] = []
	try {
		packages = await scanExamplePackages({ examplesDir: primaryExamplesDir })
		if (packages.length === 0) {
			packages = await scanExamplePackages({ examplesDir: fallbackExamplesDir })
		}
	} catch {
		return ""
	}

	const disabled = new Set((disabledExamplePackages ?? []).map((n) => sanitizeMcpName(String(n)).toLowerCase()))
	const enabledOverride = new Set(
		(enabledExamplePackages ?? []).map((n) => sanitizeMcpName(String(n)).toLowerCase()),
	)
	const enabled = packages.filter((p) => {
		const name = sanitizeMcpName(String(p.name)).toLowerCase()
		if (enabledOverride.has(name)) {
			return true
		}
		if (disabled.has(name)) {
			return false
		}
		return Boolean(p.enabledByDefault)
	})
	if (enabled.length === 0) {
		return ""
	}

	const lines: string[] = []
	lines.push(`# Sandbox Package Tools`)
	lines.push(
		`Sandbox packages are discoverable by name and description. Their specific tools (pkg--<package>--<tool>) are NOT exposed until you activate a package.`,
	)
	lines.push(
		`To activate a package, call activate_sandbox_package with package_name='<package>'. After activation, the tool result will include the package's tool names and parameters, and subsequent requests will allow calling those pkg-- tools.`,
	)

	for (const pkg of enabled) {
		lines.push("")
		lines.push(`## ${pkg.name}`)
		const pkgDescription = localizeText(pkg.description)
		if (pkgDescription) {
			lines.push(pkgDescription)
		}
	}

	return lines.join("\n")
}

export const __test__getExamplePackagesSection = getExamplePackagesSection // kilocode_change
// kilocode_change end

export const SYSTEM_PROMPT = async (
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	inputMode: Mode = defaultModeSlug, // kilocode_change: name changed to inputMode
	customModePrompts?: CustomModePrompts,
	customModes?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Experiments, // kilocode_change: type
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
	skillsManager?: SkillsManager,
	clineProviderState?: ClineProviderState, // kilocode_change
): Promise<string> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	const mode =
		getModeBySlug(inputMode, customModes)?.slug || modes.find((m) => m.slug === inputMode)?.slug || defaultModeSlug // kilocode_change: don't try to use non-existent modes

	// Try to load custom system prompt from file
	const variablesForPrompt: PromptVariables = {
		workspace: cwd,
		mode: mode,
		language: language ?? formatLanguage(vscode.env.language),
		shell: vscode.env.shell,
		operatingSystem: os.type(),
	}
	const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode, variablesForPrompt)

	// Check if it's a custom mode
	const promptComponent = getPromptComponent(customModePrompts, mode)

	// Get full mode config from custom modes or fall back to built-in modes
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

	// If a file-based custom system prompt exists, use it
	if (fileCustomSystemPrompt) {
		const { roleDefinition, baseInstructions: baseInstructionsForFile } = getModeSelection(
			mode,
			promptComponent,
			customModes,
		)

		const customInstructions = await addCustomInstructions(
			baseInstructionsForFile,
			globalCustomInstructions || "",
			cwd,
			mode,
			{
				language: language ?? formatLanguage(vscode.env.language),
				rooIgnoreInstructions,
				settings,
			},
		)

		// For file-based prompts, don't include the tool sections
		return `${roleDefinition}

${fileCustomSystemPrompt}

${customInstructions}`
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	return generatePrompt(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		effectiveDiffStrategy,
		browserViewportSize,
		promptComponent,
		customModes,
		globalCustomInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
		partialReadsEnabled,
		settings,
		todoList,
		modelId,
		skillsManager,
		clineProviderState, // kilocode_change
	)
}
