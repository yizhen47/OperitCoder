import { telemetryClient } from "@src/utils/TelemetryClient"

describe("TelemetryClient", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	/**
	 * Test the singleton pattern
	 */
	it("should be a singleton", () => {
		// Basic test to verify the service exists
		expect(telemetryClient).toBeDefined()

		// Get the constructor via prototype
		const constructor = Object.getPrototypeOf(telemetryClient).constructor

		// Verify static getInstance returns the same instance
		expect(constructor.getInstance()).toBe(telemetryClient)
		expect(constructor.getInstance()).toBe(constructor.getInstance())
	})

	it("updateTelemetryState does not throw", () => {
		expect(() => telemetryClient.updateTelemetryState("enabled")).not.toThrow()
		expect(() => telemetryClient.updateTelemetryState("enabled", "test-api-key", "test-user-id")).not.toThrow()
		expect(() => telemetryClient.updateTelemetryState("disabled")).not.toThrow()
		expect(() => telemetryClient.updateTelemetryState("unset")).not.toThrow()
	})

	it("capture does not throw", () => {
		expect(() => telemetryClient.capture("test_event")).not.toThrow()
		expect(() => telemetryClient.capture("test_event", { property: "value" })).not.toThrow()
	})

	it("captureException does not throw", () => {
		expect(() => telemetryClient.captureException(new Error("test"))).not.toThrow()
		expect(() => telemetryClient.captureException(new Error("test"), { foo: "bar" })).not.toThrow()
	})
})
