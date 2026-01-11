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
	description: LocalizedText
	tools: PackageTool[]
	states?: ToolPackageState[]
	env?: EnvVar[]
	isBuiltIn?: boolean
	enabledByDefault?: boolean

	/** Absolute path to the source file if known. */
	sourcePath?: string
	sourceType?: "js" | "ts"
}
