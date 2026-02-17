/* eslint-disable @typescript-eslint/no-explicit-any */

import * as path from "path"
import * as vm from "vm"

import * as vscode from "vscode"

import { sanitizeMcpName } from "../../../utils/mcp-name"
import { buildDefaultSandboxCapabilities, resolveToolPackageToolsForCapabilities, scanExamplePackages } from "../index"
import { getSandboxEnvValues } from "../env-secrets"
import { executeSandboxedTool } from "../runtime/sandbox"
import type { ToolPackage } from "../types"
import type { ToolPkgContainerRuntime } from "./types"
import type { ToolPkgRegistry } from "./registry"

export type ComposeDslNode = {
	type: string
	props: Record<string, any>
	children: ComposeDslNode[]
}

export type ComposeDslRenderResult = {
	tree: ComposeDslNode
	state: Record<string, any>
	memo: Record<string, any>
}

type ActionInvocation = { actionId: string; payload?: any }

type SessionDeps = {
	context: vscode.ExtensionContext
	registry: ToolPkgRegistry
	container: ToolPkgContainerRuntime
	uiModuleId: string
	uiEntryPath: string
	extensionPath: string
	initialEnvValues?: Record<string, string>
	packageOps?: {
		isPackageEnabled: (packageName: string) => boolean
		enablePackage: (packageName: string) => Promise<void>
	}
}

type ModuleExports = any

function isRecord(value: unknown): value is Record<string, any> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizePosix(p: string): string {
	return p.replace(/\\/g, "/")
}

function safeJoinPosix(fromDir: string, request: string): string {
	const joined = path.posix.normalize(path.posix.join(fromDir, request))
	return joined.replace(/^\/+/, "")
}

function looksLikeRelativeRequest(req: string): boolean {
	return req.startsWith("./") || req.startsWith("../") || req === "." || req === ".."
}

function tryResolveZipModulePath(requested: string): string[] {
	const candidates: string[] = []
	if (requested.toLowerCase().endsWith(".js") || requested.toLowerCase().endsWith(".json")) {
		candidates.push(requested)
	} else {
		candidates.push(`${requested}.js`)
		candidates.push(`${requested}.json`)
		candidates.push(path.posix.join(requested, "index.js"))
		candidates.push(path.posix.join(requested, "index.json"))
		candidates.push(requested)
	}
	return candidates
}

function extractActionId(value: any): string | null {
	if (!value) return null
	if (typeof value === "string") {
		const s = value.trim()
		if (!s) return null
		if (s.startsWith("__action:")) {
			const id = s.slice("__action:".length).trim()
			return id || null
		}
		return s
	}
	if (isRecord(value)) {
		const id = String(value.__actionId ?? "").trim()
		return id || null
	}
	return null
}

class ActionRegistry {
	private counter = 0
	private idsByFn = new WeakMap<Function, string>()
	private fnsById = new Map<string, Function>()

	register(fn: Function): { __actionId: string } {
		const existing = this.idsByFn.get(fn)
		if (existing) {
			this.fnsById.set(existing, fn)
			return { __actionId: existing }
		}
		const id = `a_${++this.counter}`
		this.idsByFn.set(fn, id)
		this.fnsById.set(id, fn)
		return { __actionId: id }
	}

	get(actionId: string): Function | undefined {
		return this.fnsById.get(actionId)
	}
}

export class ToolPkgComposeDslSession {
	readonly id: string
	readonly title: string

	private readonly deps: SessionDeps
	private readonly actionRegistry = new ActionRegistry()
	private readonly state = new Map<string, any>()
	private readonly memo = new Map<string, any>()

	private readonly moduleCache = new Map<string, { exports: ModuleExports; filename: string }>()
	private readonly vmContext: vm.Context
	private renderFn: ((ctx: any) => any) | null = null
	private readonly envValues = new Map<string, string>()
	private fileTextByLowerPath: Map<string, string> | null = null
	private fileJsonByLowerPath: Map<string, any> | null = null

	constructor(deps: SessionDeps) {
		this.deps = deps
		this.id = `toolpkg_ui_${Date.now()}_${Math.random().toString(16).slice(2)}`

		const title =
			deps.container.uiModules.find((m) => m.id === deps.uiModuleId)?.title ??
			deps.container.displayName ??
			deps.container.toolPkgId
		this.title = typeof title === "string" ? title : title?.["zh"] ?? title?.["en"] ?? deps.uiModuleId

		this.vmContext = vm.createContext({
			console,
			setTimeout,
			clearTimeout,
			setInterval,
			clearInterval,
			Promise,
			Date,
			Math,
			JSON,
			Buffer,
			URL,
			URLSearchParams,
			TextEncoder: globalThis.TextEncoder,
			TextDecoder: globalThis.TextDecoder,
		})

		for (const [k, v] of Object.entries(deps.initialEnvValues ?? {})) {
			const key = String(k ?? "").trim()
			if (!key) continue
			this.envValues.set(key, String(v ?? ""))
		}
	}

	private async ensureLoaded(): Promise<void> {
		if (this.renderFn) return

		await this.preloadZipTextFiles()

		const moduleExports = this.loadModuleSync(this.deps.uiEntryPath, this.deps.uiEntryPath)
		const candidate = moduleExports?.default ?? moduleExports

		if (typeof candidate !== "function") {
			throw new Error(`compose_dsl entry does not export a default function: ${this.deps.uiEntryPath}`)
		}

		this.renderFn = candidate
	}

	private async preloadZipTextFiles(): Promise<void> {
		if (this.fileTextByLowerPath && this.fileJsonByLowerPath) return

		const entries = await this.deps.registry.getZipEntries(this.deps.container.toolPkgId)
		if (!entries) {
			throw new Error(`ToolPkg not found: ${this.deps.container.toolPkgId}`)
		}

		const textByLower = new Map<string, string>()
		const jsonByLower = new Map<string, any>()

		const files = Object.values(entries.zip.files).filter((f) => !f.dir)
		for (const file of files) {
			const name = normalizePosix(file.name)
			const lower = name.toLowerCase()
			if (lower.endsWith(".js")) {
				const text = await file.async("string")
				textByLower.set(lower, text)
			} else if (lower.endsWith(".json")) {
				const text = await file.async("string")
				textByLower.set(lower, text)
				try {
					jsonByLower.set(lower, JSON.parse(text))
				} catch {
					// ignore
				}
			}
		}

		this.fileTextByLowerPath = textByLower
		this.fileJsonByLowerPath = jsonByLower
	}

	private resolveRequireToModulePath(request: string, fromFile: string): { kind: "zip"; path: string } | { kind: "node"; id: string } {
		const req = normalizePosix(String(request ?? ""))
		if (!req) {
			throw new Error("Empty require() request")
		}

		if (!looksLikeRelativeRequest(req)) {
			return { kind: "zip", path: req.replace(/^\/+/, "") }
		}

		const fromDir = path.posix.dirname(normalizePosix(fromFile))
		return { kind: "zip", path: safeJoinPosix(fromDir, req) }
	}

	private loadModuleSync(modulePath: string, fromFile: string): any {
		const resolved = this.resolveRequireToModulePath(modulePath, fromFile)
		if (resolved.kind !== "zip") {
			throw new Error(`Unsupported require('${modulePath}') in toolpkg UI module`)
		}

		const normalized = normalizePosix(resolved.path).replace(/^\/+/, "")
		const candidates = tryResolveZipModulePath(normalized)

		for (const candidate of candidates) {
			const key = candidate.toLowerCase()
			const cached = this.moduleCache.get(key)
			if (cached) {
				return cached.exports
			}
		}

		for (const candidate of candidates) {
			const key = candidate.toLowerCase()

			if (key.endsWith(".json")) {
				const json = this.fileJsonByLowerPath?.get(key)
				if (json !== undefined) {
					this.moduleCache.set(key, { exports: json, filename: `toolpkg:${this.deps.container.toolPkgId}/${candidate}` })
					return json
				}
			}

			const code = this.fileTextByLowerPath?.get(key)
			if (code == null) {
				continue
			}

			const filename = `toolpkg:${this.deps.container.toolPkgId}/${candidate}`
			const module = { exports: {} as any }
			const exports = module.exports

			const syncRequire = (req: string) => {
				const rel = normalizePosix(req)
				if (looksLikeRelativeRequest(rel) || rel.includes("/") || rel.includes("\\")) {
					return this.loadModuleSync(rel, candidate)
				}

				// Allow a small set of Node built-ins for convenience.
				const allowed = new Set(["url", "path"])
				if (!allowed.has(rel)) {
					throw new Error(`Unsupported require('${req}') in toolpkg UI module`)
				}
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				return require(rel)
			}

			const wrapper = new vm.Script(`(function (exports, module, require) {\n${code}\n})`, { filename })
			const fn = wrapper.runInContext(this.vmContext)
			fn(exports, module, syncRequire)

			this.moduleCache.set(key, { exports: module.exports, filename })
			return module.exports
		}

		throw new Error(`Cannot resolve module '${modulePath}' from '${fromFile}'`)
	}

	private getEnv(key: string): string {
		return this.envValues.get(key) ?? ""
	}

	private async setEnv(key: string, value: string): Promise<void> {
		const name = String(key ?? "").trim()
		if (!name) return
		const val = String(value ?? "")
		const secretKey = `sandbox-env:${encodeURIComponent(name)}`
		if (!val) {
			await this.deps.context.secrets.delete(secretKey)
			this.envValues.delete(name)
			return
		}
		await this.deps.context.secrets.store(secretKey, val)
		this.envValues.set(name, val)
	}

	private useState<T>(key: string, initialValue: T): [T, (v: T) => void] {
		const k = String(key ?? "").trim()
		if (!k) {
			return [initialValue, () => undefined]
		}
		if (!this.state.has(k)) {
			this.state.set(k, initialValue)
		}
		const setter = (v: T) => {
			this.state.set(k, v)
		}
		return [this.state.get(k) as T, setter]
	}

	private createNode(type: string, props?: Record<string, any> | null, children?: any): ComposeDslNode {
		const normalizedProps: Record<string, any> = {}
		for (const [k, v] of Object.entries(props ?? {})) {
			if (typeof v === "function") {
				normalizedProps[k] = this.actionRegistry.register(v)
			} else {
				normalizedProps[k] = v
			}
		}

		const outChildren: ComposeDslNode[] = []
		const pushChild = (c: any) => {
			if (!c) return
			if (Array.isArray(c)) {
				c.forEach(pushChild)
				return
			}
			if (typeof c === "string" || typeof c === "number" || typeof c === "boolean") {
				outChildren.push({ type: "Text", props: { text: String(c) }, children: [] })
				return
			}
			if (isRecord(c) && typeof c.type === "string" && Array.isArray(c.children)) {
				outChildren.push(c as ComposeDslNode)
			}
		}

		pushChild(children)
		return { type, props: normalizedProps, children: outChildren }
	}

	private buildCtx() {
		const ctx: any = {}

		const nodeTypes = [
			"Column",
			"Row",
			"Text",
			"Button",
			"TextField",
			"Spacer",
			"Card",
			"Icon",
			"CircularProgressIndicator",
			"Divider",
		]

		for (const type of nodeTypes) {
			ctx[type] = (props?: any, children?: any) => this.createNode(type, props, children)
		}

		ctx.useState = (key: string, initialValue: any) => this.useState(key, initialValue)
		ctx.getEnv = (key: string) => this.getEnv(key)
		ctx.setEnv = async (key: string, value: string) => await this.setEnv(key, value)
		ctx.getLocale = () => vscode.env.language

		ctx.getCurrentToolPkgId = () => this.deps.container.toolPkgId
		ctx.getCurrentPackageName = () => this.deps.container.toolPkgId

		ctx.resolveToolName = async (args: { packageName: string; toolName: string }) => {
			const p = String(args?.packageName ?? "").trim()
			const t = String(args?.toolName ?? "").trim()
			if (!p || !t) return ""
			return `${p}:${t}`
		}

		ctx.readResource = async (resourceKey: string) => {
			return await this.deps.registry.extractResourceToFile(this.deps.context, {
				toolPkgId: this.deps.container.toolPkgId,
				resourceKey: String(resourceKey ?? ""),
			})
		}

		ctx.importPackage = async (packageName: string) => {
			// In this extension, "import" maps to "enable sandbox package".
			const normalized = sanitizeMcpName(packageName)
			if (!normalized) return "Package name required"

			if (!this.deps.packageOps) {
				return `Imported package: ${normalized}`
			}

			await this.deps.packageOps.enablePackage(normalized)
			return `Imported package: ${normalized}`
		}

		ctx.usePackage = async (_packageName: string) => "OK"

		ctx.isPackageImported = async (packageName: string) => {
			if (!this.deps.packageOps) return true
			return this.deps.packageOps.isPackageEnabled(sanitizeMcpName(packageName))
		}

		ctx.callTool = async (toolName: string, params?: any) => {
			const name = String(toolName ?? "").trim()
			if (!name) throw new Error("Tool name required")

			if (name.toLowerCase() === "share_file") {
				const filePath = String(params?.path ?? "").trim()
				if (!filePath) {
					throw new Error("share_file requires { path }")
				}
				await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(filePath))
				return { success: true, path: filePath }
			}

			// Package tool call: "<package>:<tool>"
			const sep = name.indexOf(":")
			if (sep > 0) {
				const packageName = name.slice(0, sep)
				const tool = name.slice(sep + 1)
				return await this.executePackageTool(packageName, tool, params ?? {})
			}

			throw new Error(`Unsupported tool call from toolpkg UI: ${name}`)
		}

		return ctx
	}

	private async executePackageTool(packageName: string, toolName: string, params: Record<string, unknown>): Promise<any> {
		const extensionPath = this.deps.extensionPath
		const primaryExamplesDir = path.join(extensionPath, "dist", "examples")
		const isDevExtensionLayout = path.basename(extensionPath).toLowerCase() === "src"
		const fallbackExamplesDir = isDevExtensionLayout ? path.join(extensionPath, "examples") : path.join(extensionPath, "src", "examples")

		let packages = await scanExamplePackages({ examplesDir: primaryExamplesDir })
		if (packages.length === 0) {
			packages = await scanExamplePackages({ examplesDir: fallbackExamplesDir })
		}

		const requested = sanitizeMcpName(packageName)
		const pkg = packages.find((p) => sanitizeMcpName(p.name) === requested)
		if (!pkg) {
			throw new Error(`Package not found: ${packageName}`)
		}

		const capabilities = buildDefaultSandboxCapabilities({ supportsComputerUse: false })
		const { activeStateId, tools: effectiveTools } = resolveToolPackageToolsForCapabilities(pkg, capabilities)
		const tool = effectiveTools.find((t) => sanitizeMcpName(t.name) === sanitizeMcpName(toolName))
		if (!tool) {
			throw new Error(`Tool not found: ${packageName}:${toolName}`)
		}

		const env = await getSandboxEnvValues(this.deps.context.secrets, pkg.env)
		const result = await executeSandboxedTool({
			script: tool.script,
			toolExportName: tool.name,
			args: params,
			cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
			env,
			lang: vscode.env.language,
			state: activeStateId,
			toolCall: async () => {
				throw new Error("Nested tool calls are not supported from toolpkg UI")
			},
			filename: pkg.sourcePath ?? `toolpkg/${pkg.name}.js`,
			logger: console,
		})

		return result
	}

	async render(): Promise<ComposeDslRenderResult> {
		await this.ensureLoaded()

		const ctx = this.buildCtx()
		const tree = this.renderFn!(ctx)
		const node = isRecord(tree) && typeof tree.type === "string" ? (tree as ComposeDslNode) : this.createNode("Column", {}, [])
		return {
			tree: node,
			state: Object.fromEntries(this.state.entries()),
			memo: Object.fromEntries(this.memo.entries()),
		}
	}

	async invokeAction(invocation: ActionInvocation): Promise<void> {
		const actionId = String(invocation.actionId ?? "").trim()
		if (!actionId) return
		const fn = this.actionRegistry.get(actionId)
		if (!fn) {
			throw new Error(`Unknown action: ${actionId}`)
		}
		const payload = invocation.payload
		const result = fn.length >= 1 ? fn(payload) : fn()
		if (result && typeof result.then === "function") {
			await result
		}
	}

	extractActionIdFromValue(value: any): string | null {
		return extractActionId(value)
	}
}
