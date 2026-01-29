import { useTranslation } from "react-i18next"

interface CloudUpsellDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onConnect: () => void
}

// Reusable method to render cloud benefits content
export const renderCloudBenefitsContent = (t: any) => {
	void t
	return null
}

export const CloudUpsellDialog = ({ open, onOpenChange, onConnect }: CloudUpsellDialogProps) => {
	const { t } = useTranslation()
	void t
	void open
	void onOpenChange
	void onConnect

	return null
}
