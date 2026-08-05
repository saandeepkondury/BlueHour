import Foundation
import UserNotifications

struct ScheduledPing: Decodable, Identifiable {
    let id: String
    let kind: String
    let title: String
    let body: String
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
    private static let prefix = "bh."
    private static let austin = TimeZone(identifier: "America/Chicago")!

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
        content.title = "Blue Hour"
        content.body = "Native notifications are on. Morning briefs and water pings will land here."
        content.sound = .default
        content.userInfo = ["kind": "test"]

        let request = UNNotificationRequest(
            identifier: prefix + "test",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)
        )
        try? await UNUserNotificationCenter.current().add(request)
    }

    private static func fetchSchedule() async throws -> ScheduleResponse {
        guard let base = URL(string: Settings.baseURL) else { throw SyncError.notConfigured }
        var request = URLRequest(url: base.appendingPathComponent("api/notifications/schedule"))
        request.setValue("Bearer \(Settings.ingestSecret)", forHTTPHeaderField: "Authorization")
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
            content.userInfo = ["kind": item.kind, "id": item.id]

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
}
