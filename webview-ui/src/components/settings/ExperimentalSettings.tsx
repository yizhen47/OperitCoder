import React, { HTMLAttributes } from "react"
import { FlaskConical } from "lucide-react"
import { VSCodeDropdown, VSCodeOption, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { Experiments, ImageGenerationProvider } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap } from "@roo/experiments"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@src/components/ui"

import {
	SetCachedStateField, // kilocode_change
	SetExperimentEnabled,
} from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExperimentalFeature } from "./ExperimentalFeature"
import { FastApplySettings } from "./FastApplySettings" // kilocode_change: Use Fast Apply version
import { ImageGenerationSettings } from "./ImageGenerationSettings"

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Experiments
	setExperimentEnabled: SetExperimentEnabled
	// kilocode_change start
	morphApiKey?: string
	fastApplyModel?: string
	fastApplyApiProvider?: string
	visitWebBrowserType?: "auto" | "bundled" | "edge" | "chrome" | "brave" | "custom"
	visitWebBrowserExecutablePath?: string
	setCachedStateField: SetCachedStateField<
		| "morphApiKey"
		| "fastApplyModel"
		| "fastApplyApiProvider"
		| "visitWebBrowserType"
		| "visitWebBrowserExecutablePath"
	>
	// kilocode_change end
	apiConfiguration?: any
	setApiConfigurationField?: any
	imageGenerationProvider?: ImageGenerationProvider
	openRouterImageApiKey?: string
	openRouterImageGenerationSelectedModel?: string
	setOpenRouterImageApiKey?: (apiKey: string) => void
	setImageGenerationSelectedModel?: (model: string) => void
}

export const ExperimentalSettings = ({
	experiments,
	setExperimentEnabled,
	apiConfiguration,
	setApiConfigurationField,
	imageGenerationProvider,
	openRouterImageApiKey,
	openRouterImageGenerationSelectedModel,
	setOpenRouterImageApiKey,
	setImageGenerationSelectedModel,
	className,
	// kilocode_change start
	morphApiKey,
	fastApplyModel, // kilocode_change: Fast Apply model selection
	fastApplyApiProvider, // kilocode_change: Fast Apply model api base url
	visitWebBrowserType,
	visitWebBrowserExecutablePath,
	setCachedStateField,
	// kilocode_change end
	...props
}: ExperimentalSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<FlaskConical className="w-4" />
					<div>{t("settings:sections.experimental")}</div>
				</div>
			</SectionHeader>

			<Section>
				{Object.entries(experimentConfigsMap)
					.filter(([key]) => key in EXPERIMENT_IDS)
					.filter((config) => config[0] !== "MARKETPLACE") // kilocode_change: we have our own market place, filter this out for now
					.map((config) => {
						if (config[0] === "MULTI_FILE_APPLY_DIFF") {
							return (
								<ExperimentalFeature
									key={config[0]}
									experimentKey={config[0]}
									enabled={experiments[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF, enabled)
									}
								/>
							)
						}
						// kilocode_change start
						if (config[0] === "MORPH_FAST_APPLY") {
							const enabled =
								experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false
							return (
								<React.Fragment key={config[0]}>
									<ExperimentalFeature
										key={config[0]}
										experimentKey={config[0]}
										enabled={enabled}
										onChange={(enabled) =>
											setExperimentEnabled(
												EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS],
												enabled,
											)
										}
									/>
									{enabled && (
										<FastApplySettings
											setCachedStateField={setCachedStateField}
											morphApiKey={morphApiKey}
											fastApplyModel={fastApplyModel}
											fastApplyApiProvider={fastApplyApiProvider}
										/>
									)}
								</React.Fragment>
							)
						}
						// kilocode_change end
						if (
							config[0] === "IMAGE_GENERATION" &&
							setOpenRouterImageApiKey &&
							setImageGenerationSelectedModel
						) {
							return (
								<ImageGenerationSettings
									key={config[0]}
									enabled={experiments[EXPERIMENT_IDS.IMAGE_GENERATION] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.IMAGE_GENERATION, enabled)
									}
									imageGenerationProvider={imageGenerationProvider}
									openRouterImageApiKey={openRouterImageApiKey}
									openRouterImageGenerationSelectedModel={openRouterImageGenerationSelectedModel}
									setOpenRouterImageApiKey={setOpenRouterImageApiKey}
									setImageGenerationSelectedModel={setImageGenerationSelectedModel}
								/>
							)
						}
						return (
							<ExperimentalFeature
								key={config[0]}
								experimentKey={config[0]}
								enabled={experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false}
								onChange={(enabled) =>
									setExperimentEnabled(
										EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS],
										enabled,
									)
								}
							/>
						)
					})}

				<Collapsible defaultOpen={false}>
					<div className="mt-2 rounded border border-vscode-panel-border bg-vscode-editor-background">
						<div className="flex items-center justify-between gap-3 px-3 py-2">
							<CollapsibleTrigger asChild>
								<button
									type="button"
									data-testid="visit-web-browser-trigger"
									className="text-vscode-foreground text-sm text-left w-full">
									{t("settings:experimental.visitWebBrowser.label")}
								</button>
							</CollapsibleTrigger>
						</div>

						<CollapsibleContent>
							<div
								className="border-t border-vscode-panel-border px-3 py-2"
								data-testid="visit-web-browser-content">
								<div className="flex flex-col gap-2">
									<div>
										<label className="text-xs text-vscode-descriptionForeground mb-1 block">
											{t("settings:experimental.visitWebBrowser.typeLabel")}
										</label>
										<VSCodeDropdown
											data-testid="visit-web-browser-type"
											className="w-full"
											value={visitWebBrowserType || "auto"}
											onChange={(e: any) =>
												setCachedStateField(
													"visitWebBrowserType",
													((e.target as any)?.value || "auto") as any,
												)
											}>
											<VSCodeOption value="auto">
												{t("settings:experimental.visitWebBrowser.types.auto")}
											</VSCodeOption>
											<VSCodeOption value="edge">
												{t("settings:experimental.visitWebBrowser.types.edge")}
											</VSCodeOption>
											<VSCodeOption value="chrome">
												{t("settings:experimental.visitWebBrowser.types.chrome")}
											</VSCodeOption>
											<VSCodeOption value="brave">
												{t("settings:experimental.visitWebBrowser.types.brave")}
											</VSCodeOption>
											<VSCodeOption value="bundled">
												{t("settings:experimental.visitWebBrowser.types.bundled")}
											</VSCodeOption>
											<VSCodeOption value="custom">
												{t("settings:experimental.visitWebBrowser.types.custom")}
											</VSCodeOption>
										</VSCodeDropdown>
										<p className="text-xs text-vscode-descriptionForeground mt-1">
											{t("settings:experimental.visitWebBrowser.description")}
										</p>
									</div>

									<VSCodeTextField
										data-testid="visit-web-browser-executable-path"
										className="w-full"
										value={visitWebBrowserExecutablePath || ""}
										placeholder={t("settings:experimental.visitWebBrowser.pathPlaceholder")}
										onInput={(e: any) =>
											setCachedStateField(
												"visitWebBrowserExecutablePath",
												String((e.target as any)?.value ?? ""),
											)
										}>
										{t("settings:experimental.visitWebBrowser.pathLabel")}
									</VSCodeTextField>
								</div>
							</div>
						</CollapsibleContent>
					</div>
				</Collapsible>
			</Section>
		</div>
	)
}
