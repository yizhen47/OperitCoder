# React DOM 错误修复方案

## 问题描述
在ChatRow组件第561行附近出现React DOM报错，通常表现为：
- "ReactDOM.render is no longer supported"
- "findDOMNode is deprecated"
- DOM操作顺序错误
- 虚拟滚动组件渲染异常

## 根本原因分析

### 1. react-virtuoso的data prop不稳定
**问题**: `groupedMessages`在每次渲染时创建新引用，导致Virtuoso认为数据已变化
**影响**: 触发不必要的重新渲染和DOM操作

### 2. computeItemKey返回值类型不一致
**问题**: `item.ts`返回number，但react-virtuoso期望稳定的字符串key
**影响**: 导致key冲突，React无法正确追踪组件

### 3. 组件快速卸载/挂载
**问题**: 在流式更新时，组件快速挂载和卸载
**影响**: 可能导致在已卸载组件上执行DOM操作

### 4. 缺少错误边界
**问题**: 没有错误边界捕获React渲染错误
**影响**: 错误导致整个应用崩溃

## 修复方案

### 修复1: 稳定computeItemKey返回值
```typescript
// 修改前
computeItemKey={(_index: number, item: ClineMessage) => item.ts}

// 修改后
computeItemKey={(_index: number, item: ClineMessage) => String(item.ts)}
```
**原因**: 确保key始终是字符串类型，避免类型转换问题

### 修复2: 添加组件挂载/卸载追踪
```typescript
// 在ChatRowContent组件中添加
const isMountedRef = useRef(true)

useEffect(() => {
  isMountedRef.current = true
  console.log(`[ChatRowContent] Mounted - ts: ${message.ts}, type: ${message.type}`)
  return () => {
    isMountedRef.current = false
    console.log(`[ChatRowContent] Unmounted - ts: ${message.ts}, type: ${message.type}`)
  }
}, [message.ts, message.type])

// 在异步操作前检查
if (isMountedRef.current) {
  // 执行DOM操作或状态更新
}
```

### 修复3: 添加虚拟滚动优化配置
```typescript
<Virtuoso
  // ... 其他props
  overscan={200}  // 预渲染更多项目，减少滚动时的重新渲染
/>
```

### 修复4: 添加React DOM错误追踪
```typescript
// 创建ChatViewDebug组件追踪DOM错误
const originalError = console.error
console.error = (...args) => {
  const message = args[0]
  if (typeof message === "string") {
    if (message.includes("DOM") || message.includes("findDOMNode")) {
      console.error("[React DOM Error Detected]:", ...args)
    }
  }
  originalError(...args)
}
```

### 修复5: 添加错误边界
```typescript
class ChatRowErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    console.error("[ChatRowErrorBoundary] Caught error:", error)
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ChatRowErrorBoundary] Error info:", errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-500 bg-red-50">
          <h3 className="text-red-700 font-bold">组件渲染错误</h3>
          <p className="text-red-600">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

### 修复6: 确保groupedMessages稳定性
```typescript
// 使用useMemo确保groupedMessages引用稳定
const groupedMessages = useMemo(() => {
  // ... 过滤和分组逻辑
  return result
}, [
  isCondensing,
  visibleMessages,
  isBrowserSessionMessage,
  condensingMessageTs,
  olderMessagesCollapsed,
  OLDER_MESSAGES_AUTO_COLLAPSE_THRESHOLD,
  OLDER_MESSAGES_COLLAPSED_TAIL_COUNT,
  COLLAPSED_OLDER_MESSAGES_TS,
])
```

## 实施步骤

### 阶段1: 添加调试信息
1. ✅ 在ChatRowContent添加挂载/卸载日志
2. ✅ 创建ChatViewDebug组件追踪DOM错误
3. ⏳ 在ChatView中引入ChatViewDebug

### 阶段2: 修复react-virtuoso配置
4. ⏳ 修改computeItemKey返回String(item.ts)
5. ⏳ 添加overscan配置
6. ⏳ 确保groupedMessages使用useMemo

### 阶段3: 添加错误边界
7. ⏳ 创建ChatRowErrorBoundary组件
8. ⏳ 在ChatView中包裹Virtuoso
9. ⏳ 在ChatRow中包裹内容

### 阶段4: 测试验证
10. ⏳ 在开发模式下测试流式更新
11. ⏳ 检查控制台日志
12. ⏳ 验证错误是否被捕获

## 预期效果

### 短期效果
- 控制台显示组件挂载/卸载日志
- React DOM错误被正确捕获和记录
- 虚拟滚动key稳定，减少不必要的重新渲染

### 长期效果
- 消除React DOM报错
- 提升虚拟滚动性能
- 更好的错误处理和用户体验

## 注意事项

1. **开发模式 vs 生产模式**
   - 生产模式下React会被压缩，错误信息可能不清晰
   - 建议在开发模式下测试修复

2. **性能影响**
   - 额外的日志和错误边界可能轻微影响性能
   - 可以通过环境变量控制调试日志级别

3. **向后兼容**
   - 所有修复都保持向后兼容
   - 不破坏现有功能

## 相关文件

- `webview-ui/src/components/chat/ChatRow.tsx` - 主要修复文件
- `webview-ui/src/components/chat/ChatView.tsx` - Virtuoso配置
- `webview-ui/src/components/chat/ChatViewDebug.tsx` - 调试工具
