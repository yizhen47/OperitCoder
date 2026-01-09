import {
	HTMLAttributes,
	useState, // kilocode_change
} from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Info, Download, Upload, TriangleAlert } from "lucide-react"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { getMemoryPercentage } from "@/kilocode/helpers"

export const About = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => {
	const { t } = useAppTranslation()

	const [kiloCodeBloat, setKiloCodeBloat] = useState<number[][]>([])

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			{/* kilocode_change start */}
			<SectionHeader
				description={t("settings:about.version", { version: "0.0.1" })}>
				<div className="flex items-center gap-2">
					<Info className="w-4" />
					<div>{t("settings:sections.about")}</div>
				</div>
			</SectionHeader>
			{/* kilocode_change end */}

			<Section>
				{/* kilocode_change start */}
				<div>
					<div>{t("settings:about.support.issue")}</div>
					<div>{t("settings:about.support.contact")}</div>
				</div>
				{/* kilocode_change end */}

				<div className="flex flex-wrap items-center gap-2 mt-2">
					<Button onClick={() => vscode.postMessage({ type: "exportSettings" })} className="w-28">
						<Upload className="p-0.5" />
						{t("settings:footer.settings.export")}
					</Button>
					<Button onClick={() => vscode.postMessage({ type: "importSettings" })} className="w-28">
						<Download className="p-0.5" />
						{t("settings:footer.settings.import")}
					</Button>
					<Button
						variant="destructive"
						onClick={() => vscode.postMessage({ type: "resetState" })}
						className="w-28">
						<TriangleAlert className="p-0.5" />
						{t("settings:footer.settings.reset")}
					</Button>
				</div>

				{
					// kilocode_change start
					process.env.NODE_ENV === "development" && (
						<div className="flex flex-wrap items-center gap-2 mt-2">
							<Button
								variant="destructive"
								onClick={() => {
									setKiloCodeBloat([...kiloCodeBloat, new Array<number>(20_000_000).fill(0)])
									console.debug(`Memory percentage: ${getMemoryPercentage()}`)
								}}>
								Development: Allocate memory
							</Button>
						</div>
					)
					// kilocode_change end
				}
			</Section>
		</div>
	)
}
