import type { EnvVar } from "./types"

export const SANDBOX_ENV_SECRET_PREFIX = "sandbox-env:"

export function getSandboxEnvSecretKey(envName: string): string {
	return `${SANDBOX_ENV_SECRET_PREFIX}${encodeURIComponent(String(envName ?? ""))}`
}

type SecretStorageLike = {
	get(key: string): Thenable<string | undefined>
}

export async function getSandboxEnvStatus(
	secrets: SecretStorageLike,
	envNames: string[],
): Promise<Record<string, boolean>> {
	const unique = Array.from(new Set(envNames.map((n) => String(n ?? "")).filter(Boolean)))
	const pairs = await Promise.all(
		unique.map(async (name) => {
			const value = await secrets.get(getSandboxEnvSecretKey(name))
			return [name, Boolean(value)] as const
		}),
	)

	return Object.fromEntries(pairs)
}

export async function getSandboxEnvValues(
	secrets: SecretStorageLike,
	envVars: EnvVar[] | undefined,
): Promise<Record<string, string>> {
	const values: Record<string, string> = {}
	for (const envVar of envVars ?? []) {
		const name = String(envVar?.name ?? "").trim()
		if (!name) continue

		const stored = await secrets.get(getSandboxEnvSecretKey(name))
		if (stored !== undefined) {
			values[name] = stored
			continue
		}

		const fallback = envVar.defaultValue
		if (typeof fallback === "string" && fallback.length > 0) {
			values[name] = fallback
		}
	}
	return values
}

export async function getMissingRequiredSandboxEnvVars(
	secrets: SecretStorageLike,
	envVars: EnvVar[] | undefined,
): Promise<string[]> {
	const missing: string[] = []
	for (const envVar of envVars ?? []) {
		const name = String(envVar?.name ?? "").trim()
		if (!name) continue

		const isRequired = envVar.required !== false
		if (!isRequired) continue

		const stored = await secrets.get(getSandboxEnvSecretKey(name))
		if (stored !== undefined && stored.length > 0) continue

		const fallback = envVar.defaultValue
		if (typeof fallback === "string" && fallback.length > 0) continue

		missing.push(name)
	}
	return missing
}

