import { useCallback, useEffect, useRef, useState } from "react"

import type { ProviderSettings } from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"

const WelcomeViewProvider = () => {
	const { apiConfiguration, currentApiConfigName, setApiConfiguration, uriScheme } =
		useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const pendingActivation = useRef<string | null>(null)

	// Memoize the setApiConfigurationField function to pass to ApiOptions
	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setApiConfiguration({ [field]: value })
		},
		[setApiConfiguration], // setApiConfiguration from context is stable
	)

	const handleGetStarted = useCallback(() => {
		const error = apiConfiguration ? validateApiConfiguration(apiConfiguration) : undefined

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		const profileName = currentApiConfigName ?? "default"
		pendingActivation.current = profileName
		vscode.postMessage({ type: "upsertApiConfiguration", text: profileName, apiConfiguration })
	}, [apiConfiguration, currentApiConfigName])

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const message = event.data
			if (message?.type === "state" && pendingActivation.current) {
				const name = pendingActivation.current
				pendingActivation.current = null
				vscode.postMessage({ type: "loadApiConfiguration", text: name })
			}
		}
		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [])

	return (
		<Tab>
			<TabContent className="flex flex-col gap-4 p-6 justify-center">
				<h2 className="mt-0 mb-0 text-xl">{t("welcome:greeting")}</h2>

				<ApiOptions
					fromWelcomeView
					apiConfiguration={apiConfiguration || {}}
					uriScheme={uriScheme}
					setApiConfigurationField={setApiConfigurationFieldForApiOptions}
					errorMessage={errorMessage}
					setErrorMessage={setErrorMessage}
				/>

				<Button onClick={handleGetStarted} variant="primary">
					{t("welcome:providerSignup.getStarted")}
				</Button>
			</TabContent>
		</Tab>
	)
}

export default WelcomeViewProvider
