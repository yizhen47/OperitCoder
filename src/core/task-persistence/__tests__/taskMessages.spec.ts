import { describe, it, expect, vi, beforeEach } from "vitest"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"

// Mocks (use hoisted to avoid initialization ordering issues)
const hoistedLock = vi.hoisted(() => ({
	lockMock: vi.fn().mockResolvedValue(async () => {}),
}))
vi.mock("proper-lockfile", () => ({
	lock: hoistedLock.lockMock,
}))

const hoistedStorage = vi.hoisted(() => {
	const state = { baseDir: "" as string }
	return {
		state,
		getTaskDirectoryPathMock: vi.fn(async (_globalStoragePath: string, taskId: string) =>
			path.join(state.baseDir, "tasks", taskId),
		),
	}
})
vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: hoistedStorage.getTaskDirectoryPathMock,
}))

// Mocks (use hoisted to avoid initialization ordering issues)
const hoisted = vi.hoisted(() => ({
	safeWriteJsonMock: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: hoisted.safeWriteJsonMock,
}))

// Import after mocks
import { readTaskMessages, saveTaskMessages } from "../taskMessages"

let tmpBaseDir: string

beforeEach(async () => {
	hoisted.safeWriteJsonMock.mockClear()
	// Create a unique, writable temp directory to act as globalStoragePath
	tmpBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-"))
	hoistedStorage.state.baseDir = tmpBaseDir
	hoistedStorage.getTaskDirectoryPathMock.mockClear()
})

describe("taskMessages.readTaskMessages", () => {
	it("reads from latest .new/.bak temp file when ui_messages.json is temporarily missing", async () => {
		const taskId = "task-3"
		const messages: any[] = [{ role: "assistant", content: "Recovered" }]

		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })

		const baseName = "ui_messages.json"
		const tmpFile = path.join(taskDir, `.${baseName}.new_${Date.now()}_x.tmp`)
		await fs.writeFile(tmpFile, JSON.stringify(messages), "utf8")

		const result = await readTaskMessages({ taskId, globalStoragePath: tmpBaseDir })
		expect(result).toEqual(messages)
		expect(hoistedLock.lockMock).toHaveBeenCalledTimes(1)
	})
})

describe("taskMessages.saveTaskMessages", () => {
	beforeEach(() => {
		hoisted.safeWriteJsonMock.mockClear()
	})

	it("persists messages as-is", async () => {
		const messages: any[] = [
			{
				role: "assistant",
				content: "Hello",
				metadata: {
					other: "keep",
				},
			},
			{ role: "user", content: "Do thing" },
		]

		await saveTaskMessages({
			messages,
			taskId: "task-1",
			globalStoragePath: tmpBaseDir,
		})

		expect(hoisted.safeWriteJsonMock).toHaveBeenCalledTimes(1)
		const [, persisted] = hoisted.safeWriteJsonMock.mock.calls[0]
		expect(persisted).toEqual(messages)
	})

	it("persists messages without modification when no metadata", async () => {
		const messages: any[] = [
			{ role: "assistant", content: "Hi" },
			{ role: "user", content: "Yo" },
		]

		await saveTaskMessages({
			messages,
			taskId: "task-2",
			globalStoragePath: tmpBaseDir,
		})

		const [, persisted] = hoisted.safeWriteJsonMock.mock.calls[0]
		expect(persisted).toEqual(messages)
	})
})
