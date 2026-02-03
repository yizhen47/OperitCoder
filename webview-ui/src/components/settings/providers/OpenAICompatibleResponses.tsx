// kilocode_change - new file
import { Checkbox } from "vscrui"

import type { OrganizationAllowList, ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { OpenAICompatible } from "./OpenAICompatible"

type OpenAICompatibleResponsesProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

export const OpenAICompatibleResponses = (props: OpenAICompatibleResponsesProps) => {
	const { t } = useAppTranslation()
	const checked = props.apiConfiguration.enableResponsesReasoningSummary ?? true

	return (
		<>
			<OpenAICompatible {...props} />
			<div>
				<Checkbox
					checked={checked}
					onChange={(value: boolean) => {
						props.setApiConfigurationField("enableResponsesReasoningSummary", value)
					}}>
					{t("settings:providers.useReasoning")}
				</Checkbox>
			</div>
		</>
	)
}
