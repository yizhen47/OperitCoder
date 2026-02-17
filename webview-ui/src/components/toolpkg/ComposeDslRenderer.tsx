import React from "react"

type ActionRef = { __actionId?: string } | string | null | undefined

export type ComposeDslNode = {
	type: string
	props?: Record<string, any>
	children?: ComposeDslNode[]
}

function extractActionId(value: ActionRef): string | null {
	if (!value) return null
	if (typeof value === "string") {
		const s = value.trim()
		if (!s) return null
		if (s.startsWith("__action:")) return s.slice("__action:".length).trim() || null
		return s
	}
	const id = String((value as any).__actionId ?? "").trim()
	return id || null
}

function pxToTw(n: unknown, axis: "w" | "h" | "p" | "gap"): string | null {
	const value = Number(n)
	if (!Number.isFinite(value) || value <= 0) return null
	const map: Record<number, string> = {
		4: "1",
		8: "2",
		12: "3",
		16: "4",
	}
	const key = map[Math.round(value)]
	if (!key) return null
	return `${axis}-${key}`
}

function cls(...values: Array<string | null | undefined | false>) {
	return values.filter(Boolean).join(" ")
}

export function ComposeDslRenderer(props: {
	tree: ComposeDslNode
	onAction: (actionId: string, payload?: any) => void
}) {
	const seenOnLoadRef = React.useRef<Set<string>>(new Set())
	const pendingTextValuesRef = React.useRef<Map<string, string>>(new Map())

	React.useEffect(() => {
		const walk = (n: ComposeDslNode) => {
			const actionId = extractActionId(n.props?.onLoad)
			if (actionId && !seenOnLoadRef.current.has(actionId)) {
				seenOnLoadRef.current.add(actionId)
				props.onAction(actionId)
			}
			for (const child of n.children ?? []) {
				walk(child)
			}
		}
		walk(props.tree)
	}, [props.tree, props.onAction])

	const getTextValue = React.useCallback((actionId: string | null, remoteValue: string) => {
		if (!actionId) return remoteValue
		const pending = pendingTextValuesRef.current.get(actionId)
		if (pending === undefined) return remoteValue
		if (pending === remoteValue) {
			pendingTextValuesRef.current.delete(actionId)
			return remoteValue
		}
		return pending
	}, [])

	const setPendingTextValue = React.useCallback((actionId: string | null, value: string) => {
		if (!actionId) return
		pendingTextValuesRef.current.set(actionId, value)
	}, [])

	const renderNode = (node: ComposeDslNode, index: number): React.ReactNode => {
		const type = String(node.type ?? "")
		const p = node.props ?? {}
		const children = Array.isArray(node.children) ? node.children : []

		const padding = pxToTw(p.padding, "p")
		const gap = pxToTw(p.spacing, "gap")

		switch (type) {
			case "Column": {
				return (
					<div
						key={index}
						className={cls(
							"flex flex-col",
							p.fillMaxWidth ? "w-full" : null,
							p.fillMaxSize ? "w-full h-full" : null,
							padding,
							gap,
						)}
					>
						{children.map(renderNode)}
					</div>
				)
			}
			case "Row": {
				const vertical =
					p.verticalAlignment === "center" ? "items-center" : p.verticalAlignment === "start" ? "items-start" : null
				const horizontal =
					p.horizontalArrangement === "center"
						? "justify-center"
						: p.horizontalArrangement === "spaceBetween"
							? "justify-between"
							: null
				return (
					<div
						key={index}
						className={cls("flex flex-row", "gap-2", vertical, horizontal, p.fillMaxWidth ? "w-full" : null, padding)}
					>
						{children.map(renderNode)}
					</div>
				)
			}
			case "Text": {
				const text = typeof p.text === "string" ? p.text : String(p.text ?? "")
				const color =
					p.color === "onSurfaceVariant"
						? "text-vscode-descriptionForeground"
						: p.color === "onErrorContainer"
							? "text-vscode-errorForeground"
							: "text-vscode-foreground"
				const style = p.style === "titleMedium" ? "text-base font-semibold" : p.style === "bodySmall" ? "text-xs" : "text-sm"
				return (
					<div key={index} className={cls(style, color)}>
						{text}
					</div>
				)
			}
			case "Button": {
				const actionId = extractActionId(p.onClick)
				const disabled = p.enabled === false || !actionId
				const text = typeof p.text === "string" ? p.text : null
				return (
					<button
						key={index}
						type="button"
						disabled={disabled}
						className={cls(
							"rounded px-3 py-2 text-sm",
							p.fillMaxWidth ? "w-full" : null,
							disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
							"bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground",
						)}
						onClick={() => {
							if (!actionId) return
							props.onAction(actionId)
						}}
					>
						{text ? text : children.map(renderNode)}
					</button>
				)
			}
			case "TextField": {
				const label = typeof p.label === "string" ? p.label : ""
				const placeholder = typeof p.placeholder === "string" ? p.placeholder : ""
				const remoteValue = typeof p.value === "string" ? p.value : String(p.value ?? "")
				const onChangeId = extractActionId(p.onValueChange)
				const rows = Number(p.minLines ?? 1)
				const value = getTextValue(onChangeId, remoteValue)
				return (
					<div key={index} className={cls("flex flex-col gap-1", p.fillMaxWidth ? "w-full" : null)}>
						{label ? <div className="text-xs text-vscode-descriptionForeground">{label}</div> : null}
						<textarea
							className={cls(
								"w-full rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground p-2 text-sm",
							)}
							placeholder={placeholder}
							value={value}
							rows={Number.isFinite(rows) && rows > 0 ? rows : 1}
							onChange={(e) => {
								if (!onChangeId) return
								setPendingTextValue(onChangeId, e.target.value)
								props.onAction(onChangeId, e.target.value)
							}}
						/>
					</div>
				)
			}
			case "Spacer": {
				const w = pxToTw(p.width, "w")
				const h = pxToTw(p.height, "h")
				return <div key={index} className={cls(w, h)} />
			}
			case "Card": {
				const bg =
					p.containerColor === "errorContainer"
						? "bg-vscode-editorWarning-background"
						: p.containerColor === "primaryContainer"
							? "bg-vscode-button-secondaryBackground"
							: "bg-vscode-sideBar-background"
				return (
					<div
						key={index}
						className={cls(
							"rounded border border-vscode-widget-border",
							bg,
							p.fillMaxWidth ? "w-full" : null,
						)}
					>
						<div className={cls("p-4", gap)}>{children.map(renderNode)}</div>
					</div>
				)
			}
			case "Icon": {
				const name = typeof p.name === "string" ? p.name : "icon"
				return (
					<div key={index} className="text-xs text-vscode-descriptionForeground">
						[{name}]
					</div>
				)
			}
			case "CircularProgressIndicator": {
				const sizeClass = "h-4 w-4"
				return (
					<div
						key={index}
						className={cls(
							"inline-block animate-spin rounded-full border-2 border-vscode-button-foreground border-t-transparent",
							sizeClass,
						)}
					/>
				)
			}
			case "Divider": {
				return <hr key={index} className="border-vscode-widget-border" />
			}
			default: {
				// Unknown node type: render children to avoid blank screens.
				return (
					<div key={index} className="flex flex-col gap-2">
						{children.map(renderNode)}
					</div>
				)
			}
		}
	}

	return <>{renderNode(props.tree, 0)}</>
}
