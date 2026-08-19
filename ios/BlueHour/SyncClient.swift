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
    let remMin: Int?
    let coreMin: Int?
    let deepMin: Int?
    let avgHr: Double?
}

struct VitalSample: Encodable {
    let at: Date
    let restingHr: Double?
    let hrvMs: Double?
    let walkingHr: Double?
    let hrMin: Double?
    let hrAvg: Double?
    let hrMax: Double?
}

/// Pre-resolved calendar day totals (America/Chicago). Steps, active kcal,
/// and body composition only arrive this way — they are not derived from raw vitals.
struct DaySample: Encodable {
    let date: String
    let steps: Int?
    let activeKcal: Int?
    let weightKg: Double?
    let bodyFatPct: Double?
    let waistCm: Double?
}

/// Height / sex / age from Health characteristics + latest height sample.
struct ProfileHints: Encodable {
    var heightCm: Double?
    var weightKg: Double?
    var sex: String?
    var age: Int?

    var isEmpty: Bool {
        heightCm == nil && weightKg == nil && sex == nil && age == nil
    }
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
    let days: [DaySample]
    let workouts: [WorkoutSample]
    let profile: ProfileHints?

    var isEmpty: Bool {
        sleep.isEmpty && vitals.isEmpty && days.isEmpty && workouts.isEmpty && (profile?.isEmpty ?? true)
    }
}

struct IngestResponse: Decodable {
    let daysWritten: Int
    let workoutsWritten: Int
    let markedDone: [String]?
}

struct WaterLogResponse: Decodable {
    let ok: Bool
    let date: String?
    let waterOz: Int?
}

struct SiriTodayResponse: Decodable {
    let date: String
    let title: String
    let summary: String
    let spoken: String
    let waterOz: Int
    let waterTarget: Int
    let cupsLeft: Int
}

enum SyncError: LocalizedError {
    case notConfigured
    case timeout
    case unreachable
    case server(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Set the Blue Hour address and sign in first."
        case .timeout:
            return "Sync timed out. Is npm run dev running on the Mac?"
        case .unreachable:
            return "Cannot reach the trainer. Same Wi‑Fi, and Mac awake?"
        case let .server(status, message):
            if status == 401 { return "This phone is signed out. Open the gear sheet and sign in again." }
            if status == 503 { return "The server is not ready to accept Health data yet." }
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
        request.setValue("Bearer \(Settings.deviceToken)", forHTTPHeaderField: "Authorization")
        // Cold Next.js compiles of this route have taken ~30s locally.
        request.timeoutInterval = 90

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(payload)

        do {
            return try await perform(request)
        } catch let error as URLError where error.code == .timedOut {
            do {
                return try await perform(request)
            } catch {
                throw SyncError.timeout
            }
        } catch let error as URLError where Self.unreachableCodes.contains(error.code) {
            throw SyncError.unreachable
        }
    }

    func logWater(date: String, oz: Int = 18) async throws -> WaterLogResponse {
        guard Settings.isConfigured, let url = Settings.waterLogURL() else {
            throw SyncError.notConfigured
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(Settings.deviceToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 30
        request.httpBody = try JSONSerialization.data(withJSONObject: ["date": date, "oz": oz])

        do {
            return try await decode(WaterLogResponse.self, request: request)
        } catch let error as URLError where error.code == .timedOut {
            throw SyncError.timeout
        } catch let error as URLError where Self.unreachableCodes.contains(error.code) {
            throw SyncError.unreachable
        }
    }

    func fetchToday() async throws -> SiriTodayResponse {
        guard Settings.isConfigured, let url = Settings.siriTodayURL() else {
            throw SyncError.notConfigured
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(Settings.deviceToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 45

        do {
            return try await decode(SiriTodayResponse.self, request: request)
        } catch let error as URLError where error.code == .timedOut {
            throw SyncError.timeout
        } catch let error as URLError where Self.unreachableCodes.contains(error.code) {
            throw SyncError.unreachable
        }
    }

    private static let unreachableCodes: Set<URLError.Code> = [
        .cannotConnectToHost,
        .cannotFindHost,
        .networkConnectionLost,
        .notConnectedToInternet,
        .dnsLookupFailed,
    ]

    private func perform(_ request: URLRequest) async throws -> IngestResponse {
        try await decode(IngestResponse.self, request: request)
    }

    private func decode<T: Decodable>(_ type: T.Type, request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard (200..<300).contains(status) else {
            throw SyncError.server(status: status, message: String(data: data, encoding: .utf8) ?? "")
        }

        return try JSONDecoder().decode(type, from: data)
    }
}
