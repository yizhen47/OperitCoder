import { useEffect, useRef, useState } from "react"
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
			{(content?.trim()?.length ?? 0) > 0 && !isCollapsed && (
				<div
					ref={contentRef}
					data-testid="reasoning-content"
					className="reasoning-small mt-1 ml-2 max-h-40 overflow-y-auto scrollable rounded-md border border-vscode-panel-border/50 bg-vscode-editor-background/30 px-3 py-2 text-vscode-descriptionForeground">
					<MarkdownBlock markdown={content} />
				</div>
			)}
		</div>
	)
}
