// kilocode_change - new file
import { useEffect, useRef, useState } from "react"

import type { ActiveTaskTab } from "@roo/ExtensionMessage"

import { cn } from "@/lib/utils"
import { formatTimeAgoShort } from "@/utils/format"
import { vscode } from "@/utils/vscode"

interface TaskTabsBarProps {
	tasks: ActiveTaskTab[]
}

export const TaskTabsBar = ({ tasks }: TaskTabsBarProps) => {
	const [, setNowTick] = useState(Date.now())
	const tabsListRef = useRef<HTMLDivElement | null>(null)
	const tabsInnerRef = useRef<HTMLDivElement | null>(null)
	const dragTaskIdRef = useRef<string | null>(null)
	const [draggingId, setDraggingId] = useState<string | null>(null)
	const dragStateRef = useRef<{
		pointerId: number | null
		startX: number
		startY: number
		offsetX: number
		baseLeft: number
		baseIndex: number
		isDragging: boolean
	}>({
		pointerId: null,
		startX: 0,
		startY: 0,
		offsetX: 0,
		baseLeft: 0,
		baseIndex: -1,
		isDragging: false,
	})
	const lastPointerXRef = useRef<number | null>(null)
	const gapIndexRef = useRef<number>(-1)
	const suppressClickRef = useRef(false)
	const autoScrollDirectionRef = useRef<0 | 1 | -1>(0)
	const autoScrollRafRef = useRef<number | null>(null)
	const autoScrollVelocityRef = useRef<number>(0)
	const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map())
	const wheelTargetRef = useRef<number | null>(null)
	const wheelRafRef = useRef<number | null>(null)

	useEffect(() => {
		const intervalId = window.setInterval(() => setNowTick(Date.now()), 30_000)
		return () => window.clearInterval(intervalId)
	}, [])

	useEffect(() => {
		return () => {
			if (autoScrollRafRef.current !== null) {
				cancelAnimationFrame(autoScrollRafRef.current)
			}
			if (wheelRafRef.current !== null) {
				cancelAnimationFrame(wheelRafRef.current)
			}
		}
	}, [])

	if (!tasks.length) {
		return null
	}

	const stopAutoScroll = () => {
		autoScrollDirectionRef.current = 0
		// Let the RAF loop decay velocity for a smoother stop.
	}

	const startAutoScroll = (direction: 1 | -1) => {
		if (autoScrollDirectionRef.current === direction && autoScrollRafRef.current !== null) {
			return
		}
		autoScrollDirectionRef.current = direction
		if (autoScrollRafRef.current !== null) {
			return
		}
		const tick = () => {
			const container = tabsListRef.current
			if (!container) {
				autoScrollRafRef.current = null
				return
			}
			const targetVelocity = autoScrollDirectionRef.current * 3
			autoScrollVelocityRef.current += (targetVelocity - autoScrollVelocityRef.current) * 0.12
			if (autoScrollDirectionRef.current === 0 && Math.abs(autoScrollVelocityRef.current) < 0.2) {
				autoScrollVelocityRef.current = 0
				autoScrollRafRef.current = null
				return
			}
			const maxScroll = Math.max(container.scrollWidth - container.clientWidth, 0)
			const nextScroll = container.scrollLeft + autoScrollVelocityRef.current
			container.scrollLeft = Math.min(Math.max(nextScroll, 0), maxScroll)
			if (
				(autoScrollDirectionRef.current === -1 && container.scrollLeft <= 0) ||
				(autoScrollDirectionRef.current === 1 && container.scrollLeft >= maxScroll)
			) {
				autoScrollDirectionRef.current = 0
			}
			if (lastPointerXRef.current !== null) {
				applyDragTransforms(lastPointerXRef.current)
			}
			autoScrollRafRef.current = requestAnimationFrame(tick)
		}
		autoScrollRafRef.current = requestAnimationFrame(tick)
	}

	const startWheelScroll = () => {
		if (wheelRafRef.current !== null) {
			return
		}
		const tick = () => {
			const container = tabsListRef.current
			if (!container || wheelTargetRef.current === null) {
				wheelRafRef.current = null
				return
			}
			const current = container.scrollLeft
			const target = wheelTargetRef.current
			const delta = target - current
			if (Math.abs(delta) < 0.5) {
				container.scrollLeft = target
				wheelTargetRef.current = null
				wheelRafRef.current = null
				return
			}
			container.scrollLeft = current + delta * 0.18
			wheelRafRef.current = requestAnimationFrame(tick)
		}
		wheelRafRef.current = requestAnimationFrame(tick)
	}

	const clearTransforms = (withBounce: boolean) => {
		for (const [id, element] of tabRefs.current.entries()) {
			if (!element) {
				continue
			}
			const currentTransform = getComputedStyle(element).transform
			element.style.transform = ""
			element.style.transition = ""
			void withBounce
		}
	}

	const applyDragTransforms = (pointerX: number) => {
		const container = tabsListRef.current
		const inner = tabsInnerRef.current
		const draggedId = dragTaskIdRef.current
		if (!container || !inner || !draggedId) {
			return
		}
		const draggedEl = tabRefs.current.get(draggedId)
		if (!draggedEl) {
			return
		}

		const innerRect = inner.getBoundingClientRect()
		const pointerXInList = pointerX - innerRect.left + container.scrollLeft

		const dragOffsetX = dragStateRef.current.offsetX
		const dragTranslateX = pointerXInList - dragOffsetX - dragStateRef.current.baseLeft
		draggedEl.style.transition = "none"
		draggedEl.style.transform = `translateX(${dragTranslateX}px)`
		draggedEl.style.zIndex = "2"

		const centers: Array<{ id: string; center: number; index: number }> = []
		tasks.forEach((task, index) => {
			if (task.id === draggedId) {
				return
			}
			const el = tabRefs.current.get(task.id)
			if (!el) {
				return
			}
			centers.push({ id: task.id, center: el.offsetLeft + el.offsetWidth / 2, index })
		})
		centers.sort((a, b) => a.center - b.center)
		const targetIndex = centers.filter((entry) => entry.center < pointerXInList).length
		const draggedIndex = dragStateRef.current.baseIndex
		const shift = draggedEl.offsetWidth + 8

		tasks.forEach((task, index) => {
			if (task.id === draggedId) {
				return
			}
			const el = tabRefs.current.get(task.id)
			if (!el) {
				return
			}
			el.style.zIndex = ""
			el.style.transition = "transform 200ms ease-out"
			if (draggedIndex === -1 || targetIndex === draggedIndex) {
				el.style.transform = ""
				return
			}
			if (targetIndex > draggedIndex && index > draggedIndex && index <= targetIndex) {
				el.style.transform = `translateX(${-shift}px)`
				return
			}
			if (targetIndex < draggedIndex && index >= targetIndex && index < draggedIndex) {
				el.style.transform = `translateX(${shift}px)`
				return
			}
			el.style.transform = ""
		})
	}

	const finalizeReorder = () => {
		const draggedId = dragTaskIdRef.current
		if (!draggedId) {
			return
		}
		const centers: Array<{ id: string; center: number }> = []
		tasks.forEach((task) => {
			if (task.id === draggedId) {
				return
			}
			const el = tabRefs.current.get(task.id)
			if (!el) {
				return
			}
			centers.push({ id: task.id, center: el.offsetLeft + el.offsetWidth / 2 })
		})
		centers.sort((a, b) => a.center - b.center)
		const pointerX = lastPointerXRef.current
		const container = tabsListRef.current
		const inner = tabsInnerRef.current
		if (!container || !inner || pointerX === null) {
			return
		}
		const innerRect = inner.getBoundingClientRect()
		const pointerXInList = pointerX - innerRect.left + container.scrollLeft
		const insertIndex = centers.filter((entry) => entry.center < pointerXInList).length
		const ids = tasks.map((task) => task.id).filter((id) => id !== draggedId)
		ids.splice(insertIndex, 0, draggedId)
		vscode.postMessage({ type: "reorderActiveTasks", ids })
	}

	return (
		<div className="px-2 py-0 border-b border-vscode-panel-border">
			<div className="flex items-center gap-1">
				<div
					ref={tabsListRef}
					className="min-w-0 flex-1 overflow-x-auto scrollbar-hide select-none"
					onWheel={(event) => {
						if (!tabsListRef.current) {
							return
						}
						const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY
						if (delta === 0) {
							return
						}
						event.preventDefault()
						const container = tabsListRef.current
						const maxScroll = container.scrollWidth - container.clientWidth
						const nextTarget = (wheelTargetRef.current ?? container.scrollLeft) + delta
						wheelTargetRef.current = Math.min(Math.max(nextTarget, 0), Math.max(maxScroll, 0))
						startWheelScroll()
					}}
				>
					<div ref={tabsInnerRef} className="flex items-center gap-1 py-1 min-w-max">
						{tasks.map((task) => (
							<div
								key={task.id}
								title={task.title}
								ref={(element) => {
									if (element) {
										tabRefs.current.set(task.id, element)
									} else {
										tabRefs.current.delete(task.id)
									}
								}}
								className={cn(
									"group relative shrink-0 flex items-center rounded-md max-w-[220px] border text-xs transition-colors transition-transform duration-200 ease-out",
									task.isCurrent
										? "bg-vscode-button-background text-vscode-button-foreground border-vscode-focusBorder"
										: "bg-vscode-tab-inactiveBackground text-vscode-tab-inactiveForeground border-vscode-panel-border hover:bg-vscode-list-hoverBackground",
									draggingId === task.id && "cursor-grabbing",
								)}>
								<button
									type="button"
									title={task.title}
									data-testid={`task-tab-${task.id}`}
									onPointerDown={(event) => {
										if (event.button !== 0) {
											return
										}
										const target = event.currentTarget as HTMLButtonElement
										const parent = target.parentElement as HTMLDivElement | null
										if (!parent) {
											return
										}
										event.preventDefault()
										target.setPointerCapture(event.pointerId)
										const rect = parent.getBoundingClientRect()
										dragTaskIdRef.current = task.id
										setDraggingId(task.id)
										dragStateRef.current = {
											pointerId: event.pointerId,
											startX: event.clientX,
											startY: event.clientY,
											offsetX: event.clientX - rect.left,
											baseLeft: parent.offsetLeft,
											baseIndex: tasks.findIndex((item) => item.id === task.id),
											isDragging: false,
										}
										lastPointerXRef.current = event.clientX
									}}
									onPointerMove={(event) => {
										const state = dragStateRef.current
										if (state.pointerId !== event.pointerId) {
											return
										}
										const dx = event.clientX - state.startX
										const dy = event.clientY - state.startY
										if (!state.isDragging && Math.hypot(dx, dy) > 3) {
											state.isDragging = true
											suppressClickRef.current = true
										}
										if (!state.isDragging) {
											return
										}
										lastPointerXRef.current = event.clientX
										applyDragTransforms(event.clientX)
										const container = tabsListRef.current
										if (container) {
											const rect = container.getBoundingClientRect()
											const edgeThreshold = 36
											if (event.clientX < rect.left + edgeThreshold) {
												startAutoScroll(-1)
											} else if (event.clientX > rect.right - edgeThreshold) {
												startAutoScroll(1)
											} else {
												stopAutoScroll()
											}
										}
									}}
									onPointerUp={(event) => {
										const state = dragStateRef.current
										if (state.pointerId !== event.pointerId) {
											return
										}
										const target = event.currentTarget as HTMLButtonElement
										target.releasePointerCapture(event.pointerId)
										if (state.isDragging) {
											finalizeReorder()
										}
										dragTaskIdRef.current = null
										setDraggingId(null)
										dragStateRef.current.isDragging = false
										dragStateRef.current.pointerId = null
										stopAutoScroll()
										clearTransforms(true)
										lastPointerXRef.current = null
										setTimeout(() => {
											suppressClickRef.current = false
										}, 0)
									}}
									onPointerCancel={(event) => {
										const state = dragStateRef.current
										if (state.pointerId !== event.pointerId) {
											return
										}
										const target = event.currentTarget as HTMLButtonElement
										target.releasePointerCapture(event.pointerId)
										dragTaskIdRef.current = null
										setDraggingId(null)
										dragStateRef.current.isDragging = false
										dragStateRef.current.pointerId = null
										stopAutoScroll()
										clearTransforms(true)
										lastPointerXRef.current = null
										suppressClickRef.current = false
									}}
									onClick={() => {
										if (suppressClickRef.current) {
											return
										}
										vscode.postMessage({ type: "switchActiveTask", text: task.id })
									}}
									className="min-w-0 flex items-center gap-1 px-1.5 py-1 cursor-grab">
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
											{formatTimeAgoShort(task.latestAssistantMessageTs)}
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
					</div>
				</div>
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
