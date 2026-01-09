import type { TelemetrySetting } from "@roo-code/types"

class TelemetryClient {
	private static instance: TelemetryClient
	private static telemetryEnabled: boolean = false

	public updateTelemetryState(telemetrySetting: TelemetrySetting, apiKey?: string, distinctId?: string) {
		void telemetrySetting
		void apiKey
		void distinctId
		TelemetryClient.telemetryEnabled = false
	}

	public static getInstance(): TelemetryClient {
		if (!TelemetryClient.instance) {
			TelemetryClient.instance = new TelemetryClient()
		}

		return TelemetryClient.instance
	}

	public capture(eventName: string, properties?: Record<string, any>) {
		void eventName
		void properties
		return
	}

	// kilocode_change start
	public captureException(error: Error, properties?: Record<string, any>) {
		void error
		void properties
		return
	}
	// kilocode_change end
}

export const telemetryClient = TelemetryClient.getInstance()
