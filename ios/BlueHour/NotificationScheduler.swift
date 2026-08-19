import Foundation
import UserNotifications

struct ScheduledPing: Decodable, Identifiable {
    let id: String
    let kind: String
    let title: String
    let body: String
    let date: String?
    let year: Int
    let month: Int
    let day: Int
    let hour: Int
    let minute: Int
}

struct ScheduleResponse: Decodable {
    let enabled: Bool
    let timezone: String
    let reminderHour: Int
    let items: [ScheduledPing]
}

/// Native local notifications for morning briefs and water pings.
/// The server owns copy and timing; this just asks iOS to fire them.
enum NotificationScheduler {
    static let waterCategory = "water"
    static let logCupAction = "log-cup"

    private static let prefix = "bh."
    private static let austin = TimeZone(identifier: "America/Chicago")!

    static func registerCategories() {
        let logCup = UNNotificationAction(
            identifier: logCupAction,
            title: "+ Cup",
            options: []
        )
        let water = UNNotificationCategory(
            identifier: waterCategory,
            actions: [logCup],
            intentIdentifiers: [],
            options: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([water])
    }

    static func requestPermission() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    static func refresh() async {
        guard Settings.isConfigured else { return }
        let granted = await requestPermission()
        guard granted else {
            await cancelOurs()
            return
        }

        do {
            let schedule = try await fetchSchedule()
            await replace(with: schedule.enabled ? schedule.items : [])
        } catch {
            // Keep whatever is already scheduled if the trainer is unreachable.
        }
    }

    static func sendTest() async {
        _ = await requestPermission()
        let content = UNMutableNotificationContent()
        content.title = "Drink a glass of water"
        content.body = "One cup now — tap + Cup to log it."
        content.sound = .default
        content.threadIdentifier = "water"
        content.categoryIdentifier = waterCategory
        content.userInfo = ["kind": "water", "date": todayAustin()]

        let request = UNNotificationRequest(
            identifier: prefix + "test",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        try? await UNUserNotificationCenter.current().add(request)
    }

    /// Handles the + Cup action from a water banner without opening the web UI.
    static func handleResponse(_ response: UNNotificationResponse) async {
        guard response.actionIdentifier == logCupAction else { return }

        let info = response.notification.request.content.userInfo
        let date =
            (info["date"] as? String)
            ?? dateFromWaterId(info["id"] as? String)
            ?? todayAustin()

        do {
            let result = try await SyncClient().logWater(date: date)
            await confirmLog(waterOz: result.waterOz)
            await refresh()
        } catch {
            await confirmFailure()
        }
    }

    private static func fetchSchedule() async throws -> ScheduleResponse {
        guard let base = URL(string: Settings.baseURL) else { throw SyncError.notConfigured }
        var request = URLRequest(url: base.appendingPathComponent("api/notifications/schedule"))
        request.setValue("Bearer \(Settings.deviceToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 45

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ..< 300).contains(status) else {
            throw SyncError.server(status: status, message: String(data: data, encoding: .utf8) ?? "")
        }
        return try JSONDecoder().decode(ScheduleResponse.self, from: data)
    }

    private static func replace(with items: [ScheduledPing]) async {
        await cancelOurs()

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = austin
        let soon = Date().addingTimeInterval(15)
        let center = UNUserNotificationCenter.current()

        for item in items {
            var comps = DateComponents()
            comps.timeZone = austin
            comps.year = item.year
            comps.month = item.month
            comps.day = item.day
            comps.hour = item.hour
            comps.minute = item.minute
            guard let date = calendar.date(from: comps), date > soon else { continue }

            let content = UNMutableNotificationContent()
            content.title = item.title
            content.body = item.body
            content.sound = .default
            content.threadIdentifier = item.kind
            content.userInfo = [
                "kind": item.kind,
                "id": item.id,
                "date": item.date ?? String(format: "%04d-%02d-%02d", item.year, item.month, item.day),
            ]
            if item.kind == "water" {
                content.categoryIdentifier = waterCategory
            }

            let request = UNNotificationRequest(
                identifier: prefix + item.id,
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            )
            try? await center.add(request)
        }
    }

    private static func cancelOurs() async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let ours = pending.map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: ours)
        center.removeDeliveredNotifications(withIdentifiers: [prefix + "test"])
    }

    private static func confirmLog(waterOz: Int?) async {
        let content = UNMutableNotificationContent()
        content.title = "Cup logged"
        if let waterOz {
            let ml = Int((Double(waterOz) * 540.0 / 18.0).rounded())
            content.body = "\(waterOz) oz · \(ml) ml so far today."
        } else {
            content.body = "One cup added."
        }
        content.sound = .default
        content.userInfo = ["kind": "water-log-ok"]

        let request = UNNotificationRequest(
            identifier: prefix + "water-log-ok",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 0.5, repeats: false)
        )
        try? await UNUserNotificationCenter.current().add(request)
    }

    private static func confirmFailure() async {
        let content = UNMutableNotificationContent()
        content.title = "Could not log water"
        content.body = "Open Blue Hour and tap +1 cup on Today."
        content.sound = .default
        content.userInfo = ["kind": "water-log-fail"]

        let request = UNNotificationRequest(
            identifier: prefix + "water-log-fail",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 0.5, repeats: false)
        )
        try? await UNUserNotificationCenter.current().add(request)
    }

    private static func dateFromWaterId(_ id: String?) -> String? {
        guard let id else { return nil }
        // water-YYYY-MM-DD-HH
        let parts = id.split(separator: "-")
        guard parts.count >= 4, parts[0] == "water" else { return nil }
        return "\(parts[1])-\(parts[2])-\(parts[3])"
    }

    private static func todayAustin() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = austin
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
