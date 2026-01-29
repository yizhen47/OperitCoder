import React from "react"
import { vscode } from "../../utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"
import KiloRulesToggleModal from "./rules/KiloRulesToggleModal"
import BottomButton from "./BottomButton"
import { BottomApiConfig } from "./BottomApiConfig" // kilocode_change

interface BottomControlsProps {
	showApiConfig?: boolean
}

const BottomControls: React.FC<BottomControlsProps> = ({ showApiConfig = false }) => {
	const { t } = useAppTranslation()

	const showFeedbackOptions = () => {
		vscode.postMessage({ type: "showFeedbackOptions" })
	}

	return (
		<>
			<div className="fixed top-0 left-0 z-[1000]">
				<KiloRulesToggleModal hideTrigger />
			</div>
			<div className="h-6" />
		</>
	)
}

export default BottomControls
