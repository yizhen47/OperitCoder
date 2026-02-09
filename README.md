<p align="center">
  <a href="https://github.com/yizhen47/OperitCoder"><img src="https://img.shields.io/badge/GitHub-Repo-181717?style=flat&logo=github&logoColor=white" alt="GitHub Repo"></a>
  <a href="https://github.com/yizhen47/OperitCoder/issues"><img src="https://img.shields.io/badge/GitHub-Issues-1F6FEB?style=flat&logo=github&logoColor=white" alt="GitHub Issues"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=kilocode.Operit-Coder"><img src="https://img.shields.io/badge/VS_Code_Marketplace-007ACC?style=flat&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/yizhen47/OperitCoder?style=flat" alt="License"></a>
</p>

# 🚀 Operit Coder

> This is a personal-maintained fork of a VS Code AI coding assistant (based on [KiloCode](https://github.com/Kilo-Org/kilocode) / Roo Code).
>
> In this fork, I removed a large amount of cloud-related dependencies and logic to make it more standalone and minimal. I focus on improving the UI and day-to-day workflow. Some interaction patterns are inspired by closed-source AI editors, aiming to provide an open-source tool that feels smooth to use.
>
> It also supports custom AI APIs, so you can use your own models and API keys.

> 这是我个人维护的 VS Code AI 编码助手分支（基于 [KiloCode](https://github.com/Kilo-Org/kilocode) / Roo Code 体系）。
>
> 我在这个分支里删除了大量云端相关依赖与逻辑，使其更独立、更极简，并专注把 UI 与日常使用体验打磨得更顺手；制作过程中也参考了一些闭源 AI 代码编辑器的交互设计，希望让大家用上开源且顺手的工具。
>
> 同时支持自定义 AI API，让你用自己的模型与 Key。

## What you can do here

- **Write code with natural language**: describe your needs and it generates/modifies project files
- **Task automation**: automate repetitive coding workflows (terminal, browser, etc.)
- **Multi-mode collaboration**: planning (Architect) / coding (Coder) / debugging (Debugger) plus custom modes
- **MCP extensibility**: extend agent capabilities via MCP servers
- **Safety boundaries**: high-impact operations require explicit approval (configurable allow/deny rules)

## 你可以在这里做什么

- **自然语言写代码**：描述需求，自动生成/修改项目文件
- **任务自动化**：自动执行重复性编码流程（含终端、浏览器等）
- **多模式协作**：规划（Architect）/编码（Coder）/调试（Debugger）+ 自定义模式
- **MCP 扩展**：通过 MCP 服务器扩展代理能力
- **自带安全边界**：关键操作需要明确授权（可配置允许/拒绝规则）

## Practical changes in this fork

The focus is not on adding random features, but on making the core path smoother, more stable, and less disruptive:

- Reduce unnecessary dependencies and complexity (especially cloud-related parts)
- Make the UI denser so you can see more useful content in one screen
- Improve high-frequency interactions (checkpoints, resend, waiting states, etc.)

Some changes already implemented (more details can be found in the repo code and changesets):

- **Less cloud coupling / more standalone**
  - Removed many cloud-related dependencies and logic to reduce install/build/runtime overhead
  - More independent from the original Kilo direction, focused on minimalism and UX
  - Supports custom AI APIs (bring your own models and keys)
- **UI layout rework**
  - Removed the top task bar and checkpoint jump to reclaim space for chat and content
  - Improved layout density to reduce scrolling and context switching
- **Checkpoint behavior redesign**
  - Checkpoints behave more like “undo/rollback” (Cursor-style) to match “go back to that step” intuition
  - Fewer clicks for common actions
- **Message resend experience**
  - Avoids resending duplicate content when retrying a message; reduces accidental spam
- **Rendering and placeholder fixes**
  - Fixed ghost placeholders caused by layout index changes upstream
  - Switched to straightforward Markdown-only rendering to avoid “invisible but taking space” UI issues
- **Thinking/chat UI improvements**
  - Cleaner display for thinking content and chat layout; easier to scan
- **Thinking timer persistence fixes**
  - Fixed issues where thinking seconds wouldn’t stop, wouldn’t persist, or would disappear after refresh
- **Interaction polish**
  - Improved cancel button behavior and visual feedback, and added waiting animations
  - i18n tweaks: expanded language support and experimental defaults enabled
- **Concurrency & tabs**
  - Multi-chat and multi-task concurrency
  - Tab highlight styling and close logic fixes
- **Models & configuration**
  - OpenAI Compatible (Responses) provider support
  - Model list handling improvements
- **Stability & rendering**
  - Fixes for duplicate messages, diff rendering, and DOM reconciliation

## 我在这个分支做了哪些“实用向”改动

我维护这个分支的核心目标不是“堆稀奇古怪功能”，而是做好核心功能，把常用路径做得更顺、更稳定、更少打断：

- 尽量减少不必要的依赖与复杂度（尤其是云端相关部分）
- 让 UI 布局更紧凑，在同一屏里呈现更多有效内容
- 把一些高频但痛苦的交互（比如检查点、重发、等待状态）做得更符合直觉

以下是我自己维护过程中已经落地的一些改动点（更多细节见仓库代码与 changeset）：

- **去云端依赖 / 更独立**：
  - 删除大量云端相关依赖与逻辑，减少安装、构建与运行时的额外负担
  - 更独立于原本的 Kilo 方向，专注极简化与体验打磨
  - 支持自定义 AI API（使用你自己的模型与 Key）
- **UI 重新布局**：
  - 彻底删除顶部占位置的任务栏和检查点跳转，把空间还给对话与内容本身
  - 优化整体布局密度，让一个页面可以显示更多内容（减少滚动与切换）
- **检查点（Checkpoint）设定重做**：
  - 修改检查点的设定：现在更类似 Cursor 的撤回/回滚，尽量贴合“我想回到刚才那一步”的直觉
  - 降低操作成本：不用点那么多下
- **消息重发体验**：
  - 当用户需要重新发送消息时，避免重复发送相同内容，减少误触与刷屏
- **渲染与占位问题修复**：
  - 修复原版因布局 index 改变导致的幽灵组件占位问题
  - 改为纯 Markdown 渲染，渲染逻辑更直接，避免“看不见但占位”的 UI 问题
- **思考与对话 UI 优化**：
  - 优化思考内容的显示与对话框布局，使其更方便、简洁，并且更利于快速扫读
- **思考计时与持久化修复**：
  - 修复思考秒数不停止、不会储存，以及一刷新就没的 bug，让状态展示更可信
- **交互细节**：
  - 优化取消按键的体验与视觉反馈，并制作等待动画，让“正在做事”更明确
  - i18n 多语言支持增强，新增实验性设置默认开启
- **并发与标签体验**：
  - 支持对话并发与任务并发
  - 标签页高亮与关闭逻辑优化
- **模型与配置能力**：
  - OpenAI Compatible（Responses）供应商支持
  - 模型列表请求与相关逻辑优化
- **稳定性与渲染修复**：
  - 修复重复消息、diff 渲染与 React DOM 协调问题

If you like VS Code, or you used closed-source AI code editors before and now have your own API, you are welcome to try Operit Coder.

如果你觉得 VS Code 顺手，抑或你曾是闭源 AI 代码编辑器的用户，并且现在已经拥有了自己的 API，欢迎来使用 Operit Coder。

## Roadmap (near-term)

- **Move two MCP buttons into settings**: keep frequent entry points while reducing UI clutter
- **Reorganize settings**: clearer groups and naming
- **Rearrange the top bar**: prioritize commonly-used actions
- **Ensure the “expand” button in the top bar is not collapsed**: avoid losing key actions in narrow widths
- **Link chat history with model configuration**: keep the model/params used for each session
- **Support multi-model selection**: easier switching and comparison
- **Chat history import**
- **Custom themes (background / chat bubbles / AI & user avatars)**
- **Smoother UI**: better animations and interaction consistency
- **Will follow Operit project memory sync in the future**: https://github.com/AAswordman/Operit

## Roadmap（近期计划）

- **把 MCP 的两个按钮塞设置里**：把高频入口收纳进设置，减少 UI 干扰
- **重排设置**：更清晰的分组与更容易理解的命名
- **重排上边栏**：把更常用的功能放在更顺手的位置
- **确保上边栏“放大”按钮不会被折叠**：避免关键按钮在窄宽度下不可用
- **聊天记录与模型配置对接**：让历史对话能正确关联到当时使用的模型/参数
- **支持模型多选**：更灵活的模型切换与对比
- **聊天记录导入**：支持把历史记录迁移进来
- **支持自定义主题（背景 / 聊天框 / AI/对话头像）**：更强的个性化能力
- **更流畅的界面**：更好的动效与交互一致性
- **未来将跟随 Operit 项目记忆同步，请期待！**：https://github.com/AAswordman/Operit

## Changelog (English)

### 0.0.1 - 0.1.0 Summary

- **Concurrency & tabs**: multi-chat/task support, tab highlight polish, tab close fixes.
- **Core UI & interaction**: denser layout, clearer loading/waiting animations, spacing improvements.
- **Checkpoints & resend**: checkpoint logic redesign; resend avoids duplication.
- **Providers & models**: OpenAI Compatible (Responses) provider and model list handling improvements.
- **Stability & rendering**: fixes for duplicate messages, diff rendering, and DOM reconciliation.
- **i18n**: expanded language support and experimental defaults enabled.

### 0.1.0

- **Concurrent chats/tasks**: support for multi-chat and multi-task concurrency.
- **Tab UX polish**: improved tab highlight styling and interaction details.
- **Tab close fix**: fixed issues when closing tabs.
- **Removed browser tools**: removed browser-related tools to reduce overhead.
- **i18n defaults**: two new experimental settings are enabled by default.

[Jump to Chinese changelog](#更新日志)

## 更新日志

[Jump to English changelog](#changelog-english)

### 0.0.1 - 0.1.0 更新摘要

- **并发与标签体验**：支持对话/任务并发，标签页高亮与关闭逻辑优化。
- **核心 UI / 交互打磨**：布局更紧凑，加载/等待动画优化，思考区与消息间距更清晰。
- **检查点与重发体验**：检查点逻辑重做，重发避免重复与误触。
- **模型与配置能力**：新增/优化 OpenAI Compatible（Responses）供应商与模型列表请求逻辑。
- **稳定性与渲染修复**：修复重复消息、Diff 渲染与 React DOM 协调问题。
- **i18n 扩展**：增加多语言支持与实验性设置默认开启。

### 0.1.0

- **对话/任务并发**：支持多对话并发与任务并发。
- **标签页体验优化**：高亮样式美化、交互细节优化。
- **标签页关闭逻辑修复**：修复关闭标签页时的异常行为。
- **删除浏览器工具**：移除浏览器相关工具，减少冗余与依赖。
- **i18n 默认配置调整**：两个新的实验性设置默认开启。

<details>
<summary>历史版本更新日志（0.0.8 及更早）</summary>

### 0.0.8

- **等待动画升级为金属渐变风格**：优化等待动画视觉效果，采用金属渐变风格，提升界面质感。

### 0.0.7

- **智能压缩上下文按钮可主动触发**：对话框底部“智能压缩上下文”按钮现在可以在未达到自动压缩阈值时手动触发上下文压缩。
- **新增 OpenAI Compatible (Responses) 供应商**：设置中新增独立的 Responses 供应商入口。
- **Responses API 支持非流式**：当关闭流式输出时，Responses 请求会使用非流式模式并正确解析结果。
- **Responses 推理摘要开关**：新增 `enableResponsesReasoningSummary`（默认开启），用于控制是否请求/显示 reasoning summary。
- **修复构建与工具识别问题**：修复 `NATIVE_TOOL_DEFAULTS` 导入导致的构建失败，并补充导出 `isMcpTool` 用于识别 MCP 工具。
- **AI 编辑文件双击打开 Diff**：在 AI “编辑/改动文件”的文件条目上双击，可直接打开 VS Code 的 Diff 视图预览修改前后差异。

### 0.0.6

- **OpenAI Compatible 模型列表获取优化**：允许仅填写 `baseUrl` 也能请求模型列表（不强制要求 `apiKey`）。
- **OpenAI Compatible baseUrl 兼容增强**：自动规范化 `baseUrl`（去除末尾多余 `/`），并在访问 `.../models` 返回 404 时自动 fallback 到 `.../v1/models`。
- **补充单元测试**：为 `getOpenAiModels` 的 URL 规范化与 404 fallback 增加测试覆盖。

### 0.0.5

- **更清晰的加载动画**：优化加载状态的动画与反馈，使其更清晰。
- **修复智能压缩上下文**：修复智能压缩上下文逻辑异常。
- **修复 React DOM 协调错误**：修复尝试移除一个不属于父节点的子节点时的报错。

### 0.0.4

- **消息队列取消修复**：取消按钮现在会正确取消队列中的消息。
- **消息重发交互优化**：重发消息不再需要先点取消按钮。
- **新增回车发送队列消息**：支持通过回车发送队列中的消息。
- **修复重发入队问题**：修复将“消息重发”错误加入队列的问题。
- **AI 消息行间距调节**：减小思考中组件的间距，整体更紧凑。
- **队列消息加入/清除条件确认**：明确并修复队列消息的加入与清除条件。
- **字号/间距统一**：字号统一、间距调节，整体更美观。
- **修复对话框内 API 配置编辑跳转**：修复编辑时路由跳转异常。
- **修复前端 diff 显示**：增删文件以 diff 形式显示，修复 diff 渲染问题。（`817bf5a735`）

### 0.0.3

- **移除 Kilo Gateway / 登录入口**：设置页不再出现相关 provider / token 校验；聊天错误与提示中不再出现登录按钮。
- **移除 Roo Code / Roo Cloud 入口与推广**：起始页/设置页/Cloud 相关 UI 不再出现 Roo Cloud 登录、余额展示、任务分享到云等入口。
- **图片生成配置清理**：移除与 Kilo Gateway 相关的图片生成选项与状态字段，保留 OpenRouter 的图片生成配置。
- **起始页简化**：起始页不再显示“配置类型/Profile Type”。
- **修复起始页跳转**：点击“开始使用”保存配置后会自动激活配置（load profile），避免保存后又回到开始界面。
- **MCP 市场保留**：MCP 市场功能与入口保留不动。
- **对话框布局修复**：对话框宽度变窄时顶部按钮不再重合，且对话框下边界位置不再随宽度变化而下移。
- **修复消息重复发送/重复回复**：修复 webview 与扩展之间的消息回环，避免同一条用户消息触发两次请求。

### 0.0.2 

- **Operit 工具包**：同步 Operit 的工具包（仍在持续适配中，部分工具暂不可用）
- **设置项**：在设置中新增 **Sandbox 包** 选项
- **任务取消交互**：取消“取消任务”的浮动按钮，使取消逻辑更严谨
- **发送消息状态**：优化发送消息按钮的状态管理
- **对话框布局**：调整对话框 UI 排布，宽度减小时自动切换为竖排布局
- **Sandbox 多语言**：增加对 Sandbox 包的多语言支持
- **配置展示/切换**：优化“选择交互模式”和“选择 API 配置”的显示逻辑，可在对话框内直接更改；并支持读取配置中的全部模型（第二次读取 GLM 模型可能略慢）
- **登录依赖修复**：修复必须登录 Kilo 才能使用的异常行为
- **激活工具逻辑**：重写激活工具逻辑，优化 Sandbox 包状态下的 AI 上下文管理
- **自动批准**：新增 Sandbox 包与激活工具的自动批准（Auto approve）

### 0.0.1

- 初始版本
</details>

## 安装

### 方式 1：从 VS Code Marketplace 安装

Marketplace 列表：

- https://marketplace.visualstudio.com/items?itemName=kilocode.Operit-Coder

### 方式 2：从源码构建并安装 `.vsix`

先安装依赖：

```bash
pnpm install
```

构建 `.vsix`：

```bash
pnpm build
```

构建产物会输出到 `bin/`。

在 macOS/Linux：

```bash
code --install-extension "$(ls -1v bin/operit-coder-*.vsix | tail -n1)"
```

在 Windows PowerShell：

```powershell
$vsix = Get-ChildItem .\bin\operit-coder-*.vsix | Sort-Object Name | Select-Object -Last 1
code --install-extension $vsix.FullName
```

## 开发

详细开发说明见：

- [DEVELOPMENT.md](/DEVELOPMENT.md)

常用命令（仓库根目录执行）：

```bash
pnpm lint
pnpm check-types
pnpm test
```

## 项目结构（简版）

- `src/`：VS Code 扩展主体
- `webview-ui/`：侧边栏/面板 UI
- `cli/`：终端版 CLI
- `packages/`：共享包
- `.changeset/`：版本变更记录

## 反馈与交流

- **Bug / 需求**：https://github.com/yizhen47/OperitCoder/issues

## 致谢

本项目基于上游生态持续演进：

- KiloCode：https://github.com/Kilo-Org/kilocode

感谢所有上游贡献者。

## 许可证

见 [LICENSE](./LICENSE)
