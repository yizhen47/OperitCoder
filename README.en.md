<p align="center">
  <a href="./README.md">中文</a> | <strong>English</strong>
</p>

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

## What you can do here

- **Write code with natural language**: describe your needs and it generates/modifies project files
- **Task automation**: automate repetitive coding workflows (terminal, browser, etc.)
- **Multi-mode collaboration**: planning (Architect) / coding (Coder) / debugging (Debugger) plus custom modes
- **MCP extensibility**: extend agent capabilities via MCP servers
- **Safety boundaries**: high-impact operations require explicit approval (configurable allow/deny rules)

## Practical changes in this fork

My goal is not to add random features, but to make the core path smoother, more stable, and less disruptive:

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

If you like VS Code, or you used closed-source AI code editors before and now have your own API, you are welcome to try Operit Coder.

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

## Changelog

### 0.0.4

- **Fix queue cancellation**: the cancel button now correctly cancels queued messages.
- **Resend UX improvement**: resending a message no longer requires pressing cancel first.
- **Enter to send queued messages**: added support for sending queued messages via Enter.
- **Fix resend enqueue bug**: fixed an issue where “resend” was incorrectly added to the queue.
- **AI message spacing tweaks**: reduced spacing in the thinking component for a denser layout.
- **Queue enqueue/clear conditions**: clarified and fixed when queued messages are added and cleared.
- **Unified typography and spacing**: consistent font sizes and improved spacing for a cleaner look. (`943c4685cc`)
- **Fix API config edit navigation in dialog**: fixed routing issues when editing API config. (`1311485310`)
- **Fix frontend diff rendering**: add/remove files are now shown as diffs; fixed diff display issues. (`817bf5a735`)

### 0.0.3

- **Removed Kilo Gateway / login entry points**: settings no longer show related providers/token validation; chat errors/prompts no longer show login buttons.
- **Removed Roo Code / Roo Cloud entry points and promotion**: no Roo Cloud login, balance, or cloud share entry points in the start page/settings/cloud UI.
- **Cleaned up image generation configuration**: removed Kilo Gateway-related image generation options/state fields; kept OpenRouter image generation configuration.
- **Simplified the start page**: “Configuration Type/Profile Type” is no longer shown.
- **Fixed start page navigation**: clicking “Get Started” now saves and automatically activates (loads) the profile, avoiding returning back to the start screen after saving.
- **Kept MCP marketplace**: MCP marketplace functionality and entry points remain unchanged.
- **Chat dialog layout fixes**: top buttons no longer overlap in narrow widths, and the dialog bottom boundary no longer shifts downward with width changes.
- **Fixed duplicate message sending/receiving**: fixed a message loop between the webview and extension so a single user message won’t trigger duplicate requests.

### 0.0.2

- **Operit toolkit**: synced Operit’s toolkit (still being adapted; some tools may be temporarily unavailable).
- **Settings**: added a **Sandbox package** option in settings.
- **Task cancel interaction**: removed the floating “cancel task” button to make cancellation logic stricter.
- **Send button state**: improved state management for the send message button.
- **Chat dialog layout**: adjusted layout so it automatically switches to a vertical arrangement when width shrinks.
- **Sandbox i18n**: added multi-language support for the Sandbox package.
- **Config display/switching**: improved how “Interaction Mode” and “API Profile” are shown and can be changed directly in the dialog; supports loading all models from the profile (loading GLM models the second time may be slightly slow).
- **Login dependency fix**: fixed the behavior where logging into Kilo was required to use the extension.
- **Tool activation logic**: rewrote tool activation logic and improved AI context management under the Sandbox package.
- **Auto approve**: added auto-approve support for the Sandbox package and tool activation.

### 0.0.1

- Initial release

## Installation

### Option 1: Install from VS Code Marketplace

Marketplace listing:

- https://marketplace.visualstudio.com/items?itemName=kilocode.Operit-Coder

### Option 2: Build from source and install `.vsix`

Install dependencies:

```bash
pnpm install
```

Build `.vsix`:

```bash
pnpm build
```

Artifacts are written to `bin/`.

On macOS/Linux:

```bash
code --install-extension "$(ls -1v bin/operit-coder-*.vsix | tail -n1)"
```

On Windows PowerShell:

```powershell
$vsix = Get-ChildItem .\bin\operit-coder-*.vsix | Sort-Object Name | Select-Object -Last 1
code --install-extension $vsix.FullName
```

## Development

See:

- [DEVELOPMENT.md](/DEVELOPMENT.md)

Common commands (run from repo root):

```bash
pnpm lint
pnpm check-types
pnpm test
```

## Project structure (short)

- `src/`: VS Code extension core
- `webview-ui/`: sidebar/panel UI
- `cli/`: terminal CLI
- `packages/`: shared packages
- `.changeset/`: version change records

## Feedback

- **Bugs / feature requests**: https://github.com/yizhen47/OperitCoder/issues

## Credits

This project evolves on top of the upstream ecosystem:

- KiloCode: https://github.com/Kilo-Org/kilocode

Thanks to all upstream contributors.

## License

See [LICENSE](./LICENSE)
