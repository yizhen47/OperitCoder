import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

import JSZip from "jszip"

import { scanToolPkgs } from "../toolpkg/scanner"
import { ToolPkgRegistry } from "../toolpkg/registry"
import { ToolPkgComposeDslSession } from "../toolpkg/compose-dsl"

vi.mock("vscode", () => ({
	env: { language: "en" },
	commands: { executeCommand: vi.fn() },
	workspace: { workspaceFolders: [] },
	Uri: { file: (p: string) => ({ fsPath: p }) },
}))

function findFirstActionId(tree: any): string | null {
	if (!tree || typeof tree !== "object") return null
	const props = tree.props ?? {}
	for (const v of Object.values(props)) {
		if (v && typeof v === "object" && typeof (v as any).__actionId === "string") {
			return String((v as any).__actionId)
		}
	}
	for (const child of tree.children ?? []) {
		const id = findFirstActionId(child)
		if (id) return id
	}
	return null
}

describe("toolpkg", () => {
	it("scanToolPkgs parses manifest and subpackage script", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "operit-coder-toolpkg-"))
		const zip = new JSZip()

		zip.file(
			"manifest.json",
			JSON.stringify({
				schema_version: 1,
				toolpkg_id: "com.example.demo",
				subpackages: [{ id: "demo_pkg", entry: "packages/demo.js" }],
				ui_modules: [{ id: "demo_ui", runtime: "compose_dsl", entry: "ui/demo/index.ui.js", show_in_package_manager: true }],
			}),
		)
		zip.file(
			"packages/demo.js",
			`/* METADATA
{
  "name": "demo",
  "description": "demo",
  "enabledByDefault": true,
  "tools": [{ "name": "hello", "description": "x", "parameters": [] }]
}
*/
exports.hello = async function () { return { ok: true }; };
`,
		)
		zip.file(
			"ui/demo/index.ui.js",
			`exports.default = function Screen(ctx) { return ctx.Column({}, [ctx.Text({ text: "hi" })]); }`,
		)

		const toolpkgPath = path.join(tmp, "demo.toolpkg")
		const bytes = await zip.generateAsync({ type: "nodebuffer" })
		await fs.writeFile(toolpkgPath, bytes)

		const result = await scanToolPkgs({ toolPkgsDir: tmp, isBuiltIn: true })
		expect(result.containers.length).toBe(1)
		expect(result.containers[0]?.toolPkgId).toBe("com.example.demo")
		expect(result.subpackages.length).toBe(1)
		expect(result.subpackages[0]?.name).toBe("demo_pkg")
		expect(result.subpackages[0]?.toolPkgId).toBe("com.example.demo")
	})

	it("ToolPkgComposeDslSession renders and invokes actions", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "operit-coder-toolpkg-ui-"))
		const zip = new JSZip()

		zip.file(
			"manifest.json",
			JSON.stringify({
				schema_version: 1,
				toolpkg_id: "com.example.ui",
				subpackages: [],
				ui_modules: [{ id: "ui", runtime: "compose_dsl", entry: "ui/index.ui.js", show_in_package_manager: true }],
			}),
		)

		zip.file(
			"ui/index.ui.js",
			`
exports.default = function Screen(ctx) {
  const pair = ctx.useState("value", "");
  const value = pair[0];
  const setValue = pair[1];
  return ctx.Column({}, [
    ctx.TextField({ label: "Value", value, onValueChange: setValue, minLines: 1 }),
    ctx.Button({ text: "Save", onClick: async () => { await ctx.setEnv("DEMO_KEY", value); } })
  ]);
}
`,
		)

		const toolpkgPath = path.join(tmp, "ui.toolpkg")
		const bytes = await zip.generateAsync({ type: "nodebuffer" })
		await fs.writeFile(toolpkgPath, bytes)

		const secrets = {
			get: vi.fn(async () => undefined),
			store: vi.fn(async () => undefined),
			delete: vi.fn(async () => undefined),
		}
		const context = {
			secrets,
			globalStorageUri: { fsPath: tmp },
		} as any

		const registry = new ToolPkgRegistry({ toolPkgsDirs: [tmp], isBuiltIn: true })
		await registry.refresh()
		const container = registry.getContainer("com.example.ui")
		expect(container).toBeTruthy()

		const session = new ToolPkgComposeDslSession({
			context,
			registry,
			container: container!,
			uiModuleId: "ui",
			uiEntryPath: "ui/index.ui.js",
			extensionPath: tmp,
			initialEnvValues: {},
		})

		const first = await session.render()
		expect(first.tree.type).toBe("Column")

		const onValueChangeId = findFirstActionId(first.tree)
		expect(onValueChangeId).toBeTruthy()

		// Update state via onValueChange action
		await session.invokeAction({ actionId: onValueChangeId!, payload: "abc" })
		const second = await session.render()
		expect(JSON.stringify(second.tree)).toContain("abc")

		// Find save button action
		const saveActionId = (() => {
			const walk = (n: any): string | null => {
				if (!n || typeof n !== "object") return null
				if (n.type === "Button") {
					const id = (n.props?.onClick as any)?.__actionId
					return typeof id === "string" ? id : null
				}
				for (const c of n.children ?? []) {
					const id = walk(c)
					if (id) return id
				}
				return null
			}
			return walk(second.tree)
		})()

		expect(saveActionId).toBeTruthy()
		await session.invokeAction({ actionId: saveActionId! })
		expect(secrets.store).toHaveBeenCalled()
	})
})

