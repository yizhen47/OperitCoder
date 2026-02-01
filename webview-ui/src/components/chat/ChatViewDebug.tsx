/**
 * ChatViewDebug - React DOM错误调试组件
 * 用于追踪和修复React虚拟滚动相关的DOM操作错误
 */

import React from "react"

export const ChatViewDebug: React.FC = () => {
	React.useEffect(() => {
		// kilocode_change: 添加React DOM错误追踪
		console.log("[ChatViewDebug] Debug mode enabled")
		console.log("[ChatViewDebug] React version:", React.version)
		console.log("[ChatViewDebug] Tracking DOM mutations and React warnings...")

		// 监控React警告
		const originalError = console.error
		console.error = (...args) => {
			const message = args[0]
			if (typeof message === "string") {
				// 追踪React DOM相关错误
				if (
					message.includes("ReactDOM.render") ||
					message.includes("DOM") ||
					message.includes("findDOMNode") ||
					message.includes("was not found in the DOM")
				) {
					console.error("[React DOM Error Detected]:", ...args)
				}
			}
			originalError(...args)
		}

		return () => {
			console.error = originalError
		}
	}, [])

	// 监控DOM变化
	React.useEffect(() => {
		let mutationCount = 0
		const observer = new MutationObserver((mutations) => {
			mutationCount += mutations.length
			if (mutationCount > 100) {
				console.warn(
					`[ChatViewDebug] High DOM mutation rate detected: ${mutationCount} mutations. This may indicate unstable component rendering.`
				)
				mutationCount = 0
			}
		})

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
		})

		return () => {
			observer.disconnect()
			console.log(`[ChatViewDebug] Total mutations observed: ${mutationCount}`)
		}
	}, [])

	return null
}
