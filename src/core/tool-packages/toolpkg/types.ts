import type { LocalizedText } from "../types"

export interface ToolPkgManifest {
	schema_version?: number
	toolpkg_id: string
	version?: string
	display_name?: LocalizedText
	description?: LocalizedText
	subpackages?: Array<{
		id: string
		entry: string
	}>
	ui_modules?: Array<{
		id: string
		runtime?: string
		entry?: string
		title?: LocalizedText
		show_in_package_manager?: boolean
		permissions?: string[]
	}>
	resources?: Array<{
		key: string
		path: string
		mime?: string
	}>
}

export interface ToolPkgContainerRuntime {
	toolPkgId: string
	version?: string
	displayName?: LocalizedText
	description?: LocalizedText
	sourcePath: string
	subpackages: Array<{
		packageName: string
		subpackageId: string
		displayName?: LocalizedText
		description?: LocalizedText
		enabledByDefault: boolean
		toolCount: number
		entryPath: string
	}>
	resources: Array<{
		key: string
		path: string
		mime?: string
	}>
	uiModules: Array<{
		id: string
		runtime: string
		entry: string
		title?: LocalizedText
		showInPackageManager: boolean
		permissions?: string[]
	}>
}

