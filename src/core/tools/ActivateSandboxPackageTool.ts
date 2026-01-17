// kilocode_change - new file

import * as path from "path"

import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { scanExamplePackages } from "../tool-packages"
import { buildExampleToolName } from "../../utils/example-tool-name"
import { sanitizeMcpName } from "../../utils/mcp-name"

interface ActivateSandboxPackageParams {
	package_name: string
}

export class ActivateSandboxPackageTool extends BaseTool<"activate_sandbox_package"> {
	readonly name = "activate_sandbox_package" as const

	parseLegacy(params: Partial<Record<string, string>>): ActivateSandboxPackageParams {
		return {
			package_name: params.package_name || "",
		}
	}

	async execute(params: ActivateSandboxPackageParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult, toolProtocol } = callbacks

		try {
			const packageName = String(params.package_name || "").trim()
			if (!packageName) {
				task.consecutiveMistakeCount++
				task.recordToolError("activate_sandbox_package")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("activate_sandbox_package", "package_name"))
				return
			}

			task.consecutiveMistakeCount = 0

			const approvalMessage = JSON.stringify({
				tool: "sandboxPackageTool",
				packageName,
				toolName: "__activate__",
				arguments: JSON.stringify({ package_name: packageName }),
				toolProtocol,
			})

			const didApprove = await askApproval("tool", approvalMessage)
			if (!didApprove) {
				return
			}

			await task.say(
				"tool",
				JSON.stringify({
					tool: "sandboxPackageTool",
					packageName,
					toolName: "__activate__",
					arguments: JSON.stringify({ package_name: packageName }),
					content: "",
				}),
				undefined,
				true,
			)

			const provider = task.providerRef.deref()
			const extensionPath = provider?.context.extensionPath
			if (!extensionPath) {
				throw new Error("Provider not available")
			}

			const primaryExamplesDir = path.join(extensionPath, "dist", "examples")
			const fallbackExamplesDir = path.join(extensionPath, "src", "examples")

			let packages = await scanExamplePackages({ examplesDir: primaryExamplesDir })
			if (packages.length === 0) {
				packages = await scanExamplePackages({ examplesDir: fallbackExamplesDir })
			}

			const requested = sanitizeMcpName(packageName)
			const pkg = packages.find((p) => sanitizeMcpName(p.name) === requested)
			if (!pkg) {
				pushToolResult(
					`Package not found: ${packageName}. Available packages: ${packages
						.map((p) => p.name)
						.slice(0, 50)
						.join(", ")}`,
				)
				return
			}

			// Mark as activated for this task/session.
			task.activateExamplePackage(pkg.name)

			// Return tool descriptions (including tool names) so the model can call them next.
			const lines: string[] = []
			lines.push(`Activated sandbox package: ${pkg.name}`)
			if (pkg.description) {
				const desc =
					typeof pkg.description === "string" ? pkg.description : pkg.description["zh"] ?? pkg.description["en"]
				if (desc) {
					lines.push(desc)
				}
			}

			await task.say(
				"tool",
				JSON.stringify({
					tool: "sandboxPackageTool",
					packageName,
					toolName: "__activate__",
					arguments: JSON.stringify({ package_name: packageName }),
					content: `已激活沙盒包: ${pkg.name}`,
				}),
				undefined,
				false,
			)
			lines.push("")
			lines.push("Tools now available (function names):")

			for (const tool of pkg.tools) {
				const toolFullName = buildExampleToolName(pkg.name, tool.name)
				lines.push("")
				lines.push(`- ${toolFullName}`)
				if (tool.description) {
					const toolDesc =
						typeof tool.description === "string"
							? tool.description
							: tool.description["zh"] ?? tool.description["en"]
					if (toolDesc) {
						lines.push(`  ${toolDesc}`)
					}
				}
				if (tool.parameters && tool.parameters.length > 0) {
					lines.push("  Parameters:")
					for (const param of tool.parameters) {
						const required = param.required === false ? "optional" : "required"
						const paramDesc =
							typeof param.description === "string"
							? param.description
							: param.description?.["zh"] ?? param.description?.["en"]
						lines.push(
							`  - ${param.name} (${param.type}, ${required})${paramDesc ? `: ${paramDesc}` : ""}`,
						)
					}
				}
			}

			pushToolResult(lines.join("\n"))
		} catch (error) {
			await handleError("activating sandbox package", error as Error)
		}
	}
}

export const activateSandboxPackageTool = new ActivateSandboxPackageTool()
