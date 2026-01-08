// kilocode_change - new file
import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Slider } from "@/components/ui"
import { Monitor } from "lucide-react"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type DisplaySettingsProps = HTMLAttributes<HTMLDivElement> & {
	setCachedStateField: SetCachedStateField<"hideCostBelowThreshold">
	hideCostBelowThreshold?: number
}

export const DisplaySettings = ({
	setCachedStateField,
	hideCostBelowThreshold,
	...props
}: DisplaySettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Monitor className="w-4" />
					<div>{t("settings:sections.display")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<div className="font-medium">{t("settings:display.costThreshold.label")}</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:display.costThreshold.description")}
					</div>

					<div className="mt-3">
						<div className="flex items-center gap-2">
							<Slider
								min={0}
								max={1}
								step={0.01}
								value={[hideCostBelowThreshold ?? 0]}
								onValueChange={([value]) => setCachedStateField("hideCostBelowThreshold", value)}
								data-testid="cost-threshold-slider"
								className="flex-1"
							/>
							<span className="text-sm text-vscode-foreground min-w-[60px]">
								${(hideCostBelowThreshold ?? 0).toFixed(2)}
							</span>
						</div>
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							{t("settings:display.costThreshold.currentValue", {
								value: (hideCostBelowThreshold ?? 0).toFixed(2),
							})}
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
