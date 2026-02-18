import React from "react"

export function useDismissibleSessionId(activeSessionId: string | undefined): {
	isVisible: boolean
	dismiss: (sessionId?: string) => void
} {
	const [dismissedSessionId, setDismissedSessionId] = React.useState<string | null>(null)

	const dismiss = React.useCallback(
		(sessionId?: string) => {
			const id = String(sessionId ?? activeSessionId ?? "").trim()
			setDismissedSessionId(id || null)
		},
		[activeSessionId],
	)

	const isVisible = Boolean(activeSessionId) && activeSessionId !== dismissedSessionId

	return { isVisible, dismiss }
}

