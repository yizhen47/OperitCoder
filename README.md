<p align="center">
  <a href="https://github.com/yizhen47/OperitCoder"><img src="https://img.shields.io/badge/GitHub-Repo-181717?style=flat&logo=github&logoColor=white" alt="GitHub Repo"></a>
  <a href="https://github.com/yizhen47/OperitCoder/issues"><img src="https://img.shields.io/badge/GitHub-Issues-1F6FEB?style=flat&logo=github&logoColor=white" alt="GitHub Issues"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=kilocode.Operit-Coder"><img src="https://img.shields.io/badge/VS_Code_Marketplace-007ACC?style=flat&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/yizhen47/OperitCoder?style=flat" alt="License"></a>
</p>

# 🚀 Operit Coder

> 这是我个人维护的 VS Code AI 编码助手分支（基于 [KiloCode](https://github.com/Kilo-Org/kilocode) / Roo Code 体系）。我的目标很简单：把日常用得到的体验打磨好——更稳、更顺手、更少“莫名其妙”。

## 你可以在这里做什么

- **自然语言写代码**：描述需求，自动生成/修改项目文件
- **任务自动化**：自动执行重复性编码流程（含终端、浏览器等）
- **多模式协作**：规划（Architect）/编码（Coder）/调试（Debugger）+ 自定义模式
- **MCP 扩展**：通过 MCP 服务器扩展代理能力
- **自带安全边界**：关键操作需要明确授权（可配置允许/拒绝规则）

## 我在这个分支做了哪些“实用向”改动

以下是我自己维护过程中已经落地的一些改动点（更多细节见仓库代码与 changeset）：

- **错误页信息更准确**：错误界面优先显示扩展运行时版本号，并把“反馈链接”指向本仓库 Issues
- **Agent Manager 交互优化**：
  - 下拉菜单点击外部自动关闭
  - 悬停提示（tooltip）
  - 支持“追问问题”的建议按钮，一键回答
- **CLI 体验增强**：
  - 增加 `/condense`：手动压缩上下文
  - ESC/Ctrl+X 取消：更即时的取消反馈 + 更短的 readline escape 超时
  - `/mode` 命令支持自动补全（包含默认/自定义模式提示）
- **跨平台细节修复**：例如修复 macOS 下退出提示文案不一致问题

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
- `packages/`：共享包（含 `cloud` 等 workspace 包）
- `.changeset/`：版本变更记录

## 反馈与交流

- **Bug / 需求**：https://github.com/yizhen47/OperitCoder/issues

## 致谢

本项目基于上游生态持续演进：

- KiloCode：https://github.com/Kilo-Org/kilocode

感谢所有上游贡献者。

## 许可证

见 [LICENSE](./LICENSE)
