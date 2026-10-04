import AppIntents
import Foundation

/// Runs inside the widget when a star is tapped, without opening the app.
/// Compiled into the app as well, which is how WidgetKit expects interactive
/// widget intents to ship.
struct ToggleHabitIntent: AppIntent {
    static let title: LocalizedStringResource = "Star a habit"
    static let isDiscoverable = false

    @Parameter(title: "Habit")
    var habitId: String

    @Parameter(title: "Date")
    var date: String

    @Parameter(title: "Starred")
    var on: Bool

    init() {}

    init(habitId: String, date: String, on: Bool) {
        self.habitId = habitId
        self.date = date
        self.on = on
    }

    func perform() async throws -> some IntentResult {
        try await HabitsAPI.setStar(habitId, date: date, on: on)
        return .result()
    }
}

/// The widget's + Cup button. Siri's "Log water" stays in the app with its spoken reply.
struct LogCupIntent: AppIntent {
    static let title: LocalizedStringResource = "Log a cup of water"
    static let isDiscoverable = false

    @Parameter(title: "Date")
    var date: String

    init() {}

    init(date: String) {
        self.date = date
    }

    func perform() async throws -> some IntentResult {
        try await HabitsAPI.logCup(date: date)
        return .result()
    }
}
