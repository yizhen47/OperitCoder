// kilocode_change - new file

export type DataUtils = {
	parseJson(jsonString: string): any
	stringifyJson(obj: any): string
	formatDate(date?: Date | string): string
}

export function createLodashLite() {
	return {
		isEmpty(value: any) {
			return (
				value === null ||
				value === undefined ||
				(Array.isArray(value) && value.length === 0) ||
				(typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0)
			)
		},
		isString(value: any) {
			return typeof value === "string"
		},
		isNumber(value: any) {
			return typeof value === "number" && !Number.isNaN(value)
		},
		isBoolean(value: any) {
			return typeof value === "boolean"
		},
		isObject(value: any) {
			return typeof value === "object" && value !== null && !Array.isArray(value)
		},
		isArray(value: any) {
			return Array.isArray(value)
		},
		forEach(collection: any, iteratee: (value: any, key: any, collection: any) => void) {
			if (Array.isArray(collection)) {
				for (let i = 0; i < collection.length; i++) {
					iteratee(collection[i], i, collection)
				}
				return collection
			}
			if (collection && typeof collection === "object") {
				for (const key of Object.keys(collection)) {
					iteratee((collection as any)[key], key, collection)
				}
			}
			return collection
		},
		map(collection: any, iteratee: (value: any, key: any, collection: any) => any) {
			const result: any[] = []
			if (Array.isArray(collection)) {
				for (let i = 0; i < collection.length; i++) {
					result.push(iteratee(collection[i], i, collection))
				}
				return result
			}
			if (collection && typeof collection === "object") {
				for (const key of Object.keys(collection)) {
					result.push(iteratee((collection as any)[key], key, collection))
				}
			}
			return result
		},
	}
}

export function createDataUtils(): DataUtils {
	return {
		parseJson(jsonString: string) {
			try {
				return JSON.parse(jsonString)
			} catch {
				return null
			}
		},
		stringifyJson(obj: any) {
			try {
				return JSON.stringify(obj)
			} catch {
				return "{}"
			}
		},
		formatDate(date?: Date | string) {
			let d: Date
			if (!date) {
				d = new Date()
			} else if (typeof date === "string") {
				d = new Date(date)
			} else {
				d = date
			}

			const pad2 = (n: number) => String(n).padStart(2, "0")
			return (
				d.getFullYear() +
				"-" +
				pad2(d.getMonth() + 1) +
				"-" +
				pad2(d.getDate()) +
				" " +
				pad2(d.getHours()) +
				":" +
				pad2(d.getMinutes()) +
				":" +
				pad2(d.getSeconds())
			)
		},
	}
}
