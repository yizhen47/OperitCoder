// kilocode_change - new file
import { sanitizeMcpName } from "./mcp-name"

export const EXAMPLE_TOOL_SEPARATOR = "--"
export const EXAMPLE_TOOL_PREFIX = "pkg"

export function buildExampleToolName(packageName: string, toolName: string): string {
	const sanitizedPackage = sanitizeMcpName(packageName)
	const sanitizedTool = sanitizeMcpName(toolName)

	const fullName = `${EXAMPLE_TOOL_PREFIX}${EXAMPLE_TOOL_SEPARATOR}${sanitizedPackage}${EXAMPLE_TOOL_SEPARATOR}${sanitizedTool}`

	if (fullName.length > 64) {
		return fullName.slice(0, 64)
	}

	return fullName
}

export function parseExampleToolName(exampleToolName: string): { packageName: string; toolName: string } | null {
	const prefix = EXAMPLE_TOOL_PREFIX + EXAMPLE_TOOL_SEPARATOR
	if (!exampleToolName.startsWith(prefix)) {
		return null
	}

	const remainder = exampleToolName.slice(prefix.length)
	const separatorIndex = remainder.indexOf(EXAMPLE_TOOL_SEPARATOR)
	if (separatorIndex === -1) {
		return null
	}

	const packageName = remainder.slice(0, separatorIndex)
	const toolName = remainder.slice(separatorIndex + EXAMPLE_TOOL_SEPARATOR.length)

	if (!packageName || !toolName) {
		return null
	}

	return { packageName, toolName }
}
