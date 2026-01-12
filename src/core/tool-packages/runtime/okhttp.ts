// kilocode_change - new file

/* eslint-disable @typescript-eslint/no-explicit-any */

export type OkHttpInterceptor = (request: HttpRequest) => HttpRequest | void

export interface HttpRequest {
	url: string
	method: string
	headers: Record<string, string>
	body?: any
	bodyType?: "text" | "json" | "form" | "multipart"
	formParams?: Record<string, string>
	multipartParams?: Array<{ name: string; value: string; contentType?: string }>
	execute(): Promise<OkHttpResponse>
}

export interface OkHttpResponse {
	raw: {
		status_code: number
		headers: Record<string, string>
		body: string
	}
	statusCode: number
	statusMessage: string
	headers: Record<string, string>
	content: string
	contentType: string
	size: number
	json(): any
	text(): string
	bodyAsBase64(): string
	isSuccessful(): boolean
}

export class OkHttpClientBuilder {
	private config: {
		timeouts: { connect: number; read: number; write: number }
		followRedirects: boolean
		retryOnConnectionFailure: boolean
		interceptors: OkHttpInterceptor[]
	}

	public constructor() {
		this.config = {
			timeouts: { connect: 10000, read: 10000, write: 10000 },
			followRedirects: true,
			retryOnConnectionFailure: true,
			interceptors: [],
		}
	}

	public connectTimeout(timeout: number): OkHttpClientBuilder {
		this.config.timeouts.connect = timeout
		return this
	}

	public readTimeout(timeout: number): OkHttpClientBuilder {
		this.config.timeouts.read = timeout
		return this
	}

	public writeTimeout(timeout: number): OkHttpClientBuilder {
		this.config.timeouts.write = timeout
		return this
	}

	public followRedirects(follow: boolean): OkHttpClientBuilder {
		this.config.followRedirects = follow
		return this
	}

	public retryOnConnectionFailure(retry: boolean): OkHttpClientBuilder {
		this.config.retryOnConnectionFailure = retry
		return this
	}

	public addInterceptor(interceptor: OkHttpInterceptor): OkHttpClientBuilder {
		this.config.interceptors.push(interceptor)
		return this
	}

	public build(fetchImpl?: typeof globalThis.fetch): OkHttpClient {
		return new OkHttpClient({ ...this.config, interceptors: [...this.config.interceptors] }, fetchImpl)
	}
}

export class OkHttpClient {
	private readonly config: {
		timeouts: { connect: number; read: number; write: number }
		followRedirects: boolean
		retryOnConnectionFailure: boolean
		interceptors: OkHttpInterceptor[]
	}
	private readonly fetchImpl: typeof globalThis.fetch

	public constructor(config?: Partial<OkHttpClient["config"]>, fetchImpl?: typeof globalThis.fetch) {
		this.config = {
			timeouts: { connect: 10000, read: 10000, write: 10000 },
			followRedirects: true,
			retryOnConnectionFailure: true,
			interceptors: [],
			...(config ?? {}),
		}
		this.fetchImpl = fetchImpl ?? globalThis.fetch
	}

	public newRequest(): RequestBuilder {
		return new RequestBuilder(this)
	}

	public async execute(request: HttpRequest): Promise<OkHttpResponse> {
		let req = request
		for (const interceptor of this.config.interceptors) {
			const maybeNext = interceptor(req)
			if (maybeNext) {
				req = maybeNext
			}
		}

		const attempt = async (): Promise<OkHttpResponse> => {
			if (typeof this.fetchImpl !== "function") {
				throw new Error("Global fetch is not available in this runtime")
			}

			const headers = new Headers()
			for (const [k, v] of Object.entries(req.headers ?? {})) {
				if (v === undefined || v === null) {
					continue
				}
				headers.set(k, String(v))
			}

			let body: any = undefined
			const upperMethod = (req.method || "GET").toUpperCase()
			const hasBody = upperMethod !== "GET" && upperMethod !== "HEAD"

			if (hasBody && req.body !== undefined) {
				switch (req.bodyType) {
					case "form": {
						if (typeof req.body === "string") {
							body = req.body
						} else {
							const params = new URLSearchParams()
							for (const [k, v] of Object.entries(req.body ?? {})) {
								params.set(k, String(v))
							}
							body = params.toString()
						}
						if (!headers.has("content-type")) {
							headers.set("content-type", "application/x-www-form-urlencoded")
						}
						break
					}
					case "json": {
						body = typeof req.body === "string" ? req.body : JSON.stringify(req.body)
						if (!headers.has("content-type")) {
							headers.set("content-type", "application/json")
						}
						break
					}
					case "text": {
						body = typeof req.body === "string" ? req.body : String(req.body)
						if (!headers.has("content-type")) {
							headers.set("content-type", "text/plain")
						}
						break
					}
					case "multipart": {
						throw new Error("OkHttp multipart is not implemented in desktop runtime")
					}
					default: {
						body = typeof req.body === "string" ? req.body : JSON.stringify(req.body)
						break
					}
				}
			}

			const controller = new AbortController()
			const timeoutMs = Math.max(0, this.config.timeouts.connect || 0)
			let timeoutHandle: NodeJS.Timeout | undefined
			if (timeoutMs > 0) {
				timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
			}

			try {
				const resp = await this.fetchImpl(req.url, {
					method: upperMethod,
					headers,
					body,
					signal: controller.signal,
					redirect: this.config.followRedirects ? "follow" : "manual",
				})

				const content = await resp.text()
				const headersObj: Record<string, string> = {}
				resp.headers.forEach((value, key) => {
					headersObj[key] = value
				})

				const contentType = resp.headers.get("content-type") ?? ""
				const size = Buffer.byteLength(content ?? "", "utf8")

				const response: OkHttpResponse = {
					raw: {
						status_code: resp.status,
						headers: headersObj,
						body: content,
					},
					statusCode: resp.status,
					statusMessage: resp.statusText || "",
					headers: headersObj,
					content,
					contentType,
					size,
					json() {
						try {
							return JSON.parse(content)
						} catch {
							return null
						}
					},
					text() {
						return content
					},
					bodyAsBase64() {
						return Buffer.from(content ?? "", "utf8").toString("base64")
					},
					isSuccessful() {
						return resp.status >= 200 && resp.status < 300
					},
				}

				return response
			} finally {
				if (timeoutHandle) {
					clearTimeout(timeoutHandle)
				}
			}
		}

		try {
			return await attempt()
		} catch (error) {
			if (!this.config.retryOnConnectionFailure) {
				throw error
			}
			return await attempt()
		}
	}

	public async get(url: string, headers?: Record<string, string>): Promise<OkHttpResponse> {
		return this.newRequest().url(url).method("GET").headers(headers ?? {}).build().execute()
	}

	public async post(url: string, body: any, headers?: Record<string, string>): Promise<OkHttpResponse> {
		return this.newRequest().url(url).method("POST").headers(headers ?? {}).body(body, "json").build().execute()
	}

	public async put(url: string, body: any, headers?: Record<string, string>): Promise<OkHttpResponse> {
		return this.newRequest().url(url).method("PUT").headers(headers ?? {}).body(body, "json").build().execute()
	}

	public async delete(url: string, headers?: Record<string, string>): Promise<OkHttpResponse> {
		return this.newRequest().url(url).method("DELETE").headers(headers ?? {}).build().execute()
	}
}

export class RequestBuilder {
	private request: {
		url: string
		method: string
		headers: Record<string, string>
		body?: any
		bodyType?: "text" | "json" | "form" | "multipart"
	}

	public constructor(private readonly client: OkHttpClient) {
		this.request = { url: "", method: "GET", headers: {} }
	}

	public url(url: string): RequestBuilder {
		this.request.url = url
		return this
	}

	public method(method: string): RequestBuilder {
		this.request.method = method
		return this
	}

	public header(name: string, value: string): RequestBuilder {
		this.request.headers[name] = value
		return this
	}

	public headers(headers: Record<string, string>): RequestBuilder {
		this.request.headers = { ...this.request.headers, ...(headers ?? {}) }
		return this
	}

	public body(body: any, type?: "text" | "json" | "form" | "multipart"): RequestBuilder {
		this.request.body = body
		this.request.bodyType = type
		return this
	}

	public jsonBody(data: any): RequestBuilder {
		return this.body(data, "json")
	}

	public formParam(_name: string, _value: string): RequestBuilder {
		throw new Error("OkHttp formParam is not implemented in desktop runtime")
	}

	public multipartParam(_name: string, _value: string, _contentType?: string): RequestBuilder {
		throw new Error("OkHttp multipartParam is not implemented in desktop runtime")
	}

	public build(): HttpRequest {
		const snapshot = { ...this.request, headers: { ...this.request.headers } }
		let requestObj: HttpRequest
		requestObj = {
			...snapshot,
			execute: async () => this.client.execute(requestObj),
		}
		return requestObj
	}
}

export function createOkHttp(): { newClient(): OkHttpClient; newBuilder(): OkHttpClientBuilder } {
	return createOkHttpWithFetch(globalThis.fetch)
}

export function createOkHttpWithFetch(fetchImpl: typeof globalThis.fetch): {
	newClient(): OkHttpClient
	newBuilder(): OkHttpClientBuilder
} {
	return {
		newClient() {
			return new OkHttpClient(undefined, fetchImpl)
		},
		newBuilder() {
			const builder = new OkHttpClientBuilder()
			const originalBuild = builder.build.bind(builder)
			builder.build = () => originalBuild(fetchImpl)
			return builder
		},
	}
}
