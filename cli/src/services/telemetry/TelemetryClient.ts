/**
 * Telemetry Client
 * Standalone PostHog client implementation for CLI telemetry
 */

import { TelemetryEvent, type BaseProperties } from "./events.js"
import { getIdentityManager, type UserIdentity } from "./identity.js"
import { logs } from "../logs.js"

/**
 * Event queue item
 */
interface QueuedEvent {
	event: string
	properties: Record<string, unknown>
	timestamp: number
	retryCount: number
}

/**
 * Telemetry Client configuration
 */
export interface TelemetryConfig {
	enabled: boolean
	apiKey: string
	host: string
	debug?: boolean
	batchSize?: number
	flushInterval?: number
	maxRetries?: number
}

/**
 * Telemetry Client
 * Handles all telemetry operations for the CLI application
 */
export class TelemetryClient {
	private client: { capture: (payload: unknown) => void; shutdown: () => Promise<void> } | null = null
	private config: TelemetryConfig
	private identity: UserIdentity | null = null
	private eventQueue: QueuedEvent[] = []
	private flushTimer: NodeJS.Timeout | null = null
	private isShuttingDown = false

	// Performance tracking
	private performanceMetrics = {
		totalCommands: 0,
		totalMessages: 0,
		totalToolExecutions: 0,
		totalApiRequests: 0,
		totalFileOperations: 0,
		commandTimes: [] as number[],
		apiResponseTimes: [] as number[],
		toolExecutionTimes: [] as number[],
	}

	constructor(config: TelemetryConfig) {
		this.config = {
			batchSize: 10,
			flushInterval: 5000, // 5 seconds
			maxRetries: 3,
			...config,
		}

		// Intentionally do not initialize any telemetry client.
		this.client = null
	}

	/**
	 * Initialize PostHog client
	 */
	private initializeClient(): void {
		void logs
		return
	}

	/**
	 * Set user identity
	 */
	public setIdentity(identity: UserIdentity): void {
		this.identity = identity

		if (this.config.debug) {
			logs.debug("Identity set for telemetry", "TelemetryClient", {
				cliUserId: identity.cliUserId.substring(0, 8) + "...",
				sessionId: identity.sessionId.substring(0, 8) + "...",
			})
		}
	}

	/**
	 * Update Kilocode user ID
	 */
	public async updateKilocodeUserId(kilocodeToken: string): Promise<void> {
		void kilocodeToken
		return
	}

	/**
	 * Clear Kilocode user ID
	 */
	public clearKilocodeUserId(): void {
		return
	}

	/**
	 * Capture a telemetry event
	 */
	public capture(event: TelemetryEvent, properties: Record<string, unknown> = {}): void {
		void event
		void properties
		return
	}

	/**
	 * Capture an exception
	 */
	public captureException(error: Error, properties: Record<string, unknown> = {}): void {
		this.capture(TelemetryEvent.EXCEPTION_CAUGHT, {
			errorType: error.name,
			errorMessage: error.message,
			errorStack: error.stack,
			isFatal: false,
			...properties,
		})
	}

	/**
	 * Track command execution
	 */
	public trackCommand(commandType: string, executionTime: number, success: boolean): void {
		this.performanceMetrics.totalCommands++
		this.performanceMetrics.commandTimes.push(executionTime)

		this.capture(TelemetryEvent.COMMAND_EXECUTED, {
			commandType,
			executionTime,
			success,
		})
	}

	/**
	 * Track API request
	 */
	public trackApiRequest(
		provider: string,
		model: string,
		responseTime: number,
		tokens?: Record<string, unknown>,
	): void {
		this.performanceMetrics.totalApiRequests++
		this.performanceMetrics.apiResponseTimes.push(responseTime)

		this.capture(TelemetryEvent.API_REQUEST_COMPLETED, {
			provider,
			model,
			responseTime,
			...tokens,
			success: true,
		})
	}

	/**
	 * Track tool execution
	 */
	public trackToolExecution(toolName: string, executionTime: number, success: boolean): void {
		this.performanceMetrics.totalToolExecutions++
		this.performanceMetrics.toolExecutionTimes.push(executionTime)

		this.capture(TelemetryEvent.TOOL_EXECUTED, {
			toolName,
			toolCategory: this.getToolCategory(toolName),
			executionTime,
			success,
		})
	}

	/**
	 * Track file operation
	 */
	public trackFileOperation(): void {
		this.performanceMetrics.totalFileOperations++
	}

	/**
	 * Get performance metrics
	 */
	public getPerformanceMetrics(): Record<string, unknown> {
		const memory = process.memoryUsage()

		return {
			memoryHeapUsed: memory.heapUsed,
			memoryHeapTotal: memory.heapTotal,
			memoryRSS: memory.rss,
			memoryExternal: memory.external,
			totalCommands: this.performanceMetrics.totalCommands,
			totalMessages: this.performanceMetrics.totalMessages,
			totalToolExecutions: this.performanceMetrics.totalToolExecutions,
			totalApiRequests: this.performanceMetrics.totalApiRequests,
			totalFileOperations: this.performanceMetrics.totalFileOperations,
			averageCommandTime: this.calculateAverage(this.performanceMetrics.commandTimes),
			averageApiResponseTime: this.calculateAverage(this.performanceMetrics.apiResponseTimes),
			averageToolExecutionTime: this.calculateAverage(this.performanceMetrics.toolExecutionTimes),
		}
	}

	/**
	 * Send performance metrics
	 */
	public sendPerformanceMetrics(): void {
		const metrics = this.getPerformanceMetrics()
		this.capture(TelemetryEvent.PERFORMANCE_METRICS, metrics)
	}

	/**
	 * Flush queued events
	 */
	public async flush(): Promise<void> {
		return
	}

	/**
	 * Shutdown telemetry client
	 */
	public async shutdown(): Promise<void> {
		this.isShuttingDown = true
		this.client = null
		this.eventQueue = []
		if (this.flushTimer) {
			clearInterval(this.flushTimer)
			this.flushTimer = null
		}
		return
	}

	/**
	 * Get base properties for all events
	 */
	private getBaseProperties(): BaseProperties {
		if (!this.identity) {
			throw new Error("Identity not set")
		}

		const baseProps: BaseProperties = {
			cliVersion: this.getCLIVersion(),
			nodeVersion: process.version,
			platform: "unknown",
			architecture: "unknown",
			sessionId: this.identity.sessionId,
			sessionDuration: getIdentityManager().getSessionDuration(),
			mode: "code", // Will be overridden by actual mode
			ciMode: false, // Will be overridden by actual CI mode
			cliUserId: this.identity.cliUserId,
		}

		// Only include kilocodeUserId if it exists
		if (this.identity.kilocodeUserId) {
			baseProps.kilocodeUserId = this.identity.kilocodeUserId
		}

		return baseProps
	}

	/**
	 * Get distinct ID for PostHog
	 */
	private getDistinctId(): string {
		return getIdentityManager().getDistinctId()
	}

	/**
	 * Get CLI version
	 */
	private getCLIVersion(): string {
		// This will be populated from package.json
		return "1.0.0"
	}

	/**
	 * Get tool category from tool name
	 */
	private getToolCategory(toolName: string): string {
		const readTools = ["readFile", "listFiles", "searchFiles", "listCodeDefinitionNames"]
		const writeTools = ["editedExistingFile", "appliedDiff", "newFileCreated", "insertContent", "searchAndReplace"]
		const mcpTools = ["use_mcp_tool", "access_mcp_resource"]

		if (readTools.includes(toolName)) return "read"
		if (writeTools.includes(toolName)) return "write"
		if (mcpTools.includes(toolName)) return "mcp"

		return "other"
	}

	/**
	 * Calculate average of an array of numbers
	 */
	private calculateAverage(numbers: number[]): number | undefined {
		if (numbers.length === 0) return undefined
		const sum = numbers.reduce((a, b) => a + b, 0)
		return sum / numbers.length
	}

	/**
	 * Start flush timer
	 */
	private startFlushTimer(): void {
		if (this.flushTimer) {
			clearInterval(this.flushTimer)
		}

		this.flushTimer = setInterval(() => {
			this.flush().catch((error) => {
				logs.error("Error during scheduled flush", "TelemetryClient", { error })
			})
		}, this.config.flushInterval || 5000)
	}

	/**
	 * Check if telemetry is enabled
	 */
	public isEnabled(): boolean {
		return false
	}
}
