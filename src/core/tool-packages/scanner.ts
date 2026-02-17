// kilocode_change - new file

import * as fs from "fs/promises"
import * as path from "path"

import type { ToolPackage } from "./types"
import { parseJsToolPackageFromContent } from "./metadata"
import { scanToolPkgs } from "./toolpkg/scanner"

export interface ScanExamplePackagesOptions {
	examplesDir: string
}

function selectBestFilePerBaseName(fileNames: string[]): string[] {
	const byBase = new Map<string, { js?: string; ts?: string }>()

	for (const fileName of fileNames) {
		const lower = fileName.toLowerCase()
		if (lower.endsWith(".d.ts")) {
			continue
		}
		if (!lower.endsWith(".js") && !lower.endsWith(".ts")) {
			continue
		}

		const base = fileName.replace(/\.(js|ts)$/i, "")
		const current = byBase.get(base) ?? {}
		if (lower.endsWith(".js")) {
			current.js = fileName
		} else {
			current.ts = fileName
		}
		byBase.set(base, current)
	}

	const selected: string[] = []
	for (const entry of byBase.values()) {
		if (entry.js) {
			selected.push(entry.js)
			continue
		}
		if (entry.ts) {
			selected.push(entry.ts)
		}
	}

	return selected
}

export async function scanExamplePackages(options: ScanExamplePackagesOptions): Promise<ToolPackage[]> {
	const dirents = await fs.readdir(options.examplesDir, { withFileTypes: true })
	const fileNames = dirents
		.filter((d) => d.isFile())
		.map((d) => d.name)
		.filter((name) => name !== "tsconfig.json")

	const selectedFiles = selectBestFilePerBaseName(fileNames)
	const packages: ToolPackage[] = []

	for (const fileName of selectedFiles) {
		const filePath = path.join(options.examplesDir, fileName)
		let content: string
		try {
			content = await fs.readFile(filePath, "utf8")
		} catch {
			continue
		}

		const sourceType = fileName.toLowerCase().endsWith(".ts") ? "ts" : "js"
		const toolPackage = parseJsToolPackageFromContent(content, { sourcePath: filePath, sourceType })
		if (!toolPackage) {
			continue
		}

		packages.push(toolPackage)
	}

	// ToolPkg archives (.toolpkg)
	// By convention we scan a sibling `toolpkgs/` directory next to `examples/`.
	const derivedToolPkgsDir = path.join(path.dirname(options.examplesDir), "toolpkgs")
	// If examplesDir is ".../dist/examples", also try ".../toolpkgs" for dev layouts.
	const rootToolPkgsDir = path.join(path.dirname(path.dirname(options.examplesDir)), "toolpkgs")
	const toolPkgsDirCandidates = [derivedToolPkgsDir, rootToolPkgsDir, options.examplesDir]
	const seenToolPkg = new Set<string>()
	for (const toolPkgsDir of toolPkgsDirCandidates) {
		const { subpackages } = await scanToolPkgs({ toolPkgsDir, isBuiltIn: true })
		for (const pkg of subpackages) {
			const key = `${pkg.toolPkgId ?? ""}::${pkg.name}`
			if (seenToolPkg.has(key)) {
				continue
			}
			seenToolPkg.add(key)
			packages.push(pkg)
		}
	}

	return packages
}
