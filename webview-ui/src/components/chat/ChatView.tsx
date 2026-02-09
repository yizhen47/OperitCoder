import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useDeepCompareEffect, useEvent } from "react-use"
import debounce from "debounce"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import removeMd from "remove-markdown"
import { VSCodeButton as Button } from "@vscode/webview-ui-toolkit/react" // kilocode_change: do not use rounded Roo buttons
import useSound from "use-sound"
import { LRUCache } from "lru-cache"
import { Trans } from "react-i18next"

import { useDebounceEffect } from "@src/utils/useDebounceEffect"
import { appendImages } from "@src/utils/imageUtils"

import type { ClineAsk, ClineMessage } from "@roo-code/types"

import { ClineSayTool, ExtensionMessage } from "@roo/ExtensionMessage"
import { findLast } from "@roo/array"
import { SuggestionItem } from "@roo-code/types"
import { combineApiRequests } from "@roo/combineApiRequests"
import { combineCommandSequences } from "@roo/combineCommandSequences"
import { getApiMetrics } from "@roo/getApiMetrics"
import { AudioType } from "@roo/WebviewMessage"
import { getAllModes } from "@roo/modes"
import { getLatestTodo } from "@roo/todo"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"
// import RooHero from "@src/components/welcome/RooHero" // kilocode_change: unused
// import RooTips from "@src/components/welcome/RooTips" // kilocode_change: unused
import { StandardTooltip } from "@src/components/ui"
import { buildChatRowTestId, computeScrollDelta, selectAnchorTsFromRects } from "./scrollAnchor" // kilocode_change

// import VersionIndicator from "../common/VersionIndicator" // kilocode_change: unused
import { OrganizationSelector } from "../kilocode/common/OrganizationSelector"
// import { useTaskSearch } from "../history/useTaskSearch" // kilocode_change: unused
// import { CloudUpsellDialog } from "@src/components/cloud/CloudUpsellDialog" // kilocode_change: unused

import HistoryPreview from "../history/HistoryPreview"
import Announcement from "./Announcement"
// kilocode_change: browser rows removed
import ChatRow from "./ChatRow"
import { ChatRowErrorBoundary } from "./ChatRowErrorBoundary" // kilocode_change: 添加错误边界
import { ChatTextArea } from "./ChatTextArea"
import { TaskTabsBar } from "./TaskTabsBar" // kilocode_change
// import TaskHeader from "./TaskHeader"// kilocode_change
// import KiloTaskHeader from "../kilocode/KiloTaskHeader" // kilocode_change
import AutoApproveMenu from "./AutoApproveMenu"
import BottomControls from "../kilocode/BottomControls" // kilocode_change
import SystemPromptWarning from "./SystemPromptWarning"
// import ProfileViolationWarning from "./ProfileViolationWarning" kilocode_change: unused
import { CheckpointWarning } from "./CheckpointWarning"
import { IdeaSuggestionsBox } from "../kilocode/chat/IdeaSuggestionsBox" // kilocode_change
import { KilocodeNotifications } from "../kilocode/KilocodeNotifications" // kilocode_change
import { QueuedMessages } from "./QueuedMessages"
import { ChatViewDebug } from "./ChatViewDebug" // kilocode_change: 添加调试组件
import { buildDocLink } from "@/utils/docLinks"
// import DismissibleUpsell from "../common/DismissibleUpsell" // kilocode_change: unused
// import { useCloudUpsell } from "@src/hooks/useCloudUpsell" // kilocode_change: unused
// import { Cloud } from "lucide-react" // kilocode_change: unused

export interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	hideAnnouncement: () => void
}

export interface ChatViewRef {
	acceptInput: () => void
	focusInput: () => void // kilocode_change
}

export const MAX_IMAGES_PER_MESSAGE = 20 // This is the Anthropic limit.

const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0

const ChatViewComponent: React.ForwardRefRenderFunction<ChatViewRef, ChatViewProps> = (
	{ isHidden, showAnnouncement, hideAnnouncement },
	ref,
) => {
	const isMountedRef = useRef(true)

	const [audioBaseUri] = useState(() => {
		const w = window as any
		return w.AUDIO_BASE_URI || ""
	})

	const { t } = useAppTranslation()
	const modeShortcutText = `${isMac ? "⌘" : "Ctrl"} + . ${t("chat:forNextMode")}, ${isMac ? "⌘" : "Ctrl"} + Shift + . ${t("chat:forPreviousMode")}`

	const {
		clineMessages: messages,
		currentTaskItem,
		currentTaskTodos,
		activeTasks,
		taskHistoryFullLength, // kilocode_change
		taskHistoryVersion, // kilocode_change
		apiConfiguration,
		experiments,
		// kilocode_change: organizationAllowList removed
		mode,
		setMode,
		alwaysAllowModeSwitch,
		showAutoApproveMenu, // kilocode_change
		enableCheckpoints, // kilocode_change
		alwaysAllowUpdateTodoList,
		customModes,
		hasSystemPromptOverride,
		historyPreviewCollapsed, // kilocode_change
		soundEnabled,
		soundVolume,
		// cloudIsAuthenticated, // kilocode_change
		messageQueue = [],
		sendMessageOnEnter, // kilocode_change
		// kilocode_change: browser session state removed
	} = useExtensionState()

	const messagesRef = useRef(messages)

	useEffect(() => {
		messagesRef.current = messages
	}, [messages])

	// Leaving this less safe version here since if the first message is not a
	// task, then the extension is in a bad state and needs to be debugged (see
	// Cline.abort).
	const task = useMemo(() => messages.at(0), [messages])

	// kilocode_change start
	// Initialize expanded state based on the persisted setting (default to expanded if undefined)
	const [isExpanded, setIsExpanded] = useState(
		historyPreviewCollapsed === undefined ? true : !historyPreviewCollapsed,
	)

	const toggleExpanded = useCallback(() => {
		const newState = !isExpanded
		setIsExpanded(newState)
		// Send message to extension to persist the new collapsed state
		vscode.postMessage({ type: "setHistoryPreviewCollapsed", bool: !newState })
	}, [isExpanded])
	// kilocode_change end

	const latestTodos = useMemo(() => {
		// First check if we have initial todos from the state (for new subtasks)
		if (currentTaskTodos && currentTaskTodos.length > 0) {
			// Check if there are any todo updates in messages
			const messageBasedTodos = getLatestTodo(messages)
			// If there are message-based todos, they take precedence (user has updated them)
			if (messageBasedTodos && messageBasedTodos.length > 0) {
				return messageBasedTodos
			}
			// Otherwise use the initial todos from state
			return currentTaskTodos
		}
		// Fall back to extracting from messages
		return getLatestTodo(messages)
	}, [messages, currentTaskTodos])

	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages)), [messages])

	// Has to be after api_req_finished are all reduced into api_req_started messages.
	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])

	const [inputValue, setInputValue] = useState("")
	const inputValueRef = useRef(inputValue)
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const [sendingDisabled, setSendingDisabled] = useState(false)
	const [selectedImages, setSelectedImages] = useState<string[]>([])

	// We need to hold on to the ask because useEffect > lastMessage will always
	// let us know when an ask comes in and handle it, but by the time
	// handleMessage is called, the last message might not be the ask anymore
	// (it could be a say that followed).
	const [clineAsk, setClineAsk] = useState<ClineAsk | undefined>(undefined)
	const [enableButtons, setEnableButtons] = useState<boolean>(false)
	const [primaryButtonText, setPrimaryButtonText] = useState<string | undefined>(undefined)
	const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined)
	const [didClickCancel, setDidClickCancel] = useState(false)
	const [isScrollSeeking, setIsScrollSeeking] = useState(false)
	const [olderMessagesCollapsed, setOlderMessagesCollapsed] = useState(false)
	const userExpandedOlderMessagesRef = useRef(false)
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
	const prevExpandedRowsRef = useRef<Record<number, boolean>>()
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const virtuosoScrollerRef = useRef<HTMLDivElement | null>(null) // kilocode_change
	const [scrollerVersion, setScrollerVersion] = useState(0) // kilocode_change
	const stickyFollowRef = useRef<boolean>(false)
	const [showScrollToBottom, setShowScrollToBottom] = useState(false)
	const [isAtBottom, setIsAtBottom] = useState(false)
	const centerAnchorRef = useRef<{ ts: string; topInViewport: number } | null>(null) // kilocode_change
	const resizeRestoreRafRef = useRef<number | null>(null) // kilocode_change
	const lastTtsRef = useRef<string>("")
	const [wasStreaming, setWasStreaming] = useState<boolean>(false)
	const [checkpointWarning, setCheckpointWarning] = useState<
		{ type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } | undefined
	>(undefined)
	const [isCondensing, setIsCondensing] = useState<boolean>(false)
	const condensingMessageTsRef = useRef<number | null>(null) // kilocode_change
	const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
	const everVisibleMessagesTsRef = useRef<LRUCache<number, boolean>>(
		new LRUCache({
			max: 100,
			ttl: 1000 * 60 * 5,
		}),
	)

	// kilocode_change start
	const condensingMessageTs = useMemo(() => {
		if (!isCondensing) {
			condensingMessageTsRef.current = null
			return null
		}
		if (condensingMessageTsRef.current === null) {
			condensingMessageTsRef.current = Date.now()
		}
		return condensingMessageTsRef.current
	}, [isCondensing])
	// kilocode_change end
	const autoApproveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const userRespondedRef = useRef<boolean>(false)
	const lastSendSignatureRef = useRef<{ signature: string; ts: number } | null>(null) // kilocode_change
	const [currentFollowUpTs, setCurrentFollowUpTs] = useState<number | null>(null)

	const clineAskRef = useRef(clineAsk)
	useEffect(() => {
		clineAskRef.current = clineAsk
	}, [clineAsk])

	// kilocode_change start: unused
	// const {
	// 	isOpen: isUpsellOpen,
	// 	openUpsell,
	// 	closeUpsell,
	// 	handleConnect,
	// } = useCloudUpsell({
	// 	autoOpenOnAuth: false,
	// })
	// kilocode_change end

	// Keep inputValueRef in sync with inputValue state
	useEffect(() => {
		inputValueRef.current = inputValue
	}, [inputValue])

	// Compute whether auto-approval is paused (user is typing in a followup)
	const isFollowUpAutoApprovalPaused = useMemo(() => {
		return !!(inputValue && inputValue.trim().length > 0 && clineAsk === "followup")
	}, [inputValue, clineAsk])

	// Cancel auto-approval timeout when user starts typing
	useEffect(() => {
		// Only send cancel if there's actual input (user is typing)
		// and we have a pending follow-up question
		if (isFollowUpAutoApprovalPaused) {
			vscode.postMessage({ type: "cancelAutoApproval" })
		}
	}, [isFollowUpAutoApprovalPaused])

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	useEffect(() => {
		// kilocode_change: suppress ResizeObserver loop warnings (dev-only noise, common with virtualization)
		const originalConsoleError = console.error
		console.error = (...args: unknown[]) => {
			const first = args[0]
			if (typeof first === "string") {
				if (first.includes("ResizeObserver loop limit exceeded")) return
				if (first.includes("ResizeObserver loop completed with undelivered notifications")) return
			}
			originalConsoleError(...(args as Parameters<typeof originalConsoleError>))
		}
		return () => {
			console.error = originalConsoleError
		}
	}, [])

	// kilocode_change: organizationAllowList check removed - profile validation disabled
	const isProfileDisabled = useMemo(() => false, [])

	// UI layout depends on the last 2 messages (since it relies on the content
	// of these messages, we are deep comparing) i.e. the button state after
	// hitting button sets enableButtons to false,  and this effect otherwise
	// would have to true again even if messages didn't change.
	const lastMessage = useMemo(() => messages.at(-1), [messages])
	const secondLastMessage = useMemo(() => messages.at(-2), [messages])

	const volume = typeof soundVolume === "number" ? soundVolume : 0.5
	const [playNotification] = useSound(`${audioBaseUri}/notification.wav`, { volume, soundEnabled })
	const [playCelebration] = useSound(`${audioBaseUri}/celebration.wav`, { volume, soundEnabled })
	const [playProgressLoop] = useSound(`${audioBaseUri}/progress_loop.wav`, { volume, soundEnabled })

	const playSound = useCallback(
		(audioType: AudioType) => {
			if (!soundEnabled) {
				return
			}

			switch (audioType) {
				case "notification":
					playNotification()
					break
				case "celebration":
					playCelebration()
					break
				case "progress_loop":
					playProgressLoop()
					break
				default:
					console.warn(`Unknown audio type: ${audioType}`)
			}
		},
		[soundEnabled, playNotification, playCelebration, playProgressLoop],
	)

	function playTts(text: string) {
		vscode.postMessage({ type: "playTts", text })
	}

	useDeepCompareEffect(() => {
		// if last message is an ask, show user ask UI
		// if user finished a task, then start a new task with a new conversation history since in this moment that the extension is waiting for user response, the user could close the extension and the conversation history would be lost.
		// basically as long as a task is active, the conversation history will be persisted
		if (lastMessage) {
			switch (lastMessage.type) {
				case "ask":
					if (lastMessage.isAnswered === true) {
						setSendingDisabled(false)
						setClineAsk(undefined)
						setEnableButtons(false)
						setPrimaryButtonText(undefined)
						setSecondaryButtonText(undefined)
						break
					}
					// Reset user response flag when a new ask arrives to allow auto-approval
					userRespondedRef.current = false
					const isPartial = lastMessage.partial === true
					switch (lastMessage.ask) {
						case "api_req_failed":
							playSound("progress_loop")
							setSendingDisabled(true)
							setClineAsk("api_req_failed")
							setEnableButtons(true)
							setPrimaryButtonText(t("chat:retry.title"))
							setSecondaryButtonText(undefined)
							break
						case "mistake_limit_reached":
							playSound("progress_loop")
							setSendingDisabled(false)
							setClineAsk("mistake_limit_reached")
							setEnableButtons(true)
							setPrimaryButtonText(t("chat:proceedAnyways.title"))
							setSecondaryButtonText(undefined)
							break
						case "followup":
							setSendingDisabled(isPartial)
							setClineAsk("followup")
							// setting enable buttons to `false` would trigger a focus grab when
							// the text area is enabled which is undesirable.
							// We have no buttons for this tool, so no problem having them "enabled"
							// to workaround this issue.  See #1358.
							setEnableButtons(true)
							setPrimaryButtonText(undefined)
							setSecondaryButtonText(undefined)
							break
						case "tool":
							setSendingDisabled(isPartial)
							setClineAsk("tool")
							setEnableButtons(!isPartial)
							const tool = JSON.parse(lastMessage.text || "{}") as ClineSayTool
							switch (tool.tool) {
								case "editedExistingFile":
								case "appliedDiff":
								case "newFileCreated":
								case "generateImage":
									setPrimaryButtonText(t("chat:save.title"))
									setSecondaryButtonText(t("chat:reject.title"))
									break
								case "finishTask":
									setPrimaryButtonText(t("chat:completeSubtaskAndReturn"))
									setSecondaryButtonText(undefined)
									break
								case "readFile":
									if (tool.batchFiles && Array.isArray(tool.batchFiles)) {
										setPrimaryButtonText(t("chat:read-batch.approve.title"))
										setSecondaryButtonText(t("chat:read-batch.deny.title"))
									} else {
										setPrimaryButtonText(t("chat:approve.title"))
										setSecondaryButtonText(t("chat:reject.title"))
									}
									break
								default:
									setPrimaryButtonText(t("chat:approve.title"))
									setSecondaryButtonText(t("chat:reject.title"))
									break
							}
							break
						// kilocode_change: browser_action_launch removed
						case "command":
							setSendingDisabled(isPartial)
							setClineAsk("command")
							setEnableButtons(!isPartial)
							setPrimaryButtonText(t("chat:runCommand.title"))
							setSecondaryButtonText(t("chat:reject.title"))
							break
						case "command_output":
							setSendingDisabled(false)
							setClineAsk("command_output")
							setEnableButtons(true)
							setPrimaryButtonText(t("chat:proceedWhileRunning.title"))
							setSecondaryButtonText(t("chat:killCommand.title"))
							break
						case "use_mcp_server":
							setSendingDisabled(isPartial)
							setClineAsk("use_mcp_server")
							setEnableButtons(!isPartial)
							setPrimaryButtonText(t("chat:approve.title"))
							setSecondaryButtonText(t("chat:reject.title"))
							break
						case "completion_result":
						// Extension waiting for feedback, but we can just present a new task button.
						// Only play celebration sound if there are no queued messages.
						if (!isPartial && messageQueue.length === 0) {
							playSound("celebration")
						}
						setSendingDisabled(isPartial)
						setClineAsk("completion_result")
						setEnableButtons(false)
						setPrimaryButtonText(undefined)
						setSecondaryButtonText(undefined)
						break
						case "resume_task":
							setSendingDisabled(false)
							setClineAsk("resume_task")
							setEnableButtons(true)
							// For completed subtasks, show "Start New Task" instead of "Resume"
							// A subtask is considered completed if:
							// - It has a parentTaskId AND
							// - Its messages contain a completion_result (either ask or say)
							const isCompletedSubtask =
								currentTaskItem?.parentTaskId &&
								messages.some(
									(msg) => msg.ask === "completion_result" || msg.say === "completion_result",
								)
							if (isCompletedSubtask) {
								setPrimaryButtonText(undefined)
								setSecondaryButtonText(undefined)
							} else {
								setPrimaryButtonText(undefined)
								setSecondaryButtonText(undefined)
							}
							setDidClickCancel(false) // special case where we reset the cancel button state
							break
						case "resume_completed_task":
							setSendingDisabled(false)
							setClineAsk("resume_completed_task")
							setEnableButtons(false)
							setPrimaryButtonText(undefined)
							setSecondaryButtonText(undefined)
							setDidClickCancel(false)
							break
						// kilocode_change begin
						case "report_bug":
							if (!isPartial) {
								playSound("notification")
							}
							setSendingDisabled(isPartial)
							setClineAsk("report_bug")
							setEnableButtons(!isPartial)
							setPrimaryButtonText(t("chat:reportBug.title"))
							break
						case "condense":
							setSendingDisabled(isPartial)
							setClineAsk("condense")
							setEnableButtons(!isPartial)
							setPrimaryButtonText(t("kilocode:chat.condense.condenseConversation"))
							setSecondaryButtonText(undefined)
							break
						// kilocode_change end
					}
					break
				case "say":
					// Don't want to reset since there could be a "say" after
					// an "ask" while ask is waiting for response.
					switch (lastMessage.say) {
						case "api_req_retry_delayed":
							setSendingDisabled(true)
							break
						case "api_req_started":
							if (secondLastMessage?.ask === "command_output") {
								setSendingDisabled(true)
								setSelectedImages([])
								setClineAsk(undefined)
								setEnableButtons(false)
							}
							break
						case "api_req_finished":
						case "error":
						case "text":
						case "command_output":
						case "mcp_server_request_started":
						case "mcp_server_response":
						case "completion_result":
							break
					}
					break
			}
		}
	}, [lastMessage, secondLastMessage])

	// Update button text when messages change (e.g., completion_result is added) for subtasks in resume_task state
	useEffect(() => {
		if (clineAsk === "resume_task" && currentTaskItem?.parentTaskId) {
			const hasCompletionResult = messages.some(
				(msg) => msg.ask === "completion_result" || msg.say === "completion_result",
			)
			if (hasCompletionResult) {
				setPrimaryButtonText(undefined)
				setSecondaryButtonText(undefined)
			}
		}
	}, [clineAsk, currentTaskItem?.parentTaskId, messages, t])

	useEffect(() => {
		if (messages.length === 0) {
			setSendingDisabled(false)
			setClineAsk(undefined)
			setEnableButtons(false)
			setDidClickCancel(false) // kilocode_change
			setPrimaryButtonText(undefined)
			setSecondaryButtonText(undefined)
		}
	}, [messages.length])

	useEffect(() => {
		// Reset UI states only when task changes
		setExpandedRows({})
		everVisibleMessagesTsRef.current.clear() // Clear for new task
		setCurrentFollowUpTs(null) // Clear follow-up answered state for new task
		setIsCondensing(false) // Reset condensing state when switching tasks
		setDidClickCancel(false) // kilocode_change
		// Note: sendingDisabled is not reset here as it's managed by message effects

		// Clear any pending auto-approval timeout from previous task
		if (autoApproveTimeoutRef.current) {
			clearTimeout(autoApproveTimeoutRef.current)
			autoApproveTimeoutRef.current = null
		}
		// Reset user response flag for new task
		userRespondedRef.current = false
	}, [task?.ts])

	useEffect(() => {
		if (isHidden) {
			everVisibleMessagesTsRef.current.clear()
		}
	}, [isHidden])

	useEffect(() => {
		const cache = everVisibleMessagesTsRef.current
		return () => {
			cache.clear()
		}
	}, [])

	useEffect(() => {
		const prev = prevExpandedRowsRef.current
		let wasAnyRowExpandedByUser = false
		if (prev) {
			// Check if any row transitioned from false/undefined to true
			for (const [tsKey, isExpanded] of Object.entries(expandedRows)) {
				const ts = Number(tsKey)
				if (isExpanded && !(prev[ts] ?? false)) {
					wasAnyRowExpandedByUser = true
					break
				}
			}
		}

		// Expanding a row indicates the user is browsing; disable sticky follow
		if (wasAnyRowExpandedByUser) {
			stickyFollowRef.current = false
		}

		prevExpandedRowsRef.current = expandedRows // Store current state for next comparison
	}, [expandedRows])

	const isStreaming = useMemo(() => {
		// Checking clineAsk isn't enough since messages effect may be called
		// again for a tool for example, set clineAsk to its value, and if the
		// next message is not an ask then it doesn't reset. This is likely due
		// to how much more often we're updating messages as compared to before,
		// and should be resolved with optimizations as it's likely a rendering
		// bug. But as a final guard for now, the cancel button will show if the
		// last message is not an ask.
		const isLastAsk = !!modifiedMessages.at(-1)?.ask

		const isToolCurrentlyAsking =
			isLastAsk && clineAsk !== undefined && enableButtons && primaryButtonText !== undefined

		if (isToolCurrentlyAsking) {
			return false
		}

		const isLastMessagePartial = modifiedMessages.at(-1)?.partial === true

		if (isLastMessagePartial) {
			return true
		} else {
			// kilocode_change start: stabilize streaming indicator (avoid flicker)
			const lastApiReqStarted = findLast(
				modifiedMessages,
				(message: ClineMessage) => message.say === "api_req_started",
			)

			if (
				lastApiReqStarted &&
				lastApiReqStarted.text !== null &&
				lastApiReqStarted.text !== undefined &&
				lastApiReqStarted.say === "api_req_started"
			) {
				let cost: unknown
				let cancelReason: unknown
				try {
					const parsed = JSON.parse(lastApiReqStarted.text)
					cost = parsed.cost
					cancelReason = parsed.cancelReason
				} catch {
					cost = undefined
					cancelReason = undefined
				}

				if (cancelReason !== null && cancelReason !== undefined) {
					return false
				}

				if (cost === undefined || cost === null) {
					return true
				}
			}
			// kilocode_change end
		}

		return false
	}, [modifiedMessages, clineAsk, enableButtons, primaryButtonText])

	const streamingStatusText = useMemo(() => {
		if (!isStreaming) {
			return undefined
		}

		const lastMessage = modifiedMessages.at(-1)
		if (!lastMessage) {
			return t("common:ui.loading")
		}

		if (lastMessage.progressStatus?.text) {
			return lastMessage.progressStatus.text
		}

		if (lastMessage.type === "say" && lastMessage.say === "mcp_server_request_started") {
			return t("chat:mcp.callingTool", { defaultValue: t("common:ui.loading") })
		}

		if (lastMessage.type === "say" && lastMessage.say === "condense_context" && lastMessage.partial === true) {
			return t("chat:contextManagement.condensation.inProgress", { defaultValue: t("common:ui.loading") })
		}

		if (
			lastMessage.type === "say" &&
			(lastMessage.say === "text" || lastMessage.say === "reasoning") &&
			lastMessage.partial === true
		) {
			return t("chat:apiRequest.streamingReceiving", { defaultValue: t("chat:apiRequest.streaming") })
		}

		return t("chat:apiRequest.streamingConnecting", { defaultValue: t("chat:apiRequest.streaming") })
	}, [isStreaming, modifiedMessages, t])

	// kilocode_change start: keep cancel UI visible after user clicks cancel
	// Clicking cancel should disable repeated cancels, but it should not flip the UI
	// into "send" mode while the task is still cancelling.
	const isTaskRunningForInput = useMemo(() => {
		const isAwaitingResponse = sendingDisabled && clineAsk === undefined && !enableButtons
		return isStreaming || isAwaitingResponse
	}, [sendingDisabled, clineAsk, enableButtons, isStreaming])
	// kilocode_change end

	useEffect(() => {
		if (!sendingDisabled) {
			return
		}
		if (isStreaming) {
			return
		}
		if (clineAsk !== undefined) {
			return
		}
		if (enableButtons) {
			return
		}

		const lastApiReqStarted = findLast(
			modifiedMessages,
			(message: ClineMessage) => message.say === "api_req_started",
		)
		if (!lastApiReqStarted?.text) {
			return
		}

		let cost: unknown
		let cancelReason: unknown
		try {
			const parsed = JSON.parse(lastApiReqStarted.text)
			cost = parsed.cost
			cancelReason = parsed.cancelReason
		} catch {
			cost = undefined
			cancelReason = undefined
		}

		if (cost !== undefined && cost !== null) {
			setSendingDisabled(false)
			return
		}
		if (cancelReason !== undefined && cancelReason !== null) {
			setSendingDisabled(false)
			return
		}
	}, [sendingDisabled, isStreaming, clineAsk, enableButtons, modifiedMessages])

	useEffect(() => {
		if (didClickCancel && !isTaskRunningForInput) {
			setDidClickCancel(false)
		}
	}, [didClickCancel, isTaskRunningForInput])

	// kilocode_change start
	const VirtuosoScroller = useMemo(() => {
		return forwardRef<HTMLDivElement, any>((props, ref) => {
			return (
				<div
					{...props}
					ref={(node) => {
						if (node !== virtuosoScrollerRef.current) {
							virtuosoScrollerRef.current = node
							setScrollerVersion((v) => v + 1)
						}
						if (typeof ref === "function") {
							ref(node)
						} else if (ref && typeof ref === "object") {
							;(ref as React.MutableRefObject<HTMLDivElement | null>).current = node
						}
					}}
				/>
			)
		})
	}, [])

	const updateCenterAnchorFromDom = useCallback(() => {
		const scroller = virtuosoScrollerRef.current
		if (!scroller) return

		const scrollerRect = scroller.getBoundingClientRect()
		if (scrollerRect.height <= 0) return
		const centerY = scrollerRect.top + scrollerRect.height / 2

		const rowEls = Array.from(scroller.querySelectorAll<HTMLElement>("[data-testid^=\"chat-row-\"]"))
		if (rowEls.length === 0) return

		const rects = rowEls.map((el) => {
			const testId = el.dataset.testid
			const ts = (testId && testId.startsWith("chat-row-") ? testId.slice("chat-row-".length) : null) ?? ""
			const r = el.getBoundingClientRect()
			return { ts, top: r.top, bottom: r.bottom, topInViewport: r.top - scrollerRect.top }
		})

		const anchorTs = selectAnchorTsFromRects(rects, centerY)
		if (!anchorTs) return

		const anchorRect = rects.find((r) => r.ts === anchorTs)
		if (!anchorRect) return

		centerAnchorRef.current = { ts: anchorTs, topInViewport: anchorRect.topInViewport }
	}, [])

	const restoreCenterAnchorFromDom = useCallback(() => {
		if (isAtBottom || stickyFollowRef.current) return
		const scroller = virtuosoScrollerRef.current
		const anchor = centerAnchorRef.current
		if (!scroller || !anchor) return

		const scrollerRect = scroller.getBoundingClientRect()
		const anchorEl = scroller.querySelector<HTMLElement>(`[data-testid=\"${buildChatRowTestId(anchor.ts)}\"]`)
		if (!anchorEl) return

		const anchorRect = anchorEl.getBoundingClientRect()
		const currentTopInViewport = anchorRect.top - scrollerRect.top
		const delta = computeScrollDelta(anchor.topInViewport, currentTopInViewport)
		if (Math.abs(delta) < 0.5) return
		scroller.scrollTop += delta
	}, [isAtBottom])

	const scheduleRestoreCenterAnchor = useCallback(() => {
		if (resizeRestoreRafRef.current !== null) {
			cancelAnimationFrame(resizeRestoreRafRef.current)
			resizeRestoreRafRef.current = null
		}
		resizeRestoreRafRef.current = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				restoreCenterAnchorFromDom()
				resizeRestoreRafRef.current = null
			})
		})
	}, [restoreCenterAnchorFromDom])

	useEffect(() => {
		const scroller = virtuosoScrollerRef.current
		if (!scroller) return
		if (typeof ResizeObserver === "undefined") return

		let prevWidth = scroller.clientWidth
		let prevHeight = scroller.clientHeight
		const ro = new ResizeObserver(() => {
			const nextWidth = scroller.clientWidth
			const nextHeight = scroller.clientHeight
			if (nextWidth !== prevWidth || nextHeight !== prevHeight) {
				prevWidth = nextWidth
				prevHeight = nextHeight
				scheduleRestoreCenterAnchor()
			}
		})
		ro.observe(scroller)
		return () => ro.disconnect()
	}, [scrollerVersion, scheduleRestoreCenterAnchor])

	useEvent("resize", scheduleRestoreCenterAnchor, window)

	useEffect(() => {
		const scroller = virtuosoScrollerRef.current
		if (!scroller) return

		let rafId: number | null = null
		const onScroll = () => {
			if (rafId !== null) return
			rafId = requestAnimationFrame(() => {
				rafId = null
				updateCenterAnchorFromDom()
			})
		}

		scroller.addEventListener("scroll", onScroll, { passive: true })
		updateCenterAnchorFromDom()
		return () => {
			scroller.removeEventListener("scroll", onScroll)
			if (rafId !== null) cancelAnimationFrame(rafId)
		}
	}, [scrollerVersion, updateCenterAnchorFromDom])
	// kilocode_change end

	// kilocode_change start: prevent loading footer flicker
	const virtuosoFooter = useCallback(() => {
		const shouldAnimate = isStreaming && !wasStreaming
		return (
			<div
				className={`flex items-center justify-start pl-4 ${isStreaming ? "py-4" : ""} ${shouldAnimate ? "animate-fade-in" : ""}`}
			>
				{isStreaming && (
					<div className="flex items-center gap-2 text-sm text-vscode-descriptionForeground">
						<div className="flex items-center gap-1">
							<span
								className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"
								style={{ animationDuration: "1.4s", animationDelay: "0ms" }}
							/>
							<span
								className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"
								style={{ animationDuration: "1.4s", animationDelay: "200ms" }}
							/>
							<span
								className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"
								style={{ animationDuration: "1.4s", animationDelay: "400ms" }}
							/>
						</div>
						<span className="chat-loading-text">{streamingStatusText ?? t("common:ui.loading")}</span>
					</div>
				)}
			</div>
		)
	}, [isStreaming, wasStreaming, streamingStatusText, t])

	const virtuosoComponents = useMemo(
		() => ({ Footer: virtuosoFooter, Scroller: VirtuosoScroller }),
		[virtuosoFooter, VirtuosoScroller],
	) // kilocode_change
	// kilocode_change end

	const markFollowUpAsAnswered = useCallback(() => {
		const lastFollowUpMessage = messagesRef.current.findLast((msg: ClineMessage) => msg.ask === "followup")
		if (lastFollowUpMessage) {
			setCurrentFollowUpTs(lastFollowUpMessage.ts)
		}
	}, [])

	const handleChatReset = useCallback(() => {
		// Clear any pending auto-approval timeout
		if (autoApproveTimeoutRef.current) {
			clearTimeout(autoApproveTimeoutRef.current)
			autoApproveTimeoutRef.current = null
		}
		// Reset user response flag for new message
		userRespondedRef.current = false
		setDidClickCancel(false) // kilocode_change

		// Only reset message-specific state, preserving mode.
		setInputValue("")
		setSendingDisabled(true)
		setSelectedImages([])
		setClineAsk(undefined)
		setEnableButtons(false)
		// Do not reset mode here as it should persist.
		// setPrimaryButtonText(undefined)
		// setSecondaryButtonText(undefined)
	}, [])

	/**
	 * Handles sending messages to the extension
	 * @param text - The message text to send
	 * @param images - Array of image data URLs to send with the message
	 */
	const handleSendMessage = useCallback(
		(text: string, images: string[], options?: { allowQueue?: boolean }) => {
			const allowQueue = options?.allowQueue !== false
			text = text.trim()

			if (text || images.length > 0) {
				const now = Date.now() // kilocode_change
				const signature = `${text}\n${images.length}:${images.map((img) => `${img.length}:${img.slice(0, 32)}`).join("|")}` // kilocode_change
				const last = lastSendSignatureRef.current // kilocode_change
				if (last && last.signature === signature && now - last.ts < 750) {
					return
				}
				lastSendSignatureRef.current = { signature, ts: now }

				// Queue message if:
				// - Task is busy (sendingDisabled)
				// - API request in progress (isStreaming)
				// - Queue has items (preserve message order during drain)
				// kilocode_change start - allow first message in a brand-new draft conversation to send directly
				const isDraftFirstMessage =
					messagesRef.current.length === 0 &&
					clineAskRef.current === undefined &&
					!isStreaming &&
					messageQueue.length === 0
				if (allowQueue && !isDraftFirstMessage && (sendingDisabled || isStreaming || messageQueue.length > 0)) {
					try {
						console.log("queueMessage", text, images)
						vscode.postMessage({ type: "queueMessage", text, images })
						setInputValue("")
						setSelectedImages([])
					} catch (error) {
						console.error(
							`Failed to queue message: ${error instanceof Error ? error.message : String(error)}`,
						)
					}

					return
				}
				// kilocode_change end

				// Mark that user has responded - this prevents any pending auto-approvals.
				userRespondedRef.current = true

				if (clineAskRef.current) {
					if (clineAskRef.current === "followup") {
						markFollowUpAsAnswered()
					}

					// Use clineAskRef.current
					switch (
						clineAskRef.current // Use clineAskRef.current
					) {
						case "followup":
						case "tool":
						// kilocode_change: browser_action_launch removed
						case "command": // User can provide feedback to a tool or command use.
						case "command_output": // User can send input to command stdin.
						case "use_mcp_server":
						case "completion_result": // If this happens then the user has feedback for the completion result.
						case "resume_task":
						case "resume_completed_task":
						case "mistake_limit_reached":
							vscode.postMessage({
								type: "askResponse",
								askResponse: "messageResponse",
								text,
								images,
							})
							break
						// There is no other case that a textfield should be enabled.
					}
				} else {
					// This is a new message in an ongoing task.
					vscode.postMessage({ type: "askResponse", askResponse: "messageResponse", text, images })
				}

				handleChatReset()
			}
		},
		[handleChatReset, markFollowUpAsAnswered, sendingDisabled, isStreaming, messageQueue.length], // messagesRef and clineAskRef are stable
	)

	const handleSetChatBoxMessage = useCallback(
		(text: string, images: string[]) => {
			// Avoid nested template literals by breaking down the logic
			let newValue = text

			if (inputValue !== "") {
				newValue = inputValue + " " + text
			}

			setInputValue(newValue)
			setSelectedImages([...selectedImages, ...images])
		},
		[inputValue, selectedImages],
	)

	// kilocode_change start
	const startNewTask = useCallback(() => {
		vscode.postMessage({ type: "newTask" })
	}, [])
	// kilocode_change end

	// This logic depends on the useEffect[messages] above to set clineAsk,
	// after which buttons are shown and we then send an askResponse to the
	// extension.
	const handlePrimaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			// Mark that user has responded
			userRespondedRef.current = true

			const trimmedInput = text?.trim()

			switch (clineAsk) {
				case "api_req_failed":
				case "command":
				case "tool":
				// kilocode_change: browser_action_launch removed
				case "use_mcp_server":
				case "mistake_limit_reached":
				case "report_bug":
					// Only send text/images if they exist
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "yesButtonClicked",
							text: trimmedInput,
							images: images,
						})
						// Clear input state after sending
						setInputValue("")
						setSelectedImages([])
					} else {
						vscode.postMessage({ type: "askResponse", askResponse: "yesButtonClicked" })
					}
					break
				case "resume_task":
					// For completed subtasks (tasks with a parentTaskId and a completion_result),
					// start a new task instead of resuming since the subtask is done
					const isCompletedSubtask =
						currentTaskItem?.parentTaskId &&
						messagesRef.current.some(
							(msg) => msg.ask === "completion_result" || msg.say === "completion_result",
						)
					if (isCompletedSubtask) {
						startNewTask()
					} else {
						// Only send text/images if they exist
						if (trimmedInput || (images && images.length > 0)) {
							vscode.postMessage({
								type: "askResponse",
								askResponse: "yesButtonClicked",
								text: trimmedInput,
								images: images,
							})
							// Clear input state after sending
							setInputValue("")
							setSelectedImages([])
						} else {
							vscode.postMessage({ type: "askResponse", askResponse: "yesButtonClicked" })
						}
					}
					break
				case "completion_result":
				case "resume_completed_task":
					// Waiting for feedback, but we can just present a new task button
					startNewTask()
					break
				case "command_output":
					vscode.postMessage({ type: "terminalOperation", terminalOperation: "continue" })
					break
				// kilocode_change start
				case "condense":
					vscode.postMessage({
						type: "condense",
						text: lastMessage?.text,
					})
					break
				// kilocode_change end
			}

			setSendingDisabled(true)
			setClineAsk(undefined)
			setEnableButtons(false)
		},
		[clineAsk, startNewTask, currentTaskItem?.parentTaskId, lastMessage?.text], // kilocode_change: add lastMessage?.text
	)

	const handleSecondaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			// Mark that user has responded
			userRespondedRef.current = true

			const trimmedInput = text?.trim()

			if (isTaskRunningForInput) {
				vscode.postMessage({ type: "cancelTask" })
				setDidClickCancel(true)
				return
			}

			switch (clineAsk) {
				case "api_req_failed":
				case "mistake_limit_reached":
				case "resume_task":
					startNewTask()
					break
				case "command":
				case "tool":
				// kilocode_change: browser_action_launch removed
				case "use_mcp_server":
					// Only send text/images if they exist
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "noButtonClicked",
							text: trimmedInput,
							images: images,
						})
						// Clear input state after sending
						setInputValue("")
						setSelectedImages([])
					} else {
						// Responds to the API with a "This operation failed" and lets it try again
						vscode.postMessage({ type: "askResponse", askResponse: "noButtonClicked" })
					}
					break
				case "command_output":
					vscode.postMessage({ type: "terminalOperation", terminalOperation: "abort" })
					break
			}
			setSendingDisabled(true)
			setClineAsk(undefined)
			setEnableButtons(false)
		},
		[clineAsk, startNewTask, isTaskRunningForInput],
	)

	const handleTaskCloseButtonClick = useCallback(() => startNewTask(), [startNewTask]) // kilocode_change

	const { info: model } = useSelectedModel(apiConfiguration)

	const selectImages = useCallback(() => vscode.postMessage({ type: "selectImages" }), [])

	const shouldDisableImages = !model?.supportsImages || selectedImages.length >= MAX_IMAGES_PER_MESSAGE

	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data

			switch (message.type) {
				case "action":
					switch (message.action!) {
						case "didBecomeVisible":
							if (!isHidden && !sendingDisabled && !enableButtons) {
								textAreaRef.current?.focus()
							}
							break
						case "focusInput":
							textAreaRef.current?.focus()
							break
					}
					break
				case "selectedImages":
					// Only handle selectedImages if it's not for editing context
					// When context is "edit", ChatRow will handle the images
					if (message.context !== "edit") {
						setSelectedImages((prevImages: string[]) => {
							return appendImages(prevImages, message.images, MAX_IMAGES_PER_MESSAGE)
						})
					}
					break
				case "invoke":
					switch (message.invoke!) {
						case "newChat":
							handleChatReset()
							break
						case "sendMessage":
							handleSendMessage(message.text ?? "", message.images ?? [], { allowQueue: false })
							break
						case "setChatBoxMessage":
							handleSetChatBoxMessage(message.text ?? "", message.images ?? [])
							break
						case "primaryButtonClick":
							handlePrimaryButtonClick(message.text ?? "", message.images ?? [])
							break
						case "secondaryButtonClick":
							handleSecondaryButtonClick(message.text ?? "", message.images ?? [])
							break
					}
					break
				case "condenseTaskContextStarted":
					// Handle both manual and automatic condensation start
					// We don't check the task ID because:
					// 1. There can only be one active task at a time
					// 2. Task switching resets isCondensing to false (see useEffect with task?.ts dependency)
					// 3. For new tasks, currentTaskItem may not be populated yet due to async state updates
					if (message.text) {
						setIsCondensing(true)
						// Note: sendingDisabled is only set for manual condensation via handleCondenseContext
						// Automatic condensation doesn't disable sending since the task is already running
					}
					break
				case "condenseTaskContextResponse":
					// Same reasoning as above - we trust this is for the current task
					if (message.text) {
						if (isCondensing && sendingDisabled) {
							setSendingDisabled(false)
						}
						setIsCondensing(false)
					}
					break
				case "checkpointInitWarning":
					setCheckpointWarning(message.checkpointWarning)
					break
				case "interactionRequired":
					playSound("notification")
					break
			}
			// textAreaRef.current is not explicitly required here since React
			// guarantees that ref will be stable across re-renders, and we're
			// not using its value but its reference.
		},
		[
			isCondensing,
			isHidden,
			sendingDisabled,
			enableButtons,
			handleChatReset,
			handleSendMessage,
			handleSetChatBoxMessage,
			handlePrimaryButtonClick,
			handleSecondaryButtonClick,
			setCheckpointWarning,
			playSound,
		],
	)

	useEvent("message", handleMessage)

	const visibleMessages = useMemo(() => {
		// Pre-compute checkpoint hashes that have associated user messages for O(1) lookup
		const userMessageCheckpointHashes = new Set<string>()
		modifiedMessages.forEach((msg) => {
			if (
				msg.say === "user_feedback" &&
				msg.checkpoint &&
				(msg.checkpoint as any).type === "user_message" &&
				(msg.checkpoint as any).hash
			) {
				userMessageCheckpointHashes.add((msg.checkpoint as any).hash)
			}
		})

		// Remove the 500-message limit to prevent array index shifting
		// Virtuoso is designed to efficiently handle large lists through virtualization
		const newVisibleMessages = modifiedMessages.filter((message) => {
			// Filter out ALL checkpoint_saved messages (kilocode_change: prevent zero-height elements in virtuoso)
			if (message.say === "checkpoint_saved") {
				return false
			}

			// Filter out user_feedback_diff messages (kilocode_change: prevent zero-height elements in virtuoso)
			if (message.say === "user_feedback_diff") {
				return false
			}

			// Filter out all API request messages (kilocode_change)
			if (
				message.say === "api_req_started" ||
				message.say === "api_req_finished" ||
				message.say === "api_req_retried" ||
				message.say === "api_req_deleted" ||
				message.say === "api_req_retry_delayed" ||
				message.ask === "api_req_failed"
			) {
				return false
			}

			if (everVisibleMessagesTsRef.current.has(message.ts)) {
				const alwaysHiddenOnceProcessedAsk: ClineAsk[] = [
					"resume_task",
					"resume_completed_task",
				]
				const alwaysHiddenOnceProcessedSay = [
					"mcp_server_request_started",
				]
				if (message.ask && alwaysHiddenOnceProcessedAsk.includes(message.ask)) return false
				if (message.say && alwaysHiddenOnceProcessedSay.includes(message.say)) return false
				if (message.say === "text" && (message.text ?? "") === "" && (message.images?.length ?? 0) === 0) {
					return false
				}
				return true
			}

			switch (message.ask) {
				case "completion_result":
					if (message.text === "") return false
					break
				case "resume_task":
				case "resume_completed_task":
					return false
			}
			switch (message.say) {
				case "text":
					if ((message.text ?? "") === "" && (message.images?.length ?? 0) === 0) return false
					break
				case "mcp_server_request_started":
					return false
			}
			return true
		})

		const viewportStart = Math.max(0, newVisibleMessages.length - 100)
		newVisibleMessages
			.slice(viewportStart)
			.forEach((msg: ClineMessage) => everVisibleMessagesTsRef.current.set(msg.ts, true))

		return newVisibleMessages
	}, [modifiedMessages])

	// kilocode_change start
	const OLDER_MESSAGES_AUTO_COLLAPSE_THRESHOLD = 200
	const OLDER_MESSAGES_COLLAPSED_TAIL_COUNT = 120
	const COLLAPSED_OLDER_MESSAGES_TS = Number.MIN_SAFE_INTEGER + 4242

	useEffect(() => {
		// Reset for each new task
		userExpandedOlderMessagesRef.current = false
		setOlderMessagesCollapsed(false)
	}, [task?.ts])

	useEffect(() => {
		if (!task) return
		const shouldAutoCollapse = isCondensing || visibleMessages.length > OLDER_MESSAGES_AUTO_COLLAPSE_THRESHOLD
		if (shouldAutoCollapse && !userExpandedOlderMessagesRef.current) {
			setOlderMessagesCollapsed(true)
		}
	}, [task, isCondensing, visibleMessages.length])
	// kilocode_change end

	useEffect(() => {
		const cleanupInterval = setInterval(() => {
			const cache = everVisibleMessagesTsRef.current
			const currentMessageIds = new Set(modifiedMessages.map((m: ClineMessage) => m.ts))
			const viewportMessages = visibleMessages.slice(Math.max(0, visibleMessages.length - 100))
			const viewportMessageIds = new Set(viewportMessages.map((m: ClineMessage) => m.ts))

			cache.forEach((_value: boolean, key: number) => {
				if (!currentMessageIds.has(key) && !viewportMessageIds.has(key)) {
					cache.delete(key)
				}
			})
		}, 60000)

		return () => clearInterval(cleanupInterval)
	}, [modifiedMessages, visibleMessages])

	useDebounceEffect(
		() => {
			if (!isHidden && !sendingDisabled && !enableButtons) {
				textAreaRef.current?.focus()
			}
		},
		50,
		[isHidden, sendingDisabled, enableButtons],
	)

	useEffect(() => {
		// This ensures the first message is not read, future user messages are
		// labeled as `user_feedback`.
		if (lastMessage && messages.length > 1) {
			if (
				lastMessage.text && // has text
				(lastMessage.say === "text" || lastMessage.say === "completion_result") && // is a text message
				!lastMessage.partial && // not a partial message
				typeof lastMessage.text === "string" && // kilocode_change: is a string
				!lastMessage.text.startsWith("{") // not a json object
			) {
				let text = lastMessage?.text || ""
				const mermaidRegex = /```mermaid[\s\S]*?```/g
				// remove mermaid diagrams from text
				text = text.replace(mermaidRegex, "")
				// remove markdown from text
				text = removeMd(text)

				// ensure message is not a duplicate of last read message
				if (text !== lastTtsRef.current) {
					try {
						playTts(text)
						lastTtsRef.current = text
					} catch (error) {
						console.error("Failed to execute text-to-speech:", error)
					}
				}
			}
		}

		// Update previous value.
		setWasStreaming(isStreaming)
	}, [isStreaming, lastMessage, wasStreaming, messages.length])

	// kilocode_change: browser session banner removed

	const groupedMessages = useMemo(() => {
		// kilocode_change: browser session filtering removed
		const base: ClineMessage[] = visibleMessages

		let result: ClineMessage[] = base

		if (olderMessagesCollapsed && base.length > OLDER_MESSAGES_AUTO_COLLAPSE_THRESHOLD) {
			const head = base[0] ? [base[0]] : []
			const tailStart = Math.max(1, base.length - OLDER_MESSAGES_COLLAPSED_TAIL_COUNT)
			const tail = base.slice(tailStart)
			const hiddenCount = Math.max(0, base.length - head.length - tail.length)

			if (hiddenCount > 0) {
				result = [
					...head,
					{
						type: "say",
						say: "collapsed_older_messages",
						ts: COLLAPSED_OLDER_MESSAGES_TS,
						text: JSON.stringify({ hiddenCount }),
					} as any,
					...tail,
				]
			}
		}

		if (isCondensing) {
			result = [
				...result,
				{
					type: "say",
					say: "condense_context",
					ts: condensingMessageTs as number,
					partial: true,
				} as any,
			]
		}
		return result
	}, [
		isCondensing,
		visibleMessages,
		condensingMessageTs,
		olderMessagesCollapsed,
		OLDER_MESSAGES_AUTO_COLLAPSE_THRESHOLD,
		OLDER_MESSAGES_COLLAPSED_TAIL_COUNT,
		COLLAPSED_OLDER_MESSAGES_TS,
	])

	// scrolling

	const scrollToBottomSmooth = useMemo(
		() =>
			debounce(
				() =>
					requestAnimationFrame(() =>
						virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "smooth" }),
					),
				10,
				{
					immediate: true,
				},
			),
		[],
	)

	useEffect(() => {
		return () => {
			if (scrollToBottomSmooth && typeof (scrollToBottomSmooth as any).cancel === "function") {
				;(scrollToBottomSmooth as any).cancel()
			}
		}
	}, [scrollToBottomSmooth])

	const scrollToBottomAuto = useCallback(() => {
		requestAnimationFrame(() => {
			virtuosoRef.current?.scrollTo({
				top: Number.MAX_SAFE_INTEGER,
				behavior: "auto", // Instant causes crash.
			})
		})
	}, [])

	// kilocode_change start
	// Animated "blink" to highlight a specific message. Used by the TaskTimeline
	const highlightClearTimerRef = useRef<NodeJS.Timeout | undefined>()
	const [highlightedMessageIndex, setHighlightedMessageIndex] = useState<number | null>(null)
	const handleMessageClick = useCallback((index: number) => {
		setHighlightedMessageIndex(index)
		virtuosoRef.current?.scrollToIndex({ index, align: "end", behavior: "smooth" })

		// Clear existing timer if present
		if (highlightClearTimerRef.current) {
			clearTimeout(highlightClearTimerRef.current)
		}
		highlightClearTimerRef.current = setTimeout(() => {
			setHighlightedMessageIndex(null)
			highlightClearTimerRef.current = undefined
		}, 1000)
	}, [])

	// Cleanup highlight timer on unmount
	useEffect(() => {
		return () => {
			if (highlightClearTimerRef.current) {
				clearTimeout(highlightClearTimerRef.current)
			}
		}
	}, [])
	// kilocode_change end

	const handleSetExpandedRow = useCallback(
		(ts: number, expand?: boolean) => {
			setExpandedRows((prev: Record<number, boolean>) => ({
				...prev,
				[ts]: expand === undefined ? !prev[ts] : expand,
			}))
		},
		[setExpandedRows], // setExpandedRows is stable
	)

	// Scroll when user toggles certain rows.
	const toggleRowExpansion = useCallback(
		(ts: number) => {
			handleSetExpandedRow(ts)
			// The logic to set disableAutoScrollRef.current = true on expansion
			// is now handled by the useEffect hook that observes expandedRows.
		},
		[handleSetExpandedRow],
	)

	const handleRowHeightChange = useCallback(
		(isTaller: boolean) => {
			if (isAtBottom) {
				if (isTaller) {
					scrollToBottomSmooth()
				} else {
					setTimeout(() => scrollToBottomAuto(), 0)
				}
			}
		},
		[scrollToBottomSmooth, scrollToBottomAuto, isAtBottom],
	)

	// Disable sticky follow when user scrolls up inside the chat container
	const handleWheel = useCallback((event: Event) => {
		const wheelEvent = event as WheelEvent
		if (wheelEvent.deltaY < 0 && scrollContainerRef.current?.contains(wheelEvent.target as Node)) {
			stickyFollowRef.current = false
		}
	}, [])
	useEvent("wheel", handleWheel, window, { passive: true })

	// Also disable sticky follow when the chat container is scrolled away from bottom
	useEffect(() => {
		const el = virtuosoScrollerRef.current // kilocode_change
		if (!el) return
		const onScroll = () => {
			// Consider near-bottom within a small threshold consistent with Virtuoso settings
			const nearBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 10
			if (!nearBottom) {
				stickyFollowRef.current = false
			}
			// Keep UI button state in sync with scroll position
			setShowScrollToBottom(!nearBottom)
		}
		el.addEventListener("scroll", onScroll, { passive: true })
		return () => el.removeEventListener("scroll", onScroll)
	}, [])

	//kilocode_change
	// Effect to clear checkpoint warning when messages appear or task changes
	useEffect(() => {
		if (isHidden || !task) {
			setCheckpointWarning(undefined)
		}
	}, [modifiedMessages.length, isStreaming, isHidden, task])

	const placeholderText = task ? t("chat:typeMessage") : t("chat:typeTask")

	const switchToMode = useCallback(
		(modeSlug: string): void => {
			// Update local state and notify extension to sync mode change.
			setMode(modeSlug)

			// Send the mode switch message.
			vscode.postMessage({ type: "mode", text: modeSlug })
		},
		[setMode],
	)

	const handleSuggestionClickInRow = useCallback(
		(suggestion: SuggestionItem, event?: React.MouseEvent) => {
			// Mark that user has responded if this is a manual click (not auto-approval)
			if (event) {
				userRespondedRef.current = true
			}

			// Mark the current follow-up question as answered when a suggestion is clicked
			if (clineAsk === "followup" && !event?.shiftKey) {
				markFollowUpAsAnswered()
			}

			// Check if we need to switch modes
			if (suggestion.mode) {
				// Only switch modes if it's a manual click (event exists) or auto-approval is allowed
				const isManualClick = !!event
				if (isManualClick || alwaysAllowModeSwitch) {
					// Switch mode without waiting
					switchToMode(suggestion.mode)
				}
			}

			if (event?.shiftKey) {
				// Always append to existing text, don't overwrite
				setInputValue((currentValue: string) => {
					return currentValue !== "" ? `${currentValue} \n${suggestion.answer}` : suggestion.answer
				})
			} else {
				// Don't clear the input value when sending a follow-up choice
				// The message should be sent but the text area should preserve what the user typed
				const preservedInput = inputValueRef.current
				handleSendMessage(suggestion.answer, [])
				// Restore the input value after sending
				setInputValue(preservedInput)
			}
		},
		[handleSendMessage, setInputValue, switchToMode, alwaysAllowModeSwitch, clineAsk, markFollowUpAsAnswered],
	)

	const handleBatchFileResponse = useCallback((response: { [key: string]: boolean }) => {
		// Handle batch file response, e.g., for file uploads
		vscode.postMessage({ type: "askResponse", askResponse: "objectResponse", text: JSON.stringify(response) })
	}, [])

	const handleShowOlderMessages = useCallback(() => {
		userExpandedOlderMessagesRef.current = true
		setOlderMessagesCollapsed(false)
		requestAnimationFrame(() => {
			virtuosoRef.current?.scrollToIndex({ index: 0, align: "start", behavior: "auto" })
		})
	}, [])

	const handleCollapseOlderMessages = useCallback(() => {
		setOlderMessagesCollapsed(true)
		requestAnimationFrame(() => {
			scrollToBottomAuto()
		})
	}, [scrollToBottomAuto])

	const itemContent = useCallback(
		(index: number, messageOrGroup: ClineMessage) => {
			const hasCheckpoint = modifiedMessages.some((message) => message.say === "checkpoint_saved")

			// kilocode_change: collapsed older messages marker row
			if (messageOrGroup.type === "say" && (messageOrGroup as any).say === "collapsed_older_messages") {
				let hiddenCount = 0
				try {
					hiddenCount = JSON.parse(messageOrGroup.text || "{}").hiddenCount ?? 0
				} catch {
					// ignore
				}
				return (
					<div key={messageOrGroup.ts} data-testid="collapsed-older-messages" className="px-4 py-3">
						<button
							className="w-full rounded-md border border-vscode-widget-border bg-vscode-editor-background/60 hover:bg-vscode-editor-background/80 transition-colors duration-150 px-3 py-2 text-sm text-vscode-editor-foreground"
							onClick={handleShowOlderMessages}>
							{t("chat:task.seeMore")} ({hiddenCount})
						</button>
					</div>
				)
			}

			// kilocode_change: browser action rows removed

			// regular message
			return (
				<ChatRow
					key={messageOrGroup.ts}
					message={messageOrGroup}
					isExpanded={expandedRows[messageOrGroup.ts] || false}
					onToggleExpand={toggleRowExpansion} // This was already stabilized
					lastModifiedMessage={modifiedMessages.at(-1)} // Original direct access
					isLast={index === groupedMessages.length - 1} // Original direct access
					onHeightChange={handleRowHeightChange}
					isStreaming={isStreaming}
					onSuggestionClick={handleSuggestionClickInRow} // This was already stabilized
					onBatchFileResponse={handleBatchFileResponse}
					highlighted={highlightedMessageIndex === index} // kilocode_change: add highlight prop
					enableCheckpoints={enableCheckpoints} // kilocode_change
					isFollowUpAnswered={messageOrGroup.isAnswered === true || messageOrGroup.ts === currentFollowUpTs}
					isFollowUpAutoApprovalPaused={isFollowUpAutoApprovalPaused}
					editable={
						messageOrGroup.type === "ask" &&
						messageOrGroup.ask === "tool" &&
						(() => {
							let tool: any = {}
							try {
								tool = JSON.parse(messageOrGroup.text || "{}")
							} catch (_) {
								if (messageOrGroup.text?.includes("updateTodoList")) {
									tool = { tool: "updateTodoList" }
								}
							}
							if (tool.tool === "updateTodoList" && alwaysAllowUpdateTodoList) {
								return false
							}
							return tool.tool === "updateTodoList" && enableButtons && !!primaryButtonText
						})()
					}
					hasCheckpoint={hasCheckpoint}
				/>
			)
		},
		[
			expandedRows,
			toggleRowExpansion,
			modifiedMessages,
			groupedMessages.length,
			handleRowHeightChange,
			isStreaming,
			handleSuggestionClickInRow,
			handleBatchFileResponse,
			highlightedMessageIndex, // kilocode_change: add highlightedMessageIndex
			enableCheckpoints, // kilocode_change
			currentFollowUpTs,
			isFollowUpAutoApprovalPaused,
			alwaysAllowUpdateTodoList,
			enableButtons,
			primaryButtonText,
			handleShowOlderMessages,
		],
	)

	// Function to handle mode switching
	const switchToNextMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentModeIndex = allModes.findIndex((m) => m.slug === mode)
		const nextModeIndex = (currentModeIndex + 1) % allModes.length
		// Update local state and notify extension to sync mode change
		switchToMode(allModes[nextModeIndex].slug)
	}, [mode, customModes, switchToMode])

	// Function to handle switching to previous mode
	const switchToPreviousMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentModeIndex = allModes.findIndex((m) => m.slug === mode)
		const previousModeIndex = (currentModeIndex - 1 + allModes.length) % allModes.length
		// Update local state and notify extension to sync mode change
		switchToMode(allModes[previousModeIndex].slug)
	}, [mode, customModes, switchToMode])

	// Add keyboard event handler
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			// Check for Command/Ctrl + Period (with or without Shift)
			// Using event.key to respect keyboard layouts (e.g., Dvorak)
			if ((event.metaKey || event.ctrlKey) && event.key === ".") {
				event.preventDefault() // Prevent default browser behavior

				if (event.shiftKey) {
					// Shift + Period = Previous mode
					switchToPreviousMode()
				} else {
					// Just Period = Next mode
					switchToNextMode()
				}
			}
		},
		[switchToNextMode, switchToPreviousMode],
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("wheel", handleWheel, { passive: true }) // kilocode_change
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("wheel", handleWheel) // kilocode_change
		}
	}, [handleKeyDown, handleWheel]) // kilocode_change

	useImperativeHandle(ref, () => ({
		acceptInput: () => {
			if (enableButtons && primaryButtonText) {
				handlePrimaryButtonClick(inputValue, selectedImages)
			} else if (!sendingDisabled && !isProfileDisabled && (inputValue.trim() || selectedImages.length > 0)) {
				handleSendMessage(inputValue, selectedImages)
			}
		},
		// kilocode_change start
		focusInput: () => {
			if (textAreaRef.current) {
				textAreaRef.current.focus()
			}
		},
		// kilocode_change end
	}))

	const handleCondenseContext = (taskId: string) => {
		if (isCondensing || sendingDisabled) {
			return
		}
		setIsCondensing(true)
		setSendingDisabled(true)
		vscode.postMessage({ type: "condenseTaskContextRequest", text: taskId })
	}

	const areButtonsVisible = primaryButtonText || secondaryButtonText || isStreaming

	return (
		<div
			data-testid="chat-view"
			className={
				isHidden
					? "hidden"
					: "fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-hidden text-sm"
			}>
			{(showAnnouncement || showAnnouncementModal) && <Announcement hideAnnouncement={hideAnnouncement} />}
			{experiments?.multipleConcurrentTasks && activeTasks && activeTasks.length > 0 && (
				<TaskTabsBar tasks={activeTasks} />
			)} {/* kilocode_change */}
			{task ? (
				<>
					{/* kilocode_change start */}
					{/* <TaskHeader
						task={task}
						tokensIn={apiMetrics.totalTokensIn}
						tokensOut={apiMetrics.totalTokensOut}
						cacheWrites={apiMetrics.totalCacheWrites}
						cacheReads={apiMetrics.totalCacheReads}
						totalCost={apiMetrics.totalCost}
						contextTokens={apiMetrics.contextTokens}
						buttonsDisabled={sendingDisabled}
						handleCondenseContext={handleCondenseContext}
						todos={latestTodos}
					/> */}
					{/* kilocode_change start */}

					{hasSystemPromptOverride && (
						<div className="px-3">
							<SystemPromptWarning />
						</div>
					)}

					{checkpointWarning && (
						<div className="px-3">
							<CheckpointWarning warning={checkpointWarning} />
						</div>
					)}
				</>
			) : (
				<div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 relative">
					{/* Moved Task Bar Header Here */}
					{taskHistoryFullLength !== 0 && (
						<div className="flex text-vscode-descriptionForeground w-full mx-auto px-5 pt-3">
							<div className="flex items-center gap-1 cursor-pointer" onClick={toggleExpanded}>
								{taskHistoryFullLength < 10 && (
									<span className={`font-medium text-xs `}>{t("history:recentTasks")}</span>
								)}
								<span
									className={`codicon  ${isExpanded ? "codicon-eye" : "codicon-eye-closed"} scale-90`}
								/>
							</div>
						</div>
					)}
					{/* kilocode_change start: changed the classes to support notifications */}
					<div className="w-full h-full flex flex-col gap-4 px-3.5 transition-all duration-300">
						{/* kilocode_change end */}
						{/* Version indicator in top-right corner - only on welcome screen */}
						{/* kilocode_change: do not show */}
						{/* <VersionIndicator
							onClick={() => setShowAnnouncementModal(true)}
							className="absolute top-2 right-3 z-10"
						/>

						<RooHero /> */}

						{/* kilocode_change start: KilocodeNotifications + Layout fixes */}
						<KilocodeNotifications />
						<div className="flex flex-grow flex-col justify-center gap-4">
							{/* kilocode_change end */}
							<p className="text-vscode-editor-foreground leading-normal font-vscode-font-family text-center text-balance max-w-[380px] mx-auto my-0">
								<Trans
									i18nKey="chat:about"
									components={{
										DocsLink: (
											<a
												href={buildDocLink("", "welcome")}
												target="_blank"
												rel="noopener noreferrer">
												the docs
											</a>
										),
									}}
								/>
							</p>
							{taskHistoryFullLength === 0 && <IdeaSuggestionsBox />} {/* kilocode_change */}
							{/*<div className="mb-2.5">
								{cloudIsAuthenticated || taskHistory.length < 4 ? <RooTips /> : <RooCloudCTA />}
							</div> kilocode_change: do not show */}
							{/* Show the task history preview if expanded and tasks exist */}
							{taskHistoryFullLength > 0 && isExpanded && (
								<HistoryPreview taskHistoryVersion={taskHistoryVersion} />
							)}
							{/* kilocode_change start: KilocodeNotifications + Layout fixes */}
						</div>
						{/* kilocode_change end */}
					</div>
				</div>
			)}

			{/*
			// Flex layout explanation:
			// 1. Content div above uses flex: "1 1 0" to:
			//    - Grow to fill available space (flex-grow: 1)
			//    - Shrink when AutoApproveMenu needs space (flex-shrink: 1)
			//    - Start from zero size (flex-basis: 0) to ensure proper distribution
			//    minHeight: 0 allows it to shrink below its content height
			//
			// 2. AutoApproveMenu uses flex: "0 1 auto" to:
			//    - Not grow beyond its content (flex-grow: 0)
			//    - Shrink when viewport is small (flex-shrink: 1)
			//    - Use its content size as basis (flex-basis: auto)
			//    This ensures it takes its natural height when there's space
			//    but becomes scrollable when the viewport is too small
			*/}
			{/* kilocode_change: added settings toggle for this */}
			{!task && showAutoApproveMenu && (
				<div className="mb-1 flex-initial min-h-0">
					<AutoApproveMenu />
				</div>
			)}

			{task && (
				<>
					{/* kilocode_change: 在开发模式下添加调试组件 */}
					{process.env.NODE_ENV === "development" && <ChatViewDebug />}
					<div className="grow flex flex-col min-h-0" ref={scrollContainerRef}>
						<div className="flex-auto min-h-0">
							<ChatRowErrorBoundary>
								<Virtuoso
									ref={virtuosoRef}
									key={task.ts}
									className="scrollable grow overflow-y-scroll"
									increaseViewportBy={{ top: 400, bottom: 0 }} // kilocode_change: remove bottom viewport to fix spacing at bottom
								data={groupedMessages}
								computeItemKey={(_index: number, item: ClineMessage) => String(item.ts)} // kilocode_change: 返回稳定的字符串key
								itemContent={itemContent}
								followOutput={(isAtBottom: boolean) => isAtBottom || stickyFollowRef.current}
								atBottomStateChange={(isAtBottom: boolean) => {
									setIsAtBottom(isAtBottom)
									// Only show the scroll-to-bottom button if not at bottom
									setShowScrollToBottom(!isAtBottom)
								}}
								atBottomThreshold={10}
								initialTopMostItemIndex={groupedMessages.length - 1}
								overscan={200} // kilocode_change: 添加overscan以提升性能
								components={virtuosoComponents}
							/>
							</ChatRowErrorBoundary>
						</div>
					</div>
					<div className={`flex-initial min-h-0 ${!areButtonsVisible ? "mb-1" : ""}`}>
						{/* kilocode_change: added settings toggle for this */}
						{showAutoApproveMenu && <AutoApproveMenu />}
					</div>
					{/* kilocode_change: Floating scroll-to-bottom button - overlay style */}
					{showScrollToBottom && (
						<StandardTooltip content={t("chat:scrollToBottom")}>
							<button
								className="fixed bottom-32 right-6 w-10 h-10 rounded-full bg-vscode-editor-background/80 backdrop-blur-sm border border-vscode-widget-border hover:bg-vscode-editor-background/90 transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl z-50 animate-fade-in"
								onClick={() => {
									// Engage sticky follow until user scrolls up
									stickyFollowRef.current = true
									// Pin immediately to avoid lag during fast streaming
									scrollToBottomAuto()
									// Hide button immediately to prevent flash
									setShowScrollToBottom(false)
								}}>
								<span className="codicon codicon-chevron-down text-vscode-editor-foreground"></span>
							</button>
						</StandardTooltip>
					)}
					{areButtonsVisible && !showScrollToBottom && (
						<div
							className={`flex h-9 items-center mb-1 px-[15px] ${
								enableButtons || (isStreaming && !didClickCancel)
									? "opacity-100"
									: "opacity-50"
							}`}>
							{primaryButtonText && !isStreaming && (
								<StandardTooltip
									content={
										primaryButtonText === t("chat:retry.title")
											? t("chat:retry.tooltip")
											: primaryButtonText === t("chat:save.title")
												? t("chat:save.tooltip")
												: primaryButtonText === t("chat:approve.title")
													? t("chat:approve.tooltip")
													: primaryButtonText === t("chat:runCommand.title")
														? t("chat:runCommand.tooltip")
														: primaryButtonText === t("chat:startNewTask.title")
															? t("chat:startNewTask.tooltip")
															: primaryButtonText ===
																	t("chat:proceedAnyways.title")
																? t("chat:proceedAnyways.tooltip")
																: primaryButtonText ===
																		t("chat:proceedWhileRunning.title")
																	? t("chat:proceedWhileRunning.tooltip")
																	: undefined
									}>
									<Button
										disabled={!enableButtons}
										className={secondaryButtonText ? "flex-1 mr-[6px]" : "flex-[2] mr-0"}
										onClick={() => handlePrimaryButtonClick(inputValue, selectedImages)}>
										{primaryButtonText}
									</Button>
								</StandardTooltip>
							)}
							{secondaryButtonText && !isStreaming && (
								<StandardTooltip
									content={
										secondaryButtonText === t("chat:startNewTask.title")
											? t("chat:startNewTask.tooltip")
											: secondaryButtonText === t("chat:reject.title")
												? t("chat:reject.tooltip")
												: undefined
									}>
									<Button
										disabled={!enableButtons}
										className="flex-1 ml-[6px]"
										onClick={() => handleSecondaryButtonClick(inputValue, selectedImages)}>
										{secondaryButtonText}
									</Button>
								</StandardTooltip>
							)}
						</div>
					)}
				</>
			)}

			<QueuedMessages
				queue={messageQueue}
				onRemove={(index) => {
					if (messageQueue[index]) {
						vscode.postMessage({ type: "removeQueuedMessage", text: messageQueue[index].id })
					}
				}}
				onUpdate={(index, newText) => {
					if (messageQueue[index]) {
						vscode.postMessage({
							type: "editQueuedMessage",
							payload: { id: messageQueue[index].id, text: newText, images: messageQueue[index].images },
						})
					}
				}}
			/>
			<ChatTextArea
				ref={textAreaRef}
				inputValue={inputValue}
				setInputValue={setInputValue}
				sendingDisabled={sendingDisabled || isProfileDisabled}
				selectApiConfigDisabled={sendingDisabled && clineAsk !== "api_req_failed"}
				placeholderText={placeholderText}
				selectedImages={selectedImages}
				setSelectedImages={setSelectedImages}
				onSend={() => handleSendMessage(inputValue, selectedImages)}
				isTaskRunning={isTaskRunningForInput}
				onCancelTask={() => handleSecondaryButtonClick(inputValue, selectedImages)}
				cancelDisabled={didClickCancel}
				onSelectImages={selectImages}
				shouldDisableImages={shouldDisableImages}
				onHeightChange={() => {
					if (isAtBottom) {
						scrollToBottomAuto()
					}
				}}
				mode={mode}
				setMode={setMode}
				modeShortcutText={modeShortcutText}
				sendMessageOnEnter={sendMessageOnEnter} // kilocode_change
				showBrowserDockToggle={showBrowserDockToggle}
				contextTokens={apiMetrics.contextTokens} // kilocode_change: pass context tokens to ChatTextArea
			/>
			{/* kilocode_change: added settings toggle the profile and model selection */}
			<BottomControls showApiConfig />
			{/* kilocode_change: end */}

			{/* kilocode_change: disable {isProfileDisabled && (
				<div className="px-3">
					<ProfileViolationWarning />
				</div>
			)} */}

			<div id="roo-portal" />
			{/* kilocode_change: disable  */}
			{/* <CloudUpsellDialog open={isUpsellOpen} onOpenChange={closeUpsell} onConnect={handleConnect} /> */}
		</div>
	)
}

const ChatView = forwardRef(ChatViewComponent)

export default ChatView
