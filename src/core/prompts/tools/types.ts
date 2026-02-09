import { DiffStrategy } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"
import { Experiments } from "@roo-code/types"

export type ToolArgs = {
	cwd: string
	supportsComputerUse: boolean
	diffStrategy?: DiffStrategy
	// kilocode_change: browser viewport size removed
	mcpHub?: McpHub
	toolOptions?: any
	partialReadsEnabled?: boolean
	settings?: Record<string, any>
	experiments?: Partial<Experiments>
}
