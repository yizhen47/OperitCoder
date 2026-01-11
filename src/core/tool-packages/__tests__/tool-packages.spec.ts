// kilocode_change - new file

import * as fs from "fs/promises"
import * as path from "path"

import { parseJsToolPackageFromContent, scanExamplePackages } from "../index"

const examplesDir = path.resolve(__dirname, "../../../examples")

describe("tool-packages", () => {
	it("parses time.js METADATA as HJSON", async () => {
		const content = await fs.readFile(path.join(examplesDir, "time.js"), "utf8")
		const pkg = parseJsToolPackageFromContent(content, { sourceType: "js" })

		expect(pkg?.name).toBe("time")
		expect(pkg?.tools.map((t) => t.name)).toEqual(["get_time", "format_time"])
	})

	it("parses workflow.js multiline HJSON strings", async () => {
		const content = await fs.readFile(path.join(examplesDir, "workflow.js"), "utf8")
		const pkg = parseJsToolPackageFromContent(content, { sourceType: "js" })

		expect(pkg?.name).toBe("workflow")
		expect(pkg?.tools.some((t) => t.name === "usage_advice")).toBe(true)
	})

	it("parses duckduckgo.js METADATA variant", async () => {
		const content = await fs.readFile(path.join(examplesDir, "duckduckgo.js"), "utf8")
		const pkg = parseJsToolPackageFromContent(content, { sourceType: "js" })

		expect(pkg?.name).toBe("duckduckgo")
		expect(pkg?.tools.map((t) => t.name)).toEqual(["search", "fetch_content"])
	})

	it("scanExamplePackages returns a non-empty list", async () => {
		const pkgs = await scanExamplePackages({ examplesDir })
		expect(pkgs.length).toBeGreaterThan(0)
		// Ensure we prefer .js when .ts counterpart exists
		const time = pkgs.find((p) => p.name === "time")
		expect(time?.sourceType).toBe("js")
	})
})
