// kilocode_change - new file

import type { PackageTool, ToolPackage, ToolPackageState } from "./types"

export type SandboxCapabilities = Record<string, unknown>

export function buildDefaultSandboxCapabilities(options?: { supportsComputerUse?: boolean }): SandboxCapabilities {
	return {
		ui: {
			// In the desktop extension, "computer use" (image capability) is the closest analog we have
			// to "virtual display" availability from the original Operit runtime.
			virtual_display: Boolean(options?.supportsComputerUse),
		},
	}
}

type Token =
	| { kind: "punct"; value: "(" | ")" | "[" | "]" | "," }
	| { kind: "op"; value: "!" | "&&" | "||" | "==" | "!=" | ">" | ">=" | "<" | "<=" }
	| { kind: "kw"; value: "true" | "false" | "null" | "in" }
	| { kind: "num"; value: number }
	| { kind: "str"; value: string }
	| { kind: "ident"; value: string }
	| { kind: "eof" }

function tokenize(input: string): Token[] {
	const tokens: Token[] = []
	let i = 0

	const isWhitespace = (ch: string) => ch === " " || ch === "\t" || ch === "\n" || ch === "\r"
	const isDigit = (ch: string) => ch >= "0" && ch <= "9"
	const isIdentStart = (ch: string) =>
		(ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_" || ch === "$"
	const isIdentPart = (ch: string) => isIdentStart(ch) || isDigit(ch)

	while (i < input.length) {
		const ch = input[i]!
		if (isWhitespace(ch)) {
			i++
			continue
		}

		// Punctuation
		if (ch === "(" || ch === ")" || ch === "[" || ch === "]" || ch === ",") {
			tokens.push({ kind: "punct", value: ch })
			i++
			continue
		}

		// Operators (2-char first)
		const two = input.slice(i, i + 2)
		if (two === "&&" || two === "||" || two === "==" || two === "!=" || two === ">=" || two === "<=") {
			tokens.push({ kind: "op", value: two as any })
			i += 2
			continue
		}
		if (ch === "!" || ch === ">" || ch === "<") {
			tokens.push({ kind: "op", value: ch as any })
			i++
			continue
		}

		// String
		if (ch === "'" || ch === '"') {
			const quote = ch
			i++
			let out = ""
			while (i < input.length) {
				const c = input[i]!
				if (c === "\\") {
					const next = input[i + 1]
					if (next) {
						out += next
						i += 2
						continue
					}
				}
				if (c === quote) {
					i++
					break
				}
				out += c
				i++
			}
			tokens.push({ kind: "str", value: out })
			continue
		}

		// Number
		if (isDigit(ch)) {
			let start = i
			while (i < input.length && isDigit(input[i]!)) {
				i++
			}
			if (input[i] === "." && isDigit(input[i + 1] ?? "")) {
				i++
				while (i < input.length && isDigit(input[i]!)) {
					i++
				}
			}
			const raw = input.slice(start, i)
			tokens.push({ kind: "num", value: Number(raw) })
			continue
		}

		// Identifier / keyword (supports dotted paths via later parsing)
		if (isIdentStart(ch)) {
			let start = i
			i++
			while (i < input.length && isIdentPart(input[i]!)) {
				i++
			}
			const word = input.slice(start, i)
			if (word === "true" || word === "false" || word === "null" || word === "in") {
				tokens.push({ kind: "kw", value: word as any })
			} else {
				tokens.push({ kind: "ident", value: word })
			}
			continue
		}

		// Dot is only valid as part of a path; treat it like identifier separator by emitting as ident token.
		if (ch === ".") {
			tokens.push({ kind: "ident", value: "." })
			i++
			continue
		}

		throw new Error(`Unexpected character in condition: '${ch}'`)
	}

	tokens.push({ kind: "eof" })
	return tokens
}

type Parser = {
	tokens: Token[]
	pos: number
}

function peek(p: Parser): Token {
	return p.tokens[p.pos] ?? { kind: "eof" }
}

function consume(p: Parser): Token {
	const tok = peek(p)
	p.pos++
	return tok
}

function expectPunct(p: Parser, value: "(" | ")" | "[" | "]" | ",") {
	const tok = consume(p)
	if (tok.kind !== "punct" || tok.value !== value) {
		throw new Error(`Expected '${value}'`)
	}
}

function readPath(p: Parser): string[] {
	const parts: string[] = []
	const first = consume(p)
	if (first.kind !== "ident") {
		throw new Error("Expected identifier")
	}
	parts.push(first.value)

	// Dots come through as ident(".")
	while (true) {
		const next = peek(p)
		if (next.kind === "ident" && next.value === ".") {
			consume(p)
			const after = consume(p)
			if (after.kind !== "ident") {
				throw new Error("Expected identifier after '.'")
			}
			parts.push(after.value)
			continue
		}
		break
	}

	return parts
}

function getCapabilityValue(capabilities: SandboxCapabilities, pathParts: string[]): unknown {
	let cur: any = capabilities
	for (const part of pathParts) {
		if (!cur || (typeof cur !== "object" && typeof cur !== "function")) {
			return undefined
		}
		cur = cur[part]
	}
	return cur
}

function parsePrimary(p: Parser, capabilities: SandboxCapabilities): any {
	const tok = peek(p)
	if (tok.kind === "kw") {
		consume(p)
		switch (tok.value) {
			case "true":
				return true
			case "false":
				return false
			case "null":
				return null
			default:
				throw new Error(`Unexpected keyword: ${tok.value}`)
		}
	}
	if (tok.kind === "num") {
		consume(p)
		return tok.value
	}
	if (tok.kind === "str") {
		consume(p)
		return tok.value
	}
	if (tok.kind === "punct" && tok.value === "(") {
		consume(p)
		const v = parseOr(p, capabilities)
		expectPunct(p, ")")
		return v
	}
	if (tok.kind === "punct" && tok.value === "[") {
		return parseArrayLiteral(p, capabilities)
	}
	if (tok.kind === "ident") {
		const parts = readPath(p)
		return getCapabilityValue(capabilities, parts)
	}
	throw new Error("Unexpected token in primary")
}

function parseArrayLiteral(p: Parser, capabilities: SandboxCapabilities): any[] {
	expectPunct(p, "[")
	const out: any[] = []
	while (true) {
		const tok = peek(p)
		if (tok.kind === "punct" && tok.value === "]") {
			consume(p)
			break
		}
		out.push(parseOr(p, capabilities))
		const after = peek(p)
		if (after.kind === "punct" && after.value === ",") {
			consume(p)
			continue
		}
		expectPunct(p, "]")
		break
	}
	return out
}

function parseUnary(p: Parser, capabilities: SandboxCapabilities): any {
	const tok = peek(p)
	if (tok.kind === "op" && tok.value === "!") {
		consume(p)
		return !Boolean(parseUnary(p, capabilities))
	}
	return parsePrimary(p, capabilities)
}

function parseComparison(p: Parser, capabilities: SandboxCapabilities): any {
	let left = parseUnary(p, capabilities)

	while (true) {
		const tok = peek(p)
		if (tok.kind === "kw" && tok.value === "in") {
			consume(p)
			const right = parsePrimary(p, capabilities)
			if (!Array.isArray(right)) {
				left = false
			} else {
				left = right.some((v) => v === left)
			}
			continue
		}

		if (tok.kind !== "op" || (tok.value !== ">" && tok.value !== ">=" && tok.value !== "<" && tok.value !== "<=")) {
			break
		}
		consume(p)
		const right = parseUnary(p, capabilities)
		switch (tok.value) {
			case ">":
				left = left > right
				break
			case ">=":
				left = left >= right
				break
			case "<":
				left = left < right
				break
			case "<=":
				left = left <= right
				break
		}
	}

	return left
}

function parseEquality(p: Parser, capabilities: SandboxCapabilities): any {
	let left = parseComparison(p, capabilities)
	while (true) {
		const tok = peek(p)
		if (tok.kind !== "op" || (tok.value !== "==" && tok.value !== "!=")) {
			break
		}
		consume(p)
		const right = parseComparison(p, capabilities)
		left = tok.value === "==" ? left == right : left != right
	}
	return left
}

function parseAnd(p: Parser, capabilities: SandboxCapabilities): any {
	let left = parseEquality(p, capabilities)
	while (true) {
		const tok = peek(p)
		if (tok.kind !== "op" || tok.value !== "&&") {
			break
		}
		consume(p)
		left = Boolean(left) && Boolean(parseEquality(p, capabilities))
	}
	return left
}

function parseOr(p: Parser, capabilities: SandboxCapabilities): any {
	let left = parseAnd(p, capabilities)
	while (true) {
		const tok = peek(p)
		if (tok.kind !== "op" || tok.value !== "||") {
			break
		}
		consume(p)
		left = Boolean(left) || Boolean(parseAnd(p, capabilities))
	}
	return left
}

export function evaluateStateCondition(condition: string | undefined, capabilities: SandboxCapabilities): boolean {
	const expr = String(condition ?? "").trim()
	if (!expr) {
		return false
	}
	try {
		const tokens = tokenize(expr)
		const parser: Parser = { tokens, pos: 0 }
		const value = parseOr(parser, capabilities)
		return Boolean(value)
	} catch (error) {
		console.warn(`Failed to evaluate package state condition '${expr}':`, error)
		return false
	}
}

function mergeTools(
	base: PackageTool[],
	excludeTools: string[] | undefined,
	extra: PackageTool[] | undefined,
): PackageTool[] {
	const excluded = new Set((excludeTools ?? []).map((n) => String(n)))
	const next: PackageTool[] = []
	const indexByName = new Map<string, number>()

	for (const tool of base) {
		const name = String(tool.name)
		if (!name || excluded.has(name)) continue
		indexByName.set(name, next.length)
		next.push(tool)
	}

	for (const tool of extra ?? []) {
		const name = String(tool.name)
		if (!name || excluded.has(name)) continue
		const idx = indexByName.get(name)
		if (idx === undefined) {
			indexByName.set(name, next.length)
			next.push(tool)
		} else {
			next[idx] = tool
		}
	}

	return next
}

export function resolveToolPackageToolsForCapabilities(
	toolPackage: ToolPackage,
	capabilities: SandboxCapabilities,
): { activeStateId?: string; tools: PackageTool[] } {
	const states = toolPackage.states ?? []
	if (states.length === 0) {
		return { tools: toolPackage.tools }
	}

	let activeState: ToolPackageState | undefined
	for (const state of states) {
		if (evaluateStateCondition(state.condition, capabilities)) {
			activeState = state
			break
		}
	}

	if (!activeState) {
		return { tools: toolPackage.tools }
	}

	const base = activeState.inheritTools ? toolPackage.tools : []
	const tools = mergeTools(base, activeState.excludeTools, activeState.tools)
	return { activeStateId: activeState.id, tools }
}
