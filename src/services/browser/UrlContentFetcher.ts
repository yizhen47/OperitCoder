import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { Browser, Page, launch } from "puppeteer-core"
import * as cheerio from "cheerio"
import TurndownService from "turndown"
// @ts-ignore
import PCR from "puppeteer-chromium-resolver"
import { fileExistsAtPath } from "../../utils/fs"
import { serializeError } from "serialize-error"

// Timeout constants
const URL_FETCH_TIMEOUT = 30_000 // 30 seconds
const URL_FETCH_FALLBACK_TIMEOUT = 20_000 // 20 seconds for fallback

type VisitWebBrowserType = "auto" | "bundled" | "edge" | "chrome" | "brave" | "custom"

export interface VisitWebBrowserLaunchOptions {
	browserType?: VisitWebBrowserType
	executablePath?: string
}

interface PCRStats {
	puppeteer: { launch: typeof launch }
	executablePath: string
}

export class UrlContentFetcher {
	private context: vscode.ExtensionContext
	private browser?: Browser
	private page?: Page

	constructor(context: vscode.ExtensionContext) {
		this.context = context
	}

	private async ensureChromiumExists(): Promise<PCRStats> {
		const globalStoragePath = this.context?.globalStorageUri?.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}
		const puppeteerDir = path.join(globalStoragePath, "puppeteer")
		const dirExists = await fileExistsAtPath(puppeteerDir)
		if (!dirExists) {
			await fs.mkdir(puppeteerDir, { recursive: true })
		}
		// if chromium doesn't exist, this will download it to path.join(puppeteerDir, ".chromium-browser-snapshots")
		// if it does exist it will return the path to existing chromium
		const stats: PCRStats = await PCR({
			downloadPath: puppeteerDir,
		})
		return stats
	}

	private async detectSystemBrowserExecutablePath(
		browserType: Exclude<VisitWebBrowserType, "auto" | "bundled" | "custom">,
	): Promise<string | undefined> {
		const candidates: string[] = []

		if (process.platform === "win32") {
			const programFiles = process.env["PROGRAMFILES"]
			const programFilesX86 = process.env["PROGRAMFILES(X86)"]
			const localAppData = process.env["LOCALAPPDATA"]

			const roots = [programFiles, programFilesX86, localAppData].filter(Boolean) as string[]

			for (const root of roots) {
				if (browserType === "edge") {
					candidates.push(
						path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
						path.join(root, "Microsoft", "Edge SxS", "Application", "msedge.exe"),
					)
				} else if (browserType === "chrome") {
					candidates.push(path.join(root, "Google", "Chrome", "Application", "chrome.exe"))
				} else if (browserType === "brave") {
					candidates.push(path.join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"))
				}
			}
		} else if (process.platform === "darwin") {
			if (browserType === "edge") {
				candidates.push(
					"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
					"/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary",
				)
			} else if (browserType === "chrome") {
				candidates.push(
					"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
					"/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
				)
			} else if (browserType === "brave") {
				candidates.push("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser")
			}
		} else {
			// linux and others
			if (browserType === "edge") {
				candidates.push("/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable")
			} else if (browserType === "chrome") {
				candidates.push("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable")
			} else if (browserType === "brave") {
				candidates.push("/usr/bin/brave-browser", "/usr/bin/brave")
			}
		}

		for (const candidate of candidates) {
			if (await fileExistsAtPath(candidate)) {
				return candidate
			}
		}
		return undefined
	}

	private async resolveExecutablePath(
		options?: VisitWebBrowserLaunchOptions,
	): Promise<{ executablePath: string; launchFn: typeof launch }> {
		const browserType = (options?.browserType ?? "auto") as VisitWebBrowserType
		const configuredPath = String(options?.executablePath ?? "").trim()

		if (configuredPath) {
			if (!(await fileExistsAtPath(configuredPath))) {
				throw new Error(`Browser executable not found at path: ${configuredPath}`)
			}
			return { executablePath: configuredPath, launchFn: launch }
		}

		if (browserType === "custom") {
			throw new Error("Custom browser requires visitWebBrowserExecutablePath to be set")
		}

		if (browserType === "bundled") {
			const stats = await this.ensureChromiumExists()
			return { executablePath: stats.executablePath, launchFn: stats.puppeteer.launch }
		}

		const preferred: Array<Exclude<VisitWebBrowserType, "auto" | "bundled" | "custom">> =
			browserType === "auto" ? ["edge", "chrome", "brave"] : [browserType]

		for (const candidateType of preferred) {
			const candidatePath = await this.detectSystemBrowserExecutablePath(candidateType)
			if (candidatePath) {
				return { executablePath: candidatePath, launchFn: launch }
			}
		}

		// Fallback: auto can download bundled Chromium when no system browser is found.
		if (browserType === "auto") {
			const stats = await this.ensureChromiumExists()
			return { executablePath: stats.executablePath, launchFn: stats.puppeteer.launch }
		}

		throw new Error(
			`Could not find a system-installed browser for '${browserType}'. Set visitWebBrowserExecutablePath or switch to 'bundled'.`,
		)
	}

	async launchBrowser(options?: VisitWebBrowserLaunchOptions): Promise<void> {
		if (this.browser) {
			return
		}

		const { executablePath, launchFn } = await this.resolveExecutablePath(options)
		const args = [
			"--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
			"--disable-dev-shm-usage",
			"--disable-accelerated-2d-canvas",
			"--no-first-run",
			"--disable-gpu",
			"--disable-features=VizDisplayCompositor",
		]
		if (process.platform === "linux") {
			// Fixes network errors on Linux hosts (see https://github.com/puppeteer/puppeteer/issues/8246)
			args.push("--no-sandbox")
		}
		this.browser = await launchFn({
			args,
			executablePath,
		})
		// (latest version of puppeteer does not add headless to user agent)
		this.page = await this.browser?.newPage()

		// Set additional page configurations to improve loading success
		if (this.page) {
			await this.page.setViewport({ width: 1280, height: 720 })
			await this.page.setExtraHTTPHeaders({
				"Accept-Language": "en-US,en;q=0.9",
			})
		}
	}

	async closeBrowser(): Promise<void> {
		await this.browser?.close()
		this.browser = undefined
		this.page = undefined
	}

	// must make sure to call launchBrowser before and closeBrowser after using this
	async urlToMarkdown(url: string): Promise<string> {
		if (!this.browser || !this.page) {
			throw new Error("Browser not initialized")
		}
		/*
		- In Puppeteer, "networkidle2" waits until there are no more than 2 network connections for at least 500 ms (roughly equivalent to Playwright's "networkidle").
		- "domcontentloaded" is when the basic DOM is loaded.
		This should be sufficient for most doc sites.
		*/
		try {
			await this.page.goto(url, {
				timeout: URL_FETCH_TIMEOUT,
				waitUntil: ["domcontentloaded", "networkidle2"],
			})
		} catch (error) {
			// Use serialize-error to safely extract error information
			const serializedError = serializeError(error)
			const errorMessage = serializedError.message || String(error)
			const errorName = serializedError.name

			// Only retry for timeout or network-related errors
			const shouldRetry =
				errorMessage.includes("timeout") ||
				errorMessage.includes("net::") ||
				errorMessage.includes("NetworkError") ||
				errorMessage.includes("ERR_") ||
				errorName === "TimeoutError"

			if (shouldRetry) {
				// If networkidle2 fails due to timeout/network issues, try with just domcontentloaded as fallback
				console.warn(
					`Failed to load ${url} with networkidle2, retrying with domcontentloaded only: ${errorMessage}`,
				)
				await this.page.goto(url, {
					timeout: URL_FETCH_FALLBACK_TIMEOUT,
					waitUntil: ["domcontentloaded"],
				})
			} else {
				// For other errors, throw them as-is
				throw error
			}
		}

		const content = await this.page.content()

		// use cheerio to parse and clean up the HTML
		const $ = cheerio.load(content)
		$("script, style, nav, footer, header").remove()

		// convert cleaned HTML to markdown
		const turndownService = new TurndownService()
		const markdown = turndownService.turndown($.html())

		return markdown
	}
}
