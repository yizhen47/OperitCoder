# 模式与 API 请求体（更详细对比版）

本文汇总：
1) 各模式用途与允许工具组
2) 请求体结构（带注释）
3) 软件发送给 AI 的内容清单
4) 不同情况下会附加的内容（便于对比）

> 基于当前代码路径（见文末“关键代码位置”）。

---

## 1. 内置模式与用途

来源：`packages/types/src/mode.ts`

### Architect
- 用途：规划/设计/拆解任务，信息收集、澄清问题、产出 todo 计划。
- 允许工具组：`read`、`edit`（**仅 .md**）、`browser`、`mcp`。
- 额外指令：强调规划、todo、用户确认后切换模式。

### Code
- 用途：编写/修改/重构代码。
- 允许工具组：`read`、`edit`、`browser`、`command`、`mcp`。

### Ask
- 用途：解释与答疑（不改代码）。
- 允许工具组：`read`、`browser`、`mcp`。
- 额外指令：只解释，不实现。

### Debug
- 用途：诊断问题、加日志、修复。
- 允许工具组：`read`、`edit`、`browser`、`command`、`mcp`。
- 额外指令：先多假设→收敛→验证→确认后再修。

### Orchestrator
- 用途：编排复杂流程，拆分为子任务并委派。
- 允许工具组：无。
- 但始终可用工具仍可用：
  `ask_followup_question`, `attempt_completion`, `switch_mode`, `new_task`,
  `report_bug`, `condense`, `update_todo_list`, `run_slash_command`。

### 自定义模式：translate / test
- 不在内置列表中，通常从以下加载：
  - 全局：`custom_modes.yaml`
  - 项目：`.kilocodemodes`
- 若需要精准说明 translate/test 的用途与工具组，请提供对应配置文件。

---

## 2. 请求体结构（带注释）

> 模式不会改变“字段结构”，主要改变 **system prompt 内容** 与 **tools 列表**。
> tool protocol 为 `native` 时才会在请求体中显式传 `tools`。
> tool protocol 为 `xml` 时，工具定义会写进 system prompt 文本中。

### 2.1 OpenAI 兼容请求体（示意 + 注释）

来源：`src/api/providers/base-openai-compatible-provider.ts`

```jsonc
{
  "model": "...",
  "max_tokens": 1234,
  "temperature": 0.0,
  "stream": true,

  // 由 Task.ts 组装：system prompt + 对话历史
  "messages": [
    { "role": "system", "content": "<SYSTEM_PROMPT（含模式 role/指令；XML 工具定义也在这里）>" },
    // ...历史消息（已清洗、去除不适配块、可能移除图片）
    // ...当前用户消息（含 environment_details、工具结果、文件/URL 片段等）
  ],

  // 仅当 tool protocol = native 且模型支持工具时
  "tools": [
    // 受模式工具组限制（read/edit/command/browser/mcp 等）
  ],
  "tool_choice": "auto",
  "parallel_tool_calls": false
}
```

### 2.2 Anthropic 请求体（示意 + 注释）

来源：`src/api/providers/anthropic.ts`

```jsonc
{
  "model": "...",
  "max_tokens": 1234,
  "temperature": 0.0,
  "stream": true,

  // system prompt 单独字段
  "system": [
    { "type": "text", "text": "<SYSTEM_PROMPT（含模式 role/指令；XML 工具定义也在这里）>" }
  ],

  // 由 Task.ts 组装：历史 + 当前用户
  "messages": [
    // ...历史消息（已清洗）
    // ...当前用户消息（含 environment_details、工具结果等）
  ],

  // 仅当 tool protocol = native 且模型支持工具时
  "tools": [
    // 受模式工具组限制
  ]
}
```

### 2.3 Provider 特定附加信息（可能出现在 header 或 provider 私有字段）

来源：`src/api/index.ts` 的 `ApiHandlerCreateMessageMetadata`

- `taskId`：不同 provider 可能用于 header 或自定义字段（例如 Roo、DeepInfra、Requesty、Unbound）。
- `mode`：部分 provider 会附加模式用于追踪。
- `projectId`：KiloCode OpenRouter 追踪字段。

> 这些不是通用“请求体字段”，而是 provider 自己决定如何发送（header / metadata / body）。

---

## 3. 软件发送给 AI 的内容清单（全量视角）

以下内容“可能”会被发送，具体取决于模式、工具协议、设置与当前状态。

### A. System Prompt（系统提示词）
由 `SYSTEM_PROMPT(...)` 生成，包含：
- 基础系统指令（全局约束与行为规范）
- 当前模式 roleDefinition / customInstructions
- 工具说明（当 tool protocol = XML 时，工具定义文本在这里）
- 自定义规则（全局/项目规则、模式自定义提示等）

### B. Conversation History（对话历史）
`apiConversationHistory` → 清洗后发送：
- 用户/助手历史消息
- 可能包含 `tool_use`/`tool_result` 块（native 工具协议）
- 可能包含 reasoning / thoughtSignature / reasoning_details（按模型能力保留/剔除）
- 可能移除图片（模型不支持时）

### C. 当前用户消息（Current User Content）
当前轮用户内容由以下组成：
- 用户输入文本
- 文件/URL/mentions 解析结果（例如引入文件片段、URL 内容）
- 工具执行结果（tool_result）
- `environment_details` 块（自动追加）

### D. Tools（仅 native 协议）
- 由 `buildNativeToolsArray(...)` 构建
- 受模式工具组限制（例如 Ask 模式无 edit/command）
- Always-available tools 仍可用（见下）

### E. Always-available 工具（全模式生效）
来源：`src/shared/tools.ts`
- `ask_followup_question`
- `attempt_completion`
- `switch_mode`
- `new_task`
- `report_bug`
- `condense`
- `update_todo_list`
- `run_slash_command`

---

## 4. 不同情况下会“附着”的内容（对比清单）

### 4.1 环境信息块 `environment_details`
来源：`src/core/environment/getEnvironmentDetails.ts`

可能包含：
- **VSCode 可见文件列表**（Visible Files）
- **VSCode 打开的 Tabs 列表**（Open Tabs）
- **终端输出**
  - 正在运行的终端（Active）
  - 已完成输出的终端（Inactive with output）
- **最近修改的文件列表**（Recently Modified Files）
- **当前时间与时区**（可配置开关）
- **Git Status**（可配置开关与最大文件数）
- **当前成本（Cost）**（可配置开关）
- **当前模式信息**
  - slug / name / model / tool_format
  - 当启用 POWER_STEERING：附加 roleDefinition 与 customInstructions
- **Browser 会话状态**（若启用且活跃）
- **工作区文件列表**（仅首次请求或 includeFileDetails=true）
  - 可能因设置被限制数量或不展示（桌面路径特殊处理）
- **Todo 提醒区**（若 todoListEnabled）

> 注意：系统会先移除旧的 environment_details，再追加新的，避免重复。

### 4.2 文件/URL 引用（Mentions）
当用户输入包含文件/URL 提示时，系统会：
- 读取文件片段或 URL 内容
- 将内容作为“用户消息的附加块”发送

### 4.3 工具结果（Tool Results）
- native 协议：通过 `tool_result` 块加入当前用户消息
- XML 协议：以文本或特定标记嵌入
- 在进入下一轮模型请求前，都会作为用户消息的一部分发送

### 4.4 图片/附件
- 若用户附图，可能作为 image block 发送
- 若模型不支持图片，会被清洗移除（`maybeRemoveImageBlocks`）

### 4.5 续跑/恢复任务
- 恢复时可能追加：
  - `New instructions for task continuation` 包裹的用户指令
  - 或 `[TASK RESUMPTION] Resuming task...`

### 4.6 沙盒包（Sandbox Packages）逻辑
沙盒包也被称为 “example packages”，用于在受控环境中运行内置脚本工具。

**发现与展示**
- 包来源：扩展内置 `dist/examples`，开发态回退 `src/examples`。
- 每个包的元数据来自 JS/TS 文件中的 `/* METADATA ... */` HJSON 块。
- System Prompt 会列出**包名与描述**，并提示“包工具需先激活才可用”。

**激活流程**
- 通过 `activate_sandbox_package` 工具激活（工具组：`mcp`）。
- 激活时需要用户审批（tool approval）。
- 激活成功后：
  - 任务会记录该包为“已激活”。
  - Tool Result 会返回该包下**具体工具名与参数**。
  - 下一轮请求中，这些 `pkg--<package>--<tool>` 工具才会对模型“显式可用”。

**工具暴露与调用**
- 工具命名格式：`pkg--<package>--<tool>`。
- 只有**已激活**的包工具会进入请求体 `tools`（native 协议）。
- XML 协议下不会进 `tools` 字段，但模型可根据激活结果文本调用同名工具。
- 包工具受“模式工具组”限制：只有包含 `mcp` 组的模式会允许这些动态工具调用。
- 若包未激活或被禁用，会返回提示并跳过执行。

**执行与沙盒环境**
- 包工具执行通过 `vm` 沙盒运行，超时默认 60 秒。
- 提供受限 API：`Tools`、`OkHttp`、`fetch`、`lodash lite`、`dataUtils` 等。
- 可在沙盒内“嵌套调用”部分内置工具（通过 `toolCall` 转发）：
  - 允许：`execute_command`, `read_file`, `write_to_file`, `apply_patch`,
    `apply_diff`, `search_files`, `list_files`。
  - 其他工具会被拒绝为“不支持的嵌套调用”。

**触发执行的入口**
- 模型输出 `pkg_tool_use` 后进入执行流程。
- 执行前同样会走 tool approval。
- 结果以 tool result 形式写入当前用户消息，再进入下一轮请求。

### 4.7 XML 工具定义在哪里、如何进入请求
**位置**\n
- XML 工具定义文本来自：`src/core/prompts/tools/*.ts`\n
- 这些定义通过：`src/core/prompts/tools/index.ts#getToolDescriptionsForMode` 汇总\n
- 最终由：`src/core/prompts/system.ts` 注入 **System Prompt**（仅 XML 协议时）\n
\n
**注入条件**\n
- `toolProtocol = xml` 才会把工具定义拼进 system prompt\n
- `toolProtocol = native` 时不拼（而是通过请求体 `tools` 字段传递）\n
\n
**表现形式**\n
- 每个工具以 “## tool_name” + XML 片段的形式描述（例如 `<read_file>...</read_file>`）\n
- 所有工具描述会拼成 `# Tools` 段落\n

### 4.8 为什么会把 XML 工具定义和沙盒包混淆
**容易混淆的原因**\n
- 两者都以“工具/Tools”语义出现，且同处于 system prompt 附近\n
- XML 工具定义是真正可调用的工具；沙盒包部分只是“包名+描述”清单\n
- 包工具名形如 `pkg--<package>--<tool>`，在未激活时并不会出现在 `# Tools` 定义里\n
- 但模型可能把“沙盒包清单”误认为已可直接调用的工具，导致误调用\n
\n
**系统如何防止错误执行**\n
- 若未激活包，系统会返回提示：先调用 `activate_sandbox_package`\n
- 若包被禁用，会直接拒绝执行并返回错误提示\n

### 4.9 沙盒包提示词与 XML 工具提示词“占多少”
**结论：没有固定值，动态变化。**\n
两部分提示词长度受多项配置影响，主要包括：\n
- 当前模式（决定允许的工具与是否显示沙盒包）\n
- 工具协议（XML 时才有工具定义文本；native 则无）\n
- 启用的沙盒包数量与描述长度（沙盒包文本会随包数量增长）\n
- 部分工具描述会随设置变化（如多文件读、partial read、浏览器支持等）\n
\n
**如何精确测量（推荐方法）**\n
1) 生成完整 System Prompt（包含 tools 与 sandbox packages）。\n
2) 使用当前模型的 tokenizer 对 prompt 计数。\n
\n
可以从以下两个段落分别计算字符/Token：\n
- **XML 工具定义段**：`getToolDescriptionsForMode(...)` 输出的 `# Tools` 文本\n+  - 文件：`src/core/prompts/tools/index.ts`\n+- **沙盒包段**：`getExamplePackagesSection(...)` 输出的 `# Sandbox Package Tools` 文本\n+  - 文件：`src/core/prompts/system.ts`\n+\n
若你需要“当前配置下的精确 token 数”，需要在运行时抓取实际 system prompt 并调用 `api.countTokens(...)` 统计（模型不同，tokenizer 也不同）。\n

---

## 5. 关键代码位置（便于核对）

- 模式定义：`packages/types/src/mode.ts`
- 模式选择与工具组限制：`src/shared/modes.ts`
- 工具组与 Always-available 工具：`src/shared/tools.ts`
- 请求体组装与发送：`src/core/task/Task.ts`
- 环境信息构造：`src/core/environment/getEnvironmentDetails.ts`
- OpenAI 兼容请求体：`src/api/providers/base-openai-compatible-provider.ts`
- Anthropic 请求体：`src/api/providers/anthropic.ts`
- Provider 元数据说明：`src/api/index.ts` (`ApiHandlerCreateMessageMetadata`)

---

## 6. 简化对比要点（快速对照）

- 模式差异本质：**system prompt 内容 + 可用 tools 列表**。
- tool protocol = native：`tools` 会进请求体；XML：工具定义写进 system prompt。
- environment_details 每轮都会追加，但内容随状态变化（终端输出/文件列表/时间/模式等）。

如需把 translate/test 也纳入对比，请提供相应自定义模式配置。
