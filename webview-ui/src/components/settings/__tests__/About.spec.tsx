import { render, screen } from "@/utils/test-utils"

import { TranslationProvider } from "@/i18n/__mocks__/TranslationContext"

import { About } from "../About"

vi.mock("@/utils/vscode", () => ({
	vscode: { postMessage: vi.fn() },
}))

vi.mock("@/i18n/TranslationContext", () => {
	const actual = vi.importActual("@/i18n/TranslationContext")
	return {
		...actual,
		useAppTranslation: () => ({
			t: (key: string, options?: Record<string, any>) => {
				if (key === "settings:about.support.issue") {
					return "有问题在https://github.com/yizhen47/OperitCoder/issues反馈"
				}
				if (key === "settings:about.support.contact") {
					return "或联系开发者邮箱yihong47@foxmail.com"
				}
				if (key === "settings:about.version") {
					return `Version: ${options?.version ?? ""}`
				}
				return key
			},
		}),
	}
})

// kilocode_change: our about screen is very different
describe("About", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the About section header", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText("settings:sections.about")).toBeInTheDocument()
	})

	it("displays version information", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText(/Version: 0\.0\.1/)).toBeInTheDocument()
	})

	it("displays the support text and does not render external links", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText("有问题在https://github.com/yizhen47/OperitCoder/issues反馈")).toBeInTheDocument()
		expect(screen.getByText("或联系开发者邮箱yihong47@foxmail.com")).toBeInTheDocument()
		expect(screen.queryAllByRole("link")).toHaveLength(0)
	})

	it("renders export, import, and reset buttons", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText("settings:footer.settings.export")).toBeInTheDocument()
		expect(screen.getByText("settings:footer.settings.import")).toBeInTheDocument()
		expect(screen.getByText("settings:footer.settings.reset")).toBeInTheDocument()
	})
})
