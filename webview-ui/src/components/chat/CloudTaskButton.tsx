import type { HistoryItem } from "@roo-code/types"

interface CloudTaskButtonProps {
	item?: HistoryItem
	disabled?: boolean
}

// kilocode_change: cloud features disabled
export const CloudTaskButton = ({ item, disabled = false }: CloudTaskButtonProps) => {
	void item
	void disabled
	return null
}
