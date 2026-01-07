import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSize } from "react-use"
import { useTranslation, Trans } from "react-i18next"
import deepEqual from "fast-deep-equal"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"

import type { ClineMessage, ClineSay, FollowUpData, SuggestionItem } from "@roo-code/types"
import { Mode } from "@roo/modes"

import { ClineApiReqInfo, ClineAskUseMcpServer, ClineSayTool } from "@roo/ExtensionMessage"
import { COMMAND_OUTPUT_STRING } from "@roo/combineCommandSequences"
import { safeJsonParse } from "@roo/safeJsonParse"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { findMatchingResourceOrTemplate } from "@src/utils/mcp"
import { vscode } from "@src/utils/vscode"
import { formatPathTooltip } from "@src/utils/formatPathTooltip"

import { ToolUseBlock, ToolUseBlockHeader } from "../common/ToolUseBlock"
import UpdateTodoListToolBlock from "./UpdateTodoListToolBlock"
import { TodoChangeDisplay } from "./TodoChangeDisplay"
import CodeAccordian from "../common/CodeAccordian"
import MarkdownBlock from "../common/MarkdownBlock"
import { ReasoningBlock } from "./ReasoningBlock"
import Thumbnails from "../common/Thumbnails"
import ImageBlock from "../common/ImageBlock"
import ErrorRow from "./ErrorRow"

import McpResourceRow from "../mcp/McpResourceRow"

import { Mention } from "./Mention"
import { FollowUpSuggest } from "./FollowUpSuggest"
import { BatchFilePermission } from "./BatchFilePermission"
import { BatchDiffApproval } from "./BatchDiffApproval"
import { ProgressIndicator } from "./ProgressIndicator"
import { Markdown } from "./Markdown"
import { CommandExecution } from "./CommandExecution"
import { CommandExecutionError } from "./CommandExecutionError"
import ReportBugPreview from "./ReportBugPreview"

import { AutoApprovedRequestLimitWarning } from "./AutoApprovedRequestLimitWarning"
import { InProgressRow, CondensationResultRow, CondensationErrorRow, TruncationResultRow } from "./context-management"
import CodebaseSearchResultsDisplay from "./CodebaseSearchResultsDisplay"
import { appendImages } from "@src/utils/imageUtils"
import { McpExecution } from "./McpExecution"
import { ChatTextArea } from "./ChatTextArea"
import { MAX_IMAGES_PER_MESSAGE } from "./ChatView"
import { useSelectedModel } from "../ui/hooks/useSelectedModel"
import {
	Eye,
	FileDiff,
	ListTree,
	User,
	Edit,
	Trash2,
	MessageCircleQuestionMark,
	SquareArrowOutUpRight,
	FileCode2,
	PocketKnife,
	FolderTree,
	TerminalSquare,
	MessageCircle,
	Repeat2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SeeNewChangesButtons } from "./kilocode/SeeNewChangesButtons"
import { PathTooltip } from "../ui/PathTooltip"

// kilocode_change start
import { LowCreditWarning } from "../kilocode/chat/LowCreditWarning"
import { NewTaskPreview } from "../kilocode/chat/NewTaskPreview"
import { KiloChatRowGutterBar } from "../kilocode/chat/KiloChatRowGutterBar"
import { StandardTooltip } from "../ui"
import { FastApplyChatDisplay } from "./kilocode/FastApplyChatDisplay"
import { InvalidModelWarning } from "../kilocode/chat/InvalidModelWarning"
import { formatFileSize } from "@/lib/formatting-utils"
import ChatTimestamps from "./ChatTimestamps"
import { removeLeadingNonAlphanumeric } from "@/utils/removeLeadingNonAlphanumeric"
import { KILOCODE_TOKEN_REQUIRED_ERROR } from "@roo/kilocode/errorUtils"
// kilocode_change end

// Helper function to get previous todos before a specific message
function getPreviousTodos(messages: ClineMessage[], currentMessageTs: number): any[] {
	// Find the previous updateTodoList message before the current one
	const previousUpdateIndex = messages
		.slice()
		.reverse()
		.findIndex((msg) => {
			if (msg.ts >= currentMessageTs) return false
			if (msg.type === "ask" && msg.ask === "tool") {
				try {
					const tool = JSON.parse(msg.text || "{}")
					return tool.tool === "updateTodoList"
				} catch {
					return false
				}
			}
			return false
		})

	if (previousUpdateIndex !== -1) {
		const previousMessage = messages.slice().reverse()[previousUpdateIndex]
		try {
			const tool = JSON.parse(previousMessage.text || "{}")
			return tool.todos || []
		} catch {
			return []
		}
	}

	// If no previous updateTodoList message, return empty array
	return []
}

interface ChatRowProps {
	message: ClineMessage
	lastModifiedMessage?: ClineMessage
	isExpanded: boolean
	isLast: boolean
	isStreaming: boolean
	onToggleExpand: (ts: number) => void
	onHeightChange: (isTaller: boolean) => void
	onSuggestionClick?: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
	highlighted?: boolean // kilocode_change: Add highlighted prop
	enableCheckpoints?: boolean // kilocode_change
	onFollowUpUnmount?: () => void
	isFollowUpAnswered?: boolean
	isFollowUpAutoApprovalPaused?: boolean
	editable?: boolean
	hasCheckpoint?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ChatRowContentProps extends Omit<ChatRowProps, "onHeightChange"> {}

const ChatRow = memo(
	(props: ChatRowProps) => {
		const { highlighted } = props // kilocode_change: Add highlighted prop
		const { showTaskTimeline } = useExtensionState() // kilocode_change: Used by KiloChatRowGutterBar
		const { isLast, onHeightChange, message } = props
		// Store the previous height to compare with the current height
		// This allows us to detect changes without causing re-renders
		const prevHeightRef = useRef(0)

		const [chatrow, { height }] = useSize(
			<div
				// kilocode_change: add highlighted className
				className={cn(
					`px-[15px] py-[4px] pr-[6px] relative ${highlighted ? "animate-message-highlight" : ""}`,
				)}>
				{showTaskTimeline && <KiloChatRowGutterBar message={message} />}
				<ChatRowContent {...props} />
			</div>,
		)

		useEffect(() => {
			// used for partials, command output, etc.
			// NOTE: it's important we don't distinguish between partial or complete here since our scroll effects in chatview need to handle height change during partial -> complete
			const isInitialRender = prevHeightRef.current === 0 // prevents scrolling when new element is added since we already scroll for that
			// height starts off at Infinity
			if (isLast && height !== 0 && height !== Infinity && height !== prevHeightRef.current) {
				if (!isInitialRender) {
					onHeightChange(height > prevHeightRef.current)
				}
				prevHeightRef.current = height
			}
		}, [height, isLast, onHeightChange, message])

		// we cannot return null as virtuoso does not support it, so we use a separate visibleMessages array to filter out messages that should not be rendered
		return chatrow
	},
	// memo does shallow comparison of props, so we need to do deep comparison of arrays/objects whose properties might change
	deepEqual,
)

export default ChatRow

export const ChatRowContent = ({
	message,
	lastModifiedMessage,
	isExpanded,
	isLast,
	isStreaming,
	onToggleExpand,
	onSuggestionClick,
	onFollowUpUnmount,
	onBatchFileResponse,
	enableCheckpoints, // kilocode_change
	isFollowUpAnswered,
	isFollowUpAutoApprovalPaused,
}: ChatRowContentProps) => {
	const { t, i18n } = useTranslation()

	// kilocode_change: add showTimestamps
	const { mcpServers, alwaysAllowMcp, currentCheckpoint, mode, apiConfiguration, clineMessages, showTimestamps } =
		useExtensionState()

	const { info: model } = useSelectedModel(apiConfiguration)
	const [isEditing, setIsEditing] = useState(false)
	const [editedContent, setEditedContent] = useState("")
	const [editMode, setEditMode] = useState<Mode>(mode || "code")
	const [editImages, setEditImages] = useState<string[]>([])

	// Handle message events for image selection during edit mode
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = event.data
			if (msg.type === "selectedImages" && msg.context === "edit" && msg.messageTs === message.ts && isEditing) {
				setEditImages((prevImages) => appendImages(prevImages, msg.images, MAX_IMAGES_PER_MESSAGE))
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [isEditing, message.ts])

	// Memoized callback to prevent re-renders caused by inline arrow functions.
	const handleToggleExpand = useCallback(() => {
		onToggleExpand(message.ts)
	}, [onToggleExpand, message.ts])

	// Handle edit button click
	const handleEditClick = useCallback(() => {
		setIsEditing(true)
		setEditedContent(message.text || "")
		setEditImages(message.images || [])
		setEditMode(mode || "code")
		// Edit mode is now handled entirely in the frontend
		// No need to notify the backend
	}, [message.text, message.images, mode])

	// Handle cancel edit
	const handleCancelEdit = useCallback(() => {
		setIsEditing(false)
		setEditedContent(message.text || "")
		setEditImages(message.images || [])
		setEditMode(mode || "code")
	}, [message.text, message.images, mode])

	// Handle save edit
	const handleSaveEdit = useCallback(() => {
		setIsEditing(false)
		// Send edited message to backend
		vscode.postMessage({
			type: "submitEditedMessage",
			value: message.ts,
			editedMessageContent: editedContent,
			images: editImages,
		})
	}, [message.ts, editedContent, editImages])

	// Handle image selection for editing
	const handleSelectImages = useCallback(() => {
		vscode.postMessage({ type: "selectImages", context: "edit", messageTs: message.ts })
	}, [message.ts])

	// kilocode_change: usageMissing, inferenceProvider
	const [cost, usageMissing, inferenceProvider, apiReqCancelReason, apiReqStreamingFailedMessage] = useMemo(() => {
		if (message.text !== null && message.text !== undefined && message.say === "api_req_started") {
			const info = safeJsonParse<ClineApiReqInfo>(message.text)
			return [
				info?.cost,
				info?.usageMissing,
				info?.inferenceProvider,
				info?.cancelReason,
				info?.streamingFailedMessage,
			]
		}

		return [undefined, undefined, undefined]
	}, [message.text, message.say])

	// kilocode_change start: hide cost display check
	const { hideCostBelowThreshold } = useExtensionState()
	const shouldShowCost = useMemo(() => {
		if (cost === undefined || cost === null || cost <= 0) return false
		if (isExpanded) return true
		const threshold = hideCostBelowThreshold ?? 0
		return cost >= threshold
	}, [cost, isExpanded, hideCostBelowThreshold])
	// kilocode_change end: hide cost display check

	// When resuming task, last wont be api_req_failed but a resume_task
	// message, so api_req_started will show loading spinner. That's why we just
	// remove the last api_req_started that failed without streaming anything.
	const apiRequestFailedMessage =
		isLast && lastModifiedMessage?.ask === "api_req_failed" // if request is retried then the latest message is a api_req_retried
			? lastModifiedMessage?.text
			: undefined

	const isCommandExecuting =
		isLast && lastModifiedMessage?.ask === "command" && lastModifiedMessage?.text?.includes(COMMAND_OUTPUT_STRING)

	const isMcpServerResponding = isLast && lastModifiedMessage?.say === "mcp_server_request_started"

	const type = message.type === "ask" ? message.ask : message.say

	const normalColor = "var(--vscode-foreground)"
	const errorColor = "var(--vscode-errorForeground)"
	const successColor = "var(--vscode-charts-green)"
	const cancelledColor = "var(--vscode-descriptionForeground)"

	const [icon, title] = useMemo(() => {
		switch (type) {
			case "error":
			case "mistake_limit_reached":
				return [null, null] // These will be handled by ErrorRow component
			case "command":
				return [
					isCommandExecuting ? (
						<ProgressIndicator />
					) : (
						<TerminalSquare className="size-4" aria-label="Terminal icon" />
					),
					<span style={{ color: normalColor, fontWeight: "bold" }}>
						{t("chat:commandExecution.running")}
					</span>,
				]
			case "use_mcp_server":
				const mcpServerUse = safeJsonParse<ClineAskUseMcpServer>(message.text)
				if (mcpServerUse === undefined) {
					return [null, null]
				}
				return [
					isMcpServerResponding ? (
						<ProgressIndicator />
					) : (
						<span
							className="codicon codicon-server"
							style={{ color: normalColor, marginBottom: "-1.5px" }}></span>
					),
					<span style={{ color: normalColor, fontWeight: "bold" }}>
						{mcpServerUse.type === "use_mcp_tool"
							? t("chat:mcp.wantsToUseTool", { serverName: mcpServerUse.serverName })
							: t("chat:mcp.wantsToAccessResource", { serverName: mcpServerUse.serverName })}
					</span>,
				]
			case "completion_result":
				return [
					<span
						className="codicon codicon-check"
						style={{ color: successColor, marginBottom: "-1.5px" }}></span>,
					<span style={{ color: successColor, fontWeight: "bold" }}>{t("chat:taskCompleted")}</span>,
				]
			case "api_req_retry_delayed":
				return []
			case "api_req_started":
				const getIconSpan = (iconName: string, color: string) => (
					<div
						style={{
							width: 16,
							height: 16,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}>
						<span
							className={`codicon codicon-${iconName}`}
							style={{ color, fontSize: 16, marginBottom: "-1.5px" }}
						/>
					</div>
				)
				return [
					apiReqCancelReason !== null && apiReqCancelReason !== undefined ? (
						apiReqCancelReason === "user_cancelled" ? (
							getIconSpan("error", cancelledColor)
						) : (
							getIconSpan("error", errorColor)
						)
					) : cost !== null && cost !== undefined ? (
						getIconSpan("arrow-swap", normalColor)
					) : apiRequestFailedMessage ? (
						getIconSpan("error", errorColor)
					) : (
						<ProgressIndicator />
					),
					apiReqCancelReason !== null && apiReqCancelReason !== undefined ? (
						apiReqCancelReason === "user_cancelled" ? (
							<span style={{ color: normalColor, fontWeight: "bold" }}>
								{t("chat:apiRequest.cancelled")}
							</span>
						) : (
							<span style={{ color: errorColor, fontWeight: "bold" }}>
								{t("chat:apiRequest.streamingFailed")}
							</span>
						)
					) : cost !== null && cost !== undefined ? (
						// kilocode_change start: tooltip
						<StandardTooltip content={inferenceProvider && `Inference Provider: ${inferenceProvider}`}>
							<span style={{ color: normalColor }}>{t("chat:apiRequest.title")}</span>
						</StandardTooltip>
					) : // kilocode_change end
					apiRequestFailedMessage ? (
						<span style={{ color: errorColor }}>{t("chat:apiRequest.failed")}</span>
					) : (
						<span style={{ color: normalColor }}>{t("chat:apiRequest.streaming")}</span>
					),
				]
			case "followup":
				return [
					<MessageCircleQuestionMark className="w-4 shrink-0" aria-label="Question icon" />,
					<span style={{ color: normalColor, fontWeight: "bold" }}>{t("chat:questions.hasQuestion")}</span>,
				]
			default:
				return [null, null]
		}
	}, [
		type,
		isCommandExecuting,
		message,
		isMcpServerResponding,
		apiReqCancelReason,
		cost,
		apiRequestFailedMessage,
		t,
		inferenceProvider, // kilocode_change
	])

	const headerStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		marginBottom: "10px",
		wordBreak: "break-word",
	}

	const tool = useMemo(
		() => (message.ask === "tool" ? safeJsonParse<ClineSayTool>(message.text) : null),
		[message.ask, message.text],
	)

	// Unified diff content (provided by backend when relevant)
	const unifiedDiff = useMemo(() => {
		if (!tool) return undefined
		return (tool.content ?? tool.diff) as string | undefined
	}, [tool])

	const followUpData = useMemo(() => {
		if (message.type === "ask" && message.ask === "followup" && !message.partial) {
			return safeJsonParse<FollowUpData>(message.text)
		}
		return null
	}, [message.type, message.ask, message.partial, message.text])

	// kilocode_change: find previous checkpoint for restore functionality
	const previousCheckpoint = useMemo(() => {
		// Find the most recent checkpoint_saved message before this message
		const messagesBefore = clineMessages.filter((msg) => msg.ts < message.ts)
		const checkpointMsg = messagesBefore.findLast((msg) => msg.say === "checkpoint_saved")
		if (checkpointMsg) {
			return {
				ts: checkpointMsg.ts!,
				commitHash: checkpointMsg.text!,
			}
		}
		return null
	}, [clineMessages, message.ts])

	if (tool) {
		const toolIcon = (name: string) => (
			<span
				className={`codicon codicon-${name}`}
				style={{ color: "var(--vscode-foreground)", marginBottom: "-1.5px" }}></span>
		)

		switch (tool.tool as string) {
			case "editedExistingFile":
			case "appliedDiff":
				// Check if this is a batch diff request
				if (message.type === "ask" && tool.batchDiffs && Array.isArray(tool.batchDiffs)) {
					return (
						<>
							<BatchDiffApproval files={tool.batchDiffs} ts={message.ts} />
						</>
					)
				}

				// Regular single file diff
				return (
					<>
						<div className="pl-0">
							<CodeAccordian
								path={tool.path}
								code={unifiedDiff ?? tool.content ?? tool.diff}
								language="diff"
								progressStatus={message.progressStatus}
								isLoading={message.partial}
								isExpanded={isExpanded}
								onToggleExpand={handleToggleExpand}
								diffStats={tool.diffStats}
								checkpointTs={previousCheckpoint?.ts}
								commitHash={previousCheckpoint?.commitHash}
								header={t("chat:fileOperations.wantsToEdit") + " " + tool.path}
							/>
							{
								// kilocode_change start
								tool.fastApplyResult && <FastApplyChatDisplay fastApplyResult={tool.fastApplyResult} />
								// kilocode_change end
							}
						</div>
					</>
				)
			case "insertContent":
				return (
					<>
						<div className="pl-0">
							<CodeAccordian
								path={tool.path}
								code={unifiedDiff ?? tool.diff}
								language="diff"
								progressStatus={message.progressStatus}
								isLoading={message.partial}
								isExpanded={isExpanded}
								onToggleExpand={handleToggleExpand}
								diffStats={tool.diffStats}
								checkpointTs={previousCheckpoint?.ts}
								commitHash={previousCheckpoint?.commitHash}
								header={t("chat:fileOperations.wantsToEdit") + " " + tool.path}
							/>
						</div>
					</>
				)
			case "searchAndReplace":
				return (
					<>
						<div className="pl-0">
							<CodeAccordian
								path={tool.path}
								code={unifiedDiff ?? tool.diff}
								language="diff"
								progressStatus={message.progressStatus}
								isLoading={message.partial}
								isExpanded={isExpanded}
								onToggleExpand={handleToggleExpand}
								diffStats={tool.diffStats}
								checkpointTs={previousCheckpoint?.ts}
								commitHash={previousCheckpoint?.commitHash}
								header={t("chat:fileOperations.wantsToEdit") + " " + tool.path}
							/>
						</div>
					</>
				)
			case "codebaseSearch": {
				return null
			}
			case "updateTodoList" as any: {
				const todos = (tool as any).todos || []
				// Get previous todos from the latest todos in the task context
				const previousTodos = getPreviousTodos(clineMessages, message.ts)

				return <TodoChangeDisplay previousTodos={previousTodos} newTodos={todos} />
			}
			case "newFileCreated":
				return (
					<>
						<div className="pl-0">
							<CodeAccordian
								path={tool.path}
								code={unifiedDiff ?? ""}
								language="diff"
								isLoading={message.partial}
								isExpanded={isExpanded}
								onToggleExpand={handleToggleExpand}
								onJumpToFile={() => vscode.postMessage({ type: "openFile", text: "./" + tool.path })}
								diffStats={tool.diffStats}
								checkpointTs={previousCheckpoint?.ts}
								commitHash={previousCheckpoint?.commitHash}
								header={t("chat:fileOperations.wantsToCreate") + " " + tool.path}
							/>
							{
								// kilocode_change start
								tool.fastApplyResult && <FastApplyChatDisplay fastApplyResult={tool.fastApplyResult} />
								// kilocode_change end
							}
						</div>
					</>
				)
			// kilocode_change start
			case "deleteFile":
				return (
					<div className="pl-0">
						<ToolUseBlock>
							<ToolUseBlockHeader className="group">
								<Trash2 className="w-4 shrink-0" aria-label="Delete icon" style={{ marginRight: "8px" }} />
								<span style={{ fontWeight: "bold", flexGrow: 1 }}>
									{tool.stats
										? t("chat:fileOperations.wantsToDeleteDirectory")
										: t("chat:fileOperations.wantsToDelete")}
								</span>
								{tool.path && (
									<span className="whitespace-nowrap overflow-hidden text-ellipsis text-left mr-2 rtl">
										{removeLeadingNonAlphanumeric(tool.path ?? "") + "\u200E"}
									</span>
								)}
							</ToolUseBlockHeader>
							{tool.stats && tool.stats.isComplete === true && (
								<div
									className="py-1.5 text-xs text-vscode-descriptionForeground"
									style={{
										borderTop: "1px solid var(--vscode-editorGroup-border)",
									}}>
									<div className="flex items-center gap-3 flex-wrap">
										<span className="flex items-center gap-1">
											<span>📁</span>
											<span>{tool.stats.directories}</span>
										</span>
										<span className="flex items-center gap-1">
											<span>📄</span>
											<span>{tool.stats.files}</span>
										</span>
										<span className="flex items-center gap-1">
											<span>💾</span>
											<span>{formatFileSize(tool.stats.size)}</span>
										</span>
									</div>
								</div>
							)}
						</ToolUseBlock>
					</div>
				)
			// kilocode_change end
			case "readFile":
				// Check if this is a batch file permission request
				const isBatchRequest = message.type === "ask" && tool.batchFiles && Array.isArray(tool.batchFiles)

				if (isBatchRequest) {
					return (
						<BatchFilePermission
							files={tool.batchFiles || []}
							onPermissionResponse={(response) => {
								onBatchFileResponse?.(response)
							}}
							ts={message?.ts}
						/>
					)
				}

				// Regular single file read request
				return (
					<div className="pl-0">
						<ToolUseBlock>
							<ToolUseBlockHeader
								className="group"
								onClick={() => vscode.postMessage({ type: "openFile", text: tool.content })}>
								<FileCode2 className="w-4 shrink-0" aria-label="Read file icon" style={{ marginRight: "8px" }} />
								<span style={{ fontWeight: "bold", flexGrow: 1 }}>
									{message.type === "ask"
										? tool.isOutsideWorkspace
											? t("chat:fileOperations.wantsToReadOutsideWorkspace")
											: tool.additionalFileCount && tool.additionalFileCount > 0
												? t("chat:fileOperations.wantsToReadAndXMore", {
														count: tool.additionalFileCount,
													})
												: t("chat:fileOperations.wantsToRead")
										: t("chat:fileOperations.didRead")}
								</span>
								<PathTooltip content={formatPathTooltip(tool.path, tool.reason)}>
									<span className="whitespace-nowrap overflow-hidden text-ellipsis text-left mr-2 rtl">
										{formatPathTooltip(tool.path, tool.reason)}
									</span>
								</PathTooltip>
								<SquareArrowOutUpRight
									className="w-4 shrink-0 codicon codicon-link-external opacity-0 group-hover:opacity-100 transition-opacity"
									style={{ fontSize: 13.5, margin: "1px 0" }}
								/>
							</ToolUseBlockHeader>
						</ToolUseBlock>
					</div>
				)
			case "fetchInstructions":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("file-code")}
							<span style={{ fontWeight: "bold" }}>{t("chat:instructions.wantsToFetch")}</span>
						</div>
						<div className="pl-0">
							<CodeAccordian
								code={tool.content}
								language="markdown"
								isLoading={message.partial}
								isExpanded={isExpanded}
								onToggleExpand={handleToggleExpand}
							/>
						</div>
					</>
				)
			case "listFilesTopLevel":
				return (
					<>
						<div className="pl-0">
							<CodeAccordian
								path={tool.path}
								code={tool.content}
								language="shell-session"
								isExpanded={isExpanded}
								onToggleExpand={handleToggleExpand}
								header={tool.path ? t("chat:fileOperations.listFiles") + " " + tool.path : t("chat:fileOperations.listFiles")}
							/>
						</div>
					</>
				)
			case "listFilesRecursive":
				return (
					<>
						<div className="pl-0">
							<CodeAccordian
								path={tool.path}
								code={tool.content}
								language="shellsession"
								isExpanded={isExpanded}
								onToggleExpand={handleToggleExpand}
								header={tool.path ? t("chat:fileOperations.listFiles") + " " + tool.path : t("chat:fileOperations.listFiles")}
							/>
						</div>
					</>
				)
			case "searchFiles":
				return (
					<>
						<div className="pl-0">
							<CodeAccordian
								path={tool.path! + (tool.filePattern ? `/(${tool.filePattern})` : "")}
								code={tool.content}
								language="shellsession"
								isExpanded={isExpanded}
								onToggleExpand={handleToggleExpand}
								header={t("chat:fileOperations.searchFiles") + (tool.regex ? `: "${tool.regex}"` : "") + (tool.path ? ` in "${tool.path}"` : "")}
							/>
						</div>
					</>
				)
			case "switchMode":
				return null
			case "newTask":
				return (
					<>
						<div
							style={{
								marginTop: "4px",
								backgroundColor: "var(--vscode-badge-background)",
								border: "1px solid var(--vscode-badge-background)",
								borderRadius: "4px 4px 0 0",
								overflow: "hidden",
								marginBottom: "2px",
							}}>
							<div
								style={{
									padding: "9px 10px 9px 14px",
									backgroundColor: "var(--vscode-badge-background)",
									borderBottom: "1px solid var(--vscode-editorGroup-border)",
									fontWeight: "bold",
									fontSize: "var(--vscode-font-size)",
									color: "var(--vscode-badge-foreground)",
									display: "flex",
									alignItems: "center",
									gap: "6px",
								}}>
								<span className="codicon codicon-arrow-right"></span>
								{t("chat:subtasks.newTaskContent")}
							</div>
							<div style={{ padding: "12px 16px", backgroundColor: "var(--vscode-editor-background)" }}>
								<MarkdownBlock markdown={tool.content} />
							</div>
						</div>
					</>
				)
			case "finishTask":
				return (
					<>
						<div
							style={{
								marginTop: "4px",
								backgroundColor: "var(--vscode-editor-background)",
								border: "1px solid var(--vscode-badge-background)",
								borderRadius: "4px",
								overflow: "hidden",
								marginBottom: "8px",
							}}>
							<div
								style={{
									padding: "9px 10px 9px 14px",
									backgroundColor: "var(--vscode-badge-background)",
									borderBottom: "1px solid var(--vscode-editorGroup-border)",
									fontWeight: "bold",
									fontSize: "var(--vscode-font-size)",
									color: "var(--vscode-badge-foreground)",
									display: "flex",
									alignItems: "center",
									gap: "6px",
								}}>
								<span className="codicon codicon-check"></span>
								{t("chat:subtasks.completionContent")}
							</div>
							<div style={{ padding: "12px 16px", backgroundColor: "var(--vscode-editor-background)" }}>
								<MarkdownBlock markdown={t("chat:subtasks.completionInstructions")} />
							</div>
						</div>
					</>
				)
			case "runSlashCommand": {
				const slashCommandInfo = tool
				return (
					<>
						<div
							style={{
								marginTop: "4px",
								backgroundColor: "var(--vscode-editor-background)",
								border: "1px solid var(--vscode-editorGroup-border)",
								borderRadius: "4px",
								overflow: "hidden",
								cursor: "pointer",
							}}
							onClick={handleToggleExpand}>
							<ToolUseBlockHeader
								className="group"
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "10px 12px",
								}}>
								<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
									<span style={{ fontWeight: "500", fontSize: "var(--vscode-font-size)" }}>
										/{slashCommandInfo.command}
									</span>
									{slashCommandInfo.source && (
										<VSCodeBadge style={{ fontSize: "calc(var(--vscode-font-size) - 2px)" }}>
											{slashCommandInfo.source}
										</VSCodeBadge>
									)}
								</div>
								<span
									className={`codicon codicon-chevron-${isExpanded ? "up" : "down"} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}></span>
							</ToolUseBlockHeader>
							{isExpanded && (slashCommandInfo.args || slashCommandInfo.description) && (
								<div
									style={{
										padding: "12px 16px",
										borderTop: "1px solid var(--vscode-editorGroup-border)",
										display: "flex",
										flexDirection: "column",
										gap: "8px",
									}}>
									{slashCommandInfo.args && (
										<div>
											<span style={{ fontWeight: "500" }}>Arguments: </span>
											<span style={{ color: "var(--vscode-descriptionForeground)" }}>
												{slashCommandInfo.args}
											</span>
										</div>
									)}
									{slashCommandInfo.description && (
										<div style={{ color: "var(--vscode-descriptionForeground)" }}>
											{slashCommandInfo.description}
										</div>
									)}
								</div>
							)}
						</div>
					</>
				)
			}
			case "generateImage":
				return (
					<>
						{message.type === "ask" && (
							<div className="pl-0">
								<ToolUseBlock>
									<div className="p-2">
										<div className="mb-2 break-words">{tool.content}</div>
										<div className="flex items-center gap-1 text-xs text-vscode-descriptionForeground">
											{tool.path}
										</div>
									</div>
								</ToolUseBlock>
							</div>
						)}
					</>
				)
			default:
				return null
		}
	}

	switch (message.type) {
		case "say":
			switch (message.say) {
				case "diff_error":
					return (
						<ErrorRow
							type="diff_error"
							message={message.text || ""}
							expandable={true}
							showCopyButton={true}
						/>
					)
				case "subtask_result":
					return (
						<div>
							<div
								style={{
									marginTop: "0px",
									backgroundColor: "var(--vscode-badge-background)",
									border: "1px solid var(--vscode-badge-background)",
									borderRadius: "0 0 4px 4px",
									overflow: "hidden",
									marginBottom: "8px",
								}}>
								<div
									style={{
										padding: "12px 16px",
										backgroundColor: "var(--vscode-editor-background)",
									}}>
									<MarkdownBlock markdown={message.text} />
								</div>
							</div>
						</div>
					)
				case "reasoning":
					return (
						<ReasoningBlock
							content={message.text || ""}
							ts={message.ts}
							isStreaming={isStreaming}
							isLast={isLast}
						/>
					)
				case "api_req_started":
					// Determine if the API request is in progress
					// Consider streaming state: if currently streaming or message is partial, show progress indicator
					const isApiRequestInProgress =
						apiReqCancelReason === undefined &&
						apiRequestFailedMessage === undefined &&
						(cost === undefined || isStreaming || message.partial === true)

					return (
						<>
							<div
								className={`group text-sm transition-opacity ${
									isApiRequestInProgress ? "opacity-100" : "opacity-40 hover:opacity-100"
								}`}
								style={{
									...headerStyle,
									marginBottom:
										((cost === null || cost === undefined) && apiRequestFailedMessage) ||
										apiReqStreamingFailedMessage
											? 10
											: 0,
									justifyContent: "space-between",
								}}>
								<div style={{ display: "flex", alignItems: "center", gap: "10px", flexGrow: 1 }}>
									{icon}
									{/* kilocode_change start */}
									<div style={{ display: "flex", alignItems: "center", gap: "8px", flexGrow: 1 }}>
										{title}
										{showTimestamps && <ChatTimestamps ts={message.ts} />}
									</div>
									{/* kilocode_change end */}
								</div>
								<div
									className="text-xs text-vscode-dropdown-foreground border-vscode-dropdown-border/50 border px-1.5 py-0.5 rounded-lg"
									style={{ opacity: shouldShowCost ? 1 : 0 }}>
									${Number(cost || 0)?.toFixed(4)}
								</div>
								{
									// kilocode_change start
									!cost && usageMissing && (
										<StandardTooltip content={t("kilocode:pricing.costUnknownDescription")}>
											<div className="flex items-center text-xs text-vscode-dropdown-foreground border-vscode-dropdown-border/50 border px-1.5 py-0.5 rounded-lg whitespace-nowrap">
												<span className="codicon codicon-warning pr-1"></span>
												{t("kilocode:pricing.costUnknown")}
											</div>
										</StandardTooltip>
									)
									// kilocode_change end
								}
							</div>
							{(((cost === null || cost === undefined) && apiRequestFailedMessage) ||
								apiReqStreamingFailedMessage) && (
								<ErrorRow
									type="api_failure"
									message={apiRequestFailedMessage || apiReqStreamingFailedMessage || ""}
									docsURL={
										apiRequestFailedMessage?.toLowerCase().includes("powershell")
											? "https://github.com/cline/cline/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22"
											: undefined
									}
								/>
							)}
						</>
					)
				case "api_req_retry_delayed":
					let body = t(`chat:apiRequest.failed`)
					let retryInfo, rawError, code, docsURL
					if (message.text !== undefined) {
						// Try to show richer error message for that code, if available
						const potentialCode = parseInt(message.text.substring(0, 3))
						if (!isNaN(potentialCode) && potentialCode >= 400) {
							code = potentialCode
							const stringForError = `chat:apiRequest.errorMessage.${code}`
							if (i18n.exists(stringForError)) {
								body = t(stringForError)
								// Fill this out in upcoming PRs
								// Do not remove this
								// switch(code) {
								// 	case ERROR_CODE:
								// 		docsURL = ???
								// 		break;
								// }
							} else {
								body = t("chat:apiRequest.errorMessage.unknown")
								docsURL = "https://kilo.ai/support"
							}
						} else if (message.text.indexOf("Connection error") === 0) {
							body = t("chat:apiRequest.errorMessage.connection")
						} else {
							body = message.text
						}

						// This isn't pretty, but since the retry logic happens at a lower level
						// and the message object is just a flat string, we need to extract the
						// retry information using this "tag" as a convention
						const retryTimerMatch = message.text.match(/<retry_timer>(.*?)<\/retry_timer>/)
						const retryTimer = retryTimerMatch && retryTimerMatch[1] ? parseInt(retryTimerMatch[1], 10) : 0
						rawError = message.text.replace(/<retry_timer>(.*?)<\/retry_timer>/, "").trim()
						retryInfo = retryTimer > 0 && (
							<p
								className={cn(
									"mt-2 font-light text-xs  text-vscode-descriptionForeground cursor-default flex items-center gap-1 transition-all duration-1000",
									retryTimer === 0 ? "opacity-0 max-h-0" : "max-h-2 opacity-100",
								)}>
								<Repeat2 className="size-3" strokeWidth={1.5} />
								<span>{retryTimer}s</span>
							</p>
						)
					}
					return (
						<ErrorRow
							type="api_req_retry_delayed"
							code={code}
							message={body}
							docsURL={docsURL}
							additionalContent={retryInfo}
							errorDetails={rawError}
						/>
					)
				case "api_req_finished":
					return null // we should never see this message type
				case "text":
					return (
						<div className="pl-0">
							<Markdown markdown={message.text} partial={message.partial} />
							{message.images && message.images.length > 0 && (
								<div style={{ marginTop: "10px" }}>
									{message.images.map((image, index) => (
										<ImageBlock key={index} imageData={image} />
									))}
								</div>
							)}
						</div>
					)
				case "user_feedback":
					return (
						<div className="group">
							<div
								className={cn(
									"ml-0 border rounded-sm whitespace-pre-wrap",
									isEditing ? "overflow-visible" : "overflow-hidden", // kilocode_change
									isEditing
										? "bg-vscode-editor-background text-vscode-editor-foreground"
										: "cursor-text p-1 bg-vscode-editor-foreground/70 text-vscode-editor-background",
								)}>
								{isEditing ? (
									<div className="flex flex-col gap-2">
										<ChatTextArea
											inputValue={editedContent}
											setInputValue={setEditedContent}
											sendingDisabled={false}
											selectApiConfigDisabled={true}
											placeholderText={t("chat:editMessage.placeholder")}
											selectedImages={editImages}
											setSelectedImages={setEditImages}
											onSend={handleSaveEdit}
											onSelectImages={handleSelectImages}
											shouldDisableImages={!model?.supportsImages}
											mode={editMode}
											setMode={setEditMode}
											modeShortcutText=""
											isEditMode={true}
											onCancel={handleCancelEdit}
										/>
									</div>
								) : (
									<div className="flex justify-between">
										<div
											className="flex-grow px-2 py-1 wrap-anywhere rounded-lg transition-colors"
											onClick={(e) => {
												e.stopPropagation()
												if (!isStreaming) {
													handleEditClick()
												}
											}}
											title={t("chat:queuedMessages.clickToEdit")}>
											<Mention text={message.text} withShadow />
										</div>
										<div className="flex gap-2 pr-1">
											<div
												className="cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
												style={{ visibility: isStreaming ? "hidden" : "visible" }}
												onClick={(e) => {
													e.stopPropagation()
													handleEditClick()
												}}>
												<Edit className="w-4 shrink-0" aria-label="Edit message icon" />
											</div>
											<div
												className="cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
												style={{ visibility: isStreaming ? "hidden" : "visible" }}
												onClick={(e) => {
													e.stopPropagation()
													vscode.postMessage({ type: "deleteMessage", value: message.ts })
												}}>
												<Trash2 className="w-4 shrink-0" aria-label="Delete message icon" />
											</div>
										</div>
									</div>
								)}
								{!isEditing && message.images && message.images.length > 0 && (
									<Thumbnails images={message.images} style={{ marginTop: "8px" }} />
								)}
							</div>
						</div>
					)
				case "user_feedback_diff" as ClineSay:
					const tool = safeJsonParse<ClineSayTool>(message.text)
					return (
						<CodeAccordian
							code={tool?.diff}
							language="diff"
							isFeedback={true}
							isExpanded={isExpanded}
							onToggleExpand={handleToggleExpand}
							checkpointTs={previousCheckpoint?.ts}
							commitHash={previousCheckpoint?.commitHash}
						/>
					)
				case "error":
					// kilocode_change start: Show login button for KiloCode auth errors
					const isKiloCodeAuthError =
						apiConfiguration?.apiProvider === "kilocode" &&
						message.text?.includes(KILOCODE_TOKEN_REQUIRED_ERROR)
					return (
						<ErrorRow
							type="error"
							message={t("chat:error")}
							errorDetails={message.text || undefined}
							showLoginButton={isKiloCodeAuthError}
							onLoginClick={
								isKiloCodeAuthError
									? () => {
											vscode.postMessage({
												type: "switchTab",
												tab: "auth",
												values: { returnTo: "chat" },
											})
										}
									: undefined
							}
						/>
					)
				// kilocode_change end
				case "completion_result":
					const commitRange = message.metadata?.kiloCode?.commitRange
					return (
						<>
							<div className="border-l border-green-600/30 ml-0 pl-4 pb-1">
								<Markdown markdown={message.text} />
							</div>
							{
								// kilocode_change start
								!message.partial && enableCheckpoints !== false && commitRange ? (
									<SeeNewChangesButtons commitRange={commitRange} />
								) : (
									<></>
								)
								// kilocode_change end
							}
						</>
					)
				case "shell_integration_warning":
					return <CommandExecutionError />
				case "condense_context":
					// In-progress state
					if (message.partial) {
						return <InProgressRow eventType="condense_context" />
					}
					// Completed state
					if (message.contextCondense) {
						return <CondensationResultRow data={message.contextCondense} />
					}
					return null
				case "condense_context_error":
					return <CondensationErrorRow errorText={message.text} />
				case "sliding_window_truncation":
					// In-progress state
					if (message.partial) {
						return <InProgressRow eventType="sliding_window_truncation" />
					}
					// Completed state
					if (message.contextTruncation) {
						return <TruncationResultRow data={message.contextTruncation} />
					}
					return null
				case "codebase_search_result":
					let parsed: {
						content: {
							query: string
							results: Array<{
								filePath: string
								score: number
								startLine: number
								endLine: number
								codeChunk: string
							}>
						}
					} | null = null

					try {
						if (message.text) {
							parsed = JSON.parse(message.text)
						}
					} catch (error) {
						console.error("Failed to parse codebaseSearch content:", error)
					}

					if (parsed && !parsed?.content) {
						console.error("Invalid codebaseSearch content structure:", parsed.content)
						return <div>Error displaying search results.</div>
					}

					const { results = [] } = parsed?.content || {}

					return <CodebaseSearchResultsDisplay results={results} />
				case "user_edit_todos":
					return <UpdateTodoListToolBlock userEdited onChange={() => {}} />
				case "tool" as any:
					// Handle say tool messages
					const sayTool = safeJsonParse<ClineSayTool>(message.text)
					if (!sayTool) return null

					switch (sayTool.tool) {
						case "runSlashCommand": {
							const slashCommandInfo = sayTool
							return (
								<>
									<div className="pl-0">
										<ToolUseBlock>
											<ToolUseBlockHeader
												style={{
													display: "flex",
													flexDirection: "column",
													alignItems: "flex-start",
													gap: "4px",
													padding: "10px 12px",
												}}>
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: "8px",
														width: "100%",
													}}>
													<span
														style={{
															fontWeight: "500",
															fontSize: "var(--vscode-font-size)",
														}}>
														/{slashCommandInfo.command}
													</span>
													{slashCommandInfo.args && (
														<span
															style={{
																color: "var(--vscode-descriptionForeground)",
																fontSize: "var(--vscode-font-size)",
															}}>
															{slashCommandInfo.args}
														</span>
													)}
												</div>
												{slashCommandInfo.description && (
													<div
														style={{
															color: "var(--vscode-descriptionForeground)",
															fontSize: "calc(var(--vscode-font-size) - 1px)",
														}}>
														{slashCommandInfo.description}
													</div>
												)}
												{slashCommandInfo.source && (
													<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
														<VSCodeBadge
															style={{ fontSize: "calc(var(--vscode-font-size) - 2px)" }}>
															{slashCommandInfo.source}
														</VSCodeBadge>
													</div>
												)}
											</ToolUseBlockHeader>
										</ToolUseBlock>
									</div>
								</>
							)
						}
						default:
							return null
					}
				case "image":
					// Parse the JSON to get imageUri and imagePath
					const imageInfo = safeJsonParse<{ imageUri: string; imagePath: string }>(message.text || "{}")
					if (!imageInfo) {
						return null
					}
					return (
						<div style={{ marginTop: "10px" }}>
							<ImageBlock imageUri={imageInfo.imageUri} imagePath={imageInfo.imagePath} />
						</div>
					)
				// kilocode_change start: upstream pr https://github.com/RooCodeInc/Roo-Code/pull/5452
				case "browser_action":
					return null
				case "browser_action_result":
					// This should not normally be rendered here as browser_action_result messages
					// should be grouped into browser sessions and rendered by BrowserSessionRow.
					// If we see this, it means the message grouping logic has a bug.
					return (
						<>
							<div style={{ paddingTop: 10 }}>
								<div
									style={{
										color: "var(--vscode-errorForeground)",
										fontFamily: "monospace",
										fontSize: "12px",
										padding: "8px",
										backgroundColor: "var(--vscode-editor-background)",
										border: "1px solid var(--vscode-editorError-border)",
										borderRadius: "4px",
										marginBottom: "8px",
									}}>
									⚠️ Browser action result not properly grouped - this is a bug in the message
									grouping logic
								</div>
								<Markdown markdown={message.text} partial={message.partial} />
							</div>
						</>
					)
				// kilocode_change end
				default:
					return (
						<>
							<div style={{ paddingTop: 10 }}>
								<Markdown markdown={message.text} partial={message.partial} />
							</div>
						</>
					)
			}
		case "ask":
			switch (message.ask) {
				case "mistake_limit_reached":
					return <ErrorRow type="mistake_limit" message={message.text || ""} />
				case "command":
					return (
						<CommandExecution
							executionId={message.ts.toString()}
							text={message.text}
							icon={icon}
							title={title}
						/>
					)
				case "use_mcp_server":
					// Parse the message text to get the MCP server request
					const messageJson = safeJsonParse<any>(message.text, {})

					// Extract the response field if it exists
					const { response, ...mcpServerRequest } = messageJson

					// Create the useMcpServer object with the response field
					const useMcpServer: ClineAskUseMcpServer = {
						...mcpServerRequest,
						response,
					}

					if (!useMcpServer) {
						return null
					}

					const server = mcpServers.find((server) => server.name === useMcpServer.serverName)

					return (
						<>
							<div className="w-full bg-vscode-editor-background border border-vscode-border rounded-xs p-2 mt-2">
								{useMcpServer.type === "access_mcp_resource" && (
									<McpResourceRow
										item={{
											// Use the matched resource/template details, with fallbacks
											...(findMatchingResourceOrTemplate(
												useMcpServer.uri || "",
												server?.resources,
												server?.resourceTemplates,
											) || {
												name: "",
												mimeType: "",
												description: "",
											}),
											// Always use the actual URI from the request
											uri: useMcpServer.uri || "",
										}}
									/>
								)}
								{useMcpServer.type === "use_mcp_tool" && (
									<McpExecution
										executionId={message.ts.toString()}
										text={useMcpServer.arguments !== "{}" ? useMcpServer.arguments : undefined}
										serverName={useMcpServer.serverName}
										toolName={useMcpServer.toolName}
										isArguments={true}
										server={server}
										useMcpServer={useMcpServer}
										alwaysAllowMcp={alwaysAllowMcp}
									/>
								)}
							</div>
						</>
					)
				case "completion_result":
					if (message.text) {
						return (
							<div>
								<div style={{ color: "var(--vscode-charts-green)", paddingTop: 10 }}>
									<Markdown markdown={message.text} partial={message.partial} />
								</div>
							</div>
						)
					} else {
						return null // Don't render anything when we get a completion_result ask without text
					}
				case "followup":
					return (
						<>
							<div className="flex flex-col gap-2 ml-0">
								<Markdown
									markdown={message.partial === true ? message?.text : followUpData?.question}
								/>
								<FollowUpSuggest
									suggestions={followUpData?.suggest}
									onSuggestionClick={onSuggestionClick}
									ts={message?.ts}
									onCancelAutoApproval={onFollowUpUnmount}
									isAnswered={isFollowUpAnswered}
									isFollowUpAutoApprovalPaused={isFollowUpAutoApprovalPaused}
								/>
							</div>
						</>
					)

				// kilocode_change begin
				case "condense":
					return (
						<>
							<NewTaskPreview context={message.text || ""} />
						</>
					)

				case "payment_required_prompt": {
					return (
						<LowCreditWarning
							message={message}
							isOrganization={!!apiConfiguration.kilocodeOrganizationId}
						/>
					)
				}
				case "invalid_model": {
					return <InvalidModelWarning message={message} isLast={isLast} />
				}
				case "report_bug":
					return (
						<>
							<ReportBugPreview data={message.text || ""} />
						</>
					)
				// kilocode_change end
				case "auto_approval_max_req_reached": {
					return <AutoApprovedRequestLimitWarning message={message} />
				}
				default:
					return null
			}
	}
}
