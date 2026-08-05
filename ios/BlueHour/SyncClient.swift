import Foundation
import UIKit

enum UIDeviceName {
    @MainActor static func current() -> String {
        UIDevice.current.name
    }
}

struct SleepSample: Encodable {
    let startAt: Date
    let endAt: Date
    let asleepMin: Int
    let inBedMin: Int?
}

struct VitalSample: Encodable {
    let at: Date
    let restingHr: Double?
    let hrvMs: Double?
}

struct WorkoutSample: Encodable {
    let externalId: String
    let startAt: Date
    let endAt: Date
    let activityType: String
    let distanceMi: Double?
    let durationSec: Double
    let avgHr: Double?
    let maxHr: Double?
    let activeKcal: Double?
}

struct HealthPayload: Encodable {
    let device: String?
    let sleep: [SleepSample]
    let vitals: [VitalSample]
    let workouts: [WorkoutSample]

    var isEmpty: Bool {
        sleep.isEmpty && vitals.isEmpty && workouts.isEmpty
    }
}

struct IngestResponse: Decodable {
    let daysWritten: Int
    let workoutsWritten: Int
    let markedDone: [String]
}

enum SyncError: LocalizedError {
    case notConfigured
    case server(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Set the Blue Hour address and sync key first."
        case let .server(status, message):
            if status == 401 { return "Sync key rejected. Check it matches HEALTH_INGEST_SECRET." }
            if status == 503 { return "The server has no HEALTH_INGEST_SECRET set." }
            return "Server returned \(status). \(message)"
        }
    }
}

struct SyncClient {
    func send(_ payload: HealthPayload) async throws -> IngestResponse {
        guard Settings.isConfigured, let url = Settings.ingestURL() else {
            throw SyncError.notConfigured
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(Settings.ingestSecret)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 30

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard (200..<300).contains(status) else {
            throw SyncError.server(status: status, message: String(data: data, encoding: .utf8) ?? "")
        }

        return try JSONDecoder().decode(IngestResponse.self, from: data)
    }
}
