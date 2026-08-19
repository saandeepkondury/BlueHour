import BackgroundTasks
import Foundation
import HealthKit

/// Keeps Today fresh when the app is not open.
///
/// Two wakes:
/// 1. **HealthKit background delivery** — observer queries fire when new sleep,
///    workouts, steps, energy, heart, or body-composition data land.
/// 2. **BGAppRefresh** — a periodic backup in case observers are quiet.
///
/// Both debounce to avoid stacking uploads when several types update at once.
actor BackgroundHealthSync {
    static let shared = BackgroundHealthSync()
    static let refreshTaskId = "com.bluehour.trainer.health-refresh"

    private let store = HKHealthStore()
    private var observersStarted = false
    private var lastSyncAt: Date?
    private var inFlight = false
    private let minInterval: TimeInterval = 90

    private init() {}

    nonisolated func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.refreshTaskId, using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            Task { await Self.shared.handleRefresh(refresh) }
        }
    }

    /// Call after Connect succeeds, and on every cold launch once configured.
    nonisolated func startIfConfigured() {
        guard Settings.isConfigured else { return }
        Task { await Self.shared.bootstrap() }
    }

    private func bootstrap() async {
        await startObservers()
        Self.scheduleRefresh()
    }

    // MARK: - HealthKit observers

    private var watchedTypes: [HKSampleType] {
        HealthKitAccess.observedTypes
    }

    private func startObservers() async {
        if observersStarted { return }
        guard HKHealthStore.isHealthDataAvailable() else { return }

        do {
            try await store.requestAuthorization(toShare: [], read: HealthKitAccess.readTypes)
        } catch {
            return
        }

        for type in watchedTypes {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completionHandler, _ in
                Task {
                    defer { completionHandler() }
                    await Self.shared.syncFromBackground()
                }
            }
            store.execute(query)

            do {
                try await store.enableBackgroundDelivery(for: type, frequency: .hourly)
            } catch {
                // Delivery may fail if the capability is missing or the type
                // was denied — observers still help while the process is alive.
            }
        }

        observersStarted = true
    }

    // MARK: - BGAppRefresh

    nonisolated static func scheduleRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: refreshTaskId)
        // Aim for early morning Austin so sleep + RHR are usually settled.
        request.earliestBeginDate = Date(timeIntervalSinceNow: 4 * 3600)
        try? BGTaskScheduler.shared.submit(request)
    }

    private func handleRefresh(_ task: BGAppRefreshTask) async {
        Self.scheduleRefresh()

        let work = Task {
            do {
                _ = try await HealthSyncRunner.sync()
                return true
            } catch {
                return false
            }
        }

        task.expirationHandler = {
            work.cancel()
        }

        let ok = await work.value
        task.setTaskCompleted(success: ok)
    }

    // MARK: - Shared sync

    private func syncFromBackground() async {
        guard Settings.isConfigured else { return }
        if inFlight { return }
        if let last = lastSyncAt, Date().timeIntervalSince(last) < minInterval { return }

        inFlight = true
        defer { inFlight = false }

        do {
            _ = try await HealthSyncRunner.sync()
            lastSyncAt = Date()
        } catch {
            // Silent on background — next open or wake will retry.
        }
    }
}
