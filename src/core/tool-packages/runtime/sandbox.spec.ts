// kilocode_change - new file

import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

import { executeSandboxedTool } from "./sandbox"

describe("executeSandboxedTool", () => {
	it("returns value when tool function returns normally", async () => {
		const script = `
exports.echo = async function (params) {
  return { ok: true, params };
}
`

		const result = await executeSandboxedTool({
			script,
			toolExportName: "echo",
			args: { a: 1 },
			toolCall: async () => {
				throw new Error("toolCall should not be called")
			},
		})

		expect(result).toEqual({ ok: true, params: { a: 1 } })
	})

	it("returns completion value when tool calls complete()", async () => {
		const script = `
exports.main = async function () {
  complete({ done: true });
}
`

		const result = await executeSandboxedTool({
			script,
			toolExportName: "main",
			args: {},
			toolCall: async () => {
				throw new Error("toolCall should not be called")
			},
		})

		expect(result).toEqual({ done: true })
	})

	it("OkHttp.newClient().newRequest() executes via injected fetch", async () => {
		const script = `
exports.fetch = async function () {
  const client = OkHttp.newClient();
  const resp = await client.newRequest()
    .url('https://example.test/')
    .method('GET')
    .headers({ 'X-Test': '1' })
    .build()
    .execute();

  return {
    status: resp.statusCode,
    content: resp.content,
    ok: resp.isSuccessful(),
    contentType: resp.contentType,
  };
}
`

		const calls: any[] = []
		const fakeFetch: typeof fetch = (async (url: any, init?: any) => {
			calls.push({ url, init })
			return new Response("hello", {
				status: 200,
				headers: { "content-type": "text/plain" },
			})
		}) as any

		const result = await executeSandboxedTool({
			script,
			toolExportName: "fetch",
			args: {},
			fetch: fakeFetch,
			toolCall: async () => {
				throw new Error("toolCall should not be called")
			},
		})

		expect(result).toEqual({ status: 200, content: "hello", ok: true, contentType: "text/plain" })
		expect(calls.length).toBe(1)
		expect(calls[0].url).toBe("https://example.test/")
		expect(calls[0].init.method).toBe("GET")
		expect(calls[0].init.headers.get("X-Test")).toBe("1")
	})

	it("toolCall maps write_file to write_to_file", async () => {
		const script = `
exports.main = async function () {
  const result = await toolCall('write_file', { path: 'a.txt', content: 'x' });
  return result;
}
`

		const seen: any[] = []
		const result = await executeSandboxedTool({
			script,
			toolExportName: "main",
			args: {},
			toolCall: async (name, params) => {
				seen.push({ name, params })
				return { ok: true }
			},
		})

		expect(result).toEqual({ ok: true })
		expect(seen).toEqual([{ name: "write_to_file", params: { path: "a.txt", content: "x" } }])
	})

	it("Tools.Files supports basic read/write/list/exists within sandbox root", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "operit-coder-sandbox-"))
		const script = `
exports.main = async function () {
  await Tools.Files.mkdir('dir', true);
  const writeRes = await Tools.Files.write('dir/a.txt', 'hello');
  const content = await Tools.Files.read('dir/a.txt');
  const listing = await Tools.Files.list('dir');
  const exists = await Tools.Files.exists('dir/a.txt');
  return {
    writeOk: writeRes.successful,
    content: content.content,
    entries: listing.entries.map(e => ({ name: e.name, isDirectory: e.isDirectory })),
    exists: exists.exists
  };
}
`

		const result = await executeSandboxedTool({
			script,
			toolExportName: "main",
			args: {},
			cwd: tmp,
			toolCall: async () => {
				throw new Error("toolCall should not be called")
			},
		})

		expect(result).toEqual({
			writeOk: true,
			content: "hello",
			entries: [{ name: "a.txt", isDirectory: false }],
			exists: true,
		})
	})

	it("Tools.Files.readPart returns Kotlin-style line numbers and metadata", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "operit-coder-sandbox-"))
		const script = `
exports.main = async function () {
  await Tools.Files.mkdir('dir', true);
  await Tools.Files.write('dir/b.txt', 'a\nb\nc');
  const part = await Tools.Files.readPart('dir/b.txt', 2, 2);
  return {
    startLine: part.startLine,
    endLine: part.endLine,
    totalLines: part.totalLines,
    content: part.content
  };
}
`

		const result = await executeSandboxedTool({
			script,
			toolExportName: "main",
			args: {},
			cwd: tmp,
			toolCall: async () => {
				throw new Error("toolCall should not be called")
			},
		})

		expect(result).toEqual({
			startLine: 1,
			endLine: 2,
			totalLines: 3,
			content: "2| b",
		})
	})

	it("Tools.Files blocks escaping sandbox root", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "operit-coder-sandbox-"))
		const script = `
exports.main = async function () {
  try {
    await Tools.Files.read('../outside.txt');
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e && e.message ? e.message : e) };
  }
}
`

		const result = await executeSandboxedTool({
			script,
			toolExportName: "main",
			args: {},
			cwd: tmp,
			toolCall: async () => {
				throw new Error("toolCall should not be called")
			},
		})

		expect(result).toEqual({ ok: false, message: "Path escapes sandbox root" })
	})

	it("Tools.System.terminal.exec forwards cwd to execute_command", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "operit-coder-sandbox-"))
		const script = `
exports.main = async function () {
  const session = await Tools.System.terminal.create('s');
  const result = await Tools.System.terminal.exec(session.sessionId, 'echo hi');
  return { sessionId: result.sessionId, output: result.output, exitCode: result.exitCode };
}
`

		const seen: any[] = []
		const result = await executeSandboxedTool({
			script,
			toolExportName: "main",
			args: {},
			cwd: tmp,
			toolCall: async (name, params) => {
				seen.push({ name, params })
				return "ok"
			},
		})

		expect(result).toEqual({ sessionId: expect.any(String), output: "ok", exitCode: 0 })
		expect(seen).toEqual([{ name: "execute_command", params: { command: "echo hi", cwd: tmp } }])
	})
})
