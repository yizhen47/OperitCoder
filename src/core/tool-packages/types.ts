// kilocode_change - new file

export type LocalizedText = string | Record<string, string>

export interface EnvVar {
	name: string
	description: LocalizedText
	required?: boolean
	defaultValue?: string | null
}

export interface PackageToolParameter {
	name: string
	description: LocalizedText
	type: string
	required?: boolean
}

export interface PackageTool {
	name: string
	description: LocalizedText
	parameters: PackageToolParameter[]
	script: string
}

export interface ToolPackageState {
	id: string
	condition?: string
	inheritTools?: boolean
	excludeTools?: string[]
	tools?: PackageTool[]
}

export interface ToolPackage {
	name: string
	/**
	 * Optional user-facing display name. When omitted, clients should fall back to `name`.
	 */
	displayName?: LocalizedText
	description: LocalizedText
	tools: PackageTool[]
	states?: ToolPackageState[]
	env?: EnvVar[]
	isBuiltIn?: boolean
	enabledByDefault?: boolean
	/**
	 * Optional toolpkg container identifier if this package was loaded from a `.toolpkg` archive.
	 */
	toolPkgId?: string
	/**
	 * Optional toolpkg subpackage identifier if this package was loaded from a `.toolpkg` archive.
	 */
	toolPkgSubpackageId?: string

	/** Absolute path to the source file if known. */
	sourcePath?: string
	sourceType?: "js" | "ts"
}
