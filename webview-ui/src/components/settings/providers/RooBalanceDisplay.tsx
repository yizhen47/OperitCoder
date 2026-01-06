import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { useRooCreditBalance } from "@/components/ui/hooks/useRooCreditBalance"
import { useExtensionState } from "@src/context/ExtensionStateContext"

export const RooBalanceDisplay = () => {
	const { data: balance } = useRooCreditBalance()

	if (balance === null || balance === undefined) {
		return null
	}

	const formattedBalance = balance.toFixed(2)
	return (
		<VSCodeLink href="https://app.roocode.com/billing" className="text-vscode-foreground hover:underline whitespace-nowrap">
			${formattedBalance}
		</VSCodeLink>
	)
}
