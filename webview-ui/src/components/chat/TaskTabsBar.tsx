// kilocode_change - new file
import { useEffect, useState } from "react"

import type { ActiveTaskTab } from "@roo/ExtensionMessage"

import { cn } from "@/lib/utils"
import { formatTimeAgo } from "@/utils/format"
import { vscode } from "@/utils/vscode"

interface TaskTabsBarProps {
	tasks: ActiveTaskTab[]
}

export const TaskTabsBar = ({ tasks }: TaskTabsBarProps) => {
	const [, setNowTick] = useState(Date.now())

	useEffect(() => {
		const intervalId = window.setInterval(() => setNowTick(Date.now()), 30_000)
		return () => window.clearInterval(intervalId)
	}, [])

	if (!tasks.length) {
		return null
	}

	return (
		<div className="px-2 pt-2 pb-1 border-b border-vscode-panel-border">
			<div className="flex items-center gap-1 overflow-x-auto">
				{tasks.map((task) => (
					<div
						key={task.id}
						className={cn(
							"group shrink-0 flex items-center rounded-md max-w-[280px] border text-xs transition-colors",
							task.isCurrent
								? "bg-vscode-tab-activeBackground text-vscode-tab-activeForeground border-vscode-focusBorder"
								: "bg-vscode-tab-inactiveBackground text-vscode-tab-inactiveForeground border-vscode-panel-border hover:bg-vscode-list-hoverBackground",
						)}>
						<button
							type="button"
							title={task.title}
							data-testid={`task-tab-${task.id}`}
							onClick={() => vscode.postMessage({ type: "switchActiveTask", text: task.id })}
							className="min-w-0 flex items-center gap-1.5 px-2 py-1">
							{task.isRunning && (
								<span
									className="codicon codicon-loading codicon-modifier-spin text-[11px] opacity-80"
									data-testid={`task-tab-loading-${task.id}`}
								/>
							)}
							<span className="truncate">{task.title}</span>
							{task.latestAssistantMessageTs && (
								<span
									className="shrink-0 text-[10px] opacity-70"
									data-testid={`task-tab-last-reply-${task.id}`}>
									{formatTimeAgo(task.latestAssistantMessageTs)}
								</span>
							)}
						</button>
						<button
							type="button"
							title="Close task"
							aria-label="Close task"
							data-testid={`task-tab-close-${task.id}`}
							onClick={(event) => {
								event.preventDefault()
								event.stopPropagation()
								vscode.postMessage({ type: "closeActiveTask", text: task.id })
							}}
							className="shrink-0 px-1.5 py-1 text-[11px] opacity-70 hover:opacity-100">
							<span className="codicon codicon-close" />
						</button>
					</div>
				))}
				<button
					type="button"
					title="New task"
					aria-label="New task"
					data-testid="task-tab-create"
					onClick={() => vscode.postMessage({ type: "newTask" })}
					className="shrink-0 flex items-center justify-center rounded-md border border-vscode-panel-border bg-vscode-tab-inactiveBackground text-vscode-tab-inactiveForeground hover:bg-vscode-list-hoverBackground px-2 py-1">
					<span className="codicon codicon-add text-[12px]" />
				</button>
			</div>
		</div>
	)
}
