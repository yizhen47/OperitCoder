// kilocode_change - new file

import { useMemo, useState, type MouseEvent } from "react"
import { Check, Copy, CornerDownRight, LoaderCircle, X } from "lucide-react"

import { cn } from "@/lib/utils"

interface ToolResultDisplayProps {
	resultText: string
	isError?: boolean
	isRunning?: boolean
	enableCopy?: boolean
	className?: string
}

const parseBooleanResult = (raw: string): boolean | undefined => {
	const normalized = raw.trim().toLowerCase()
	if (normalized === "true") return true
	if (normalized === "false") return false
	return undefined
}

export const ToolResultDisplay = ({
	resultText,
	isError,
	isRunning,
	enableCopy = true,
	className,
}: ToolResultDisplayProps) => {
	const normalized = resultText.startsWith("⏎") ? resultText.slice(1) : resultText
	const boolResult = parseBooleanResult(normalized)
	const [isExpanded, setIsExpanded] = useState(false)
	const isBoolTrue = boolResult === true
	const isBoolFalse = boolResult === false

	const statusColorClass = useMemo(() => {
		if (isError) return "text-vscode-errorForeground"
		if (isBoolTrue) return "text-vscode-charts-green"
		return "text-vscode-descriptionForeground"
	}, [isError, isBoolTrue])

	const handleToggle = () => setIsExpanded((v) => !v)
	const hasContent = normalized.trim().length > 0

	const displayText = useMemo(() => {
		if (isRunning) return "执行中…"
		if (hasContent) return normalized
		return isError || isBoolFalse ? "执行失败" : "执行成功"
	}, [hasContent, normalized, isError, isBoolFalse, isRunning])

	const handleCopy = async (e: MouseEvent) => {
		e.stopPropagation()
		try {
			if (typeof navigator === "undefined") return
			if (!navigator.clipboard?.writeText) return
			await navigator.clipboard.writeText(normalized)
		} catch {
			// ignore
		}
	}

	return (
		<div className={cn(className)}>
			<div
				className="w-full flex items-center gap-2 pl-6 pr-4 py-[2px] rounded-sm cursor-pointer select-none"
				onClick={handleToggle}
				data-testid="tool-result-toggle">
				<CornerDownRight className={cn("w-4 h-4", statusColorClass)} />
				{isRunning ? (
					<LoaderCircle className={cn("w-3.5 h-3.5 animate-spin", statusColorClass)} />
				) : isError || isBoolFalse ? (
					<X className={cn("w-3.5 h-3.5", statusColorClass)} />
				) : (
					<Check className={cn("w-3.5 h-3.5", statusColorClass)} />
				)}
				<span
					data-testid="tool-result-collapsed"
					className={cn(
						"text-xs font-normal flex-1 min-w-0 truncate",
						statusColorClass,
					)}>
					{displayText}
				</span>
				{enableCopy && hasContent && !isRunning && (
					<button
						type="button"
						onClick={handleCopy}
						className="w-5 h-5 inline-flex items-center justify-center text-vscode-descriptionForeground"
						data-testid="tool-result-copy">
						<Copy className="w-3.5 h-3.5" />
					</button>
				)}
			</div>
			{isExpanded && hasContent && (
				<div
					data-testid="tool-result-expanded"
					className={cn(
						"mt-0.5 ml-6 mr-4 rounded-md border border-vscode-panel-border/50 bg-vscode-editor-background/30",
						"max-h-72 overflow-y-auto",
						"px-2 py-1.5",
					)}>
					<div className={cn("text-xs whitespace-pre-wrap break-words", statusColorClass)}>{normalized}</div>
				</div>
			)}
		</div>
	)
}
