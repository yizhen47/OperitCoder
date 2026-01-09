# Operit Coder Development Guide

Welcome to the Operit Coder development guide! This document will help you set up your development environment and understand how to work with the codebase. Whether you're fixing bugs, adding features, or just exploring the code, this guide will get you started.

## Prerequisites

Before you begin, choose one of the following development environment options:

### Option 1: Native Development (Recommended for MacOS/Linux/Windows Subsystem for Linux)

1. **Git** - For version control
2. **Git LFS** - For large file storage (https://git-lfs.com/) - Required for handling GIF, MP4, and other binary assets
3. **Node.js** (version [v20.19.2](https://github.com/Kilo-Org/kilocode/blob/main/.nvmrc) recommended)
4. **pnpm** - Package manager (https://pnpm.io/)
5. **Visual Studio Code** - Our recommended IDE for development

### Option 2: Devcontainer (Recommended for Windows)

1. **Git** - For version control
2. **Git LFS** - For large file storage (https://git-lfs.com/) - Required for handling GIF, MP4, and other binary assets
3. **Docker Desktop** - For running the development container
4. **Visual Studio Code** - Our recommended IDE for development
5. **Dev Containers extension** - VSCode extension for container development

> **Note for Windows Contributors**: If you're having issues with WSL or want a standardized development environment, we recommend using the devcontainer option. It provides the exact same environment as our Nix flake configuration but works seamlessly on Windows without WSL.

### Option 3: Nix Flake (Recommended for NixOS/Nix users)

1. **Git** - For version control
2. **Git LFS** - For large file storage (https://git-lfs.com/) - Required for handling GIF, MP4, and other binary assets
3. **Nix** - The Nix package manager with flakes enabled
4. **direnv** - For automatic environment loading
5. **Visual Studio Code** - Our recommended IDE for development

## Getting Started

### Installation

#### Native Development Setup

1. **Fork and Clone the Repository**:

    - **Fork the Repository**:
        - Visit the [Operit Coder GitHub repository](https://github.com/Kilo-Org/kilocode)
        - Click the "Fork" button in the top-right corner to create your own copy.
    - **Clone Your Fork**:
        ```bash
        git clone https://github.com/[YOUR-USERNAME]/kilocode.git
        cd kilocode
        ```
        Replace `[YOUR-USERNAME]` with your actual GitHub username.

2. **Setup Git LFS**:

    ```bash
    git lfs install
    git lfs pull
    ```

    This ensures all large files (GIFs, MP4s, etc.) are properly downloaded.

3. **Install dependencies**:

    ```bash
    pnpm install
    ```

    This command will install dependencies for the main extension, webview UI, and e2e tests.

4. **Install VSCode Extensions**:
    - **Required**: [ESBuild Problem Matchers](https://marketplace.visualstudio.com/items?itemName=connor4312.esbuild-problem-matchers) - Helps display build errors correctly.

While not strictly necessary for running the extension, these extensions are recommended for development:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - Integrates ESLint into VS Code.
- [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) - Integrates Prettier into VS Code.

The full list of recommended extensions is [here](https://github.com/Kilo-Org/kilocode/blob/main/.vscode/extensions.json)

#### Devcontainer Setup (Recommended for Windows)

1. **Prerequisites**:

    - Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
    - Install [Visual Studio Code](https://code.visualstudio.com/)
    - Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. **Fork and Clone the Repository** (same as above)

3. **Open in Devcontainer**:

    - Open the project in VSCode
    - When prompted, click "Reopen in Container" or use Command Palette: `Dev Containers: Reopen in Container`
    - Wait for the container to build and setup to complete (this may take a few minutes on first run)

4. **Start Development**:
    - All dependencies are automatically installed
    - All recommended VSCode extensions are pre-installed
    - Press F5 to start debugging the extension

#### Nix Flake Setup (Recommended for NixOS/Nix users)

1. **Prerequisites**:

    - Install [Nix](https://nixos.org/download.html) with flakes enabled
    - Install [direnv](https://direnv.net/) for automatic environment loading
    - Install [Visual Studio Code](https://code.visualstudio.com/)
    - (Optional) Install the [mkhl.direnv](https://marketplace.visualstudio.com/items?itemName=mkhl.direnv) VSCode extension for better direnv integration

2. **Fork and Clone the Repository** (same as above)

3. **Setup Development Environment**:

    ```bash
    cd kilocode
    direnv allow
    ```

    The project includes a [`.envrc`](.envrc) file that automatically loads the Nix flake environment when you enter the directory. This provides:

    - Node.js 20 (matching the version in `.nvmrc`)
    - pnpm (via corepack)
    - All other necessary development dependencies

4. **Install Project Dependencies**:

    ```bash
    pnpm install
    ```

5. **Install VSCode Extensions** (same as native development setup above)

6. **Start Development**:
    - Press F5 to start debugging the extension
    - The environment is automatically activated when you enter the project directory
    - No need to manually run `nix develop` - direnv handles this automatically

### Project Structure

The project is organized into several key directories:

- **`src/`** - Core extension code
    - **`core/`** - Core functionality and tools
    - **`services/`** - Service implementations
- **`webview-ui/`** - Frontend UI code
- **`e2e/`** - End-to-end tests
- **`scripts/`** - Utility scripts
- **`assets/`** - Static assets like images and icons

## Development Workflow

### 🔧 本地调试

#### 一键启动调试（推荐）

在 VSCode 中按 `F5` 键（或选择 **Run** → **Start Debugging**）

这会自动：
1. ✅ 启动 webview-ui 开发服务器（Vite，支持热重载）
2. ✅ 启动扩展代码监听构建
3. ✅ 打开新的 VSCode 窗口进行调试

**终端显示**：
- 会创建两个独立的终端（webview-ui 和 extension）
- 💡 **提示**：可以点击终端右上角的拆分图标 `⊞`，将两个终端左右拆分显示

**开发模式特性**：
- ✅ Webview UI 更改会立即热重载
- ✅ 核心扩展代码更改会自动重新加载窗口

#### 手动启动（可选）

如果需要单独控制各个服务：

```bash
# 启动 webview-ui 开发服务器
cd webview-ui
pnpm dev

# 启动扩展代码监听
cd src
pnpm watch:bundle
```

然后在 VSCode 中按 F5 启动调试。

### 📦 打包插件

#### 完整打包流程

在项目根目录或 src 目录执行：

```bash
# 方式一：在项目根目录
pnpm build

# 方式二：在 src 目录
cd src && pnpm vsix
```

**打包过程**：
1. ✅ 构建 webview-ui（`cd ../webview-ui && pnpm build`）
2. ✅ 构建扩展代码（`pnpm bundle --production`）
3. ✅ 生成 `.vsix` 文件到 `bin/` 目录

**输出文件**：`bin/operit-coder-*.vsix`

### 📥 安装打包后的插件

```bash
# 自动安装最新版本
code --install-extension "$(ls -1v bin/operit-coder-*.vsix | tail -n1)"

# 或者在 VSCode 中手动安装
# Extensions → ... → Install from VSIX → 选择 bin/operit-coder-*.vsix
```

### 🔄 快速安装开发版本

使用 VSCode 任务快速构建并安装：

```bash
# 在 VSCode 中
# Terminal → Run Task → install-dev-extension
```

或命令行：

```bash
pnpm i && pnpm run build && code --force --install-extension "$(ls -1v bin/operit-coder-*.vsix | tail -n1)"
```

## Testing

Operit Coder uses several types of tests to ensure quality:

### Unit Tests

Run unit tests with:

```bash
pnpm test
```

This runs both extension and webview tests.

### End-to-End Tests

For more details on E2E tests, see [apps/vscode-e2e](apps/vscode-e2e/).

## Linting and Type Checking

Ensure your code meets our quality standards:

```bash
pnpm lint          # Run ESLint
pnpm check-types   # Run TypeScript type checking
```

## Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks, which automate certain checks before commits and pushes. The hooks are located in the `.husky/` directory.

### Pre-commit Hook

Before a commit is finalized, the `.husky/pre-commit` hook runs:

1.  **Branch Check**: Prevents committing directly to the `main` branch.
2.  **Type Generation**: Runs `pnpm --filter operit-coder generate-types`.
3.  **Type File Check**: Ensures that any changes made to `src/exports/roo-code.d.ts` by the type generation are staged.
4.  **Linting**: Runs `lint-staged` to lint and format staged files.

### Pre-push Hook

Before changes are pushed to the remote repository, the `.husky/pre-push` hook runs:

1.  **Branch Check**: Prevents pushing directly to the `main` branch.
2.  **Compilation**: Runs `pnpm run check-types` to ensure typing is correct.
3.  **Changeset Check**: Checks if a changeset file exists in `.changeset/` and reminds you to create one using `npm run changeset` if necessary.

These hooks help maintain code quality and consistency. If you encounter issues with commits or pushes, check the output from these hooks for error messages.

## Troubleshooting

### Common Issues

1. **Extension not loading**: Check the VSCode Developer Tools (Help > Toggle Developer Tools) for errors
2. **Webview not updating**: Try reloading the window (Developer: Reload Window)
3. **Build errors**: Make sure all dependencies are installed with `pnpm install`
4. **Ripgrep missing**: We bundle `@vscode/ripgrep`, but if that binary is missing the extension will fall back to `rg` on your `PATH` (commonly `/opt/homebrew/bin/rg` on macOS) or the path set in `RIPGREP_PATH`.

### Debugging Tips

- Use `console.log()` statements in your code for debugging
- Check the Output panel in VSCode (View > Output) and select "Operit Coder" from the dropdown
- For webview issues, use the browser developer tools in the webview (right-click > "Inspect Element")

### Testing with Local Backend

To test the extension against a local Operit Coder backend:

1. **Set up your local backend** at `http://localhost:3000`
2. **Use the "Run Extension [Local Backend]" launch configuration**:
    - Go to Run and Debug (Ctrl+Shift+D)
    - Select "Run Extension [Local Backend]" from the dropdown
    - Press F5 to start debugging

This automatically sets the `KILOCODE_BACKEND_BASE_URL` environment variable, making all sign-in/sign-up buttons point to your local backend instead of production.

## Contributing

We welcome contributions to Operit Coder! Here's how you can help:

1. **Report an issue** using [GitHub Issues](https://github.com/Kilo-Org/kilocode/issues)
2. **Find an issue** and submit a Pull Request with your fix
3. **Write tests** to improve Code Coverage
4. **Improve Documentation** at [kilo.ai/docs](https://kilo.ai/docs)
5. **Suggest a new feature** using [GitHub Discussions](https://github.com/Kilo-Org/kilocode/discussions/categories/ideas)!
6. Want to **implement something new**? Awesome! We'd be glad to support you on [Discord](https://discord.gg/Ja6BkfyTzJ)!

## Community

Your contributions are welcome! For questions or ideas, please join our Discord server: https://discord.gg/Ja6BkfyTzJ

We look forward to your contributions and feedback!
