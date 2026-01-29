import { type ProviderSettings, type OrganizationAllowList } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

type RooProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	cloudIsAuthenticated: boolean
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

export const Roo = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	cloudIsAuthenticated,
	organizationAllowList,
	modelValidationError,
	simplifySettings,
}: RooProps) => {
	void apiConfiguration
	void setApiConfigurationField
	void routerModels
	void cloudIsAuthenticated
	void organizationAllowList
	void modelValidationError
	void simplifySettings
	return null
}
