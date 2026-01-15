// kilocode_change - new file

import { useEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

interface ToolResultBlockProps {
	title: string
	subtitle?: string
	content?: string
	isPartial: boolean
	isError: boolean
}

export const ToolResultBlock = ({
	title,
	subtitle,
	content,
	isPartial,
	isError,
}: ToolResultBlockProps) => {
	const isActive = isPartial
	const [isCollapsed, setIsCollapsed] = useState(() => (isActive ? false : true))
	const wasActiveRef = useRef(isActive)

	useEffect(() => {
		if (isActive) {
			setIsCollapsed(false)
		}
	}, [isActive])

	useEffect(() => {
		if (wasActiveRef.current && !isActive) {
			setIsCollapsed(true)
		}
		wasActiveRef.current = isActive
	}, [isActive])

	const statusChar = isActive ? "…" : isError ? "×" : "√"

	const handleToggle = () => {
		setIsCollapsed((v) => !v)
	}

	return (
		<div className="group">
			<div className="flex items-center justify-between pr-2 cursor-pointer select-none" onClick={handleToggle}>
				<div className="flex items-center gap-2 min-w-0">
					<ChevronRight className={cn("w-3 transition-transform", !isCollapsed && "rotate-90")} />
					<span className="text-xs text-vscode-descriptionForeground">
						{statusChar}
					</span>
					<span className="font-normal text-xs text-vscode-descriptionForeground">{title}</span>
					{subtitle && (
						<span className="text-xs text-vscode-descriptionForeground whitespace-nowrap overflow-hidden text-ellipsis">
							{subtitle}
						</span>
					)}
				</div>
			</div>
			{(isActive || (content?.trim()?.length ?? 0) > 0) && (
				<div
					data-testid="tool-result-content"
					className={cn(
						"mt-1 ml-2 scrollable rounded-md border border-vscode-panel-border/50 bg-vscode-editor-background/30 transition-all duration-200 ease-out text-vscode-descriptionForeground",
						isCollapsed
							? "max-h-0 overflow-hidden opacity-0 -translate-y-1 px-0 py-0 pointer-events-none"
							: "max-h-40 overflow-y-auto opacity-100 translate-y-0 px-3 py-2 pointer-events-auto",
					)}
				>
					{isActive && (content?.trim()?.length ?? 0) === 0 ? (
						<div
							data-testid="tool-result-loading"
							className={cn(
								"h-3 w-full rounded",
								"bg-[linear-gradient(90deg,rgba(255,255,255,0.06),rgba(255,255,255,0.22),rgba(255,255,255,0.06))]",
								"animate-pulse",
							)}
						/>
					) : (
						<div className="text-xs whitespace-pre-wrap break-words">{content}</div>
					)}
				</div>
			)}
		</div>
	)
}
