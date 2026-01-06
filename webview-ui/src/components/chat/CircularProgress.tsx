import React from "react"
import { cn } from "@/lib/utils"

interface CircularProgressProps {
	percentage: number
	size?: number
	strokeWidth?: number
	className?: string
}

export const CircularProgress = ({
	percentage,
	size = 40,
	strokeWidth = 3,
	className,
}: CircularProgressProps) => {
	const radius = (size - strokeWidth) / 2
	const circumference = radius * 2 * Math.PI
	const offset = circumference - (percentage / 100) * circumference

	return (
		<div
			className={cn("relative inline-flex items-center justify-center", className)}
			style={{ width: size, height: size }}>
			<svg
				width={size}
				height={size}
				className="transform -rotate-90"
				viewBox={`0 0 ${size} ${size}`}>
				{/* Background circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-vscode-editor-background opacity-20"
				/>
				{/* Progress circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					className="text-vscode-foreground transition-all duration-300 ease-out"
					style={{
						strokeDasharray: circumference,
						strokeDashoffset: offset,
					}}
				/>
			</svg>
			{/* Percentage text in center */}
			<div className="absolute inset-0 flex items-center justify-center">
				<span className="text-xs font-medium text-vscode-foreground">
					{Math.round(percentage)}%
				</span>
			</div>
		</div>
	)
}
