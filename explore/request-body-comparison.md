# 请求体文件对比与改进建议

对比对象：
- `explore/modes-and-requests.md`
- `explore/request_body_annotated.jsonc`

---

## 主要差异

| 维度 | modes-and-requests.md | request_body_annotated.jsonc |
| --- | --- | --- |
| 目标 | 系统级说明：模式、工具组、请求体结构、环境信息等 | 请求体实现细节：字段示例与注释为主 |
| 形式 | 叙述型 Markdown | JSONC 示例 + 分段注释 |
| 覆盖范围 | OpenAI 兼容 + Anthropic + 元数据/环境细节 | OpenAIProvider + Deepseek 特例 + 示例工具 |
| 细节深度 | 中等：请求体结构、工具协议差异 | 高：message 形态、tool_calls、reasoning_content |
| 工具协议 | 明确区分 native / xml，说明 tools 字段何时出现 | 仅在 OpenAIProvider 语境中描述 enableToolCall |
| 多模态 | 未展开具体 content 结构 | 详细列出 image/audio/video content 结构 |
| 头信息 | 说明 provider 可能在 header/metadata/body 附加 | 给出 Authorization/Content-Type 等头示例 |
| 可读性 | 面向概览/对比 | 面向实现与调试 |

---

## 哪个更好

结论（就“请求体”主题而言）：`request_body_annotated.jsonc` 更好。

原因：
- 更接近实际实现：字段级注释、tool_calls 形态、多模态结构与 Deepseek 特殊字段都更具体。
- 更适合调试/实现验证：可以直接逐字段核对代码路径。

但：如果目的是“了解系统整体如何拼装请求”，`modes-and-requests.md`更适合做入口说明。

---

## 怎么改（建议落地清单）

### 1) 明确分工与入口
- `modes-and-requests.md` 保持“系统概览 + 导航”，在“请求体结构”处链接到 `request_body_annotated.jsonc`。
- `request_body_annotated.jsonc` 作为“权威字段级说明”，专注请求体细节。

### 2) 补齐彼此缺口
- 在 `request_body_annotated.jsonc` 增加 Anthropic 请求体示例（system 字段、messages 结构），对应 `modes-and-requests.md` 的 2.2 章节。
- 在 `modes-and-requests.md` 增加 message 的具体形态（纯文本 vs 多模态、tool_calls/ tool_result），避免读者以为只有文本。

### 3) 统一术语与触发条件
- 把“tool protocol = native/xml”与“enableToolCall/availableTools”对齐：
  - 文档中说明：native 协议 + enableToolCall 才会带 tools 字段。
- 统一“OpenAI 兼容”的命名：`OpenAIProvider` vs `base-openai-compatible-provider`，避免读者误解为不同实现。

### 4) 增加版本/来源标注
- 两份文档都在开头加“基于代码路径 + 最近校验日期”，避免与实现脱节。
- 关键字段旁标明源文件/函数（和 `modes-and-requests.md` 的“关键代码位置”风格一致）。

### 5) 避免重复、压缩冗余
- 删除 `modes-and-requests.md` 中“请求体结构”与 JSONC 重复的细节，只保留结构示意。
- 让 JSONC 文件只保留“请求体相关字段”，把“环境信息/模式介绍”留在 Markdown。

---

## 需要修改的优先级（建议顺序）

1) `request_body_annotated.jsonc` 添加 Anthropic 请求体示例。
2) `modes-and-requests.md` 加一小节：message content 形态（纯文本/多模态/工具）。
3) 两处术语对齐与触发条件说明。

如果你确认要改，我可以直接改这两份文件并更新目录说明。
