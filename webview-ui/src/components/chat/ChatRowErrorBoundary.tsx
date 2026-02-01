/**
 * ChatRowErrorBoundary - React错误边界组件
 * 用于捕获和处理ChatRow组件中的渲染错误
 */

import React from "react"

interface ChatRowErrorBoundaryState {
	hasError: boolean
	error: Error | null
}

interface ChatRowErrorBoundaryProps {
	children: React.ReactNode
	messageTs?: number
}

export class ChatRowErrorBoundary extends React.Component<
	ChatRowErrorBoundaryProps,
	ChatRowErrorBoundaryState
> {
	constructor(props: ChatRowErrorBoundaryProps) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): ChatRowErrorBoundaryState {
		// kilocode_change: 记录错误到控制台
		console.error("[ChatRowErrorBoundary] Caught error:", {
			message: error.message,
			stack: error.stack,
			component: "ChatRow",
			messageTs: "N/A",
		})
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// kilocode_change: 详细的错误信息记录
		console.error("[ChatRowErrorBoundary] Error info:", {
			error,
			errorInfo,
			componentStack: errorInfo.componentStack,
		})
	}

	render() {
		if (this.state.hasError) {
			return (
				<div
					className="p-4 border border-red-500 bg-red-50 dark:bg-red-950/20"
					data-testid="chat-row-error-boundary">
					<h3 className="text-red-700 dark:text-red-400 font-bold mb-2">
						消息渲染错误
					</h3>
					<p className="text-red-600 dark:text-red-300 text-sm mb-4">
						{this.state.error?.message || "未知错误"}
					</p>
					{process.env.NODE_ENV === "development" && (
						<details className="mt-2">
							<summary className="cursor-pointer text-xs text-red-500 dark:text-red-400">
								查看错误详情
							</summary>
							<pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-auto">
								{this.state.error?.stack}
							</pre>
						</details>
					)}
					<button
						onClick={() => window.location.reload()}
						className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
						重新加载页面
					</button>
				</div>
			)
		}
		return this.props.children
	}
}
