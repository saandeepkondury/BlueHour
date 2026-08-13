import AppIntents
import Foundation

// MARK: - Shared helpers

enum AustinDay {
    private static let zone = TimeZone(identifier: "America/Chicago")!

    static func todayISO() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = zone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

enum SiriIntentError: Error, CustomLocalizedStringResourceConvertible {
    case notConfigured
    case unreachable
    case failed(String)

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .notConfigured:
            return "Connect Blue Hour first — open the app and save the address and sync key."
        case .unreachable:
            return "Cannot reach Blue Hour right now. Check Wi‑Fi and try again."
        case let .failed(message):
            return "\(message)"
        }
    }
}

private func mapSyncError(_ error: Error) -> SiriIntentError {
    if let sync = error as? SyncError {
        switch sync {
        case .notConfigured: return .notConfigured
        case .timeout, .unreachable: return .unreachable
        case let .server(_, message):
            return .failed(message.isEmpty ? sync.localizedDescription : message)
        }
    }
    return .failed(error.localizedDescription)
}

// MARK: - Log water

struct LogWaterIntent: AppIntent {
    static var title: LocalizedStringResource = "Log water"
    static var description = IntentDescription("Logs one cup (18 oz / 540 ml) of water in Blue Hour.")
    static var openAppWhenRun = false

    @Parameter(title: "Ounces", default: 18)
    var ounces: Int?

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$ounces) oz of water")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard Settings.isConfigured else { throw SiriIntentError.notConfigured }

        let oz = max(1, min(ounces ?? 18, 64))
        do {
            let result = try await SyncClient().logWater(date: AustinDay.todayISO(), oz: oz)
            let total = result.waterOz.map { "\($0) oz so far today." } ?? "Logged."
            let cups = oz == 18 ? "one cup" : "\(oz) ounces"
            return .result(dialog: "Logged \(cups). \(total)")
        } catch {
            throw mapSyncError(error)
        }
    }
}

// MARK: - Today's plan

struct TodaysPlanIntent: AppIntent {
    static var title: LocalizedStringResource = "Today's plan"
    static var description = IntentDescription("Hears today's Blue Hour workout and fuel snapshot.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard Settings.isConfigured else { throw SiriIntentError.notConfigured }

        do {
            let today = try await SyncClient().fetchToday()
            return .result(dialog: IntentDialog(stringLiteral: today.spoken))
        } catch {
            throw mapSyncError(error)
        }
    }
}

// MARK: - Sync Health

struct SyncHealthIntent: AppIntent {
    static var title: LocalizedStringResource = "Sync Apple Health"
    static var description = IntentDescription("Pulls the latest Apple Watch data into Blue Hour.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard Settings.isConfigured else { throw SiriIntentError.notConfigured }

        do {
            let bridge = HealthBridge()
            try await bridge.requestAccess()
            let payload = try await bridge.collect()
            let result = try await SyncClient().send(payload)
            await NotificationScheduler.refresh()

            let message: String
            if result.workoutsWritten > 0 {
                let runs = result.workoutsWritten == 1 ? "1 run" : "\(result.workoutsWritten) runs"
                message = "Synced \(runs) and \(result.daysWritten) days."
            } else if result.daysWritten > 0 {
                message = "Synced \(result.daysWritten) days."
            } else {
                message = "Nothing new in Health."
            }
            return .result(dialog: IntentDialog(stringLiteral: message))
        } catch {
            throw mapSyncError(error)
        }
    }
}

// MARK: - Open screens

enum OpenScreen: String, AppEnum {
    case today
    case water
    case coach
    case fuel
    case plan
    case progress

    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        TypeDisplayRepresentation(name: "Screen")
    }

    static var caseDisplayRepresentations: [OpenScreen: DisplayRepresentation] = [
        .today: "Today",
        .water: "Water",
        .coach: "Coach",
        .fuel: "Fuel",
        .plan: "Plan",
        .progress: "Progress",
    ]

    var destination: AppDestination {
        switch self {
        case .today: return .today
        case .water: return .water
        case .coach: return .coach
        case .fuel: return .fuel
        case .plan: return .plan
        case .progress: return .progress
        }
    }
}

/// Parameter-free open so Shortcuts always has a stable “Open Blue Hour” tile
/// even before parameterized screen variants are indexed.
struct OpenAppIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Blue Hour"
    static var description = IntentDescription("Opens Blue Hour on Today.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        DeepLinkRouter.shared.open(.today)
        return .result(dialog: "Opening Blue Hour.")
    }
}

struct OpenBlueHourIntent: AppIntent {
    static var title: LocalizedStringResource = "Open a Blue Hour screen"
    static var description = IntentDescription("Opens a specific Blue Hour screen.")
    static var openAppWhenRun = true

    @Parameter(title: "Screen", default: .today)
    var screen: OpenScreen

    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$screen) in Blue Hour")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        DeepLinkRouter.shared.open(screen.destination)
        return .result(dialog: "Opening \(screen.rawValue).")
    }
}

// MARK: - Shortcuts phrases

struct BlueHourShortcuts: AppShortcutsProvider {
    static var shortcutTileColor: ShortcutTileColor = .navy

    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogWaterIntent(),
            phrases: [
                "Log water in \(.applicationName)",
                "Log a cup in \(.applicationName)",
                "Log a cup of water in \(.applicationName)",
                "Add water in \(.applicationName)",
            ],
            shortTitle: "Log water",
            systemImageName: "drop.fill"
        )
        AppShortcut(
            intent: TodaysPlanIntent(),
            phrases: [
                "What's today's plan in \(.applicationName)",
                "What's my workout in \(.applicationName)",
                "Today's workout in \(.applicationName)",
                "Tell me today's plan in \(.applicationName)",
            ],
            shortTitle: "Today's plan",
            systemImageName: "figure.run"
        )
        AppShortcut(
            intent: SyncHealthIntent(),
            phrases: [
                "Sync Apple Health in \(.applicationName)",
                "Sync Health in \(.applicationName)",
                "Sync my Watch in \(.applicationName)",
            ],
            shortTitle: "Sync Health",
            systemImageName: "heart.fill"
        )
        AppShortcut(
            intent: OpenAppIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Launch \(.applicationName)",
                "Start \(.applicationName)",
            ],
            shortTitle: "Open",
            systemImageName: "sunrise.fill"
        )
        AppShortcut(
            intent: OpenBlueHourIntent(),
            phrases: [
                "Open \(\.$screen) in \(.applicationName)",
                "Show \(\.$screen) in \(.applicationName)",
                "Go to \(\.$screen) in \(.applicationName)",
            ],
            shortTitle: "Open screen",
            systemImageName: "square.grid.2x2"
        )
    }
}
