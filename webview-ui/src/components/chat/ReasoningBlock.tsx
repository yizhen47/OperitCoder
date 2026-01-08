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

	useLayoutEffect(() => {
		const container = contentRef.current
		if (!container) {
			return
		}

		const existing = container.querySelectorAll('span[data-streaming-reveal="1"]')
		for (const el of existing) {
			el.replaceWith(document.createTextNode(el.textContent ?? ""))
		}

		const currentText = container.textContent ?? ""
		const prevText = prevRenderedTextRef.current

		if (!isActive) {
			prevRenderedTextRef.current = ""
			return
		}

		if (!currentText.startsWith(prevText) || currentText.length <= prevText.length) {
			prevRenderedTextRef.current = currentText
			return
		}

		const totalNew = currentText.length - prevText.length
		const maxAnimatedChars = 240
		const maxDelayMs = 200
		const animatedChars = Math.min(totalNew, maxAnimatedChars)
		const animateFromStart = prevText.length === 0

		let remaining = animatedChars
		const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
		const textNodes: Text[] = []
		let node = walker.nextNode()
		while (node) {
			textNodes.push(node as Text)
			node = walker.nextNode()
		}

		const makeRevealFragment = (text: string) => {
			const frag = document.createDocumentFragment()
			for (let j = 0; j < text.length; j++) {
				const span = document.createElement("span")
				span.className = "animate-streaming-reveal"
				span.dataset.streamingReveal = "1"
				span.textContent = text[j]
				frag.appendChild(span)
			}
			return frag
		}

		const applyOrderedDelays = () => {
			const spans = Array.from(container.querySelectorAll('span[data-streaming-reveal="1"]')) as HTMLSpanElement[]
			if (spans.length === 0) {
				return
			}
			const baseRect = container.getBoundingClientRect()
			const items = spans
				.map((s) => ({
					span: s,
					rect: s.getBoundingClientRect(),
				}))
				.sort((a, b) => {
					const topDiff = (a.rect.top - baseRect.top) - (b.rect.top - baseRect.top)
					if (Math.abs(topDiff) > 1) {
						return topDiff
					}
					return (a.rect.left - baseRect.left) - (b.rect.left - baseRect.left)
				})

			const lines: Array<typeof items> = []
			let currentLine: typeof items = []
			let currentTop: number | undefined
			for (const item of items) {
				const top = item.rect.top
				if (currentTop === undefined || Math.abs(top - currentTop) <= 1) {
					currentLine.push(item)
					currentTop = currentTop ?? top
					continue
				}
				lines.push(currentLine)
				currentLine = [item]
				currentTop = top
			}
			if (currentLine.length > 0) {
				lines.push(currentLine)
			}

			if (lines.length === 1) {
				const line = lines[0]
				const step = line.length > 1 ? maxDelayMs / (line.length - 1) : 0
				for (let j = 0; j < line.length; j++) {
					const delay = Math.min(maxDelayMs, j * step)
					line[j].span.style.setProperty("--streaming-reveal-delay", `${delay.toFixed(2)}ms`)
				}
				return
			}

			const lineStep = lines.length > 1 ? maxDelayMs / (lines.length - 1) : 0
			const intraLineMax = Math.min(60, lineStep * 0.5)

			for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
				const line = lines[lineIndex]
				const baseDelay = lineIndex * lineStep
				const charStep = line.length > 1 ? intraLineMax / (line.length - 1) : 0
				for (let j = 0; j < line.length; j++) {
					const delay = Math.min(maxDelayMs, baseDelay + j * charStep)
					line[j].span.style.setProperty("--streaming-reveal-delay", `${delay.toFixed(2)}ms`)
				}
			}
		}

		if (animateFromStart) {
			for (let i = 0; i < textNodes.length && remaining > 0; i++) {
				const textNode = textNodes[i]
				const len = textNode.data.length
				if (len === 0) {
					continue
				}

				if (remaining >= len) {
					textNode.replaceWith(makeRevealFragment(textNode.data))
					remaining -= len
					continue
				}

				textNode.splitText(remaining)
				textNode.replaceWith(makeRevealFragment(textNode.data))
				remaining = 0
			}
		} else {
			for (let i = textNodes.length - 1; i >= 0 && remaining > 0; i--) {
				const textNode = textNodes[i]
				const len = textNode.data.length
				if (len === 0) {
					continue
				}

				if (remaining >= len) {
					textNode.replaceWith(makeRevealFragment(textNode.data))
					remaining -= len
					continue
				}

				const splitIndex = len - remaining
				const tail = textNode.splitText(splitIndex)
				tail.replaceWith(makeRevealFragment(tail.data))
				remaining = 0
			}
		}

		applyOrderedDelays()

		prevRenderedTextRef.current = currentText
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
						"reasoning-small mt-1 ml-2 scrollable rounded-md border border-vscode-panel-border/50 bg-vscode-editor-background/30 text-vscode-descriptionForeground transition-all duration-200 ease-out",
						isCollapsed
							? "max-h-0 overflow-hidden opacity-0 -translate-y-1 px-0 py-0 pointer-events-none"
							: "max-h-40 overflow-y-auto opacity-100 translate-y-0 px-3 py-2 pointer-events-auto",
					)}>
					<MarkdownBlock markdown={content} />
				</div>
			)}
		</div>
	)
}
