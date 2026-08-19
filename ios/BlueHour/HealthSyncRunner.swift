import Foundation

/// Shared collect → post → reschedule path used by the UI, Siri, and
/// background wakes so every entrypoint behaves the same way.
enum HealthSyncRunner {
    static func sync() async throws -> IngestResponse {
        guard Settings.isConfigured else { throw SyncError.notConfigured }

        let bridge = HealthBridge()
        try await bridge.requestAccess()
        _ = await NotificationScheduler.requestPermission()
        let payload = try await bridge.collect()
        let result = try await SyncClient().send(payload)
        await NotificationScheduler.refresh()
        return result
    }

    static func summary(for result: IngestResponse) -> String {
        if result.workoutsWritten > 0 {
            let runs = result.workoutsWritten == 1 ? "1 run" : "\(result.workoutsWritten) runs"
            return "Synced \(runs) and \(result.daysWritten) days"
        }
        if result.daysWritten > 0 {
            return "Synced \(result.daysWritten) days"
        }
        return "Nothing new in Health"
    }
}
