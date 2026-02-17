import * as fs from "fs/promises"
import * as path from "path"

import type { ExtensionContext } from "vscode"

import { scanToolPkgs } from "./scanner"
import type { ToolPkgContainerRuntime } from "./types"
import { type ZipEntries, loadZipEntriesFromBuffer, readZipBytes, readZipText } from "./zip"

type LoadedArchive = {
	mtimeMs: number
	size: number
	entries: Awaited<ReturnType<typeof loadZipEntriesFromBuffer>>
}

export class ToolPkgRegistry {
	private readonly toolPkgsDirs: string[]
	private readonly isBuiltIn: boolean

	private containersById = new Map<string, ToolPkgContainerRuntime>()
	private archivesByPath = new Map<string, LoadedArchive>()

	constructor(options: { toolPkgsDirs: string[]; isBuiltIn: boolean }) {
		this.toolPkgsDirs = options.toolPkgsDirs
		this.isBuiltIn = options.isBuiltIn
	}

	async refresh(): Promise<void> {
		const containers: ToolPkgContainerRuntime[] = []

		for (const dir of this.toolPkgsDirs) {
			const scanned = await scanToolPkgs({ toolPkgsDir: dir, isBuiltIn: this.isBuiltIn })
			containers.push(...scanned.containers)
		}

		this.containersById = new Map(containers.map((c) => [c.toolPkgId, c]))
	}

	getContainers(): ToolPkgContainerRuntime[] {
		return Array.from(this.containersById.values())
	}

	getContainer(toolPkgId: string): ToolPkgContainerRuntime | undefined {
		return this.containersById.get(toolPkgId)
	}

	private async loadArchive(container: ToolPkgContainerRuntime): Promise<LoadedArchive> {
		const filePath = container.sourcePath
		const stat = await fs.stat(filePath)
		const cached = this.archivesByPath.get(filePath)
		if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
			return cached
		}

		const buffer = await fs.readFile(filePath)
		const entries = await loadZipEntriesFromBuffer(buffer)
		const loaded: LoadedArchive = { mtimeMs: stat.mtimeMs, size: stat.size, entries }
		this.archivesByPath.set(filePath, loaded)
		return loaded
	}

	async getZipEntries(toolPkgId: string): Promise<ZipEntries | null> {
		const container = this.getContainer(toolPkgId)
		if (!container) return null
		const archive = await this.loadArchive(container)
		return archive.entries
	}

	async readEntryText(toolPkgId: string, entryPath: string): Promise<string | null> {
		const container = this.getContainer(toolPkgId)
		if (!container) return null
		const archive = await this.loadArchive(container)
		return await readZipText(archive.entries, entryPath)
	}

	async readEntryBytes(toolPkgId: string, entryPath: string): Promise<Uint8Array | null> {
		const container = this.getContainer(toolPkgId)
		if (!container) return null
		const archive = await this.loadArchive(container)
		return await readZipBytes(archive.entries, entryPath)
	}

	async extractResourceToFile(
		context: ExtensionContext,
		options: { toolPkgId: string; resourceKey: string },
	): Promise<string | null> {
		const container = this.getContainer(options.toolPkgId)
		if (!container) return null

		const resource = container.resources.find((r) => r.key.toLowerCase() === options.resourceKey.toLowerCase())
		if (!resource) return null

		const bytes = await this.readEntryBytes(container.toolPkgId, resource.path)
		if (!bytes) return null

		const fileName = path.posix.basename(resource.path) || `${options.resourceKey}.bin`
		const outDir = path.join(context.globalStorageUri.fsPath, "toolpkgs", container.toolPkgId, "resources")
		await fs.mkdir(outDir, { recursive: true })
		const outPath = path.join(outDir, fileName)
		await fs.writeFile(outPath, bytes)
		return outPath
	}
}
