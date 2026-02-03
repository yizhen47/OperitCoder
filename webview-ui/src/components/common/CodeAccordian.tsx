import { memo, useMemo, useCallback, useEffect, useRef, type MouseEvent } from "react"
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { type ToolProgressStatus } from "@roo-code/types"
import { getLanguageFromPath } from "@src/utils/getLanguageFromPath"
import { formatPathTooltip } from "@src/utils/formatPathTooltip"

import { ToolUseBlock, ToolUseBlockHeader } from "./ToolUseBlock"
import CodeBlock from "../kilocode/common/CodeBlock" // kilocode_change
import { PathTooltip } from "../ui/PathTooltip"
import DiffView from "./DiffView"
import { vscode } from "@src/utils/vscode"
import { Undo } from "lucide-react"
import { StandardTooltip } from "../ui"

interface CodeAccordianProps {
	path?: string
	code?: string
	language: string
	progressStatus?: ToolProgressStatus
	isLoading?: boolean
	isExpanded: boolean
	isFeedback?: boolean
	onToggleExpand: () => void
	header?: string
	onJumpToFile?: () => void
	// New props for diff stats
	diffStats?: { added: number; removed: number }
	// kilocode_change: checkpoint restore props
	checkpointTs?: number
	commitHash?: string
}

const CodeAccordian = ({
	path,
	code = "",
	language,
	progressStatus,
	isLoading,
	isExpanded,
	isFeedback,
	onToggleExpand,
	header,
	onJumpToFile,
	diffStats,
	checkpointTs,
	commitHash,
}: CodeAccordianProps) => {
	const inferredLanguage = useMemo(() => language ?? (path ? getLanguageFromPath(path) : "txt"), [path, language])
	const source = useMemo(() => String(code).trim() /*kilocode_change: coerce to string*/, [code])
	const hasHeader = Boolean(path || header)
	const clickTimeoutRef = useRef<number | undefined>(undefined)

	useEffect(() => {
		return () => {
			if (clickTimeoutRef.current !== undefined) {
				window.clearTimeout(clickTimeoutRef.current)
				clickTimeoutRef.current = undefined
			}
		}
	}, [])

	// Use provided diff stats only (render-only)
	const derivedStats = useMemo(() => {
		if (diffStats && (diffStats.added > 0 || diffStats.removed > 0)) return diffStats
		return null
	}, [diffStats])

	const hasValidStats = Boolean(derivedStats && (derivedStats.added > 0 || derivedStats.removed > 0))

	// kilocode_change: handle checkpoint restore
	const handleRestore = useCallback(() => {
		if (checkpointTs && commitHash) {
			vscode.postMessage({
				type: "checkpointRestore",
				payload: { ts: checkpointTs, commitHash, mode: "restore" },
			})
		}
	}, [checkpointTs, commitHash])

	const handleHeaderClick = useCallback(() => {
		if (clickTimeoutRef.current !== undefined) {
			window.clearTimeout(clickTimeoutRef.current)
		}

		clickTimeoutRef.current = window.setTimeout(() => {
			onToggleExpand()
			clickTimeoutRef.current = undefined
		}, 200)
	}, [onToggleExpand])

	const handleHeaderDoubleClick = useCallback(
		(e: MouseEvent<HTMLDivElement>) => {
			e.preventDefault()
			e.stopPropagation()

			if (clickTimeoutRef.current !== undefined) {
				window.clearTimeout(clickTimeoutRef.current)
				clickTimeoutRef.current = undefined
			}

			if (onJumpToFile) {
				onJumpToFile()
				return
			}

			if (path) {
				const trimmedPath = path.trim()
				const normalizedPath =
					trimmedPath.startsWith("a/") ||
					trimmedPath.startsWith("b/") ||
					trimmedPath.startsWith("a\\") ||
					trimmedPath.startsWith("b\\")
						? trimmedPath.slice(2)
						: trimmedPath
				vscode.postMessage({ type: "openFile", text: normalizedPath })
			}
		},
		[onJumpToFile, path],
	)

	return (
		<ToolUseBlock onDoubleClick={handleHeaderDoubleClick}>
			{hasHeader && (
				<ToolUseBlockHeader onClick={handleHeaderClick} onDoubleClick={handleHeaderDoubleClick} className="group">
					{/* kilocode_change: checkpoint restore button - positioned at far left */}
					{checkpointTs && commitHash && (
						<button
							className="mr-2 hover:bg-vscode-toolbar-hoverBackground rounded transition-colors"
							onClick={(e) => {
								e.stopPropagation()
								handleRestore()
							}}
							aria-label="撤回">
							<Undo className="w-3 h-3" />
						</button>
					)}
					{isLoading && <VSCodeProgressRing className="size-3 mr-2" />}
					{header ? (
						<div className="flex items-center">
							<span className="codicon codicon-server mr-1.5"></span>
							<PathTooltip content={header}>
								<span className="whitespace-nowrap overflow-hidden text-ellipsis mr-2">{header}</span>
							</PathTooltip>
						</div>
					) : (
						<div className="flex items-center">
							<span className="codicon codicon-file mr-1.5"></span>
							{path?.startsWith(".") && <span>.</span>}
							<PathTooltip content={formatPathTooltip(path)}>
								<span className="whitespace-nowrap overflow-hidden text-ellipsis text-left mr-2 rtl">
									{formatPathTooltip(path)}
								</span>
							</PathTooltip>
						</div>
					)}
					<div className="flex-grow-1" />
					{/* Prefer diff stats over generic progress indicator if available */}
					{hasValidStats ? (
						<div className="flex items-center gap-2 mr-1">
							<span className="text-xs font-medium text-vscode-charts-green">+{derivedStats!.added}</span>
							<span className="text-xs font-medium text-vscode-charts-red">-{derivedStats!.removed}</span>
						</div>
					) : (
						progressStatus &&
						progressStatus.text && (
							<>
								{progressStatus.icon && (
									<span className={`codicon codicon-${progressStatus.icon} mr-1`} />
								)}
								<span className="mr-1 ml-auto text-vscode-descriptionForeground">
									{progressStatus.text}
								</span>
							</>
						)
					)}
					{onJumpToFile && path && (
						<span
							className="codicon codicon-link-external mr-1"
							style={{ fontSize: 13.5 }}
							onClick={(e) => {
								e.stopPropagation()
								onJumpToFile()
							}}
							aria-label={`Open file: ${path}`}
						/>
					)}
					{!onJumpToFile && (
						<span
							className={`opacity-0 group-hover:opacity-100 codicon codicon-chevron-${isExpanded ? "up" : "down"}`}></span>
					)}
				</ToolUseBlockHeader>
			)}
			{(!hasHeader || isExpanded) && !isFeedback && (
				<div className="overflow-x-auto overflow-y-auto max-h-[300px] max-w-full">
					{inferredLanguage === "diff" ? (
						<DiffView source={source} filePath={path} />
					) : (
						<CodeBlock source={source} language={inferredLanguage} />
					)}
				</div>
			)}
		</ToolUseBlock>
	)
}

export default memo(CodeAccordian)
