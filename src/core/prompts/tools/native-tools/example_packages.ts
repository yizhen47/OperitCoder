// kilocode_change - new file

import type OpenAI from "openai"
import * as path from "path"

import { buildExampleToolName } from "../../../../utils/example-tool-name"
import type { LocalizedText, ToolPackage } from "../../../tool-packages"
import { scanExamplePackages } from "../../../tool-packages"

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
	const examplesDir = path.join(extensionPath, "examples")
	const cacheKey = examplesDir

	if (cachedTools && cachedKey === cacheKey) {
		return cachedTools
	}

	try {
		const packages = await scanExamplePackages({ examplesDir })
		const enabled = packages.filter((p) => p.enabledByDefault)
		const tools = enabled.flatMap(convertToolPackageToOpenAITools)

		cachedTools = tools
		cachedKey = cacheKey
		return tools
	} catch (error) {
		console.warn("Failed to load example packages:", error)
		cachedTools = []
		cachedKey = cacheKey
		return []
	}
}
