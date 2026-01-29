<p align="center">
  <strong>中文</strong> | <a href="./README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/yizhen47/OperitCoder"><img src="https://img.shields.io/badge/GitHub-Repo-181717?style=flat&logo=github&logoColor=white" alt="GitHub Repo"></a>
  <a href="https://github.com/yizhen47/OperitCoder/issues"><img src="https://img.shields.io/badge/GitHub-Issues-1F6FEB?style=flat&logo=github&logoColor=white" alt="GitHub Issues"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=kilocode.Operit-Coder"><img src="https://img.shields.io/badge/VS_Code_Marketplace-007ACC?style=flat&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/yizhen47/OperitCoder?style=flat" alt="License"></a>
</p>

# 🚀 Operit Coder

> 这是我个人维护的 VS Code AI 编码助手分支（基于 [KiloCode](https://github.com/Kilo-Org/kilocode) / Roo Code 体系）。
> 
> 我在这个分支里删除了大量云端相关依赖与逻辑，使其更独立、更极简，并专注把 UI 与日常使用体验打磨得更顺手；制作过程中也参考了一些闭源 AI 代码编辑器的交互设计，希望让大家用上开源且顺手的工具。
> 
> 同时支持自定义 AI API，让你用自己的模型与 Key。

## 你可以在这里做什么

- **自然语言写代码**：描述需求，自动生成/修改项目文件
- **任务自动化**：自动执行重复性编码流程（含终端、浏览器等）
- **多模式协作**：规划（Architect）/编码（Coder）/调试（Debugger）+ 自定义模式
- **MCP 扩展**：通过 MCP 服务器扩展代理能力
- **自带安全边界**：关键操作需要明确授权（可配置允许/拒绝规则）

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

如果你觉得 VS Code 顺手，抑或你曾是闭源 AI 代码编辑器的用户，并且现在已经拥有了自己的 API，欢迎来使用 Operit Coder。

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

## 更新日志

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
