// kilocode_change - new file
import { useEffect, useMemo, useRef, useState } from "react"
import { Button, Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"
import { Check, Pin } from "lucide-react"

import type { ProviderSettings } from "@roo-code/types"
import { useProviderModels } from "../hooks/useProviderModels"

interface ApiConfigMeta {
	id: string
	name: string
}

interface KiloProfileSelectorProps {
	currentConfigId: string
	currentModelId?: string
	currentApiConfigName?: string
	apiConfiguration?: ProviderSettings
	displayName: string
	listApiConfigMeta?: ApiConfigMeta[]
	pinnedApiConfigs?: Record<string, boolean>
	togglePinnedApiConfig: (configId: string) => void
	selectApiConfigDisabled?: boolean
	initiallyOpen?: boolean
	triggerClassName?: string
}

export const KiloProfileSelector = ({
	currentConfigId,
	currentModelId,
	currentApiConfigName,
	apiConfiguration,
	displayName,
	listApiConfigMeta,
	pinnedApiConfigs,
	togglePinnedApiConfig,
	selectApiConfigDisabled = false,
	initiallyOpen = false,
	triggerClassName,
}: KiloProfileSelectorProps) => {
	const { t } = useAppTranslation()
	const [open, setOpen] = useState(initiallyOpen)
	const [panel, setPanel] = useState<"config" | "model">("config")
	const [configSearchValue, setConfigSearchValue] = useState("")
	const [modelSearchValue, setModelSearchValue] = useState("")
	const [pendingConfigId, setPendingConfigId] = useState<string>("")
	const configSwitchRequestedRef = useRef<Set<string>>(new Set())

	const activeConfigId = pendingConfigId || currentConfigId
	const isSwitchingConfig = Boolean(pendingConfigId && pendingConfigId !== currentConfigId)
	const safeApiConfiguration =
		apiConfiguration ?? ({ apiProvider: "anthropic", apiModelId: "" } as unknown as ProviderSettings)
	const { providerModels, isLoading, isError } = useProviderModels(safeApiConfiguration)

	useEffect(() => {
		if (!pendingConfigId) {
			return
		}
		if (pendingConfigId === currentConfigId) {
			return
		}
		if (configSwitchRequestedRef.current.has(pendingConfigId)) {
			return
		}
		configSwitchRequestedRef.current.add(pendingConfigId)
		vscode.postMessage({ type: "loadApiConfigurationById", text: pendingConfigId })
	}, [pendingConfigId, currentConfigId])

	const filteredConfigs = useMemo(() => {
		const configs = listApiConfigMeta || []
		if (!configSearchValue) {
			return configs
		}
		const q = configSearchValue.toLowerCase()
		return configs.filter((c) => c.name.toLowerCase().includes(q))
	}, [listApiConfigMeta, configSearchValue])

	const pinnedConfigs = useMemo(
		() => filteredConfigs.filter((c) => pinnedApiConfigs && pinnedApiConfigs[c.id]),
		[filteredConfigs, pinnedApiConfigs],
	)
	const unpinnedConfigs = useMemo(
		() => filteredConfigs.filter((c) => !pinnedApiConfigs || !pinnedApiConfigs[c.id]),
		[filteredConfigs, pinnedApiConfigs],
	)

	const modelIds = useMemo(() => {
		const ids = providerModels ? Object.keys(providerModels) : []
		ids.sort((a, b) => a.localeCompare(b))
		const missingModelIds = currentModelId && ids.indexOf(currentModelId) >= 0 ? [] : currentModelId ? [currentModelId] : []
		const merged = missingModelIds.concat(ids)
		if (!modelSearchValue) {
			return merged
		}
		const q = modelSearchValue.toLowerCase()
		return merged.filter((id) => id.toLowerCase().includes(q))
	}, [providerModels, modelSearchValue, currentModelId])

	const triggerText = useMemo(() => {
		const modelLabel = currentModelId ? (providerModels?.[currentModelId]?.displayName ?? currentModelId) : ""
		return modelLabel || displayName
	}, [displayName, currentModelId, providerModels])

	useEffect(() => {
		if (!open) {
			setPanel("config")
			setPendingConfigId("")
			setConfigSearchValue("")
			setModelSearchValue("")
		}
	}, [open])

	return (
		<div className={cn("flex-1", "min-w-0", "overflow-hidden")}>
			<Popover open={open} onOpenChange={setOpen}>
				<StandardTooltip content={t("chat:selectApiConfig")}>
					<PopoverTrigger
						data-testid="kilo-profile-selector-trigger"
						disabled={selectApiConfigDisabled}
						className={cn(
							"w-full min-w-0 max-w-full inline-flex items-center gap-1.5 relative whitespace-nowrap px-1 py-0.5 text-xs",
							"bg-transparent border-0 rounded-md text-vscode-foreground",
							"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
							selectApiConfigDisabled
								? "opacity-50 cursor-not-allowed"
								: "opacity-90 hover:opacity-100 hover:bg-[var(--color-vscode-list-hoverBackground)] cursor-pointer",
							triggerClassName,
						)}>
						<span className="truncate">{triggerText}</span>
					</PopoverTrigger>
				</StandardTooltip>
				<PopoverContent className="p-0 overflow-hidden w-[320px]" align="start" sideOffset={4}>
					{panel === "config" ? (
						<div className="flex flex-col w-full">
							<div className="relative p-2 border-b border-vscode-dropdown-border">
								<input
									aria-label={t("common:ui.search_placeholder")}
									value={configSearchValue}
									onChange={(e) => setConfigSearchValue(e.target.value)}
									placeholder={t("common:ui.search_placeholder")}
									className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
									autoFocus
								/>
							</div>
							<div className="max-h-[300px] overflow-y-auto">
								{pinnedConfigs.map((config) => {
									const isCurrentConfig = config.name === currentApiConfigName
									return (
										<div
											key={config.id}
											className="flex justify-between gap-2 w-full py-1.5 px-3 cursor-pointer hover:bg-vscode-list-hoverBackground"
											onClick={() => {
												setPendingConfigId(config.id)
												setPanel("model")
											}}>
											<div className={cn("truncate min-w-0 overflow-hidden", { "font-medium": isCurrentConfig })}>
												{config.name}
											</div>
											<div className="flex justify-end w-10 flex-shrink-0">
												<div
													className={cn("size-5 p-1", {
														hidden: !isCurrentConfig,
													})}>
													<Check className="size-3" />
												</div>
												<StandardTooltip content={t("chat:unpin")}>
													<Button
														variant="ghost"
														size="icon"
														onClick={(e) => {
															e.stopPropagation()
															togglePinnedApiConfig(config.id)
															vscode.postMessage({ type: "toggleApiConfigPin", text: config.id })
														}}
														className="size-5 bg-accent">
														<Pin className="size-3 p-0.5 opacity-50" />
													</Button>
												</StandardTooltip>
											</div>
										</div>
									)
								})}
								{pinnedConfigs.length > 0 && unpinnedConfigs.length > 0 ? (
									<div className="py-1 px-3 text-xs text-vscode-descriptionForeground">
										{t("chat:separator")}
									</div>
								) : null}
								{unpinnedConfigs.map((config) => {
									const isCurrentConfig = config.name === currentApiConfigName
									const pinned = Boolean(pinnedApiConfigs?.[config.id])
									return (
										<div
											key={config.id}
											className="flex justify-between gap-2 w-full py-1.5 px-3 cursor-pointer hover:bg-vscode-list-hoverBackground"
											onClick={() => {
												setPendingConfigId(config.id)
												setPanel("model")
											}}>
											<div className={cn("truncate min-w-0 overflow-hidden", { "font-medium": isCurrentConfig })}>
												{config.name}
											</div>
											<div className="flex justify-end w-10 flex-shrink-0">
												<div
													className={cn("size-5 p-1", {
														"block group-hover:hidden": !pinned,
														hidden: !isCurrentConfig,
													})}>
													<Check className="size-3" />
												</div>
												<StandardTooltip content={pinned ? t("chat:unpin") : t("chat:pin")}>
													<Button
														variant="ghost"
														size="icon"
														onClick={(e) => {
															e.stopPropagation()
															togglePinnedApiConfig(config.id)
															vscode.postMessage({ type: "toggleApiConfigPin", text: config.id })
														}}
														className={cn("size-5", { "bg-accent": pinned })}>
														<Pin className="size-3 p-0.5 opacity-50" />
													</Button>
												</StandardTooltip>
											</div>
										</div>
									)
								})}
							</div>
							<div className="border-t border-vscode-dropdown-border">
								<button
									type="button"
									className="w-full text-left py-2 px-3 text-sm hover:bg-vscode-list-hoverBackground"
									onClick={() => {
										vscode.postMessage({
											type: "loadApiConfiguration",
											text: "settingsButtonClicked",
											values: { section: "providers" },
										})
										setOpen(false)
									}}>
									{t("chat:edit")}
								</button>
							</div>
						</div>
					) : (
						<div className="flex flex-col w-full">
							<div className="flex items-center justify-between gap-2 p-2 border-b border-vscode-dropdown-border">
								<button
									type="button"
									className="text-xs px-2 py-1 rounded hover:bg-vscode-list-hoverBackground"
									onClick={() => {
										setPanel("config")
										setModelSearchValue("")
										setPendingConfigId("")
									}}>
									{t("common:ui.back")}
								</button>
								<div className="truncate text-xs text-vscode-descriptionForeground">{t("chat:selectModelConfig")}</div>
							</div>
							<div className="relative p-2 border-b border-vscode-dropdown-border">
								<input
									aria-label={t("common:ui.search_placeholder")}
									value={modelSearchValue}
									onChange={(e) => setModelSearchValue(e.target.value)}
									placeholder={t("common:ui.search_placeholder")}
									className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
									autoFocus
								/>
							</div>
							<div className="max-h-[300px] overflow-y-auto">
								{isSwitchingConfig || isLoading ? (
									<div className="py-2 px-3 text-sm text-vscode-descriptionForeground">{t("common:ui.loading")}</div>
								) : isError ? (
									<div className="py-2 px-3 text-sm text-vscode-descriptionForeground">{t("common:ui.error")}</div>
								) : modelIds.length === 0 ? (
									<div className="py-2 px-3 text-sm text-vscode-descriptionForeground">{t("common:ui.no_results")}</div>
								) : (
									modelIds.map((id) => (
										<div
											key={id}
											className={cn(
												"px-3 py-1.5 text-sm cursor-pointer hover:bg-vscode-list-hoverBackground",
												id === currentModelId && "font-medium",
											)}
											onClick={() => {
												if (!activeConfigId) {
													return
												}
												vscode.postMessage({
													type: "setApiConfigModelById",
													values: { configId: activeConfigId, modelId: id },
												})
												setOpen(false)
											}}>
											{providerModels?.[id]?.displayName ?? id}
										</div>
									))
								)
								}
							</div>
						</div>
					)}
				</PopoverContent>
			</Popover>
		</div>
	)
}
