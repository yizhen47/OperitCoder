export function buildChatRowTestId(ts: string): string {
	return `chat-row-${ts}`
}

type RectLike = {
	ts: string
	top: number
	bottom: number
}

export function selectAnchorTsFromRects(rects: RectLike[], centerY: number): string | null {
	if (rects.length === 0) return null

	// Prefer a row that contains the viewport center.
	for (const r of rects) {
		if (centerY >= r.top && centerY <= r.bottom) return r.ts
	}

	// Otherwise choose the row whose midpoint is closest to center.
	let best: { ts: string; dist: number } | null = null
	for (const r of rects) {
		const mid = (r.top + r.bottom) / 2
		const dist = Math.abs(mid - centerY)
		if (!best || dist < best.dist) {
			best = { ts: r.ts, dist }
		}
	}

	return best?.ts ?? null
}

export function computeScrollDelta(expectedTopInViewport: number, currentTopInViewport: number): number {
	return currentTopInViewport - expectedTopInViewport
}
