// kilocode_change - new file

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as vm from "vm"

import { createDataUtils, createLodashLite } from "./libraries"
import { createOkHttpWithFetch } from "./okhttp"
import { createToolsApi } from "./tools"

export type SandboxLogger = Pick<Console, "log" | "warn" | "error"> & {
	debug?: (...args: any[]) => void
}

export type ToolCallHandler = (toolName: string, params?: Record<string, unknown>) => Promise<unknown>

export interface ExecuteSandboxedToolOptions {
	script: string
	toolExportName: string
	args: Record<string, unknown>
	cwd?: string
	env?: Record<string, string | undefined>
	state?: string
	onIntermediateResult?: (result: unknown) => void
	toolCall: ToolCallHandler
	logger?: SandboxLogger
	timeoutMs?: number
	filename?: string
	fetch?: typeof globalThis.fetch
}

const DEFAULT_TIMEOUT_MS = 60_000

function normalizeToolName(toolName: string): string {
	// Basic compatibility mapping from Operit tool names to this extension's native tools.
	// Keep this minimal; expand only when needed.
	switch (toolName) {
		case "write_file":
			return "write_to_file"
		default:
			return toolName
	}
}

function createToolCall(toolCall: ToolCallHandler) {
	return async (...rawArgs: any[]): Promise<any> => {
		let name: string
		let params: Record<string, unknown> | undefined

		// toolCall(toolType, toolName, toolParams?)
		if (typeof rawArgs[0] === "string" && typeof rawArgs[1] === "string") {
			name = rawArgs[1]
			params = (rawArgs[2] ?? undefined) as any
		} else if (typeof rawArgs[0] === "string") {
			// toolCall(toolName, toolParams?)
			name = rawArgs[0]
			params = (rawArgs[1] ?? undefined) as any
		} else if (rawArgs[0] && typeof rawArgs[0] === "object") {
			// toolCall({ name, params })
			name = String((rawArgs[0] as any).name)
			params = ((rawArgs[0] as any).params ?? undefined) as any
		} else {
			throw new Error("Invalid toolCall arguments")
		}

		return await toolCall(normalizeToolName(name), params)
	}
}

function safeAtob(value: string): string {
	return Buffer.from(String(value ?? ""), "base64").toString("binary")
}

function safeBtoa(value: string): string {
	return Buffer.from(String(value ?? ""), "binary").toString("base64")
}

export async function executeSandboxedTool(options: ExecuteSandboxedToolOptions): Promise<unknown> {
	const logger = options.logger ?? console
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
	const filename = options.filename ?? "package-tool.js"

	let didComplete = false
	let completionValue: unknown = undefined

	let resolveCompletion!: (v: unknown) => void
	let rejectCompletion!: (e: unknown) => void
	const completionPromise = new Promise<unknown>((resolve, reject) => {
		resolveCompletion = resolve
		rejectCompletion = reject
	})

	const complete = (value: unknown) => {
		if (didComplete) {
			return
		}
		didComplete = true
		completionValue = value
		resolveCompletion(value)
	}

	const sendIntermediateResult = (value: unknown) => {
		try {
			options.onIntermediateResult?.(value)
		} catch (e) {
			logger.warn("sendIntermediateResult handler failed", e)
		}
	}

	const getEnv = (key: string) => options.env?.[key]
	const getState = () => options.state

	const sandboxToolCall = createToolCall(options.toolCall)
	const okHttp = createOkHttpWithFetch(options.fetch ?? fetch)
	const Tools = createToolsApi(sandboxToolCall, okHttp, { cwd: options.cwd })

	const OkHttp = okHttp

	const NativeInterface = {
		callTool: (_toolType: string, toolName: string, paramsJson: string) => {
			throw new Error(
				`NativeInterface.callTool is not supported in desktop runtime (tool=${toolName}, params=${paramsJson})`,
			)
		},
		callToolAsync: (_callbackId: string, _toolType: string, toolName: string, paramsJson: string) => {
			throw new Error(
				`NativeInterface.callToolAsync is not supported in desktop runtime (tool=${toolName}, params=${paramsJson})`,
			)
		},
		setResult: (_result: string) => {
			// no-op in desktop runtime; scripts should use complete()
		},
		setError: (_error: string) => {
			// no-op
		},
		logInfo: (message: string) => {
			logger.log(message)
		},
		logError: (message: string) => {
			logger.error(message)
		},
		logDebug: (message: string, data: string) => {
			logger.debug ? logger.debug(message, data) : logger.log(message, data)
		},
		registerImageFromBase64: (_base64: string, _mimeType: string) => {
			throw new Error("NativeInterface.registerImageFromBase64 is not supported in desktop runtime")
		},
		registerImageFromPath: (_path: string) => {
			throw new Error("NativeInterface.registerImageFromPath is not supported in desktop runtime")
		},
		reportError: (_errorType: string, _errorMessage: string, _errorLine: number, _errorStack: string) => {
			// no-op
		},
	}

	const sandboxConsole: Console = {
		log: (...args: any[]) => logger.log(...args),
		warn: (...args: any[]) => logger.warn(...args),
		error: (...args: any[]) => logger.error(...args),
		debug: (...args: any[]) => (logger.debug ? logger.debug(...args) : logger.log(...args)),
		info: (...args: any[]) => logger.log(...args),
		trace: (...args: any[]) => logger.log(...args),
		clear: () => undefined,
		count: () => undefined,
		countReset: () => undefined,
		group: () => undefined,
		groupCollapsed: () => undefined,
		groupEnd: () => undefined,
		table: () => undefined,
		time: () => undefined,
		timeEnd: () => undefined,
		timeLog: () => undefined,
		assert: () => undefined,
		dir: () => undefined,
		dirxml: () => undefined,
		profile: () => undefined,
		profileEnd: () => undefined,
		timeStamp: () => undefined,
		context: () => undefined,
	} as any

	const context = vm.createContext({
		console: sandboxConsole,
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
		Headers,
		fetch: options.fetch ?? fetch,
		atob: safeAtob,
		btoa: safeBtoa,
		TextEncoder: globalThis.TextEncoder,
		TextDecoder: globalThis.TextDecoder,
		crypto: (globalThis as any).crypto,

		exports: {},
		module: { exports: {} },

		complete,
		sendIntermediateResult,
		getEnv,
		getState,
		toolCall: sandboxToolCall,
		Tools,
		OkHttp,
		NativeInterface,
		_: createLodashLite(),
		dataUtils: createDataUtils(),
	})

	// Keep exports/module.exports aligned (CommonJS style)
	;(context as any).module.exports = (context as any).exports

	try {
		const script = new vm.Script(options.script, { filename })
		script.runInContext(context)

		const exported = (context as any).exports
		const toolFn = exported?.[options.toolExportName]
		if (typeof toolFn !== "function") {
			throw new Error(`Tool export not found: ${options.toolExportName}`)
		}

		const executePromise = (async () => {
			const returned = await toolFn(options.args)
			if (didComplete) {
				return completionValue
			}
			if (returned !== undefined) {
				return returned
			}
			return await completionPromise
		})()

		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs)
		})

		return await Promise.race([executePromise, timeoutPromise])
	} catch (error) {
		if (!didComplete) {
			rejectCompletion(error)
		}
		throw error
	}
}
