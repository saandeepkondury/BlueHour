import Foundation
import WidgetKit

struct HabitsEntry: TimelineEntry {
    let date: Date
    /// `nil` when this phone has not signed in yet.
    let snapshot: HabitsSnapshot?
}

/// The trainer plans in Austin time, so "today" rolls over at Austin midnight.
enum AustinClock {
    static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Chicago") ?? .current
        return calendar
    }()

    static func iso(_ date: Date) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    static func nextMidnight(after date: Date) -> Date {
        let start = calendar.startOfDay(for: date)
        return calendar.date(byAdding: .day, value: 1, to: start) ?? date.addingTimeInterval(86_400)
    }
}

extension HabitsSnapshot {
    /// What the card should say the moment a new day starts, before the next fetch.
    func rolledOver(to date: String) -> HabitsSnapshot {
        HabitsSnapshot(
            date: date,
            habits: habits.map { HabitsSnapshot.Habit(id: $0.id, label: $0.label, done: false) },
            done: 0,
            total: total,
            streak: 0,
            plan: nil,
            mealsLogged: 0,
            water: water.map { Water(oz: 0, target: $0.target, cups: 0, cupsTarget: $0.cupsTarget) }
        )
    }
}

struct HabitsProvider: TimelineProvider {
    func placeholder(in context: Context) -> HabitsEntry {
        HabitsEntry(date: .now, snapshot: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (HabitsEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
            return
        }
        Task { completion(await load()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitsEntry>) -> Void) {
        Task {
            let now = Date.now
            let entry = await load()
            let midnight = AustinClock.nextMidnight(after: now)
            var entries = [entry]
            if let snapshot = entry.snapshot {
                entries.append(
                    HabitsEntry(date: midnight, snapshot: snapshot.rolledOver(to: AustinClock.iso(midnight)))
                )
            }
            // Half-hourly keeps stars tapped elsewhere in sync without eating the
            // daily refresh budget; the app also reloads whenever it is put away.
            let refresh = min(now.addingTimeInterval(15 * 60), midnight.addingTimeInterval(60))
            completion(Timeline(entries: entries, policy: .after(refresh)))
        }
    }

    private func load() async -> HabitsEntry {
        guard HabitsAPI.isSignedIn else { return HabitsEntry(date: .now, snapshot: nil) }
        do {
            return HabitsEntry(date: .now, snapshot: try await HabitsAPI.today())
        } catch HabitsAPIError.notSignedIn {
            return HabitsEntry(date: .now, snapshot: nil)
        } catch {
            let today = AustinClock.iso(.now)
            guard let cached = HabitsAPI.cached else {
                return HabitsEntry(date: .now, snapshot: HabitsSnapshot.sample.rolledOver(to: today))
            }
            return HabitsEntry(date: .now, snapshot: cached.date == today ? cached : cached.rolledOver(to: today))
        }
    }
}
