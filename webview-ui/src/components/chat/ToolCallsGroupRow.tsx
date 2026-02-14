import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronRight } from "lucide-react"

import type { ClineMessage } from "@roo-code/types"

import { cn } from "@/lib/utils"

export function ToolCallsGroupRow({
	groupMessages,
	toolCallCount,
	hasReasoning,
	isComplete,
	renderToolMessage,
}: {
	groupMessages: ClineMessage[]
	toolCallCount: number
	hasReasoning: boolean
	isComplete: boolean
	renderToolMessage?: (message: ClineMessage, index: number) => ReactNode
}) {
	const { t } = useTranslation()

	const [isExpanded, setIsExpanded] = useState(true)
	const [isUserOverridden, setIsUserOverridden] = useState(false)
	const wasCompleteRef = useRef(isComplete)

	useEffect(() => {
		if (isUserOverridden) {
			wasCompleteRef.current = isComplete
			return
		}

		// Before the run ends, keep it expanded. Once the next non-target message arrives
		// (isComplete becomes true), auto-collapse exactly once. After that, allow user toggle.
		if (!isComplete) {
			setIsExpanded(true)
		} else if (!wasCompleteRef.current && isComplete) {
			setIsExpanded(false)
		}
		wasCompleteRef.current = isComplete
	}, [isComplete, isUserOverridden])

	const handleToggle = () => {
		setIsUserOverridden(true)
		setIsExpanded((v) => !v)
	}

	return (
		<div className="px-4 py-1">
			<div
				className={cn(
					"flex items-center gap-2 select-none cursor-pointer",
					"text-xs text-vscode-descriptionForeground",
				)}
				onClick={handleToggle}
				data-testid="tool-calls-group-toggle">
				{isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
				<span>
					{hasReasoning ? t("chat:toolCalls.withReasoningLabel") : t("chat:toolCalls.label")} ({toolCallCount})
				</span>
			</div>

			{isExpanded && (
				<div className="mt-1 pl-6" data-testid="tool-calls-group-expanded">
					<div className="flex flex-col gap-1">
						{groupMessages.map((msg, idx) => (
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
