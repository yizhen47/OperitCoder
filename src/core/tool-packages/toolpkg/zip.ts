import * as path from "path"

import JSZip from "jszip"

export type ZipEntries = {
	zip: JSZip
	filesByLowerName: Map<string, string>
}

export function normalizeZipEntryPath(rawPath: string): string | null {
	const normalized = String(rawPath ?? "").replace(/\\/g, "/").trim().replace(/^\/+/, "")
	if (!normalized) return null
	if (normalized.includes("..")) return null
	return normalized
}

export async function loadZipEntriesFromBuffer(buffer: Buffer): Promise<ZipEntries> {
	const zip = await JSZip.loadAsync(buffer)
	const filesByLowerName = new Map<string, string>()
	for (const fileName of Object.keys(zip.files)) {
		const normalized = normalizeZipEntryPath(fileName)
		if (!normalized) continue
		filesByLowerName.set(normalized.toLowerCase(), normalized)
	}
	return { zip, filesByLowerName }
}

export async function readZipText(entries: ZipEntries, entryPath: string): Promise<string | null> {
	const normalized = normalizeZipEntryPath(entryPath)
	if (!normalized) return null
	const actual = entries.filesByLowerName.get(normalized.toLowerCase())
	if (!actual) return null
	const file = entries.zip.file(actual)
	if (!file) return null
	return await file.async("string")
}

export async function readZipBytes(entries: ZipEntries, entryPath: string): Promise<Uint8Array | null> {
	const normalized = normalizeZipEntryPath(entryPath)
	if (!normalized) return null
	const actual = entries.filesByLowerName.get(normalized.toLowerCase())
	if (!actual) return null
	const file = entries.zip.file(actual)
	if (!file) return null
	return await file.async("uint8array")
}

export function findManifestEntryName(entries: ZipEntries): string | null {
	const exactHjson = entries.filesByLowerName.get("manifest.hjson")
	if (exactHjson) return exactHjson

	const exactJson = entries.filesByLowerName.get("manifest.json")
	if (exactJson) return exactJson

	// Nested manifest
	const all = Array.from(entries.filesByLowerName.values())
	const nestedHjson = all.find((x) => path.posix.basename(x).toLowerCase() === "manifest.hjson")
	if (nestedHjson) return nestedHjson

	return all.find((x) => path.posix.basename(x).toLowerCase() === "manifest.json") ?? null
}

