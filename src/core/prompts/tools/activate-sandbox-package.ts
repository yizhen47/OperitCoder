// kilocode_change - new file

import { ToolArgs } from "./types"

export function getActivateSandboxPackageDescription(_args: ToolArgs): string {
	return `## activate_sandbox_package

Activate a sandbox (example) package for the current session.

Sandbox packages are listed by name and description, but their specific tools (pkg--<package>--<tool>) are NOT exposed until you activate the package.

After activation succeeds, the tool result will include the package's tool names, descriptions, and parameter schemas. Subsequent requests will allow calling those pkg-- tools.

**Parameters:**
- package_name (required): Name of the sandbox package to activate

**Usage:**
\`\`\`xml
<activate_sandbox_package>
<package_name>12306_ticket</package_name>
</activate_sandbox_package>
\`\`\``
}
