/**
 * ChatViewFixed - React DOM错误修复补丁
 * 此文件包含所有必要的修复，需要手动应用到ChatView.tsx
 */

// 修复1: 在ChatView.tsx顶部添加调试组件引入
// 在import语句后添加:
// import { ChatViewDebug } from "./ChatViewDebug" // kilocode_change: 添加调试组件
// import { ChatRowErrorBoundary } from "./ChatRowErrorBoundary" // kilocode_change: 添加错误边界

// 修复2: 在return语句中添加调试组件
// 在<div data-testid="chat-view" className={...}>之后添加:
// {process.env.NODE_ENV === "development" && <ChatViewDebug />}

// 修复3: 修改computeItemKey
// 将:
// computeItemKey={(_index: number, item: ClineMessage) => item.ts}
// 改为:
// computeItemKey={(_index: number, item: ClineMessage) => {
//   // kilocode_change: 确保key稳定，避免DOM操作冲突
//   return String(item.ts)
// }}

// 修复4: 添加overscan配置
// 在<Virtuoso>组件中添加:
// overscan={200}  // kilocode_change: 添加虚拟滚动优化配置

// 修复5: 用ChatRowErrorBoundary包裹Virtuoso
// 将:
// <Virtuoso ... />
// 改为:
// <ChatRowErrorBoundary messageTs={task?.ts}>
//   <Virtuoso ... />
// </ChatRowErrorBoundary>

export const CHANGES = {
	description: "React DOM错误修复 - 需要手动应用",
	changes: [
		{
			file: "webview-ui/src/components/chat/ChatView.tsx",
			type: "import",
			description: "添加调试组件和错误边界导入",
			code: `import { ChatViewDebug } from "./ChatViewDebug"
import { ChatRowErrorBoundary } from "./ChatRowErrorBoundary"`,
		},
		{
			file: "webview-ui/src/components/chat/ChatView.tsx",
			type: "render",
			description: "在开发模式下添加调试组件",
			code: `{process.env.NODE_ENV === "development" && <ChatViewDebug />}`,
			location: "在<div data-testid=\"chat-view\" ...>之后，<div>标签之前",
		},
		{
			file: "webview-ui/src/components/chat/ChatView.tsx",
			type: "virtuoso",
			description: "修复computeItemKey返回值和添加overscan",
			code: `computeItemKey={(_index: number, item: ClineMessage) => {
  // kilocode_change: 确保key稳定，避免DOM操作冲突
  return String(item.ts)
}}
overscan={200}  // kilocode_change: 添加虚拟滚动优化配置`,
		},
		{
			file: "webview-ui/src/components/chat/ChatView.tsx",
			type: "error-boundary",
			description: "用ChatRowErrorBoundary包裹Virtuoso",
			code: `<ChatRowErrorBoundary messageTs={task?.ts}>
  <Virtuoso ... />
</ChatRowErrorBoundary>`,
			location: "替换<Virtuoso>组件",
		},
	],
}
