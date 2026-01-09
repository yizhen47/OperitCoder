import { TelemetryEventName, type TelemetryEvent } from "@roo-code/types"

import { BaseTelemetryClient } from "./BaseTelemetryClient"

/**
 * PostHogTelemetryClient handles telemetry event tracking for the Roo Code extension.
 * Uses PostHog analytics to track user interactions and system events.
 * Respects user privacy settings and VSCode's global telemetry configuration.
 */
export class PostHogTelemetryClient extends BaseTelemetryClient {
	// Git repository properties that should be filtered out for all users
	private readonly gitPropertyNames = ["repositoryUrl", "repositoryName", "defaultBranch"]
	// kilocode_change start: filter sensitive error properties for organization users
	private readonly orgFilteredProperties = ["errorMessage", "cliPath", "stderrPreview"]
	// kilocode_change end

	constructor(debug = false) {
		super(
			{
				type: "exclude",
				events: [
					TelemetryEventName.TASK_MESSAGE,
					// TelemetryEventName.LLM_COMPLETION // kilocode_change
				],
			},
			debug,
		)
	}

	/**
	 * Filter out properties based on privacy rules
	 * - Git repository properties are filtered for all users
	 * - Error details (paths, messages) are filtered for organization users
	 * @param propertyName The property name to check
	 * @param allProperties All properties for context (to check organization membership)
	 * @returns Whether the property should be included in telemetry events
	 */
	// kilocode_change start: add allProperties parameter for org-based filtering
	protected override isPropertyCapturable(propertyName: string, allProperties: Record<string, unknown>): boolean {
		// Filter out git repository properties for all users
		if (this.gitPropertyNames.includes(propertyName)) {
			return false
		}
		if (allProperties.kilocodeOrganizationId && this.orgFilteredProperties.includes(propertyName)) {
			return false
		}
		return true
	}
	// kilocode_change end

	public override async capture(event: TelemetryEvent): Promise<void> {
		void event
		return
	}

	/**
	 * Updates the telemetry state based on user preferences and VSCode settings.
	 * Only enables telemetry if both VSCode global telemetry is enabled and
	 * user has opted in.
	 * @param didUserOptIn Whether the user has explicitly opted into telemetry
	 */
	public override updateTelemetryState(didUserOptIn: boolean): void {
		void didUserOptIn
		this.telemetryEnabled = false
	}

	public override async shutdown(): Promise<void> {
		return
	}

	// kilocode_change start
	public override async captureException(error: Error, properties?: Record<string | number, unknown>): Promise<void> {
		void error
		void properties
		return
	}

	public override async updateIdentity(kilocodeToken: string) {
		void kilocodeToken
		return
	}
	// kilocode_change end
}
