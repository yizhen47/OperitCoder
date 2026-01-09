import { telemetryClient } from "../TelemetryClient"

describe("TelemetryClient", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should be a singleton", () => {
		// Basic test to verify the service exists
		expect(telemetryClient).toBeDefined()
	})

	it("should have updateTelemetryState method", () => {
		// Test if the method exists
		expect(typeof telemetryClient.updateTelemetryState).toBe("function")

		// Call it with different values to verify it doesn't throw errors
		expect(() => telemetryClient.updateTelemetryState("enabled")).not.toThrow()
		expect(() => telemetryClient.updateTelemetryState("disabled")).not.toThrow()
		expect(() => telemetryClient.updateTelemetryState("unset")).not.toThrow()
	})

	it("should have capture method", () => {
		// Test if the method exists
		expect(typeof telemetryClient.capture).toBe("function")

		// Call it to verify it doesn't throw errors
		expect(() => telemetryClient.capture("test_event")).not.toThrow()
		expect(() => telemetryClient.capture("test_event", { key: "value" })).not.toThrow()
	})

	it("updateTelemetryState does not throw", () => {
		expect(() => telemetryClient.updateTelemetryState("enabled")).not.toThrow()
		expect(() => telemetryClient.updateTelemetryState("enabled", "test-api-key", "test-user-id")).not.toThrow()
		expect(() => telemetryClient.updateTelemetryState("disabled")).not.toThrow()
		expect(() => telemetryClient.updateTelemetryState("unset")).not.toThrow()
	})

	it("capture does not throw", () => {
		expect(() => telemetryClient.capture("test_event")).not.toThrow()
		expect(() => telemetryClient.capture("test_event", { key: "value" })).not.toThrow()
	})

	it("captureException does not throw", () => {
		expect(() => telemetryClient.captureException(new Error("test"))).not.toThrow()
		expect(() => telemetryClient.captureException(new Error("test"), { foo: "bar" })).not.toThrow()
	})
})
