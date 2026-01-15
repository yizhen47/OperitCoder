// kilocode_change - new file

import { useMemo, useState, type MouseEvent, type ReactNode } from "react"
import { ArrowRight, Code, Copy, FileText, Globe, Search, Terminal } from "lucide-react"

import { cn } from "@/lib/utils"

interface CompactToolDisplayProps {
	toolName: string
	params?: string
	expandedContent?: ReactNode
	onRowClick?: () => void
	disableExpand?: boolean
	className?: string
}

function getToolIconComponent(toolName: string) {
	const name = toolName.toLowerCase()
	// 文件工具
	if (name.includes("file") || name.includes("read") || name.includes("write")) return FileText
	// 搜索工具
	if (name.includes("search") || name.includes("find") || name.includes("query")) return Search
	// 命令行工具
	if (name.includes("terminal") || name.includes("exec") || name.includes("command") || name.includes("shell")) return Terminal
	// 代码工具
	if (name.includes("code") || name.includes("ffmpeg")) return Code
	// 网络工具
	if (name.includes("http") || name.includes("web") || name.includes("visit") || name.includes("browser")) return Globe
	// 默认图标
	return ArrowRight
}

function buildParamSummary(params: string): string {
	const raw = params.trim()
	if (!raw) return ""
	const firstParamRegex = /<param[^>]*>([^<]*)<\/param>/i
	const match = raw.match(firstParamRegex)
	const summary = (match?.[1] ?? raw).replace(/\s+/g, " ").trim()
	return summary
}

export const CompactToolDisplay = ({
	toolName,
	params,
	expandedContent,
	onRowClick,
	disableExpand,
	className,
}: CompactToolDisplayProps) => {
	const hasParams = (params?.trim()?.length ?? 0) > 0
	const hasDetails = hasParams || Boolean(expandedContent)
	const [isExpanded, setIsExpanded] = useState(false)
	const IconComp = useMemo(() => getToolIconComponent(toolName), [toolName])
	const summary = useMemo(() => (params ? buildParamSummary(params) : ""), [params])

	const handleToggle = () => {
		if (disableExpand) return
		if (!hasDetails) return
		setIsExpanded((v) => !v)
	}

	const handleRowClick = () => {
		if (onRowClick) {
			onRowClick()
			return
		}
		handleToggle()
	}

	const handleCopy = async (e: MouseEvent) => {
		e.stopPropagation()
		try {
			if (typeof navigator === "undefined") return
			if (!navigator.clipboard?.writeText) return
			await navigator.clipboard.writeText(params ?? "")
		} catch {
			// ignore
		}
	}

	return (
		<div className={cn("w-full", className)}>
			<div
				className={cn(
					"w-full flex items-center rounded-[4px] select-none",
					onRowClick || (hasDetails && !disableExpand) ? "cursor-pointer" : "cursor-default",
					"pt-[4px] pb-0",
				)}
				onClick={handleRowClick}
				data-testid="tool-call-toggle">
				<IconComp
					className="w-4 h-4 shrink-0"
					style={{ color: "var(--vscode-textLink-foreground)", opacity: 0.7 }}
				/>
				<div className="w-2 shrink-0" />
				<span
					className="text-xs font-medium shrink-0 min-w-[80px] max-w-[120px] truncate"
					style={{ color: "var(--vscode-textLink-foreground)" }}>
					{toolName}
				</span>
				{hasParams && !isExpanded && (
					<span
						className="text-xs flex-1 min-w-0 truncate"
						style={{ color: "var(--vscode-descriptionForeground)", opacity: 0.7 }}>
						{summary}
					</span>
				)}
			</div>
			{isExpanded && hasDetails && (
				<div
					data-testid="tool-call-expanded"
					className={cn(
						"ml-6 mr-4 rounded-md border border-vscode-panel-border/50 bg-vscode-editor-background/30 relative",
						"max-h-72 overflow-y-auto",
						"px-2 py-1",
					)}>
					{hasParams && !expandedContent && (
						<button
							type="button"
							onClick={handleCopy}
							className="w-4 h-4 inline-flex items-center justify-center text-vscode-descriptionForeground absolute right-1 top-1"
							data-testid="tool-call-copy">
							<Copy className="w-3 h-3" />
						</button>
					)}
					{expandedContent ? (
						expandedContent
					) : (
						<div className="text-xs text-vscode-descriptionForeground whitespace-pre-wrap break-words pr-4">{params}</div>
					)}
				</div>
			)}
		</div>
	)
}
