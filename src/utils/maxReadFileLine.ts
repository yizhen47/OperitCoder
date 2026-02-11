export const DEFAULT_MAX_READ_FILE_LINE = 500

export function normalizeMaxReadFileLine(value?: number): number {
	if (value === undefined || value === null || value < 0) {
		return DEFAULT_MAX_READ_FILE_LINE
	}

	return value
}
