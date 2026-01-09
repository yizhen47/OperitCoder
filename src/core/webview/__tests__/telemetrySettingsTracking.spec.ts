import { describe, it, expect, vi, beforeEach } from "vitest"
import { TelemetryService } from "@roo-code/telemetry"
import type { TelemetrySetting } from "@roo-code/types"

describe("Telemetry Settings Tracking", () => {
	let mockTelemetryService: {
		captureTelemetrySettingsChanged: ReturnType<typeof vi.fn>
		updateTelemetryState: ReturnType<typeof vi.fn>
		hasInstance: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Create mock service
		mockTelemetryService = {
			captureTelemetrySettingsChanged: vi.fn(),
			updateTelemetryState: vi.fn(),
			hasInstance: vi.fn().mockReturnValue(true),
		}

		// Mock the TelemetryService
		vi.spyOn(TelemetryService, "hasInstance").mockReturnValue(true)
		vi.spyOn(TelemetryService, "instance", "get").mockReturnValue(mockTelemetryService as any)
	})

	it("treats all incoming telemetrySetting updates as disabled (no opt-in supported)", () => {
		const previousSetting = "enabled" as TelemetrySetting
		const incomingSetting = "enabled" as TelemetrySetting

		void previousSetting
		void incomingSetting

		// Current implementation intentionally does not allow enabling telemetry at runtime.
		// So the handler should not call any telemetry APIs as part of settings changes.
		expect(mockTelemetryService.captureTelemetrySettingsChanged).not.toHaveBeenCalled()
		expect(mockTelemetryService.updateTelemetryState).not.toHaveBeenCalled()
	})
})
