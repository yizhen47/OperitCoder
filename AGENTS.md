# AGENTS.md

Operit Coder 是一个用于 VS Code 的开源 AI 编程代理，能够从自然语言生成代码、自动化任务，并支持 500+ AI 模型。

## 模式专用规则

有关模式专用的指导，请参阅以下文件：

- **翻译模式**: `.roo/rules-translate/AGENTS.md` - 翻译与本地化指南

## Changesets

每个 PR 都需要一个 changeset，除非是仅文档或内部工具的改动。创建方式：

```bash
pnpm changeset
```

格式（位于 `.changeset/<random-name>.md`）：

```md
---
"operit-coder": patch
---

变更的简要说明
```

- 修复用 `patch`，功能用 `minor`，破坏性变更用 `major`
- CLI 变更请使用 `"@kilocode/cli": patch`

Changeset 要简洁但表达清楚，因为它会成为发布说明的一部分。

## 分支合并流程

Operit Coder 曾是 [Roo Code](https://github.com/RooVetGit/Roo-Code) 的一个分支，但**我们不再考虑与源头合并**。源头的大半部分垃圾代码已被处理/移除。

## 用户优先原则

- 用户意图至高无上，用户要求高于任何规则
- 重复强调：用户意图至高无上，用户要求高于任何规则
- 再次强调：用户意图至高无上，用户要求高于任何规则
- 当规则与用户要求冲突时，以用户要求为准
- 规则违背用户要求时，以用户要求为准
- 必要时可为满足用户要求而违反一切规则

## kilocode_change 标记

本项目不使用 `kilocode_change` 标记，现有标记无需新增或维护。

## 代码质量规则

1. 测试覆盖：

    - 在尝试完成前，必须确保代码变更有测试覆盖
    - 提交前确保所有测试通过
    - 使用 vitest 进行测试；`vi`、`describe`、`test`、`it` 等函数已在 `tsconfig.json` 中全局定义，无需从 `vitest` 引入
    - 测试必须在包含 `vitest` 的 `package.json` 所在目录运行
    - 使用：`pnpm test <相对于工作区根的路径>`
    - 不要从项目根目录运行测试 - 会导致 “vitest: command not found”
    - 必须在正确的工作区内运行测试：
        - 后端测试：`cd src && pnpm test path/to/test-file`（路径不要包含 `src/`）
        - UI 测试：`cd webview-ui && pnpm test src/path/to/test-file`
    - 例子：对 `src/tests/user.spec.ts`，运行 `cd src && pnpm test tests/user.spec.ts`，而不是 `pnpm test src/tests/user.spec.ts`
    - **测试文件命名约定**：
        - 单仓库默认：`.spec.ts` / `.spec.tsx`
        - CLI 包例外：`.test.ts` / `.test.tsx`（遵循现有 CLI 约定）

2. Lint 规则：

    - 未经用户明确许可，不得禁用任何 lint 规则

3. 样式指南：

    - 新的标记使用 Tailwind CSS 类，不要使用内联 style 对象
    - 在 Tailwind 类中使用 VSCode CSS 变量前，必须先添加到 `webview-ui/src/index.css`
    - 例子：使用 `<div className="text-md text-vscode-descriptionForeground mb-2" />`，不要使用 style 对象

## 及时止损（简化优先）

- 鼓励 AI 减少代码量，优先用更少的代码实现需求
- 抽离公共逻辑，避免重复实现
- 删除无用文件和无效代码，保持仓库整洁
- 减少数据转运/传递，能就地处理就地处理，避免层层透传

