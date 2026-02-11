import * as vscode from "vscode"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { defaultModeSlug, getModeBySlug, getGroupName } from "../../shared/modes"
import { buildApiHandler } from "../../api"
import { experiments as experimentsModule, EXPERIMENT_IDS } from "../../shared/experiments"
import { SYSTEM_PROMPT } from "../prompts/system"
import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../diff/strategies/multi-file-search-replace"
import { Package } from "../../shared/package"
import { resolveToolProtocol } from "../../utils/resolveToolProtocol"

import { ClineProvider } from "./ClineProvider"

export const generateSystemPrompt = async (provider: ClineProvider, message: WebviewMessage) => {
	const state = await provider.getState() // kilocode_change

	const {
		apiConfiguration,
		customModePrompts,
		customInstructions,
		diffEnabled,
		mcpEnabled,
		fuzzyMatchThreshold,
		experiments,
		enableMcpServerCreation,
		language,
		maxConcurrentFileReads,
	} = state // kilocode_change

	// Check experiment to determine which diff strategy to use
	const isMultiFileApplyDiffEnabled = experimentsModule.isEnabled(
		experiments ?? {},
		EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF,
	)

	const diffStrategy = isMultiFileApplyDiffEnabled
		? new MultiFileSearchReplaceDiffStrategy(fuzzyMatchThreshold)
		: new MultiSearchReplaceDiffStrategy(fuzzyMatchThreshold)

	const cwd = provider.cwd

	const mode = message.mode ?? defaultModeSlug
	const customModes = await provider.customModesManager.getCustomModes()

	const rooIgnoreInstructions = provider.getCurrentTask()?.rooIgnoreController?.getInstructions()

	// Determine if image support is available for prompt generation
	let modelInfo: any = undefined

	// Create a temporary API handler to check if the model supports browser capability
	// This avoids relying on an active Cline instance which might not exist during preview
	try {
		const tempApiHandler = buildApiHandler(apiConfiguration)
		modelInfo = tempApiHandler.getModel().info
	} catch (error) {
		console.error("Error checking if model supports browser capability:", error)
	}

	// Check if model supports image capability
	const supportsComputerUse = modelInfo && (modelInfo as any)?.supportsImages === true

	// Resolve tool protocol for system prompt generation
	const toolProtocol = resolveToolProtocol(apiConfiguration, modelInfo)

	const systemPrompt = await SYSTEM_PROMPT(
		provider.context,
		cwd,
		supportsComputerUse,
		mcpEnabled ? provider.getMcpHub() : undefined,
		diffStrategy,
		mode,
		customModePrompts,
		customModes,
		customInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
		true,
		{
			maxConcurrentFileReads: maxConcurrentFileReads ?? 5,
			todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
			useAgentRules: vscode.workspace.getConfiguration(Package.name).get<boolean>("useAgentRules") ?? true,
			newTaskRequireTodos: vscode.workspace
				.getConfiguration(Package.name)
				.get<boolean>("newTaskRequireTodos", false),
			toolProtocol,
			isStealthModel: modelInfo?.isStealthModel,
		},
		undefined, // todoList
		undefined, // modelId
		provider.getSkillsManager(),
		state, // kilocode_change
	)

	return systemPrompt
}
