import { computeScrollDelta, selectAnchorTsFromRects } from "../scrollAnchor"

describe("scrollAnchor", () => {
	test("selectAnchorTsFromRects prefers rect containing center", () => {
		const rects = [
			{ ts: "1", top: 0, bottom: 40 },
			{ ts: "2", top: 40, bottom: 80 },
		]
		expect(selectAnchorTsFromRects(rects, 10)).toBe("1")
		expect(selectAnchorTsFromRects(rects, 60)).toBe("2")
	})

	test("selectAnchorTsFromRects falls back to closest midpoint", () => {
		const rects = [
			{ ts: "1", top: 0, bottom: 10 },
			{ ts: "2", top: 20, bottom: 30 },
			{ ts: "3", top: 40, bottom: 50 },
		]

		// center is between rect 1 and rect 2, closer to rect 2 midpoint (25)
		expect(selectAnchorTsFromRects(rects, 18)).toBe("2")
	})

	test("computeScrollDelta returns current minus expected", () => {
		expect(computeScrollDelta(100, 110)).toBe(10)
		expect(computeScrollDelta(100, 80)).toBe(-20)
	})
})
