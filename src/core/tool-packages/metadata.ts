// kilocode_change - new file

import * as Hjson from "hjson"

import type {
	EnvVar,
	LocalizedText,
	PackageTool,
	PackageToolParameter,
	ToolPackage,
	ToolPackageState,
} from "./types"

const metadataPattern = /\/\*\s*METADATA\s*([\s\S]*?)\*\//m

export function extractMetadataFromJs(jsContent: string): string {
	const match = jsContent.match(metadataPattern)
	if (!match) {
		return "{}"
	}

	return match[1]?.trim() ?? "{}"
}

function safeParseHjson(value: string): unknown {
	return Hjson.parse(value)
}

function asLocalizedText(value: unknown): LocalizedText {
	if (typeof value === "string") {
		return value
	}
	if (value && typeof value === "object") {
		return value as Record<string, string>
	}
	return ""
}

function asEnvVar(value: unknown): EnvVar | null {
	if (!value) {
		return null
	}
	if (typeof value === "string") {
		return {
			name: value,
			description: "",
			required: true,
		}
	}
	if (typeof value !== "object") {
		return null
	}

	const record = value as Record<string, unknown>
	const name = typeof record.name === "string" ? record.name : ""
	if (!name) {
		return null
	}

	return {
		name,
		description: asLocalizedText(record.description),
		required: typeof record.required === "boolean" ? record.required : undefined,
		defaultValue:
			record.defaultValue === undefined || record.defaultValue === null
				? record.defaultValue ?? undefined
				: String(record.defaultValue),
	}
}

function escapeRegexLiteral(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function validateToolFunctionExists(jsContent: string, toolName: string): boolean {
	const escapedToolName = escapeRegexLiteral(toolName)

	const patterns = [
		new RegExp(`async\\s+function\\s+${escapedToolName}\\s*\\(`),
		new RegExp(`function\\s+${escapedToolName}\\s*\\(`),
		new RegExp(`exports\\.${escapedToolName}\\s*=\\s*(?:async\\s+)?function`),
		new RegExp(`(?:const|let|var)\\s+${escapedToolName}\\s*=\\s*(?:async\\s+)?\\(`),
		new RegExp(`exports\\.${escapedToolName}\\s*=`),
	]

	for (const pattern of patterns) {
		if (pattern.test(jsContent)) {
			return true
		}
	}

	return false
}

function asPackageToolParameter(value: unknown): PackageToolParameter | null {
	if (!value || typeof value !== "object") {
		return null
	}

	const record = value as Record<string, unknown>
	const name = typeof record.name === "string" ? record.name : ""
	if (!name) {
		return null
	}

	return {
		name,
		description: asLocalizedText(record.description),
		type: typeof record.type === "string" ? record.type : "string",
		required: typeof record.required === "boolean" ? record.required : undefined,
	}
}

function asPackageTool(value: unknown, script: string): PackageTool | null {
	if (!value || typeof value !== "object") {
		return null
	}

	const record = value as Record<string, unknown>
	const name = typeof record.name === "string" ? record.name : ""
	if (!name) {
		return null
	}

	const rawParameters = Array.isArray(record.parameters) ? record.parameters : []
	const parameters = rawParameters.map(asPackageToolParameter).filter(Boolean) as PackageToolParameter[]

	return {
		name,
		description: asLocalizedText(record.description),
		parameters,
		script,
	}
}

function asToolPackageState(value: unknown, script: string): ToolPackageState | null {
	if (!value || typeof value !== "object") {
		return null
	}

	const record = value as Record<string, unknown>
	const id = typeof record.id === "string" ? record.id : ""
	if (!id) {
		return null
	}

	const rawTools = Array.isArray(record.tools) ? record.tools : []
	const tools = rawTools.map((t) => asPackageTool(t, script)).filter(Boolean) as PackageTool[]

	return {
		id,
		condition: typeof record.condition === "string" ? record.condition : undefined,
		inheritTools: typeof record.inheritTools === "boolean" ? record.inheritTools : undefined,
		excludeTools: Array.isArray(record.excludeTools)
			? record.excludeTools.filter((x) => typeof x === "string")
			: undefined,
		tools,
	}
}

export function parseJsToolPackageFromContent(
	jsContent: string,
	options?: { sourcePath?: string; sourceType?: "js" | "ts" },
): ToolPackage | null {
	let metadata: unknown
	try {
		const metadataString = extractMetadataFromJs(jsContent)
		metadata = safeParseHjson(metadataString)
	} catch (error) {
		console.warn(`Failed to parse METADATA block as HJSON: ${(error as Error).message}`)
		return null
	}

	if (!metadata || typeof metadata !== "object") {
		return null
	}

	const record = metadata as Record<string, unknown>
	const name = typeof record.name === "string" ? record.name : ""
	if (!name) {
		return null
	}

	const rawTools = Array.isArray(record.tools) ? record.tools : []
	const tools = rawTools.map((t) => asPackageTool(t, jsContent)).filter(Boolean) as PackageTool[]
	if (tools.length === 0) {
		return null
	}

	for (const tool of tools) {
		validateToolFunctionExists(jsContent, tool.name)
	}

	const rawStates = Array.isArray(record.states) ? record.states : []
	const states = rawStates
		.map((s) => asToolPackageState(s, jsContent))
		.filter(Boolean) as ToolPackageState[]

	for (const state of states) {
		for (const tool of state.tools ?? []) {
			validateToolFunctionExists(jsContent, tool.name)
		}
	}

	const rawEnv = Array.isArray(record.env) ? record.env : []
	const env = rawEnv.map(asEnvVar).filter(Boolean) as EnvVar[]

	return {
		name,
		description: asLocalizedText(record.description),
		tools,
		states,
		env,
		isBuiltIn: true,
		enabledByDefault: typeof record.enabledByDefault === "boolean" ? record.enabledByDefault : undefined,
		sourcePath: options?.sourcePath,
		sourceType: options?.sourceType,
	}
}
