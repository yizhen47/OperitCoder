import { memo, useEffect, useRef, useState } from "react"
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

	useEffect(() => {
		// kilocode_change start
		// IMPORTANT: do not structurally mutate the DOM produced by ReactMarkdown.
		// The previous implementation wrapped/rewrote text nodes (splitText/replaceWith)
		// to create a per-character streaming reveal animation. With react-virtuoso
		// frequently mounting/unmounting rows during streaming, this caused React to
		// attempt to remove nodes that were already replaced, triggering:
		// NotFoundError: Failed to execute 'removeChild' on 'Node'.
		//
		// We keep streaming behavior but disable DOM-level per-character animation.
		if (partial !== true) {
			prevRenderedTextRef.current = ""
			return
		}
		prevRenderedTextRef.current = markdown ?? ""
		// kilocode_change end
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
