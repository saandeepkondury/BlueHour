import Foundation

/// Today's habit card, as drawn by the home screen widget.
struct HabitsSnapshot: Codable, Equatable {
    struct Habit: Codable, Equatable, Identifiable {
        let id: String
        let label: String
        var done: Bool
    }

    struct Plan: Codable, Equatable {
        let title: String
        let detail: String
        let done: Bool
    }

    struct Water: Codable, Equatable {
        static let cupOz = 18

        var oz: Int
        /// `nil` on a day with no plan, which is also when the server has no target.
        let target: Int?
        var cups: Int
        let cupsTarget: Int?

        var progress: Double {
            guard let target, target > 0 else { return 0 }
            return min(1, Double(oz) / Double(target))
        }

        var isDone: Bool { target.map { oz >= $0 } ?? false }

        func addingCup() -> Water {
            let next = oz + Self.cupOz
            return Water(oz: next, target: target, cups: next / Self.cupOz, cupsTarget: cupsTarget)
        }
    }

    let date: String
    var habits: [Habit]
    var done: Int
    let total: Int
    var streak: Int
    var plan: Plan?
    var mealsLogged: Int?
    var water: Water?

    /// Placeholder for the widget gallery and previews.
    static let sample = HabitsSnapshot(
        date: "2026-10-04",
        habits: [
            Habit(id: "sleep", label: "Good sleep", done: true),
            Habit(id: "meal_prep", label: "Meal prepped", done: true),
            Habit(id: "plan", label: "Did the plan", done: false),
        ],
        done: 2,
        total: 3,
        streak: 4,
        plan: Plan(title: "Easy run · 2.5 mi", detail: "Week 1 · Build", done: false),
        mealsLogged: 1,
        water: Water(oz: 54, target: 108, cups: 3, cupsTarget: 6)
    )

    func settingStar(_ habitId: String, on: Bool) -> HabitsSnapshot {
        var next = self
        next.habits = habits.map { habit in
            var habit = habit
            if habit.id == habitId { habit.done = on }
            return habit
        }
        next.done = next.habits.filter(\.done).count
        return next
    }
}

enum HabitsAPIError: Error {
    case notSignedIn
    case server(Int)
}

/// Talks to `/api/habits/*` with the device token the app saved at sign-in.
enum HabitsAPI {
    private static let cacheKey = "bh.widget.habits"

    static var isSignedIn: Bool {
        base != nil && !(SharedKeychain.read(SharedKeychain.tokenAccount) ?? "").isEmpty
    }

    private static var base: URL? {
        guard let raw = SharedKeychain.read(SharedKeychain.baseURLAccount), !raw.isEmpty else { return nil }
        return URL(string: raw)
    }

    private static func request(_ path: String) throws -> URLRequest {
        guard let base, let token = SharedKeychain.read(SharedKeychain.tokenAccount), !token.isEmpty else {
            throw HabitsAPIError.notSignedIn
        }
        var request = URLRequest(url: base.appendingPathComponent(path))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 20
        return request
    }

    private static func decode(_ data: Data, _ response: URLResponse) throws -> HabitsSnapshot {
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw status == 401 ? HabitsAPIError.notSignedIn : HabitsAPIError.server(status)
        }
        return try JSONDecoder().decode(HabitsSnapshot.self, from: data)
    }

    static func today() async throws -> HabitsSnapshot {
        let (data, response) = try await URLSession.shared.data(for: request("api/habits/today"))
        let snapshot = try decode(data, response)
        cached = snapshot
        return snapshot
    }

    static func setStar(_ habitId: String, date: String, on: Bool) async throws {
        let previous = cached
        if let previous, previous.date == date {
            cached = previous.settingStar(habitId, on: on)
        }

        var request = try request("api/habits/star")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "date": date,
            "habitId": habitId,
            "on": on,
        ])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            var snapshot = try decode(data, response)
            // The star endpoint only returns habits; keep the last known rest.
            snapshot.plan = snapshot.plan ?? previous?.plan
            snapshot.mealsLogged = snapshot.mealsLogged ?? previous?.mealsLogged
            snapshot.water = snapshot.water ?? previous?.water
            cached = snapshot
            WidgetSync.broadcast()
        } catch {
            cached = previous
            throw error
        }
    }

    private struct WaterLogged: Decodable {
        let waterOz: Int?
    }

    /// One 18 oz cup, the same amount the + Cup notification logs.
    static func logCup(date: String) async throws {
        let previous = cached
        if var optimistic = previous, optimistic.date == date, let water = optimistic.water {
            optimistic.water = water.addingCup()
            cached = optimistic
        }

        var request = try request("api/water/log")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "date": date,
            "oz": HabitsSnapshot.Water.cupOz,
        ])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<300).contains(status) else {
                throw status == 401 ? HabitsAPIError.notSignedIn : HabitsAPIError.server(status)
            }
            if let oz = try JSONDecoder().decode(WaterLogged.self, from: data).waterOz,
               var snapshot = cached, snapshot.date == date, let water = snapshot.water {
                snapshot.water = HabitsSnapshot.Water(
                    oz: oz,
                    target: water.target,
                    cups: oz / HabitsSnapshot.Water.cupOz,
                    cupsTarget: water.cupsTarget
                )
                cached = snapshot
            }
            WidgetSync.broadcast()
        } catch {
            cached = previous
            throw error
        }
    }

    /// Last good snapshot, so the widget still draws when the trainer is unreachable.
    static var cached: HabitsSnapshot? {
        get {
            guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return nil }
            return try? JSONDecoder().decode(HabitsSnapshot.self, from: data)
        }
        set {
            if let newValue, let data = try? JSONEncoder().encode(newValue) {
                UserDefaults.standard.set(data, forKey: cacheKey)
            } else {
                UserDefaults.standard.removeObject(forKey: cacheKey)
            }
        }
    }
}
