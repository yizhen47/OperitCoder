import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@src/context/ExtensionStateContext"

import MarkdownBlock from "../common/MarkdownBlock"
import { Lightbulb, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReasoningBlockProps {
	content: string
	ts: number
	isPartial: boolean
	metadata?: any
}

export const ReasoningBlock = ({ content, ts, isPartial, metadata }: ReasoningBlockProps) => {
	const { t } = useTranslation()
	const { reasoningBlockCollapsed } = useExtensionState()
	const isActive = isPartial
	const persistedDurationMs: number | undefined = metadata?.reasoningDurationMs
	const persistedStartedAtMs: number | undefined = metadata?.reasoningStartedAtMs
	const prevRenderedTextRef = useRef("")

	// kilocode_change start
	// Default to expanded while streaming, otherwise follow the user's preference.
	const [isCollapsed, setIsCollapsed] = useState(() => (isActive ? false : (reasoningBlockCollapsed ?? false)))

	// Use the message timestamp (ts) as the start reference to avoid timer drift on re-mounts.
	const startTimeRef = useRef<number>(persistedStartedAtMs ?? ts)
	const [elapsed, setElapsed] = useState<number>(() => {
		if (typeof persistedDurationMs === "number") {
			return persistedDurationMs
		}
		if (isActive) {
			return Math.max(0, Date.now() - (persistedStartedAtMs ?? ts))
		}
		return 0
	})
	const contentRef = useRef<HTMLDivElement>(null)
	const wasActiveRef = useRef(isActive)
	// kilocode_change end

	useEffect(() => {
		if (!isActive) {
			setIsCollapsed(reasoningBlockCollapsed ?? false)
		}
	}, [reasoningBlockCollapsed, isActive])

	useEffect(() => {
		startTimeRef.current = persistedStartedAtMs ?? ts
	}, [persistedStartedAtMs, ts])

	useEffect(() => {
		if (isActive) {
			setIsCollapsed(false)
			const tick = () => setElapsed(Math.max(0, Date.now() - startTimeRef.current))
			tick()
			const id = setInterval(tick, 1000)
			return () => clearInterval(id)
		}
	}, [isActive])

	// Auto-collapse when streaming ends
	useEffect(() => {
		if (wasActiveRef.current && !isActive) {
			const finalElapsed =
				typeof persistedDurationMs === "number"
					? persistedDurationMs
					: Math.max(0, Date.now() - startTimeRef.current)
			setElapsed(finalElapsed)
			setIsCollapsed(true)
		}
		wasActiveRef.current = isActive
	}, [isActive, persistedDurationMs])

	// kilocode_change: Fixed removeChild error by avoiding direct DOM manipulation
	// The original implementation used useLayoutEffect to directly manipulate DOM nodes,
	// which conflicts with React's reconciliation and react-virtuoso's virtual scrolling.
	// This can cause "Failed to execute 'removeChild' on 'Node'" errors when:
	// 1. The component is unmounted by react-virtuoso
	// 2. react-markdown modifies the DOM structure
	// 3. Multiple rapid updates occur during streaming
	//
	// Solution: Use React state to control animation classes instead of direct DOM manipulation.
	// The streaming reveal animation is now handled purely through CSS classes.
	useEffect(() => {
		// Track when streaming ends to clean up animation state
		if (!isActive) {
			prevRenderedTextRef.current = ""
			return
		}

		// Update the previous text reference for next comparison
		const currentText = content ?? ""
		const prevText = prevRenderedTextRef.current

		// Only update if there's new content
		if (currentText.length > prevText.length && currentText.startsWith(prevText)) {
			prevRenderedTextRef.current = currentText
		}
	}, [content, isActive])

	useEffect(() => {
		if (!isActive || isCollapsed) {
			return
		}

		const el = contentRef.current
		if (!el) {
			return
		}

		const rafId = requestAnimationFrame(() => {
			el.scrollTop = el.scrollHeight
		})

		return () => cancelAnimationFrame(rafId)
	}, [content, isActive, isCollapsed])

	const seconds = Math.floor(elapsed / 1000)
	const secondsLabel = t("chat:reasoning.seconds", { count: seconds })
	const shouldShowSeconds = isActive || elapsed > 0 || typeof persistedDurationMs === "number"

	const handleToggle = () => {
		setIsCollapsed(!isCollapsed)
	}

	return (
		<div className="group">
			<div
				className="flex items-center justify-between pr-2 cursor-pointer select-none"
				onClick={handleToggle}>
				<div className="flex items-center gap-2">
					<Lightbulb className="w-3" />
					<span className="font-normal text-xs text-vscode-descriptionForeground">{t("chat:reasoning.thinking")}</span>
					{shouldShowSeconds && (
						<span className="text-xs text-vscode-descriptionForeground">{secondsLabel}</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<ChevronUp
						className={cn(
							"w-3 transition-all opacity-0 group-hover:opacity-100",
							isCollapsed && "-rotate-180",
						)}
					/>
				</div>
			</div>
			{(content?.trim()?.length ?? 0) > 0 && (
				<div
					ref={contentRef}
					data-testid="reasoning-content"
					className={cn(
						"reasoning-small ml-2 scrollable rounded-md text-vscode-descriptionForeground transition-all duration-200 ease-out",
						isCollapsed
							? "max-h-0 overflow-hidden opacity-0 -translate-y-1 mt-0 px-0 py-0 border-0 bg-transparent pointer-events-none"
							: "max-h-40 overflow-y-auto opacity-100 translate-y-0 mt-1 px-3 py-2 border border-vscode-panel-border/50 bg-vscode-editor-background/30 pointer-events-auto",
					)}>
					<MarkdownBlock markdown={content} />
				</div>
			)}
		</div>
	)
}
