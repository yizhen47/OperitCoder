// kilocode_change - new file

import type OpenAI from "openai"

const ACTIVATE_SANDBOX_PACKAGE_DESCRIPTION = `Activate a sandbox (example) package for the current session.

Sandbox packages are discoverable by name and description, but their specific tools (pkg--<package>--<tool>) are NOT exposed until you explicitly activate the package.

After activation succeeds, the tool result will include the package's tool names, descriptions, and parameter schemas, and subsequent requests will allow calling those pkg-- tools.

Parameters:
- package_name: (required) The package name to activate (e.g., "12306_ticket", "time")`

const PACKAGE_NAME_PARAMETER_DESCRIPTION = `Name of the sandbox package to activate`

export default {
	type: "function",
	function: {
		name: "activate_sandbox_package",
		description: ACTIVATE_SANDBOX_PACKAGE_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				package_name: {
					type: "string",
					description: PACKAGE_NAME_PARAMETER_DESCRIPTION,
				},
			},
			required: ["package_name"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
