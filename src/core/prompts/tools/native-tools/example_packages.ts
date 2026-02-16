// kilocode_change - new file

import type OpenAI from "openai"
import * as path from "path"

import { buildExampleToolName } from "../../../../utils/example-tool-name"
import { sanitizeMcpName } from "../../../../utils/mcp-name" // kilocode_change
import type { LocalizedText, ToolPackage } from "../../../tool-packages"
import {
	buildDefaultSandboxCapabilities,
	resolveToolPackageToolsForCapabilities,
	scanExamplePackages,
} from "../../../tool-packages"

function describeLocalizedText(description: LocalizedText | undefined): string {
	if (!description) {
		return ""
	}
	if (typeof description === "string") {
		return description
	}

	return (
		description["zh"] ??
		description["zh-CN"] ??
		description["en"] ??
		Object.values(description)[0] ??
		""
	)
}

function buildParameterSchema(type: string): Record<string, any> {
	switch (type) {
		case "number":
			return { type: "number" }
		case "boolean":
			return { type: "boolean" }
		case "object":
			return { type: "object", additionalProperties: true }
		case "array":
			return { type: "array" }
		case "string":
		default:
			return { type: "string" }
	}
}
// kilocode_change end

function convertToolPackageToOpenAITools(toolPackage: ToolPackage): OpenAI.Chat.ChatCompletionTool[] {
	const tools: OpenAI.Chat.ChatCompletionTool[] = []

	for (const tool of toolPackage.tools) {
		const properties: Record<string, any> = {}
		const required: string[] = []

		for (const param of tool.parameters) {
			properties[param.name] = {
				...buildParameterSchema(param.type),
				description: describeLocalizedText(param.description),
			}

			if (param.required !== false) {
				required.push(param.name)
			}
		}

		const parameters: OpenAI.FunctionParameters = {
			type: "object",
			properties,
			additionalProperties: false,
		}

		if (required.length > 0) {
			parameters.required = required
		}

		const toolName = buildExampleToolName(toolPackage.name, tool.name)

		tools.push({
			type: "function",
			function: {
				name: toolName,
				description: describeLocalizedText(tool.description),
				parameters,
			},
		})
	}

	return tools
}

let cachedTools: OpenAI.Chat.ChatCompletionTool[] | null = null
let cachedKey: string | null = null

/**
 * Dynamically generates tool definitions for built-in example packages.
 *
 * 当前仅加载 enabledByDefault=true 的包，后续会增加“use_package/激活包”机制。
 */
export async function getExamplePackageTools(extensionPath: string): Promise<OpenAI.Chat.ChatCompletionTool[]> {
	// kept for backward compatibility
	return getExamplePackageToolsWithToggleLists(extensionPath)
}

// kilocode_change start
export async function getExamplePackageToolsWithDisabledList(
	extensionPath: string,
	disabledExamplePackages?: string[],
): Promise<OpenAI.Chat.ChatCompletionTool[]> {
	return getExamplePackageToolsWithToggleLists(extensionPath, { disabledExamplePackages })
}

export async function getExamplePackageToolsWithToggleLists(
	extensionPath: string,
	options?: {
		enabledExamplePackages?: string[]
		disabledExamplePackages?: string[]
		activatedExamplePackages?: string[]
		capabilities?: Record<string, unknown>
	},
): Promise<OpenAI.Chat.ChatCompletionTool[]> {
	const primaryExamplesDir = path.join(extensionPath, "dist", "examples")
	const isDevExtensionLayout = path.basename(extensionPath).toLowerCase() === "src" // kilocode_change
	const fallbackExamplesDir = isDevExtensionLayout
		? path.join(extensionPath, "examples")
		: path.join(extensionPath, "src", "examples")
	const examplesDir = primaryExamplesDir
	const enabledKey = (options?.enabledExamplePackages ?? []).slice().sort().join(",")
	const disabledKey = (options?.disabledExamplePackages ?? []).slice().sort().join(",")
	const activatedKey = (options?.activatedExamplePackages ?? []).slice().sort().join(",")
	const capKey = JSON.stringify({
		// Keep cache key stable and minimal; only include capability flags that impact state selection.
		ui_virtual_display: Boolean((options?.capabilities as any)?.ui?.virtual_display),
	})
	const cacheKey = `${primaryExamplesDir}|${fallbackExamplesDir}|${disabledKey}|${capKey}`
	const fullCacheKey = `${cacheKey}|${enabledKey}|${activatedKey}`

	if (cachedTools && cachedKey === fullCacheKey) {
		return cachedTools
	}

	try {
		let packages = await scanExamplePackages({ examplesDir })
		if (packages.length === 0) {
			packages = await scanExamplePackages({ examplesDir: fallbackExamplesDir })
		}
		const disabled = new Set((options?.disabledExamplePackages ?? []).map((n) => sanitizeMcpName(n)))
		const enabledOverride = new Set((options?.enabledExamplePackages ?? []).map((n) => sanitizeMcpName(n)))
		const activated = new Set((options?.activatedExamplePackages ?? []).map((n) => sanitizeMcpName(n)))

		const enabled = packages.filter((p) => {
			const name = sanitizeMcpName(p.name)
			if (enabledOverride.has(name)) {
				return true
			}
			if (disabled.has(name)) {
				return false
			}
			return Boolean(p.enabledByDefault)
		})

		// Require explicit activation before exposing any pkg-- tools to the model.
		// If no activated packages, return empty tool list.
		const capabilities = (options?.capabilities ?? buildDefaultSandboxCapabilities()) as any
		const activatedEnabled = enabled.filter((p) => activated.has(sanitizeMcpName(p.name)))
		const tools = activatedEnabled.flatMap((pkg) => {
			const { tools: effectiveTools } = resolveToolPackageToolsForCapabilities(pkg, capabilities)
			return convertToolPackageToOpenAITools({ ...pkg, tools: effectiveTools })
		})

		cachedTools = tools
		cachedKey = fullCacheKey
		return tools
	} catch (error) {
		console.warn("Failed to load example packages:", error)
		cachedTools = []
		cachedKey = fullCacheKey
		return []
	}
}
