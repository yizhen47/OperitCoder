import type { CloudUserInfo, CloudOrganizationMembership } from "@roo-code/types"

type CloudViewProps = {
	userInfo: CloudUserInfo | null
	isAuthenticated: boolean
	cloudApiUrl?: string
	organizations?: CloudOrganizationMembership[]
}

export const CloudView = (_props: CloudViewProps) => null
