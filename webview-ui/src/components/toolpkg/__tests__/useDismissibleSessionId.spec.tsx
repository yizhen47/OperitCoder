import { act, renderHook } from "@testing-library/react"

import { useDismissibleSessionId } from "../useDismissibleSessionId"

describe("useDismissibleSessionId", () => {
	it("hides a session optimistically and reveals new sessions", () => {
		const hook = renderHook((props: { id?: string }) => useDismissibleSessionId(props.id), { initialProps: {} })
		expect(hook.result.current.isVisible).toBe(false)

		hook.rerender({ id: "s1" })
		expect(hook.result.current.isVisible).toBe(true)

		act(() => hook.result.current.dismiss())
		expect(hook.result.current.isVisible).toBe(false)

		hook.rerender({ id: "s2" })
		expect(hook.result.current.isVisible).toBe(true)
	})
})
