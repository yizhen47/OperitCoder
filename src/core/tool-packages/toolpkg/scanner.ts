import * as fs from "fs/promises"
import * as path from "path"

import * as Hjson from "hjson"

import type { ToolPackage } from "../types"
import { parseJsToolPackageFromContent } from "../metadata"
import type { ToolPkgContainerRuntime, ToolPkgManifest } from "./types"
import { findManifestEntryName, loadZipEntriesFromBuffer, normalizeZipEntryPath, readZipText } from "./zip"

type ToolPkgScanResult = {
	containers: ToolPkgContainerRuntime[]
	subpackages: ToolPackage[]
}

type CacheEntry = {
	mtimeMs: number
	size: number
	result: ToolPkgScanResult
}

const cacheByFilePath = new Map<string, CacheEntry>()

function parseManifest(text: string, manifestEntryName: string): ToolPkgManifest {
	if (manifestEntryName.toLowerCase().endsWith(".hjson")) {
		return Hjson.parse(text) as ToolPkgManifest
	}
	return JSON.parse(text) as ToolPkgManifest
}

function asNonEmptyString(value: unknown): string {
	return typeof value === "string" ? value.trim() : ""
}

function asBool(value: unknown, defaultValue: boolean): boolean {
	if (typeof value === "boolean") return value
	if (typeof value === "number") return value !== 0
	if (typeof value === "string") {
		const s = value.trim().toLowerCase()
		if (["true", "1", "yes", "on"].includes(s)) return true
		if (["false", "0", "no", "off"].includes(s)) return false
	}
	return defaultValue
}

export async function scanToolPkgs(options: {
	toolPkgsDir: string
	isBuiltIn: boolean
}): Promise<ToolPkgScanResult> {
	let dirents: Array<{ name: string; isFile(): boolean }>
	try {
		dirents = await fs.readdir(options.toolPkgsDir, { withFileTypes: true })
	} catch {
		return { containers: [], subpackages: [] }
	}

	const toolpkgFiles = dirents
		.filter((d) => d.isFile())
		.map((d) => d.name)
		.filter((name) => name.toLowerCase().endsWith(".toolpkg"))

	const containers: ToolPkgContainerRuntime[] = []
	const subpackages: ToolPackage[] = []

	for (const fileName of toolpkgFiles) {
		const filePath = path.join(options.toolPkgsDir, fileName)
		let stat: { mtimeMs: number; size: number }
		try {
			stat = await fs.stat(filePath)
		} catch {
			continue
		}

		const cached = cacheByFilePath.get(filePath)
		if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
			containers.push(...cached.result.containers)
			subpackages.push(...cached.result.subpackages)
			continue
		}

		const buffer = await fs.readFile(filePath)
		const entries = await loadZipEntriesFromBuffer(buffer)
		const manifestEntryName = findManifestEntryName(entries)
		if (!manifestEntryName) {
			cacheByFilePath.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, result: { containers: [], subpackages: [] } })
			continue
		}

		const manifestText = await readZipText(entries, manifestEntryName)
		if (!manifestText) {
			cacheByFilePath.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, result: { containers: [], subpackages: [] } })
			continue
		}

		let manifest: ToolPkgManifest
		try {
			manifest = parseManifest(manifestText, manifestEntryName)
		} catch {
			cacheByFilePath.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, result: { containers: [], subpackages: [] } })
			continue
		}

		const toolPkgId = asNonEmptyString(manifest.toolpkg_id)
		if (!toolPkgId) {
			cacheByFilePath.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, result: { containers: [], subpackages: [] } })
			continue
		}

		const runtime: ToolPkgContainerRuntime = {
			toolPkgId,
			version: typeof manifest.version === "string" ? manifest.version : undefined,
			displayName: manifest.display_name,
			description: manifest.description,
			sourcePath: filePath,
			subpackages: [],
			resources: [],
			uiModules: [],
		}

		const resourceList = Array.isArray(manifest.resources) ? manifest.resources : []
		runtime.resources = resourceList
			.map((r) => {
				const key = asNonEmptyString(r?.key)
				const rawPath = asNonEmptyString(r?.path)
				const normalizedPath = normalizeZipEntryPath(rawPath)
				if (!key || !normalizedPath) return null
				return { key, path: normalizedPath, mime: typeof r?.mime === "string" ? r.mime : undefined }
			})
			.filter(Boolean) as any

		const uiList = Array.isArray(manifest.ui_modules) ? manifest.ui_modules : []
		runtime.uiModules = uiList
			.map((m) => {
				const id = asNonEmptyString(m?.id)
				const entry = normalizeZipEntryPath(asNonEmptyString(m?.entry))
				if (!id || !entry) return null
				return {
					id,
					runtime: asNonEmptyString(m?.runtime) || "compose_dsl",
					entry,
					title: m?.title,
					showInPackageManager: asBool(m?.show_in_package_manager, false),
					permissions: Array.isArray(m?.permissions) ? (m?.permissions.filter((x) => typeof x === "string") as string[]) : undefined,
				}
			})
			.filter(Boolean) as any

		const subList = Array.isArray(manifest.subpackages) ? manifest.subpackages : []
		const parsedSubpackages: ToolPackage[] = []

		for (const sp of subList) {
			const subpackageId = asNonEmptyString(sp?.id)
			const entryPath = normalizeZipEntryPath(asNonEmptyString(sp?.entry))
			if (!subpackageId || !entryPath) {
				continue
			}

			const jsContent = await readZipText(entries, entryPath)
			if (!jsContent) {
				continue
			}

			const parsed = parseJsToolPackageFromContent(jsContent, {
				sourcePath: `${filePath}:${entryPath}`,
				sourceType: "js",
			})
			if (!parsed) {
				continue
			}

			const normalized = {
				...parsed,
				name: subpackageId,
				isBuiltIn: options.isBuiltIn,
				toolPkgId,
				toolPkgSubpackageId: subpackageId,
				sourcePath: `${filePath}:${entryPath}`,
				sourceType: "js" as const,
			} satisfies ToolPackage

			parsedSubpackages.push(normalized)
			runtime.subpackages.push({
				packageName: subpackageId,
				subpackageId,
				displayName: normalized.displayName,
				description: normalized.description,
				enabledByDefault: Boolean(normalized.enabledByDefault),
				toolCount: normalized.tools.length,
				entryPath,
			})
		}

		const result: ToolPkgScanResult = {
			containers: [runtime],
			subpackages: parsedSubpackages,
		}
		cacheByFilePath.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, result })

		containers.push(runtime)
		subpackages.push(...parsedSubpackages)
	}

	return { containers, subpackages }
}

