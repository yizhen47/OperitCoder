import { memo, useLayoutEffect, useRef, useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import { useCopyToClipboard } from "@src/utils/clipboard"
import { StandardTooltip } from "@src/components/ui"

import MarkdownBlock from "../common/MarkdownBlock"

export const Markdown = memo(({ markdown, partial }: { markdown?: string; partial?: boolean }) => {
	const [isHovering, setIsHovering] = useState(false)
	const markdownContainerRef = useRef<HTMLDivElement | null>(null)
	const prevRenderedTextRef = useRef("")

	// Shorter feedback duration for copy button flash.
	const { copyWithFeedback } = useCopyToClipboard(200)

	useLayoutEffect(() => {
		let rafId: number | null = null
		let cancelled = false

		if (!markdown || markdown.length === 0) {
			prevRenderedTextRef.current = ""
			return () => {
				if (rafId != null) {
					cancelAnimationFrame(rafId)
				}
				cancelled = true
			}
		}

		const container = markdownContainerRef.current
		if (!container) {
			return
		}

		const existing = container.querySelectorAll('span[data-streaming-reveal="1"]')
		for (const el of existing) {
			el.replaceWith(document.createTextNode(el.textContent ?? ""))
		}

		const currentText = container.textContent ?? ""
		const prevText = prevRenderedTextRef.current

		if (partial !== true) {
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
				span.className = "streaming-reveal-pending"
				span.dataset.streamingReveal = "1"
				span.textContent = text[j]
				frag.appendChild(span)
			}
			return frag
		}

		const startRevealAnimations = () => {
			rafId = requestAnimationFrame(() => {
				if (cancelled) {
					return
				}
				const spans = Array.from(
					container.querySelectorAll('span[data-streaming-reveal="1"]'),
				) as HTMLSpanElement[]
				for (const span of spans) {
					span.classList.remove("streaming-reveal-pending")
					span.classList.add("animate-streaming-reveal")
				}
			})
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
		startRevealAnimations()

		prevRenderedTextRef.current = currentText
		return () => {
			cancelled = true
			if (rafId != null) {
				cancelAnimationFrame(rafId)
			}
		}
	}, [markdown, partial])

	if (!markdown || markdown.length === 0) {
		return null
	}

	return (
		<div
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => setIsHovering(false)}
			style={{ position: "relative" }}>
			<div style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
				<div ref={markdownContainerRef}>
					<MarkdownBlock markdown={markdown} />
				</div>
			</div>
			{markdown && !partial && isHovering && (
				<div
					style={{
						position: "absolute",
						bottom: "-4px",
						right: "8px",
						opacity: 0,
						animation: "fadeIn 0.2s ease-in-out forwards",
						borderRadius: "4px",
					}}>
					<style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1.0; } }`}</style>
					<StandardTooltip content="Copy as markdown">
						<VSCodeButton
							className="copy-button"
							appearance="icon"
							style={{
								height: "24px",
								border: "none",
								background: "var(--vscode-editor-background)",
								transition: "background 0.2s ease-in-out",
							}}
							onClick={async () => {
								const success = await copyWithFeedback(markdown)
								if (success) {
									const button = document.activeElement as HTMLElement
									if (button) {
										button.style.background = "var(--vscode-button-background)"
										setTimeout(() => {
											button.style.background = ""
										}, 200)
									}
								}
							}}>
							<span className="codicon codicon-copy" />
						</VSCodeButton>
					</StandardTooltip>
				</div>
			)}
		</div>
	)
})
