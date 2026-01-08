// npx vitest run src/components/settings/__tests__/DisplaySettings.spec.tsx

import { render, screen, fireEvent } from "@/utils/test-utils"
import { DisplaySettings } from "../DisplaySettings"

vi.mock("@/components/ui", () => ({
  Slider: ({ value, onValueChange, "data-testid": dataTestId, ...props }: any) => (
    <input
      type="range"
      value={value?.[0] ?? 0}
      onChange={(e) => onValueChange([parseFloat((e.target as HTMLInputElement).value)])}
      data-testid={dataTestId}
      {...props}
    />
  ),
}))

// Mock the translation context
vi.mock("../../../i18n/TranslationContext", () => ({
  useAppTranslation: () => ({
    t: (key: string) => {
      // Return fixed English strings for tests
      const translations: { [key: string]: string } = {
        "settings:sections.display": "Display",
        "settings:display.costThreshold.label": "Hide costs below threshold",
        "settings:display.costThreshold.description": "Hide small costs in the UI",
        "settings:display.costThreshold.currentValue": "Current threshold: ${{value}}",
      }
      return translations[key] || key
    },
  }),
}))

describe("DisplaySettings", () => {
  const mockSetCachedStateField = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders cost threshold controls", () => {
    render(
      <DisplaySettings hideCostBelowThreshold={0.12} setCachedStateField={mockSetCachedStateField} />,
    )

    expect(screen.getByText("Display")).toBeInTheDocument()
    expect(screen.getByText("Hide costs below threshold")).toBeInTheDocument()
    expect(screen.getByText("Hide small costs in the UI")).toBeInTheDocument()
    expect(screen.getByTestId("cost-threshold-slider")).toBeInTheDocument()
    expect(screen.getByText("$0.12")).toBeInTheDocument()
  })

  it("calls setCachedStateField when slider value changes", () => {
    render(<DisplaySettings hideCostBelowThreshold={0} setCachedStateField={mockSetCachedStateField} />)

    const slider = screen.getByTestId("cost-threshold-slider") as HTMLInputElement
    fireEvent.change(slider, { target: { value: "0.23" } })
    expect(mockSetCachedStateField).toHaveBeenCalledWith("hideCostBelowThreshold", 0.23)
  })
})
