import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"
import * as lockfile from "proper-lockfile" // kilocode_change

import { Anthropic } from "@anthropic-ai/sdk"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

export type ApiMessage = Anthropic.MessageParam & {
	ts?: number
	isSummary?: boolean
	id?: string
	// For reasoning items stored in API history
	type?: "reasoning"
	summary?: any[]
	encrypted_content?: string
	text?: string
	// For OpenRouter reasoning_details array format (used by Gemini 3, etc.)
	reasoning_details?: any[]
	// For non-destructive condense: unique identifier for summary messages
	condenseId?: string
	// For non-destructive condense: points to the condenseId of the summary that replaces this message
	// Messages with condenseParent are filtered out when sending to API if the summary exists
	condenseParent?: string
	// For non-destructive truncation: unique identifier for truncation marker messages
	truncationId?: string
	// For non-destructive truncation: points to the truncationId of the marker that hides this message
	// Messages with truncationParent are filtered out when sending to API if the marker exists
	truncationParent?: string
	// Identifies a message as a truncation boundary marker
	isTruncationMarker?: boolean
}

export async function readApiMessages({
	taskId,
	globalStoragePath,
}: {
	taskId: string
	globalStoragePath: string
}): Promise<ApiMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

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
		console.warn(`[readApiMessages] Failed to acquire lock for ${filePath}:`, error)
	}
	// kilocode_change end

	try {
		if (await fileExistsAtPath(filePath)) {
			const fileContent = await fs.readFile(filePath, "utf8")
			try {
				const parsedData = JSON.parse(fileContent)
				if (Array.isArray(parsedData) && parsedData.length === 0) {
					console.error(
						`[Roo-Debug] readApiMessages: Found API conversation history file, but it's empty (parsed as []). TaskId: ${taskId}, Path: ${filePath}`,
					)
				}
				return parsedData
			} catch (error) {
				console.error(
					`[Roo-Debug] readApiMessages: Error parsing API conversation history file. TaskId: ${taskId}, Path: ${filePath}, Error: ${error}`,
				)
				throw error
			}
		} else {
			const oldPath = path.join(taskDir, "claude_messages.json")

			if (await fileExistsAtPath(oldPath)) {
				const fileContent = await fs.readFile(oldPath, "utf8")
				try {
					const parsedData = JSON.parse(fileContent)
					if (Array.isArray(parsedData) && parsedData.length === 0) {
						console.error(
							`[Roo-Debug] readApiMessages: Found OLD API conversation history file (claude_messages.json), but it's empty (parsed as []). TaskId: ${taskId}, Path: ${oldPath}`,
						)
					}
					await fs.unlink(oldPath)
					return parsedData
				} catch (error) {
					console.error(
						`[Roo-Debug] readApiMessages: Error parsing OLD API conversation history file (claude_messages.json). TaskId: ${taskId}, Path: ${oldPath}, Error: ${error}`,
					)
					// DO NOT unlink oldPath if parsing failed, throw error instead.
					throw error
				}
			}
		}

		// Try to recover from leftover .new/.bak temp file created by safeWriteJson.
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
			console.warn(`[readApiMessages] Failed to recover API messages for ${taskId}:`, error)
		}
	} finally {
		// kilocode_change start
		try {
			await releaseLock?.()
		} catch (error) {
			console.warn(`[readApiMessages] Failed to release lock for ${filePath}:`, error)
		}
		// kilocode_change end
	}

	// If we reach here, neither the new nor the old history file was found.
	console.error(
		`[Roo-Debug] readApiMessages: API conversation history file not found for taskId: ${taskId}. Expected at: ${filePath}`,
	)
	return []
}

export async function saveApiMessages({
	messages,
	taskId,
	globalStoragePath,
}: {
	messages: ApiMessage[]
	taskId: string
	globalStoragePath: string
}) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)
	await safeWriteJson(filePath, messages)
}
