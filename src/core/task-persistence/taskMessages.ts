import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"
import * as lockfile from "proper-lockfile" // kilocode_change

import type { ClineMessage } from "@roo-code/types"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

export type ReadTaskMessagesOptions = {
	taskId: string
	globalStoragePath: string
}

export async function readTaskMessages({
	taskId,
	globalStoragePath,
}: ReadTaskMessagesOptions): Promise<ClineMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)

	// kilocode_change start
	let releaseLock: (() => Promise<void>) | undefined
	try {
		releaseLock = await lockfile.lock(path.resolve(filePath), {
			stale: 31_000,
			update: 10_000,
			realpath: false,
			retries: { retries: 5, factor: 2, minTimeout: 100, maxTimeout: 1_000 },
		})
	} catch (error) {
		console.warn(`[readTaskMessages] Failed to acquire lock for ${filePath}:`, error)
	}

	try {
		const fileExists = await fileExistsAtPath(filePath)
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}

		// If the file does not exist, attempt to recover from a leftover .new/.bak temp file.
		try {
			const baseName = path.basename(filePath)
			const entries = await fs.readdir(taskDir)
			const candidates = entries
				.filter(
					(name) =>
						(name.startsWith(`.${baseName}.new_`) || name.startsWith(`.${baseName}.bak_`)) &&
						name.endsWith(".tmp"),
				)
				.map((name) => path.join(taskDir, name))

			if (candidates.length > 0) {
				const sorted = await Promise.all(
					candidates.map(async (candidate) => ({
						candidate,
						mtimeMs: (await fs.stat(candidate)).mtimeMs,
					})),
				)
				sorted.sort((a, b) => b.mtimeMs - a.mtimeMs)
				return JSON.parse(await fs.readFile(sorted[0].candidate, "utf8"))
			}
		} catch (error) {
			console.warn(`[readTaskMessages] Failed to recover messages for ${taskId}:`, error)
		}

		return []
	} finally {
		try {
			await releaseLock?.()
		} catch (error) {
			console.warn(`[readTaskMessages] Failed to release lock for ${filePath}:`, error)
		}
	}
	// kilocode_change end
}

export type SaveTaskMessagesOptions = {
	messages: ClineMessage[]
	taskId: string
	globalStoragePath: string
}

export async function saveTaskMessages({ messages, taskId, globalStoragePath }: SaveTaskMessagesOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	await safeWriteJson(filePath, messages)
}
