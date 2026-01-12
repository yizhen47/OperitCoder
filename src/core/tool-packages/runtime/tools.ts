// kilocode_change - new file

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fs from "fs/promises"
import * as path from "path"

import { createOkHttpWithFetch } from "./okhttp"

export type ToolsApi = Record<string, any>

export interface ToolsRuntimeOptions {
	/** Root directory for file operations. If omitted, defaults to process.cwd(). */
	cwd?: string
	maxFileSizeBytes?: number
	textProbeBytes?: number
}

function resolveSafePath(root: string, inputPath: string): string {
	if (!inputPath) {
		throw new Error("Path is required")
	}
	if (path.isAbsolute(inputPath)) {
		throw new Error("Absolute paths are not allowed in desktop runtime")
	}

	const resolvedRoot = path.resolve(root)
	const resolved = path.resolve(resolvedRoot, inputPath)
	if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
		throw new Error("Path escapes sandbox root")
	}
	return resolved
}

function toIsoStringSafe(ms: number): string {
	try {
		return new Date(ms).toISOString()
	} catch {
		return new Date().toISOString()
	}
}

function modeToPermString(mode: number): string {
	// Not trying to be a perfect ls -l replica; just enough for scripts.
	return (mode & 0o777).toString(8)
}

function isTextLike(buf: Buffer, probeBytes: number): boolean {
	const len = Math.min(buf.length, probeBytes)
	if (len === 0) {
		return true
	}

	let suspicious = 0
	for (let i = 0; i < len; i++) {
		const b = buf[i]
		if (b === 0) {
			return false
		}
		if (b < 0x09) {
			suspicious++
			continue
		}
		if (b >= 0x0e && b < 0x20) {
			suspicious++
		}
	}
	return suspicious / len < 0.3
}

function addLineNumbersKotlinStyle(content: string, startLineIndex: number, totalLines: number): string {
	const lines = String(content).split(/\r?\n/)
	if (lines.length === 0) {
		return ""
	}
	const maxDigits = (totalLines > 0 ? String(totalLines).length : String(lines.length).length) || 1
	return lines
		.map((line, index) => {
			const lineNumber = String(startLineIndex + index + 1).padStart(maxDigits, " ")
			return `${lineNumber}| ${line}`
		})
		.join("\n")
}

function splitFileLinesForCountingAndSlicing(text: string): string[] {
	const parts = String(text).split(/\r?\n/)
	if (parts.length === 1 && parts[0] === "") {
		return []
	}
	if (parts.length > 1 && parts[parts.length - 1] === "") {
		parts.pop()
	}
	return parts
}

async function statToExistsData(root: string, inputPath: string): Promise<any> {
	const full = resolveSafePath(root, inputPath)
	try {
		const st = await fs.stat(full)
		return {
			env: "linux" as const,
			path: inputPath,
			exists: true,
			isDirectory: st.isDirectory(),
			size: st.size,
		}
	} catch {
		return {
			env: "linux" as const,
			path: inputPath,
			exists: false,
		}
	}
}

async function listDirectory(root: string, inputPath: string): Promise<any> {
	const full = resolveSafePath(root, inputPath)
	const dirents = await fs.readdir(full, { withFileTypes: true })
	const entries = [] as any[]
	for (const d of dirents) {
		const p = path.join(full, d.name)
		let st: any
		try {
			st = await fs.stat(p)
		} catch {
			st = undefined
		}
		entries.push({
			name: d.name,
			isDirectory: d.isDirectory(),
			size: st?.size ?? 0,
			permissions: st ? modeToPermString(st.mode) : "",
			lastModified: st ? toIsoStringSafe(st.mtimeMs) : "",
			toString() {
				return this.name
			},
		})
	}
	return {
		env: "linux" as const,
		path: inputPath,
		entries,
		toString() {
			return entries.map((e) => e.name).join("\n")
		},
	}
}

async function readTextFile(root: string, inputPath: string, textOnly: boolean, probeBytes: number): Promise<any> {
	const full = resolveSafePath(root, inputPath)
	let buf: Buffer
	let st: import("fs").Stats
	try {
		st = await fs.stat(full)
	} catch {
		throw new Error(`File does not exist: ${inputPath}`)
	}
	if (!st.isFile()) {
		throw new Error(`Path is not a file: ${inputPath}`)
	}
	try {
		buf = await fs.readFile(full)
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		throw new Error(`Error reading file: ${message}`)
	}
	if (!isTextLike(buf, probeBytes)) {
		if (textOnly) {
			throw new Error(`Skipped non-text file: ${inputPath}`)
		}
		throw new Error("File does not appear to be a text file. Use specialized tools for binary files.")
	}
	return {
		env: "linux" as const,
		path: inputPath,
		content: buf.toString("utf8"),
		size: buf.length,
		toString() {
			return this.content
		},
	}
}

async function readTextFilePart(
	root: string,
	inputPath: string,
	startLineParam: number,
	endLineParam: number | undefined,
	maxFileSizeBytes: number,
): Promise<any> {
	const full = resolveSafePath(root, inputPath)
	let text: string
	let st: import("fs").Stats
	try {
		st = await fs.stat(full)
	} catch {
		throw new Error(`File does not exist or is not a regular file: ${inputPath}`)
	}
	if (!st.isFile()) {
		throw new Error(`File does not exist or is not a regular file: ${inputPath}`)
	}
	try {
		text = await fs.readFile(full, "utf8")
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		throw new Error(`Error reading file part: ${message}`)
	}

	const fileLines = splitFileLinesForCountingAndSlicing(text)
	const totalLines = fileLines.length

	const startLine = Math.max(1, Number(startLineParam) || 1)
	const startLineClamped = Math.min(Math.max(1, startLine), Math.max(1, totalLines))
	const endLine = Number.isFinite(endLineParam as number)
		? Number(endLineParam)
		: startLineClamped + 99
	const endLineClamped = Math.min(Math.max(endLine, startLineClamped), Math.max(1, totalLines))

	const startIndex = startLineClamped - 1
	const endIndex = endLineClamped

	const partContent = totalLines > 0 ? fileLines.slice(startIndex, Math.min(endIndex, totalLines)).join("\n") : ""

	let truncatedPartContent = partContent
	const isTruncated = truncatedPartContent.length > maxFileSizeBytes
	if (isTruncated) {
		truncatedPartContent = truncatedPartContent.substring(0, maxFileSizeBytes)
	}

	let contentWithLineNumbers = addLineNumbersKotlinStyle(truncatedPartContent, startIndex, totalLines)
	if (isTruncated) {
		contentWithLineNumbers += "\n\n... (file content truncated) ..."
	}

	return {
		env: "linux" as const,
		path: inputPath,
		content: contentWithLineNumbers,
		partIndex: 0,
		totalParts: 1,
		startLine: startIndex,
		endLine: Math.min(endIndex, totalLines),
		totalLines,
		toString() {
			return this.content
		},
	}
}

async function mkdirp(root: string, inputPath: string, createParents: boolean): Promise<any> {
	const full = resolveSafePath(root, inputPath)
	try {
		await fs.mkdir(full, { recursive: !!createParents })
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		throw new Error(`Error creating directory: ${message}`)
	}
	return {
		env: "linux" as const,
		operation: "mkdir",
		path: inputPath,
		successful: true,
		details: `Directory created: ${inputPath}`,
		toString() {
			return this.details
		},
	}
}

async function writeTextFile(root: string, inputPath: string, content: string, append = false): Promise<any> {
	const full = resolveSafePath(root, inputPath)
	try {
		await fs.mkdir(path.dirname(full), { recursive: true })
		if (append) {
			const exists = await fs
				.stat(full)
				.then(() => true)
				.catch(() => false)
			if (exists) {
				await fs.appendFile(full, String(content ?? ""), "utf8")
			} else {
				await fs.writeFile(full, String(content ?? ""), "utf8")
			}
		} else {
			await fs.writeFile(full, String(content ?? ""), "utf8")
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		throw new Error(`Error writing to file: ${message}`)
	}

	const st = await fs
		.stat(full)
		.catch(() => null)
	if (!st) {
		throw new Error("Write completed but file does not exist. Possible permission issue.")
	}

	if (st.size === 0 && String(content ?? "").length > 0) {
		throw new Error("File was created but appears to be empty. Possible write failure.")
	}

	return {
		env: "linux" as const,
		operation: append ? "append" : "write",
		path: inputPath,
		successful: true,
		details: append ? `Content appended to ${inputPath}` : `Content written to ${inputPath}`,
		toString() {
			return this.details
		},
	}
}

async function writeBinaryFile(root: string, inputPath: string, base64Content: string): Promise<any> {
	const full = resolveSafePath(root, inputPath)
	let buf: Buffer
	try {
		await fs.mkdir(path.dirname(full), { recursive: true })
		buf = Buffer.from(String(base64Content ?? ""), "base64")
		await fs.writeFile(full, buf)
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		throw new Error(`Error writing binary file: ${message}`)
	}

	const st = await fs
		.stat(full)
		.catch(() => null)
	if (!st) {
		throw new Error("Write completed but file does not exist. Possible permission issue.")
	}

	if (st.size === 0 && buf.length > 0) {
		throw new Error("File was created but appears to be empty. Possible write failure.")
	}

	return {
		env: "linux" as const,
		operation: "write_binary",
		path: inputPath,
		successful: true,
		details: `Binary content written to ${inputPath}`,
		toString() {
			return this.details
		},
	}
}

async function readBinaryFile(root: string, inputPath: string): Promise<any> {
	const full = resolveSafePath(root, inputPath)
	const buf = await fs.readFile(full)
	return {
		env: "linux" as const,
		path: inputPath,
		contentBase64: buf.toString("base64"),
		size: buf.length,
		toString() {
			return this.contentBase64
		},
	}
}

function stripHtmlToText(html: string): string {
	return String(html)
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim()
}

function extractHtmlTitle(html: string): string {
	const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)
	if (!match) {
		return ""
	}
	return stripHtmlToText(match[1] ?? "")
}

function extractHtmlLinks(html: string, baseUrl: string): Array<{ text: string; url: string }> {
	const links: Array<{ text: string; url: string }> = []
	const re = /<a\s+[^>]*href\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi
	let m: RegExpExecArray | null
	while ((m = re.exec(html))) {
		const href = m[2] ?? m[3] ?? m[4] ?? ""
		const text = stripHtmlToText(m[5] ?? "")
		if (!href || !text) {
			continue
		}
		if (href.startsWith("javascript:")) {
			continue
		}
		let resolved = href
		try {
			resolved = new URL(href, baseUrl).toString()
		} catch {
			// ignore
		}
		links.push({ text, url: resolved })
		if (links.length >= 30) {
			break
		}
	}
	return links
}

export function createToolsApi(
	toolCall: (...args: any[]) => Promise<any>,
	okHttp: ReturnType<typeof createOkHttpWithFetch>,
	options?: ToolsRuntimeOptions,
): ToolsApi {
	const root = options?.cwd ? path.resolve(options.cwd) : process.cwd()
	const maxFileSizeBytes = options?.maxFileSizeBytes ?? 100_000
	const textProbeBytes = options?.textProbeBytes ?? 512
	const terminalSessions = new Map<string, { name: string }>()
	const visitKey = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

	const netHttp = async (options: {
		url: string
		method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"
		headers?: Record<string, string>
		body?: string | object
		connect_timeout?: number
		read_timeout?: number
		follow_redirects?: boolean
		responseType?: "text" | "json" | "arraybuffer" | "blob"
		validateStatus?: boolean
	}) => {
		const client = okHttp
			.newBuilder()
			.connectTimeout(options.connect_timeout ?? 10000)
			.readTimeout(options.read_timeout ?? 10000)
			.followRedirects(options.follow_redirects ?? true)
			.build()

		const method = (options.method ?? "GET").toUpperCase()
		const request = client.newRequest().url(options.url).method(method)
		if (options.headers) {
			request.headers(options.headers)
		}
		if (options.body !== undefined && options.body !== null && method !== "GET" && method !== "HEAD") {
			if (typeof options.body === "string") {
				request.body(options.body, "text")
			} else {
				request.body(options.body, "json")
			}
		}

		const resp = await request.build().execute()
		return {
			url: options.url,
			statusCode: resp.statusCode,
			statusMessage: resp.statusMessage,
			headers: resp.headers,
			contentType: resp.contentType,
			content: resp.content,
			size: resp.size,
			toString() {
				return resp.content
			},
		}
	}

	return {
		Files: {
			list: async (p: string, _environment?: string) => await listDirectory(root, p),
			read: async (pathOrOptions: any) => {
				const p = typeof pathOrOptions === "string" ? pathOrOptions : pathOrOptions?.path
				const textOnly =
					typeof pathOrOptions === "object" && pathOrOptions
						? Boolean(pathOrOptions.text_only)
						: false
				if (!p) {
					throw new Error("Tools.Files.read requires a path")
				}
				return await readTextFile(root, p, textOnly, textProbeBytes)
			},
			readPart: async (p: string, startLine?: number, endLine?: number, _environment?: string) =>
				await readTextFilePart(root, p, startLine ?? 1, endLine, maxFileSizeBytes),
			write: async (p: string, content: string, append?: boolean, _environment?: string) =>
				await writeTextFile(root, p, content, !!append),
			writeBinary: async (p: string, base64Content: string, _environment?: string) =>
				await writeBinaryFile(root, p, base64Content),
			readBinary: async (p: string, _environment?: string) => await readBinaryFile(root, p),
			exists: async (p: string, _environment?: string) => await statToExistsData(root, p),
			mkdir: async (p: string, createParents?: boolean, _environment?: string) =>
				await mkdirp(root, p, !!createParents),
		},
		Net: {
			http: netHttp,
			httpGet: async (url: string) => {
				return await netHttp({ url, method: "GET" })
			},
			httpPost: async (url: string, body: string | object) => {
				return await netHttp({ url, method: "POST", body })
			},
			visit: async (urlOrParams: any) => {
				const url = typeof urlOrParams === "string" ? urlOrParams : urlOrParams?.url
				if (!url) {
					throw new Error("Tools.Net.visit requires a url")
				}
				const client = okHttp.newClient()
				const resp = await client.get(url, {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
				})
				const html = resp.content
				return {
					url,
					title: extractHtmlTitle(html),
					content: stripHtmlToText(html).slice(0, 8000),
					metadata: {},
					links: extractHtmlLinks(html, url),
					visitKey: visitKey(),
					toString() {
						return this.content
					},
				}
			},
		},
		System: {
			terminal: {
				create: async (sessionName: string) => {
					const sessionId = `${sessionName}-${Date.now()}-${Math.random().toString(16).slice(2)}`
					terminalSessions.set(sessionId, { name: sessionName })
					return { sessionId, sessionName, isNewSession: true }
				},
				exec: async (sessionId: string, command: string) => {
					if (!terminalSessions.has(sessionId)) {
						throw new Error(`Unknown terminal session: ${sessionId}`)
					}
					const raw = await toolCall("execute_command", { command, cwd: root })
					if (raw && typeof raw === "object" && "output" in raw && "exitCode" in raw) {
						return raw
					}
					return {
						sessionId,
						command,
						output: typeof raw === "string" ? raw : JSON.stringify(raw),
						exitCode: 0,
						toString() {
							return this.output
						},
					}
				},
			},
			shell: async (command: string) => {
				const raw = await toolCall("execute_command", { command, cwd: root })
				if (raw && typeof raw === "object" && "output" in raw && "exitCode" in raw) {
					return raw
				}
				return {
					command,
					output: typeof raw === "string" ? raw : JSON.stringify(raw),
					exitCode: 0,
					toString() {
						return this.output
					},
				}
			},
		},
		UI: {},
		FFmpeg: {},
		Tasker: {},
		Workflow: {
			getAll: async () => {
				throw new Error("Tools.Workflow is not supported in desktop runtime")
			},
			create: async () => {
				throw new Error("Tools.Workflow is not supported in desktop runtime")
			},
			get: async () => {
				throw new Error("Tools.Workflow is not supported in desktop runtime")
			},
			update: async () => {
				throw new Error("Tools.Workflow is not supported in desktop runtime")
			},
			patch: async () => {
				throw new Error("Tools.Workflow is not supported in desktop runtime")
			},
			delete: async () => {
				throw new Error("Tools.Workflow is not supported in desktop runtime")
			},
			trigger: async () => {
				throw new Error("Tools.Workflow is not supported in desktop runtime")
			},
		},
		Chat: {},
		Memory: {},
		calc: async (_expression: string) => {
			throw new Error("Tools.calc is not supported in desktop runtime")
		},
	}
}
