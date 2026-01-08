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

// Import after mocks
import { readApiMessages } from "../apiMessages"

let tmpBaseDir: string

beforeEach(async () => {
	// Create a unique, writable temp directory to act as globalStoragePath
	tmpBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-"))
	hoistedStorage.state.baseDir = tmpBaseDir
	hoistedStorage.getTaskDirectoryPathMock.mockClear()
	hoistedLock.lockMock.mockClear()
})

describe("apiMessages.readApiMessages", () => {
	it("reads from latest .new/.bak temp file when api_conversation_history.json is temporarily missing", async () => {
		const taskId = "task-1"
		const messages: any[] = [{ role: "user", content: "Recovered" }]

		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })

		const baseName = "api_conversation_history.json"
		const tmpFile = path.join(taskDir, `.${baseName}.new_${Date.now()}_x.tmp`)
		await fs.writeFile(tmpFile, JSON.stringify(messages), "utf8")

		const result = await readApiMessages({ taskId, globalStoragePath: tmpBaseDir })
		expect(result).toEqual(messages)
		expect(hoistedLock.lockMock).toHaveBeenCalledTimes(1)
	})
})
