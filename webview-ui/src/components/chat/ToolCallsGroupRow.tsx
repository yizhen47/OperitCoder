import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronRight } from "lucide-react"

import type { ClineMessage } from "@roo-code/types"

import { cn } from "@/lib/utils"

export function ToolCallsGroupRow({
	toolMessages,
	toolCallCount,
	renderToolMessage,
}: {
	toolMessages: ClineMessage[]
	toolCallCount: number
	renderToolMessage?: (message: ClineMessage, index: number) => ReactNode
}) {
	const { t } = useTranslation()

	const isActive = useMemo(() => {
		if (toolMessages.some((m) => m.partial === true)) return true
		const last = toolMessages.at(-1)
		return last?.type === "ask" && (last.ask === "tool" || last.ask === "use_mcp_server")
	}, [toolMessages])
	const [isCollapsed, setIsCollapsed] = useState(() => !isActive)
	const wasActiveRef = useRef(isActive)

	useEffect(() => {
		if (isActive) setIsCollapsed(false)
	}, [isActive])

	useEffect(() => {
		if (wasActiveRef.current && !isActive) {
			setIsCollapsed(true)
		}
		wasActiveRef.current = isActive
	}, [isActive])

	const handleToggle = () => setIsCollapsed((v) => !v)

	return (
		<div className="px-4 py-1">
			<div
				className={cn(
					"flex items-center gap-2 select-none cursor-pointer",
					"text-xs text-vscode-descriptionForeground",
				)}
				onClick={handleToggle}
				data-testid="tool-calls-group-toggle">
				{isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
				<span>{t("chat:toolCalls.label")} ({toolCallCount})</span>
			</div>

			{!isCollapsed && (
				<div className="mt-1 pl-6" data-testid="tool-calls-group-expanded">
					<div className="flex flex-col gap-1">
						{toolMessages.map((msg, idx) => (
							<React.Fragment key={msg.ts ?? idx}>
								{renderToolMessage ? renderToolMessage(msg, idx) : null}
							</React.Fragment>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
