import cloneDeep from "clone-deep"
import { serializeError } from "serialize-error"
import { Anthropic } from "@anthropic-ai/sdk"

import type { ToolName, ClineAsk, ToolProgressStatus, ToolProtocol } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import type { ToolParamName, ToolResponse, ToolUse, McpToolUse, ExampleToolUse } from "../../shared/tools"
import { Package } from "../../shared/package"
import { t } from "../../i18n"
import { AskIgnoredError } from "../task/AskIgnoredError"

// kilocode_change start
import * as path from "path"
import { buildDefaultSandboxCapabilities, resolveToolPackageToolsForCapabilities, scanExamplePackages } from "../tool-packages"
import { sanitizeMcpName } from "../../utils/mcp-name"
import { executeSandboxedTool } from "../tool-packages/runtime/sandbox"
import { getMissingRequiredSandboxEnvVars, getSandboxEnvValues } from "../tool-packages/env-secrets"
// kilocode_change end

import { fetchInstructionsTool } from "../tools/FetchInstructionsTool"
import { listFilesTool } from "../tools/ListFilesTool"
import { readFileTool } from "../tools/ReadFileTool"
import { getSimpleReadFileToolDescription, simpleReadFileTool } from "../tools/simpleReadFileTool"
import { shouldUseSingleFileRead, TOOL_PROTOCOL } from "@roo-code/types"
import { writeToFileTool } from "../tools/WriteToFileTool"
import { applyDiffTool } from "../tools/MultiApplyDiffTool"
import { searchAndReplaceTool } from "../tools/SearchAndReplaceTool"
import { searchReplaceTool } from "../tools/SearchReplaceTool"
import { applyPatchTool } from "../tools/ApplyPatchTool"
import { searchFilesTool } from "../tools/SearchFilesTool"
// kilocode_change: browser_action removed
import { executeCommandTool } from "../tools/ExecuteCommandTool"
import { useMcpToolTool } from "../tools/UseMcpToolTool"
import { accessMcpResourceTool } from "../tools/accessMcpResourceTool"
import { askFollowupQuestionTool } from "../tools/AskFollowupQuestionTool"
import { switchModeTool } from "../tools/SwitchModeTool"
import { attemptCompletionTool, AttemptCompletionCallbacks } from "../tools/AttemptCompletionTool"
import { newTaskTool } from "../tools/NewTaskTool"

import { updateTodoListTool } from "../tools/UpdateTodoListTool"
import { runSlashCommandTool } from "../tools/RunSlashCommandTool"
import { generateImageTool } from "../tools/GenerateImageTool"

// kilocode_change start
import { activateSandboxPackageTool } from "../tools/ActivateSandboxPackageTool"
// kilocode_change end

import { formatResponse } from "../prompts/responses"
import { validateToolUse } from "../tools/validateToolUse"
import { Task } from "../task/Task"
import { codebaseSearchTool } from "../tools/CodebaseSearchTool"
import { experiments, EXPERIMENT_IDS } from "../../shared/experiments"
import { applyDiffTool as applyDiffToolClass } from "../tools/ApplyDiffTool"

import { yieldPromise } from "../kilocode"
import { evaluateGatekeeperApproval } from "./kilocode/gatekeeper"
import { editFileTool, isFastApplyAvailable } from "../tools/kilocode/editFileTool"
import { deleteFileTool } from "../tools/kilocode/deleteFileTool"
import { newRuleTool } from "../tools/kilocode/newRuleTool"
import { reportBugTool } from "../tools/kilocode/reportBugTool"
import { condenseTool } from "../tools/kilocode/condenseTool"
import { captureAskApproval } from "./kilocode/captureAskApprovalEvent"

// kilocode_change start
type NormalizedToolResponse = {
  text: string
  imageBlocks: Anthropic.ImageBlockParam[]
}

const extractImageUrisFromText = (text: string): string[] => {
	if (!text) {
		return []
	}

	const urls = new Set<string>()
	const add = (value: string | undefined) => {
		const trimmed = (value ?? "").trim()
		if (trimmed) {
			urls.add(trimmed)
		}
	}

	const dataUriRegex = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g
	const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g
	const imageUrlRegex = /https?:\/\/[^\s)]+?\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s)]*)?/gi

	let match: RegExpExecArray | null
	while ((match = dataUriRegex.exec(text)) !== null) {
		add(match[0])
	}

	while ((match = markdownImageRegex.exec(text)) !== null) {
		const raw = match[1]?.trim()
		const url = raw ? raw.split(/\s+/)[0] : undefined
		add(url)
	}

	while ((match = imageUrlRegex.exec(text)) !== null) {
		add(match[0])
	}

	return Array.from(urls)
}

const approvalQueueByTask = new WeakMap<Task, Promise<void>>()
const pendingConcurrentToolCallsByTask = new WeakMap<Task, Set<Promise<void>>>()

const enqueueTaskApproval = <T>(task: Task, operation: () => Promise<T>): Promise<T> => {
	const previous = approvalQueueByTask.get(task) ?? Promise.resolve()
	const next = previous.catch(() => undefined).then(operation)
	approvalQueueByTask.set(task, next.then(() => undefined, () => undefined))
	return next
}

const hasPendingConcurrentToolCalls = (task: Task): boolean => {
	const pending = pendingConcurrentToolCallsByTask.get(task)
	return (pending?.size ?? 0) > 0
}

const CONCURRENT_NATIVE_TOOL_ALLOWLIST = new Set<ToolName>([
	"read_file",
	"fetch_instructions",
	"list_files",
	"codebase_search",
	"search_files",
	"access_mcp_resource",
	"use_mcp_tool",
])

const canRunToolUseConcurrently = async (cline: Task, toolBlock: ToolUse): Promise<boolean> => {
	if (toolBlock.partial || !toolBlock.id || cline.didRejectTool || cline.didAlreadyUseTool) {
		return false
	}

	if (!CONCURRENT_NATIVE_TOOL_ALLOWLIST.has(toolBlock.name as ToolName)) {
		return false
	}

	const state = await cline.providerRef.deref()?.getState()
	return experiments.isEnabled(state?.experiments ?? {}, EXPERIMENT_IDS.MULTIPLE_NATIVE_TOOL_CALLS)
}

const trackConcurrentToolCall = (task: Task, operation: () => Promise<void>): void => {
	const pending = pendingConcurrentToolCallsByTask.get(task) ?? new Set<Promise<void>>()
	pendingConcurrentToolCallsByTask.set(task, pending)

	let trackedPromise: Promise<void>
	trackedPromise = operation()
		.catch((error) => {
			console.error("[presentAssistantMessage] Concurrent tool execution failed:", error)
		})
		.finally(() => {
			pending.delete(trackedPromise)
			if (
				pending.size === 0 &&
				task.didCompleteReadingStream &&
				task.currentStreamingContentIndex >= task.assistantMessageContent.length
			) {
				task.userMessageContentReady = true
			}
		})

	pending.add(trackedPromise)
}

const normalizeToolResponse = (
  content: ToolResponse,
  formatText: (text: string) => string = (text) => text || "(tool did not return anything)",
): NormalizedToolResponse => {
  if (typeof content === "string") {
    return { text: formatText(content), imageBlocks: [] }
  }

  const textBlocks = content.filter((item) => item.type === "text")
  const imageBlocks = content.filter((item) => item.type === "image") as Anthropic.ImageBlockParam[]
  const text = formatText(textBlocks.map((item) => (item as Anthropic.TextBlockParam).text).join("\n"))
  return { text, imageBlocks }
}

const pushNativeToolSkipResult = (cline: Task, toolCallId: string | undefined, errorMessage: string) => {
  if (!toolCallId) {
    return
  }
  cline.userMessageContent.push({
    type: "tool_result",
    tool_use_id: toolCallId,
    content: errorMessage,
    is_error: true,
  } as Anthropic.ToolResultBlockParam)
}

const pushToolSkipResult = (
	cline: Task,
	toolProtocol: ToolProtocol,
	toolCallId: string | undefined,
	errorMessage: string,
) => {
	if (toolProtocol === TOOL_PROTOCOL.NATIVE) {
		pushNativeToolSkipResult(cline, toolCallId, errorMessage)
		return
	}
	cline.userMessageContent.push({
		type: "text",
		text: errorMessage,
	})
}

// kilocode_change start
const createHandleError = (options: {
	cline: Task
	toolProtocol: ToolProtocol
	pushToolResult: (content: ToolResponse) => void
}) => {
	const { cline, toolProtocol, pushToolResult } = options
	return async (action: string, error: Error) => {
		// Silently ignore AskIgnoredError - this is an internal control flow
		// signal, not an actual error. It occurs when a newer ask supersedes an older one.
		if (error instanceof AskIgnoredError) {
			return
		}
		const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`
		await cline.say(
			"error",
			`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
		)
		pushToolResult(formatResponse.toolError(errorString, toolProtocol))
	}
}

const createRemoveClosingTag = (isPartial: boolean) => {
	return (tag: ToolParamName, text?: string): string => {
		if (!isPartial) {
			return text || ""
		}

		if (!text) {
			return ""
		}

		// This regex dynamically constructs a pattern to match the
		// closing tag:
		// - Optionally matches whitespace before the tag.
		// - Matches '<' or '</' optionally followed by any subset of
		//   characters from the tag name.
		const tagRegex = new RegExp(
			`\\s?<\\/?${tag
				.split("")
				.map((char) => `(?:${char})?`)
				.join("")}$`,
			"g",
		)

		return text.replace(tagRegex, "")
	}
}
// kilocode_change end

const createNativeToolResultPusher = (options: {
  cline: Task
  toolCallId: string | undefined
  warnLabel: string
  formatText?: (text: string) => string
  computeIsError?: (text: string) => boolean
  includeIsErrorField?: boolean
  markToolUsed?: boolean
  onDidPush?: (text: string, isError: boolean) => void
}) => {
  let hasToolResult = false
  const {
    cline,
    toolCallId,
    warnLabel,
    formatText,
    computeIsError,
    includeIsErrorField = false,
    markToolUsed = false,
    onDidPush,
  } = options

  const pushToolResult = (content: ToolResponse) => {
    if (!toolCallId) {
      return
    }
    if (hasToolResult) {
      console.warn(`[presentAssistantMessage] Skipping duplicate tool_result for ${warnLabel}: ${toolCallId}`)
      return
    }

    const normalized = normalizeToolResponse(content, formatText)
    const isError = computeIsError ? computeIsError(normalized.text) : false
    const toolResultBlock: any = {
      type: "tool_result",
      tool_use_id: toolCallId,
      content: normalized.text,
    }
    if (includeIsErrorField) {
      toolResultBlock.is_error = isError
    }

    cline.userMessageContent.push(toolResultBlock as Anthropic.ToolResultBlockParam)
    if (normalized.imageBlocks.length > 0) {
      cline.userMessageContent.push(...normalized.imageBlocks)
    }

    onDidPush?.(normalized.text, isError)
    hasToolResult = true
    if (markToolUsed) {
      cline.didAlreadyUseTool = true
    }
  }

  return { pushToolResult }
}

const createAskApprovalHandler = (options: {
	cline: Task
	toolProtocol: ToolProtocol
	pushToolResult: (content: ToolResponse) => void
	telemetryToolName: ToolName
	gatekeeperToolName: string
	gatekeeperParams: Record<string, any>
	yoloDeniedUsesProtocol?: boolean
}) => {
	const {
		cline,
		toolProtocol,
		pushToolResult,
		telemetryToolName,
		gatekeeperToolName,
		gatekeeperParams,
		yoloDeniedUsesProtocol = false,
	} = options

	return async (
		type: ClineAsk,
		partialMessage?: string,
		progressStatus?: ToolProgressStatus,
		isProtected?: boolean,
	) => {
		return await enqueueTaskApproval(cline, async () => {
			if (cline.didRejectTool) {
				pushToolResult(formatResponse.toolDenied(toolProtocol))
				captureAskApproval(telemetryToolName, false)
				return false
			}

			// kilocode_change start: YOLO mode with AI gatekeeper
			const state = await cline.providerRef.deref()?.getState()
			if (state?.yoloMode) {
				const approved = await evaluateGatekeeperApproval(cline, gatekeeperToolName, gatekeeperParams)
				if (!approved) {
					pushToolResult(
						yoloDeniedUsesProtocol ? formatResponse.toolDenied(toolProtocol) : formatResponse.toolDenied(),
					)
					cline.didRejectTool = true
					captureAskApproval(telemetryToolName, false)
					return false
				}
				captureAskApproval(telemetryToolName, true)
				return true
			}
			// kilocode_change end

			const { response, text, images } = await cline.ask(
				type,
				partialMessage,
				false,
				progressStatus,
				isProtected || false,
			)

			if (response !== "yesButtonClicked") {
				if (text) {
					await cline.say("user_feedback", text, images)
					pushToolResult(
						formatResponse.toolResult(
							formatResponse.toolDeniedWithFeedback(text, toolProtocol),
							images,
						),
					)
				} else {
					pushToolResult(formatResponse.toolDenied(toolProtocol))
				}
				cline.didRejectTool = true
				captureAskApproval(telemetryToolName, false)
				return false
			}

			if (text) {
				await cline.say("user_feedback", text, images)
				pushToolResult(
					formatResponse.toolResult(formatResponse.toolApprovedWithFeedback(text, toolProtocol), images),
				)
			}

			captureAskApproval(telemetryToolName, true)
			return true
		})
	}
}
// kilocode_change end

async function handleMcpToolUse(cline: Task, mcpBlock: McpToolUse): Promise<void> {
	if (cline.didRejectTool) {
		const toolCallId = mcpBlock.id
		const errorMessage = !mcpBlock.partial
			? `Skipping MCP tool ${mcpBlock.name} due to user rejecting a previous tool.`
			: `MCP tool ${mcpBlock.name} was interrupted and not executed due to user rejecting a previous tool.`
		pushNativeToolSkipResult(cline, toolCallId, errorMessage)
		return
	}

	if (cline.didAlreadyUseTool) {
		const state = await cline.providerRef.deref()?.getState()
		const isMultipleNativeToolCallsEnabled = experiments.isEnabled(
			state?.experiments ?? {},
			EXPERIMENT_IDS.MULTIPLE_NATIVE_TOOL_CALLS,
		)
		if (!isMultipleNativeToolCallsEnabled) {
			const toolCallId = mcpBlock.id
			const errorMessage = `MCP tool [${mcpBlock.name}] was not executed because a tool has already been used in this message. Only one tool may be used per message.`
			pushNativeToolSkipResult(cline, toolCallId, errorMessage)
			return
		}
		cline.didAlreadyUseTool = false
	}

	const toolCallId = mcpBlock.id
	const toolProtocol = TOOL_PROTOCOL.NATIVE // MCP tools in native mode always use native protocol
	const { pushToolResult } = createNativeToolResultPusher({
		cline,
		toolCallId,
		warnLabel: "mcp_tool_use",
		markToolUsed: false,
	})

	const handleError = createHandleError({ cline, toolProtocol, pushToolResult })

	if (!mcpBlock.partial) {
		cline.recordToolUsage("use_mcp_tool") // Record as use_mcp_tool for analytics
		TelemetryService.instance.captureToolUsage(cline.taskId, "use_mcp_tool", toolProtocol)
	}

	// Resolve sanitized server name back to original server name
	// The serverName from parsing is sanitized (e.g., "my_server" from "my server")
	// We need the original name to find the actual MCP connection
	const mcpHub = cline.providerRef.deref()?.getMcpHub()
	let resolvedServerName = mcpBlock.serverName
	if (mcpHub) {
		const originalName = mcpHub.findServerNameBySanitizedName(mcpBlock.serverName)
		if (originalName) {
			resolvedServerName = originalName
		}
	}

	const askApproval = createAskApprovalHandler({
		cline,
		toolProtocol,
		pushToolResult,
		telemetryToolName: "use_mcp_tool",
		gatekeeperToolName: "use_mcp_tool",
		gatekeeperParams: {
			server_name: resolvedServerName,
			tool_name: mcpBlock.toolName,
			arguments: mcpBlock.arguments,
		},
		yoloDeniedUsesProtocol: true,
	})

	// Execute the MCP tool using the same handler as use_mcp_tool
	// Create a synthetic ToolUse block that the useMcpToolTool can handle
	const syntheticToolUse: ToolUse<"use_mcp_tool"> = {
		type: "tool_use",
		id: mcpBlock.id,
		name: "use_mcp_tool",
		params: {
			server_name: resolvedServerName,
			tool_name: mcpBlock.toolName,
			arguments: JSON.stringify(mcpBlock.arguments),
		},
		partial: mcpBlock.partial,
		nativeArgs: {
			server_name: resolvedServerName,
			tool_name: mcpBlock.toolName,
			arguments: mcpBlock.arguments,
		},
	}

	await useMcpToolTool.handle(cline, syntheticToolUse, {
		askApproval,
		handleError,
		pushToolResult,
		removeClosingTag: (tag, text) => text || "",
		toolProtocol,
	})
}

async function handlePkgToolUse(cline: Task, pkgBlock: ExampleToolUse): Promise<void> {
	const toolCallId = pkgBlock.id
	const toolProtocol = toolCallId ? TOOL_PROTOCOL.NATIVE : TOOL_PROTOCOL.XML

	// kilocode_change start
	// Require explicit activation before executing any package tools.
	if (!cline.isExamplePackageActivated(pkgBlock.packageName)) {
		const message = `Package '${pkgBlock.packageName}' is not activated. Activate it first using activate_sandbox_package with package_name='${pkgBlock.packageName}'.`
		pushToolSkipResult(cline, toolProtocol, toolCallId, message)
		await cline.say(
			"tool" as any,
			JSON.stringify({
				tool: "sandboxPackageTool",
				packageName: pkgBlock.packageName,
				toolName: pkgBlock.toolName,
				content: message,
				isError: true,
			}),
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: true },
		)
		cline.didAlreadyUseTool = true
		return
	}
	// kilocode_change end

	// kilocode_change: Respect disabledExamplePackages toggle
	try {
		const state = await cline.providerRef.deref()?.getState()
		const disabled = (state as any)?.disabledExamplePackages as string[] | undefined
		const enabled = (state as any)?.enabledExamplePackages as string[] | undefined

		const isDisabled = Array.isArray(disabled) && disabled.includes(pkgBlock.packageName)
		const isEnabledOverride = Array.isArray(enabled) && enabled.includes(pkgBlock.packageName)
		if (isDisabled && !isEnabledOverride) {
			const message = `Package '${pkgBlock.packageName}' is disabled in settings.`
			pushToolSkipResult(cline, toolProtocol, toolCallId, message)
			await cline.say(
				"tool" as any,
				JSON.stringify({
					tool: "sandboxPackageTool",
					packageName: pkgBlock.packageName,
					toolName: pkgBlock.toolName,
					content: message,
					isError: true,
				}),
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
			)
			cline.didAlreadyUseTool = true
			return
		}
	} catch {
		// ignore and continue
	}

	if (cline.didRejectTool) {
		// For native protocol, we must send a tool_result for every tool_use to avoid API errors
		const errorMessage = !pkgBlock.partial
			? `Skipping package tool ${pkgBlock.name} due to user rejecting a previous tool.`
			: `Package tool ${pkgBlock.name} was interrupted and not executed due to user rejecting a previous tool.`
		const formatted = errorMessage
		pushToolSkipResult(cline, toolProtocol, toolCallId, formatted)
		await cline.say(
			"tool" as any,
			JSON.stringify({
				tool: "sandboxPackageTool",
				packageName: pkgBlock.packageName,
				toolName: pkgBlock.toolName,
				content: formatted,
				isError: true,
			}),
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: true },
		)
		return
	}

	if (cline.didAlreadyUseTool) {
		const state = await cline.providerRef.deref()?.getState()
		const isMultipleNativeToolCallsEnabled = experiments.isEnabled(
			state?.experiments ?? {},
			EXPERIMENT_IDS.MULTIPLE_NATIVE_TOOL_CALLS,
		)
		if (!isMultipleNativeToolCallsEnabled) {
			const errorMessage = `Package tool [${pkgBlock.name}] was not executed because a tool has already been used in this message. Only one tool may be used per message.`
			const formatted = errorMessage
			pushToolSkipResult(cline, toolProtocol, toolCallId, formatted)
			await cline.say(
				"tool" as any,
				JSON.stringify({
					tool: "sandboxPackageTool",
					packageName: pkgBlock.packageName,
					toolName: pkgBlock.toolName,
					content: formatted,
					isError: true,
				}),
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
			)
			return
		}
		cline.didAlreadyUseTool = false
	}

	const toolDescription = () => `[sandbox_package_tool for '${pkgBlock.packageName}.${pkgBlock.toolName}']`

	const formatPkgToolResultContent = (result: string) => {
		return result || "(tool did not return anything)"
	}

	const isPkgToolErrorResult = (formattedResult: string) => {
		try {
			const parsed = JSON.parse(formattedResult)
			const status = (parsed as any)?.status
			return status === "error" || status === "denied"
		} catch {
			return false
		}
	}

	const sayPkgToolResult = async (formattedResult: string, isError: boolean) => {
		await cline.say(
			"tool" as any,
			JSON.stringify({
				tool: "sandboxPackageTool",
				packageName: pkgBlock.packageName,
				toolName: pkgBlock.toolName,
				content: formattedResult,
				isError,
			}),
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: true },
		)
	}

	const { pushToolResult: pushNativePkgToolResult } = createNativeToolResultPusher({
		cline,
		toolCallId,
		warnLabel: "pkg_tool_use",
		formatText: formatPkgToolResultContent,
		computeIsError: isPkgToolErrorResult,
		includeIsErrorField: true,
		markToolUsed: false,
		onDidPush: (text, isError) => {
			void sayPkgToolResult(text, isError)
		},
	})

	const pushToolResult = (content: ToolResponse) => {
		if (toolProtocol === TOOL_PROTOCOL.NATIVE) {
			pushNativePkgToolResult(content)
		} else {
			cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })
			if (typeof content === "string") {
				const formatted = formatPkgToolResultContent(content)
				cline.userMessageContent.push({
					type: "text",
					text: formatted,
				})
				void sayPkgToolResult(formatted, isPkgToolErrorResult(formatted))
			} else {
				const normalized = normalizeToolResponse(content, formatPkgToolResultContent)
				const formatted = normalized.text
				cline.userMessageContent.push({
					type: "text",
					text: formatted,
				})
				cline.userMessageContent.push(...normalized.imageBlocks)
				void sayPkgToolResult(formatted, isPkgToolErrorResult(formatted))
			}
		}
		if (toolProtocol === TOOL_PROTOCOL.XML) {
			cline.didAlreadyUseTool = true
		}
	}

	const handleError = async (action: string, error: Error) => {
		await createHandleError({ cline, toolProtocol, pushToolResult })(action, error)
	}

	const askApproval = async (
		type: ClineAsk,
		partialMessage?: string,
		progressStatus?: ToolProgressStatus,
		isProtected?: boolean,
	) => {
		return await enqueueTaskApproval(cline, async () => {
			if (cline.didRejectTool) {
				pushToolResult(formatResponse.toolDenied(toolProtocol))
				return false
			}

			const { response, text, images } = await cline.ask(
				type,
				partialMessage,
				false,
				progressStatus,
				isProtected || false,
			)

			if (response !== "yesButtonClicked") {
				if (text) {
					await cline.say("user_feedback", text, images)
					pushToolResult(
						formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text, toolProtocol), images),
					)
				} else {
					pushToolResult(formatResponse.toolDenied(toolProtocol))
				}
				cline.didRejectTool = true
				return false
			}

			if (text) {
				await cline.say("user_feedback", text, images)
				pushToolResult(
					formatResponse.toolResult(formatResponse.toolApprovedWithFeedback(text, toolProtocol), images),
				)
			}

			return true
		})
	}

	// Only execute when the tool call is complete.
	if (pkgBlock.partial) {
		return
	}

	// Ask for approval so the package tool call is visible in the UI (similar to other tools).
	const approvalMessage = JSON.stringify({
		tool: "sandboxPackageTool",
		packageName: pkgBlock.packageName,
		toolName: pkgBlock.toolName,
		arguments: JSON.stringify(pkgBlock.arguments ?? {}),
	})
	const didApprove = await askApproval("tool", approvalMessage)
	if (!didApprove) {
		// askApproval already pushed a tool_result (native) and set didRejectTool.
		return
	}

	// Show a running tool result block in the UI while the sandboxed tool is executing.
	await cline.say(
		"tool" as any,
		JSON.stringify({
			tool: "sandboxPackageTool",
			packageName: pkgBlock.packageName,
			toolName: pkgBlock.toolName,
			content: "",
			isError: false,
		}),
		undefined,
		true,
		undefined,
		undefined,
		{ isNonInteractive: true },
	)

	let pkgArgsForLog = "{}"
	try {
		pkgArgsForLog = JSON.stringify(pkgBlock.arguments ?? {}, null, 2)
	} catch {
		pkgArgsForLog = String(pkgBlock.arguments ?? "{}")
	}
	console.log("[Pkg Sandbox] start", {
		packageName: pkgBlock.packageName,
		toolName: pkgBlock.toolName,
		args: pkgArgsForLog,
	})

	const toolCallForSandbox = async (toolName: string, params?: Record<string, unknown>): Promise<unknown> => {
		if (toolName === "visit_web") {
			const url = String((params as any)?.url ?? "").trim()
			if (!url) {
				throw new Error("visit_web requires url")
			}
			try {
				const providerState = await cline.providerRef.deref()?.getState().catch(() => undefined as any)
				await cline.urlContentFetcher.launchBrowser({
					browserType: providerState?.visitWebBrowserType,
					executablePath: providerState?.visitWebBrowserExecutablePath,
				})
				return await cline.urlContentFetcher.urlToMarkdown(url)
			} finally {
				await cline.urlContentFetcher.closeBrowser().catch(() => undefined)
			}
		}

		// Execute nested native tools through existing tool handlers and return a string result to sandbox.
		const name = toolName as ToolName
		const paramObj = (params ?? {}) as Record<string, any>
		const legacyParams: Partial<Record<ToolParamName, string>> = {}
		for (const [k, v] of Object.entries(paramObj)) {
			legacyParams[k as ToolParamName] = typeof v === "string" ? v : JSON.stringify(v)
		}

		const toolUse: ToolUse = {
			type: "tool_use",
			name,
			params: legacyParams,
			partial: false,
			nativeArgs: paramObj as any,
		}

		return await new Promise<unknown>(async (resolve, reject) => {
			let resolved = false
			const resolveOnce = (value: unknown) => {
				if (resolved) return
				resolved = true
				resolve(value)
			}

			const pushNestedResult = (content: ToolResponse) => {
				if (typeof content === "string") {
					resolveOnce(content)
					return
				}
				const textBlocks = content.filter((item) => item.type === "text")
				resolveOnce(textBlocks.map((item) => (item as Anthropic.TextBlockParam).text).join("\n"))
			}

			const callbacks = {
				askApproval: askApproval,
				handleError: async (action: string, error: Error) => {
					await handleError(action, error)
					reject(error)
				},
				pushToolResult: pushNestedResult,
				removeClosingTag: (_tag: any, text?: string) => text || "",
				toolProtocol,
			}

			try {
				switch (name) {
					case "execute_command":
						await executeCommandTool.handle(cline, toolUse as any, callbacks as any)
						break
					case "read_file":
						await readFileTool.handle(cline, toolUse as any, callbacks as any)
						break
					case "write_to_file":
						await writeToFileTool.handle(cline, toolUse as any, callbacks as any)
						break
					case "apply_patch":
						await applyPatchTool.handle(cline, toolUse as any, callbacks as any)
						break
					case "apply_diff":
						await applyDiffToolClass.handle(cline, toolUse as any, callbacks as any)
						break
					case "search_files":
						await searchFilesTool.handle(cline, toolUse as any, callbacks as any)
						break
					case "list_files":
						await listFilesTool.handle(cline, toolUse as any, callbacks as any)
						break
					default:
						throw new Error(`Unsupported nested tool call from sandbox: ${toolName}`)
				}
			} catch (e) {
				reject(e)
			}
		})
	}

	try {
		const provider = cline.providerRef.deref()
		const extensionPath = provider?.context.extensionPath
		if (!extensionPath) {
			throw new Error("Provider not available")
		}

		const primaryExamplesDir = path.join(extensionPath, "dist", "examples")
		const fallbackExamplesDir = path.join(extensionPath, "src", "examples")
		let packages = await scanExamplePackages({ examplesDir: primaryExamplesDir })
		if (packages.length === 0) {
			packages = await scanExamplePackages({ examplesDir: fallbackExamplesDir })
		}

		const pkg = packages.find((p) => sanitizeMcpName(p.name) === pkgBlock.packageName)
		if (!pkg) {
			throw new Error(`Example package not found: ${pkgBlock.packageName}`)
		}

		const modelInfo = cline.api.getModel().info
		const capabilities = buildDefaultSandboxCapabilities({ supportsComputerUse: (modelInfo as any)?.supportsImages === true })
		const { activeStateId, tools: effectiveTools } = resolveToolPackageToolsForCapabilities(pkg, capabilities)

		const tool = effectiveTools.find((t) => sanitizeMcpName(t.name) === pkgBlock.toolName)
		if (!tool) {
			throw new Error(`Tool not found in package '${pkg.name}': ${pkgBlock.toolName}`)
		}

		const missingEnv = await getMissingRequiredSandboxEnvVars(provider.context.secrets, pkg.env)
		if (missingEnv.length > 0) {
			const message = `Missing required environment variables for package '${pkg.name}': ${missingEnv.join(
				", ",
			)}. Configure them in Settings → Sandbox Packages.`
			pushToolSkipResult(cline, toolProtocol, toolCallId, message)
			await cline.say(
				"tool" as any,
				JSON.stringify({
					tool: "sandboxPackageTool",
					packageName: pkgBlock.packageName,
					toolName: pkgBlock.toolName,
					content: message,
					isError: true,
				}),
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
			)
			cline.didAlreadyUseTool = true
			return
		}

		const env = await getSandboxEnvValues(provider.context.secrets, pkg.env)
		const providerState = await provider.getState().catch(() => undefined as any)
		const lang = String(providerState?.language ?? "en")

		const result = await executeSandboxedTool({
			script: tool.script,
			toolExportName: tool.name,
			args: (pkgBlock.arguments ?? {}) as Record<string, unknown>,
			cwd: cline.cwd,
			env,
			lang,
			state: activeStateId,
			toolCall: toolCallForSandbox,
			filename: pkg.sourcePath ?? `examples/${pkg.name}.js`,
			logger: console,
		})

		let resultForLog: string
		if (typeof result === "string") {
			resultForLog = result
		} else {
			try {
				resultForLog = JSON.stringify(result)
			} catch {
				resultForLog = String(result)
			}
		}
		console.log("[Pkg Sandbox] done", {
			packageName: pkgBlock.packageName,
			toolName: pkgBlock.toolName,
			result: resultForLog,
		})
		pushToolResult(resultForLog)
	} catch (error) {
		await handleError(`executing package tool ${pkgBlock.packageName}.${pkgBlock.toolName}`, error as Error)
	}
}

// kilocode_change start
async function handleToolUse(cline: Task, toolBlock: ToolUse): Promise<void> {
	// Fetch state early so it's available for toolDescription and validation
	const state = await cline.providerRef.deref()?.getState()
	const { mode, customModes, experiments: stateExperiments } = state ?? {}

	// Fast Apply + native tool aliases compatibility:
	// In native protocol parsing, `edit_file` may be treated as an alias for `apply_diff`.
	// When Fast Apply is actually enabled, we need to undo that aliasing so that the
	// real `edit_file` tool handler runs.
	if (
		isFastApplyAvailable(state as any) &&
		toolBlock.originalName === "edit_file" &&
		toolBlock.name === "apply_diff"
	) {
		toolBlock.name = "edit_file"
		toolBlock.originalName = undefined
	}

	const toolDescription = (): string => {
		switch (toolBlock.name) {
			case "execute_command":
				return `[${toolBlock.name} for '${toolBlock.params.command}']`
			case "read_file":
				// Check if this model should use the simplified description
				const modelId = cline.api.getModel().id
				if (shouldUseSingleFileRead(modelId)) {
					return getSimpleReadFileToolDescription(toolBlock.name, toolBlock.params)
				} else {
					// Prefer native typed args when available; fall back to legacy params
					// Check if nativeArgs exists (native protocol)
					if (toolBlock.nativeArgs) {
						return readFileTool.getReadFileToolDescription(toolBlock.name, toolBlock.nativeArgs)
					}
					return readFileTool.getReadFileToolDescription(toolBlock.name, toolBlock.params)
				}
			case "fetch_instructions":
				return `[${toolBlock.name} for '${toolBlock.params.task}']`
			case "write_to_file":
				return `[${toolBlock.name} for '${toolBlock.params.path}']`
			case "apply_diff":
				// Handle both legacy format and new multi-file format
				if (toolBlock.params.path) {
					return `[${toolBlock.name} for '${toolBlock.params.path}']`
				} else if (toolBlock.params.args) {
					// Try to extract first file path from args for display
					const match = toolBlock.params.args.match(/<file>.*?<path>([^<]+)<\/path>/s)
					if (match) {
						const firstPath = match[1]
						// Check if there are multiple files
						const fileCount = (toolBlock.params.args.match(/<file>/g) || []).length
						if (fileCount > 1) {
							return `[${toolBlock.name} for '${firstPath}' and ${fileCount - 1} more file${fileCount > 2 ? "s" : ""}]`
						} else {
							return `[${toolBlock.name} for '${firstPath}']`
						}
					}
				}
				return `[${toolBlock.name}]`
			case "search_files":
				return `[${toolBlock.name} for '${toolBlock.params.regex}'${
					toolBlock.params.file_pattern ? ` in '${toolBlock.params.file_pattern}'` : ""
				}]`
			case "search_and_replace":
				return `[${toolBlock.name} for '${toolBlock.params.path}']`
			case "edit_file":
				return `[${toolBlock.name} for '${toolBlock.params.target_file}']`
			case "delete_file":
				return `[${toolBlock.name} for '${toolBlock.params.path}']`
			case "search_replace":
				return `[${toolBlock.name} for '${toolBlock.params.file_path}']`
			case "apply_patch":
				return `[${toolBlock.name}]`
			case "list_files":
				return `[${toolBlock.name} for '${toolBlock.params.path}']`
			case "use_mcp_tool":
				return `[${toolBlock.name} for '${toolBlock.params.server_name}']`
			case "access_mcp_resource":
				return `[${toolBlock.name} for '${toolBlock.params.server_name}']`
			case "ask_followup_question":
				return `[${toolBlock.name} for '${toolBlock.params.question}']`
			case "attempt_completion":
				return `[${toolBlock.name}]`
			case "switch_mode":
				return `[${toolBlock.name} to '${toolBlock.params.mode_slug}'${toolBlock.params.reason ? ` because: ${toolBlock.params.reason}` : ""}]`
			case "codebase_search": // Add case for the new tool
				return `[${toolBlock.name} for '${toolBlock.params.query}']`
			case "update_todo_list":
				return `[${toolBlock.name}]`
			case "new_task": {
				const mode = toolBlock.params.mode ?? defaultModeSlug
				const message = toolBlock.params.message ?? "(no message)"
				const modeName = getModeBySlug(mode, customModes)?.name ?? mode
				return `[${toolBlock.name} in ${modeName} mode: '${message}']`
			}
			case "new_rule":
				return `[${toolBlock.name} for '${toolBlock.params.path}']`
			case "report_bug":
				return `[${toolBlock.name}]`
			case "condense":
				return `[${toolBlock.name}]`
			case "run_slash_command":
				return `[${toolBlock.name} for '${toolBlock.params.command}'${toolBlock.params.args ? ` with args: ${toolBlock.params.args}` : ""}]`
			case "generate_image":
				return `[${toolBlock.name} for '${toolBlock.params.path}']`
			default:
				return `[${toolBlock.name}]`
		}
	}

	// Determine protocol by checking if this tool call has an ID.
	// Native protocol tool calls ALWAYS have an ID (set when parsed from tool_call chunks).
	// XML protocol tool calls NEVER have an ID (parsed from XML text).
	const toolCallId = (toolBlock as any).id
	const toolProtocol = toolCallId ? TOOL_PROTOCOL.NATIVE : TOOL_PROTOCOL.XML
	const isMultipleNativeToolCallsEnabled = experiments.isEnabled(
		stateExperiments ?? {},
		EXPERIMENT_IDS.MULTIPLE_NATIVE_TOOL_CALLS,
	)

	if (cline.didRejectTool) {
		const errorMessage = !toolBlock.partial
			? `Skipping tool ${toolDescription()} due to user rejecting a previous tool.`
			: `Tool ${toolDescription()} was interrupted and not executed due to user rejecting a previous tool.`
		pushToolSkipResult(cline, toolProtocol, toolCallId, errorMessage)
		return
	}

	if (cline.didAlreadyUseTool) {
		if (!isMultipleNativeToolCallsEnabled || toolProtocol === TOOL_PROTOCOL.XML) {
			const errorMessage = `Tool [${toolBlock.name}] was not executed because a tool has already been used in this message. Only one tool may be used per message. You must assess the first tool's result before proceeding to use the next tool.`
			pushToolSkipResult(cline, toolProtocol, toolCallId, errorMessage)
			return
		}
		cline.didAlreadyUseTool = false
	}

	const { pushToolResult: pushNativeToolResult } = createNativeToolResultPusher({
		cline,
		toolCallId,
		warnLabel: "tool_use_id",
	})

	const pushToolResult = (content: ToolResponse) => {
		if (toolProtocol === TOOL_PROTOCOL.NATIVE) {
			pushNativeToolResult(content)
		} else {
			// For XML protocol, add as text blocks (legacy behavior)
			cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })

			if (typeof content === "string") {
				cline.userMessageContent.push({
					type: "text",
					text: content || "(tool did not return anything)",
				})
			} else {
				cline.userMessageContent.push(...content)
			}
		}

		// For XML protocol: Only one tool per message is allowed
		// For native protocol with experimental flag enabled: Multiple tools can be executed in sequence
		// For native protocol with experimental flag disabled: Single tool per message (default safe behavior)
		if (toolProtocol === TOOL_PROTOCOL.XML) {
			// Once a tool result has been collected, ignore all other tool
			// uses since we should only ever present one tool result per
			// message (XML protocol only).
			cline.didAlreadyUseTool = true
		} else if (toolProtocol === TOOL_PROTOCOL.NATIVE && !isMultipleNativeToolCallsEnabled) {
			// For native protocol with experimental flag disabled, enforce single tool per message
			cline.didAlreadyUseTool = true
		} else if (toolProtocol === TOOL_PROTOCOL.NATIVE && isMultipleNativeToolCallsEnabled) {
			// When multiple native tool calls are enabled, keep accepting subsequent tool blocks.
			cline.didAlreadyUseTool = false
		}
		// If toolProtocol is NATIVE and isMultipleNativeToolCallsEnabled is true,
		// allow multiple tool calls in sequence (don't set didAlreadyUseTool)
	}

	const askApproval = createAskApprovalHandler({
		cline,
		toolProtocol,
		pushToolResult,
		telemetryToolName: toolBlock.name as ToolName,
		gatekeeperToolName: toolBlock.name,
		gatekeeperParams: toolBlock.params,
		yoloDeniedUsesProtocol: false,
	})

	const askFinishSubTaskApproval = async () => {
		// Ask the user to approve this task has completed, and he has
		// reviewed it, and we can declare task is finished and return
		// control to the parent task to continue running the rest of
		// the sub-tasks.
		const toolMessage = JSON.stringify({ tool: "finishTask" })
		return await askApproval("tool", toolMessage)
	}

	const handleError = createHandleError({ cline, toolProtocol, pushToolResult })

	// If block is partial, remove partial closing tag so its not
	// presented to user.
	const removeClosingTag = createRemoveClosingTag(toolBlock.partial)

	const commonCallbacks = {
		askApproval,
		handleError,
		pushToolResult,
		removeClosingTag,
		toolProtocol,
	}

	// kilocode_change: browser session handling removed

	if (!toolBlock.partial) {
		cline.recordToolUsage(toolBlock.name)
		TelemetryService.instance.captureToolUsage(cline.taskId, toolBlock.name, toolProtocol)
	}

	// Validate tool use before execution - ONLY for complete (non-partial) blocks.
	// Validating partial blocks would cause validation errors to be thrown repeatedly
	// during streaming, pushing multiple tool_results for the same tool_use_id and
	// potentially causing the stream to appear frozen.
	if (!toolBlock.partial) {
		const modelInfo = cline.api.getModel()
		// Resolve aliases in includedTools before validation
		// e.g., "edit_file" should resolve to "apply_diff"
		const rawIncludedTools = modelInfo?.info?.includedTools
		const { resolveToolAlias } = await import("../prompts/tools/filter-tools-for-mode")
		const includedTools = rawIncludedTools?.map((tool) => resolveToolAlias(tool))

		try {
			validateToolUse(
				toolBlock.name as ToolName,
				mode ?? defaultModeSlug,
				customModes ?? [],
				{ apply_diff: cline.diffEnabled },
				toolBlock.params,
				stateExperiments,
				includedTools,
			)
		} catch (error) {
			cline.consecutiveMistakeCount++
			// For validation errors (unknown tool, tool not allowed for mode), we need to:
			// 1. Send a tool_result with the error (required for native protocol)
			// 2. NOT set didAlreadyUseTool = true (the tool was never executed, just failed validation)
			// This prevents the stream from being interrupted with "Response interrupted by tool use result"
			// which would cause the extension to appear to hang
			const errorContent = formatResponse.toolError(error.message, toolProtocol)
			if (toolProtocol === TOOL_PROTOCOL.NATIVE && toolCallId) {
				// For native protocol, push tool_result directly without setting didAlreadyUseTool
				cline.userMessageContent.push({
					type: "tool_result",
					tool_use_id: toolCallId,
					content: typeof errorContent === "string" ? errorContent : "(validation error)",
					is_error: true,
				} as Anthropic.ToolResultBlockParam)
			} else {
				// For XML protocol, use the standard pushToolResult
				pushToolResult(errorContent)
			}
			return
		}
	}

	// Check for identical consecutive tool calls.
	if (!toolBlock.partial) {
		// Use the detector to check for repetition, passing the ToolUse
		// block directly.
		const repetitionCheck = cline.toolRepetitionDetector.check(toolBlock)

		// If execution is not allowed, notify user and break.
		if (!repetitionCheck.allowExecution && repetitionCheck.askUser) {
			// Handle repetition similar to mistake_limit_reached pattern.
			const { response, text, images } = await cline.ask(
				repetitionCheck.askUser.messageKey as ClineAsk,
				repetitionCheck.askUser.messageDetail.replace("{toolName}", toolBlock.name),
			)

			if (response === "messageResponse") {
				// Add user feedback to userContent.
				cline.userMessageContent.push(
					{
						type: "text" as const,
						text: `Tool repetition limit reached. User feedback: ${text}`,
					},
					...formatResponse.imageBlocks(images),
				)

				// Add user feedback to chat.
				await cline.say("user_feedback", text, images)

				// Track tool repetition in telemetry.
				TelemetryService.instance.captureConsecutiveMistakeError(cline.taskId)
			}

			// Return tool result message about the repetition
			pushToolResult(
				formatResponse.toolError(
					`Tool call repetition limit reached for ${toolBlock.name}. Please try a different approach.`,
					toolProtocol,
				),
			)
			return
		}
	}

	await checkpointSaveAndMark(cline) // kilocode_change: moved out of switch
	switch (toolBlock.name) {
		case "write_to_file":
			await writeToFileTool.handle(cline, toolBlock as ToolUse<"write_to_file">, commonCallbacks)
			break
		case "update_todo_list":
			await updateTodoListTool.handle(cline, toolBlock as ToolUse<"update_todo_list">, commonCallbacks)
			break
		case "apply_diff": {
			await checkpointSaveAndMark(cline)

			// Check if this tool call came from native protocol by checking for ID
			// Native calls always have IDs, XML calls never do
			if (toolProtocol === TOOL_PROTOCOL.NATIVE) {
				await applyDiffToolClass.handle(cline, toolBlock as ToolUse<"apply_diff">, commonCallbacks)
				break
			}

			// Get the provider and state to check experiment settings
			const provider = cline.providerRef.deref()
			let isMultiFileApplyDiffEnabled = false

			if (provider) {
				const state = await provider.getState()
				isMultiFileApplyDiffEnabled = experiments.isEnabled(
					state.experiments ?? {},
					EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF,
				)
			}

			if (isMultiFileApplyDiffEnabled) {
				await applyDiffTool(cline, toolBlock, askApproval, handleError, pushToolResult, removeClosingTag)
			} else {
				await applyDiffToolClass.handle(cline, toolBlock as ToolUse<"apply_diff">, commonCallbacks)
			}
			break
		}
		case "search_and_replace":
			await checkpointSaveAndMark(cline)
			await searchAndReplaceTool.handle(cline, toolBlock as ToolUse<"search_and_replace">, commonCallbacks)
			break
		case "search_replace":
			await checkpointSaveAndMark(cline)
			await searchReplaceTool.handle(cline, toolBlock as ToolUse<"search_replace">, commonCallbacks)
			break
		case "apply_patch":
			await checkpointSaveAndMark(cline)
			await applyPatchTool.handle(cline, toolBlock as ToolUse<"apply_patch">, commonCallbacks)
			break
		case "edit_file":
			await editFileTool(cline, toolBlock, askApproval, handleError, pushToolResult, removeClosingTag)
			break
		case "delete_file":
			await deleteFileTool(cline, toolBlock, askApproval, handleError, pushToolResult, removeClosingTag)
			break
		case "read_file":
			// Check if this model should use the simplified single-file read tool
			// Only use simplified tool for XML protocol - native protocol works with standard tool
			const modelId = cline.api.getModel().id
			if (shouldUseSingleFileRead(modelId) && toolProtocol !== TOOL_PROTOCOL.NATIVE) {
				await simpleReadFileTool(
					cline,
					toolBlock,
					askApproval,
					handleError,
					pushToolResult,
					removeClosingTag,
					toolProtocol,
				)
			} else {
				await readFileTool.handle(cline, toolBlock as ToolUse<"read_file">, commonCallbacks)
			}
			break
		case "fetch_instructions":
			await fetchInstructionsTool.handle(cline, toolBlock as ToolUse<"fetch_instructions">, commonCallbacks)
			break
		case "list_files":
			await listFilesTool.handle(cline, toolBlock as ToolUse<"list_files">, commonCallbacks)
			break
		case "codebase_search":
			await codebaseSearchTool.handle(cline, toolBlock as ToolUse<"codebase_search">, commonCallbacks)
			break
		case "search_files":
			await searchFilesTool.handle(cline, toolBlock as ToolUse<"search_files">, commonCallbacks)
			break
		// kilocode_change: browser_action removed
		case "execute_command":
			await executeCommandTool.handle(cline, toolBlock as ToolUse<"execute_command">, commonCallbacks)
			break
		case "use_mcp_tool":
			await useMcpToolTool.handle(cline, toolBlock as ToolUse<"use_mcp_tool">, commonCallbacks)
			break
		case "access_mcp_resource":
			await accessMcpResourceTool.handle(cline, toolBlock as ToolUse<"access_mcp_resource">, commonCallbacks)
			break
		case "ask_followup_question":
			await askFollowupQuestionTool.handle(cline, toolBlock as ToolUse<"ask_followup_question">, commonCallbacks)
			break
		case "switch_mode":
			await switchModeTool.handle(cline, toolBlock as ToolUse<"switch_mode">, commonCallbacks)
			break
		case "new_task":
			await newTaskTool.handle(cline, toolBlock as ToolUse<"new_task">, {
				...commonCallbacks,
				toolCallId: toolBlock.id,
			})
			break
		case "attempt_completion": {
			const completionCallbacks: AttemptCompletionCallbacks = {
				askApproval,
				handleError,
				pushToolResult,
				removeClosingTag,
				askFinishSubTaskApproval,
				toolDescription,
				toolProtocol,
			}
			await attemptCompletionTool.handle(
				cline,
				toolBlock as ToolUse<"attempt_completion">,
				completionCallbacks,
			)
			break
		}
		case "new_rule":
			await newRuleTool(cline, toolBlock, askApproval, handleError, pushToolResult, removeClosingTag)
			break
		case "report_bug":
			await reportBugTool(cline, toolBlock, askApproval, handleError, pushToolResult, removeClosingTag)
			break
		case "condense":
			await condenseTool(cline, toolBlock, askApproval, handleError, pushToolResult, removeClosingTag)
			break
		case "run_slash_command":
			await runSlashCommandTool.handle(cline, toolBlock as ToolUse<"run_slash_command">, commonCallbacks)
			break
		// kilocode_change start
		case "activate_sandbox_package":
			await activateSandboxPackageTool.handle(cline, toolBlock as ToolUse<"activate_sandbox_package">, commonCallbacks)
			break
		// kilocode_change end
		case "generate_image":
			await checkpointSaveAndMark(cline)
			await generateImageTool.handle(cline, toolBlock as ToolUse<"generate_image">, commonCallbacks)
			break
		default: {
			// Handle unknown/invalid tool names
			// This is critical for native protocol where every tool_use MUST have a tool_result
			// Note: This case should rarely be reached since validateToolUse now checks for unknown tools

			// CRITICAL: Don't process partial blocks for unknown tools - just let them stream in.
			// If we try to show errors for partial blocks, we'd show the error on every streaming chunk,
			// creating a loop that appears to freeze the extension. Only handle complete blocks.
			if (toolBlock.partial) {
				break
			}

			const errorMessage = `Unknown tool "${toolBlock.name}". This tool does not exist. Please use one of the available tools.`
			cline.consecutiveMistakeCount++
			cline.recordToolError(toolBlock.name as ToolName, errorMessage)
			await cline.say("error", t("tools:unknownToolError", { toolName: toolBlock.name }))
			// Push tool_result directly for native protocol WITHOUT setting didAlreadyUseTool
			// This prevents the stream from being interrupted with "Response interrupted by tool use result"
			if (toolProtocol === TOOL_PROTOCOL.NATIVE && toolCallId) {
				cline.userMessageContent.push({
					type: "tool_result",
					tool_use_id: toolCallId,
					content: formatResponse.toolError(errorMessage, toolProtocol),
					is_error: true,
				} as Anthropic.ToolResultBlockParam)
			} else {
				pushToolResult(formatResponse.toolError(errorMessage, toolProtocol))
			}
			break
		}
	}

}
// kilocode_change end

/**
 * Processes and presents assistant message content to the user interface.
 *
 * This function is the core message handling system that:
 * - Sequentially processes content blocks from the assistant's response.
 * - Displays text content to the user.
 * - Executes tool use requests with appropriate user approval.
 * - Manages the flow of conversation by determining when to proceed to the next content block.
 * - Coordinates file system checkpointing for modified files.
 * - Controls the conversation state to determine when to continue to the next request.
 *
 * The function uses a locking mechanism to prevent concurrent execution and handles
 * partial content blocks during streaming. It's designed to work with the streaming
 * API response pattern, where content arrives incrementally and needs to be processed
 * as it becomes available.
 */

export async function presentAssistantMessage(cline: Task) {
	if (cline.abort) {
		throw new Error(`[Task#presentAssistantMessage] task ${cline.taskId}.${cline.instanceId} aborted`)
	}

	if (cline.presentAssistantMessageLocked) {
		cline.presentAssistantMessageHasPendingUpdates = true
		return
	}

	cline.presentAssistantMessageLocked = true
	cline.presentAssistantMessageHasPendingUpdates = false

	if (cline.currentStreamingContentIndex >= cline.assistantMessageContent.length) {
		// This may happen if the last content block was completed before
		// streaming could finish. If streaming is finished, and we're out of
		// bounds then this means we already  presented/executed the last
		// content block and are ready to continue to next request.
		if (cline.didCompleteReadingStream) {
			cline.userMessageContentReady = true
		}

		cline.presentAssistantMessageLocked = false
		return
	}

	let block: any
	try {
		block = cloneDeep(cline.assistantMessageContent[cline.currentStreamingContentIndex]) // need to create copy bc while stream is updating the array, it could be updating the reference block properties too
	} catch (error) {
		console.error(`ERROR cloning block:`, error)
		console.error(
			`Block content:`,
			JSON.stringify(cline.assistantMessageContent[cline.currentStreamingContentIndex], null, 2),
		)
		cline.presentAssistantMessageLocked = false
		return
	}

	switch (block.type) {
		case "pkg_tool_use": {
			await handlePkgToolUse(cline, block as ExampleToolUse)
			break
		}
		case "mcp_tool_use": {
			// Handle native MCP tool calls (from mcp_serverName_toolName dynamic tools)
			// These are converted to the same execution path as use_mcp_tool but preserve
			// their original name in API history
			await handleMcpToolUse(cline, block as McpToolUse)
			break
		}
		case "text": {
			if (cline.didRejectTool || cline.didAlreadyUseTool) {
				break
			}

			let content = block.content

			if (content) {
				// Have to do this for partial and complete since sending
				// content in thinking tags to markdown renderer will
				// automatically be removed.
				// Remove end substrings of <thinking or </thinking (below xml
				// parsing is only for opening tags).
				// Tthis is done with the xml parsing below now, but keeping
				// here for reference.
				// content = content.replace(/<\/?t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?$/, "")
				//
				// Remove all instances of <thinking> (with optional line break
				// after) and </thinking> (with optional line break before).
				// - Needs to be separate since we dont want to remove the line
				//   break before the first tag.
				// - Needs to happen before the xml parsing below.
				content = content.replace(/<thinking>\s?/g, "")
				content = content.replace(/\s?<\/thinking>/g, "")

				// Remove partial XML tag at the very end of the content (for
				// tool use and thinking tags), Prevents scrollview from
				// jumping when tags are automatically removed.
				const lastOpenBracketIndex = content.lastIndexOf("<")

				if (lastOpenBracketIndex !== -1) {
					const possibleTag = content.slice(lastOpenBracketIndex)

					// Check if there's a '>' after the last '<' (i.e., if the
					// tag is complete) (complete thinking and tool tags will
					// have been removed by now.)
					const hasCloseBracket = possibleTag.includes(">")

					if (!hasCloseBracket) {
						// Extract the potential tag name.
						let tagContent: string

						if (possibleTag.startsWith("</")) {
							tagContent = possibleTag.slice(2).trim()
						} else {
							tagContent = possibleTag.slice(1).trim()
						}

						const isLikelyTagName = /^[a-zA-Z_]+$/.test(tagContent)
						const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</"

						if (isOpeningOrClosing || isLikelyTagName) {
							content = content.slice(0, lastOpenBracketIndex).trim()
						}
					}
				}
			}

			await cline.say("text", content, undefined, block.partial)
			if (!block.partial && content) {
				const imageUris = extractImageUrisFromText(content)
				for (const imageUri of imageUris) {
					await cline.say("image", JSON.stringify({ imageUri }))
				}
			}
			break
		}
		case "tool_use": {
			// kilocode_change start
			if (await canRunToolUseConcurrently(cline, block as ToolUse)) {
				const concurrentBlock = block as ToolUse
				trackConcurrentToolCall(cline, async () => {
					await handleToolUse(cline, concurrentBlock)
				})
			} else {
				await handleToolUse(cline, block as ToolUse)
			}
			// kilocode_change end
			break
		}
	}

	// Seeing out of bounds is fine, it means that the next too call is being
	// built up and ready to add to assistantMessageContent to present.
	// When you see the UI inactive during this, it means that a tool is
	// breaking without presenting any UI. For example the write_to_file tool
	// was breaking when relpath was undefined, and for invalid relpath it never
	// presented UI.
	// This needs to be placed here, if not then calling
	// cline.presentAssistantMessage below would fail (sometimes) since it's
	// locked.
	cline.presentAssistantMessageLocked = false

	// NOTE: When tool is rejected, iterator stream is interrupted and it waits
	// for `userMessageContentReady` to be true. Future calls to present will
	// skip execution since `didRejectTool` and iterate until `contentIndex` is
	// set to message length and it sets userMessageContentReady to true itself
	// (instead of preemptively doing it in iterator).
	if (!block.partial || cline.didRejectTool || cline.didAlreadyUseTool) {
		// Block is finished streaming and executing.
		if (cline.currentStreamingContentIndex === cline.assistantMessageContent.length - 1) {
			// It's okay that we increment if !didCompleteReadingStream, it'll
			// just return because out of bounds and as streaming continues it
			// will call `presentAssitantMessage` if a new block is ready. If
			// streaming is finished then we set `userMessageContentReady` to
			// true when out of bounds. This gracefully allows the stream to
			// continue on and all potential content blocks be presented.
			// Last block is complete and it is finished executing
			// kilocode_change start
			if (!hasPendingConcurrentToolCalls(cline)) {
				cline.userMessageContentReady = true // Will allow `pWaitFor` to continue.
			}
			// kilocode_change end
		}

		// Call next block if it exists (if not then read stream will call it
		// when it's ready).
		// Need to increment regardless, so when read stream calls this function
		// again it will be streaming the next block.
		cline.currentStreamingContentIndex++

		if (cline.currentStreamingContentIndex < cline.assistantMessageContent.length) {
			// There are already more content blocks to stream, so we'll call
			// this function ourselves.
			// kilocode_change start: prevent excessive recursion
			await yieldPromise()
			await presentAssistantMessage(cline)
			// kilocode_change end
			return
		} else {
			// CRITICAL FIX: If we're out of bounds and the stream is complete, set userMessageContentReady
			// This handles the case where assistantMessageContent is empty or becomes empty after processing
			// kilocode_change start
			if (cline.didCompleteReadingStream && !hasPendingConcurrentToolCalls(cline)) {
				cline.userMessageContentReady = true
			}
			// kilocode_change end
		}
	}

	// Block is partial, but the read stream may have finished.
	if (cline.presentAssistantMessageHasPendingUpdates) {
		// kilocode_change start: prevent excessive recursion
		await yieldPromise()
		await presentAssistantMessage(cline)
		// kilocode_change end
	}
}

/**
 * save checkpoint and mark done in the current streaming task.
 * @param task The Task instance to checkpoint save and mark.
 * @returns
 */
async function checkpointSaveAndMark(task: Task) {
	if (task.currentStreamingDidCheckpoint) {
		return
	}
	try {
		// kilocode_change: order changed to prevent second execution while still awaiting the save
		task.currentStreamingDidCheckpoint = true
		await task.checkpointSave(true)
	} catch (error) {
		console.error(`[Task#presentAssistantMessage] Error saving checkpoint: ${error.message}`, error)
	}
}
