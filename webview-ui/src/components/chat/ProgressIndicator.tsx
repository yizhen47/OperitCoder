interface ProgressIndicatorProps {
	statusText?: string
}

export const ProgressIndicator = ({ statusText }: ProgressIndicatorProps) => (
	<div
		style={{
			display: "flex",
			alignItems: "center",
			gap: "4px",
		}}>
		<span
			style={{
				width: "6px",
				height: "6px",
				borderRadius: "50%",
				backgroundColor: "var(--vscode-descriptionForeground)",
				animation: "pulse 1.4s ease-in-out infinite",
			}}
		/>
		<span
			style={{
				width: "6px",
				height: "6px",
				borderRadius: "50%",
				backgroundColor: "var(--vscode-descriptionForeground)",
				animation: "pulse 1.4s ease-in-out 0.2s infinite",
			}}
		/>
		<span
			style={{
				width: "6px",
				height: "6px",
				borderRadius: "50%",
				backgroundColor: "var(--vscode-descriptionForeground)",
				animation: "pulse 1.4s ease-in-out 0.4s infinite",
			}}
		/>
		{statusText && (
			<span
				style={{
					marginLeft: "6px",
					fontSize: "12px",
					color: "var(--vscode-descriptionForeground)",
					whiteSpace: "nowrap",
				}}>
				{statusText}
			</span>
		)}
		<style>{`
			@keyframes pulse {
				0%, 100% { opacity: 0.3; }
				50% { opacity: 1; }
			}
		`}</style>
	</div>
)
