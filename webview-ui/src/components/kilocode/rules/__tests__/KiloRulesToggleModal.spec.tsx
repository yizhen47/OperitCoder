import { render, screen } from "@/utils/test-utils"

import KiloRulesToggleModal from "../KiloRulesToggleModal"

let currentViewportWidth = 1200
let currentViewportHeight = 800

vi.mock("react-use", async () => {
	const actual = await vi.importActual<any>("react-use")
	return {
		...actual,
		useWindowSize: () => ({ width: currentViewportWidth, height: currentViewportHeight }),
		useClickAway: vi.fn(),
	}
})

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock("../../../ui/tooltip", () => ({
	TooltipProvider: ({ children }: any) => <div>{children}</div>,
	Tooltip: ({ children }: any) => <div>{children}</div>,
	TooltipTrigger: ({ children }: any) => <div>{children}</div>,
	TooltipContent: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("../../BottomButton", () => ({
	default: ({ onClick }: any) => (
		<button type="button" data-testid="rules-button" onClick={onClick}>
			open
		</button>
	),
}))

describe("KiloRulesToggleModal", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		currentViewportWidth = 1200
		currentViewportHeight = 800

		vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1200)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("does not move down when viewport width shrinks", () => {
		const getBoundingClientRectSpy = vi.spyOn(HTMLElement.prototype as any, "getBoundingClientRect")
		getBoundingClientRectSpy.mockImplementation(() => ({
			left: 100,
			top: currentViewportWidth >= 1000 ? 100 : 180,
			width: 100,
			height: 20,
			right: 200,
			bottom: 120,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		}))

		const { rerender } = render(<KiloRulesToggleModal />)

		screen.getByTestId("rules-button").click()
		const menu = screen.getByTestId("kilo-rules-toggle-modal") as HTMLDivElement

		// Ensure the header is configured to wrap so buttons/tabs won't overlap on narrow widths
		const header = menu.firstElementChild?.nextElementSibling as HTMLDivElement | null
		expect(header).toBeTruthy()
		expect(header!.style.display).toBe("flex")
		expect(header!.style.flexWrap).toBe("wrap")
		const firstBottom = menu.style.bottom

		currentViewportWidth = 800
		rerender(<KiloRulesToggleModal />)
		const shrinkBottom = menu.style.bottom

		currentViewportWidth = 1400
		rerender(<KiloRulesToggleModal />)
		const growBottom = menu.style.bottom

		// After opening, vertical position is frozen; width changes shouldn't move the modal bottom edge.
		expect(shrinkBottom).toBe(firstBottom)
		expect(growBottom).toBe(firstBottom)
	})
})
