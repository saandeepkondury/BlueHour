import Foundation
import HealthKit

/// Reads the last two weeks of Watch data. Everything here is read-only —
/// Blue Hour never writes back into Apple Health.
struct HealthBridge {
    private let store = HKHealthStore()
    private let lookbackDays = 14

    /// A gap this long means a separate sleep block rather than the same night.
    private let nightGap: TimeInterval = 3 * 3600

    enum BridgeError: LocalizedError {
        case unavailable

        var errorDescription: String? {
            "Health data is not available on this device."
        }
    }

    private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKCategoryType(.sleepAnalysis),
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.heartRate),
            HKQuantityType(.distanceWalkingRunning),
            HKQuantityType(.activeEnergyBurned),
        ]
        types.insert(HKQuantityType(.appleExerciseTime))
        return types
    }

    func requestAccess() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { throw BridgeError.unavailable }
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    func collect() async throws -> HealthPayload {
        let start = Calendar.current.date(byAdding: .day, value: -lookbackDays, to: Date())!

        async let workouts = loadWorkouts(since: start)
        async let sleep = loadSleep(since: start)
        async let resting = loadVitals(HKQuantityType(.restingHeartRate), unit: .count().unitDivided(by: .minute()), since: start)
        async let hrv = loadVitals(HKQuantityType(.heartRateVariabilitySDNN), unit: .secondUnit(with: .milli), since: start)

        var vitals: [VitalSample] = []
        for sample in try await resting {
            vitals.append(VitalSample(at: sample.date, restingHr: sample.value, hrvMs: nil))
        }
        for sample in try await hrv {
            vitals.append(VitalSample(at: sample.date, restingHr: nil, hrvMs: sample.value))
        }
        // Ascending so the server's last write per day is the most recent reading.
        vitals.sort { $0.at < $1.at }

        return HealthPayload(
            device: await UIDeviceName.current(),
            sleep: try await sleep,
            vitals: vitals,
            workouts: try await workouts
        )
    }

    // MARK: - Workouts

    private func loadWorkouts(since start: Date) async throws -> [WorkoutSample] {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date())
        let samples = try await runQuery(sampleType: HKObjectType.workoutType(), predicate: predicate)
        guard let workouts = samples as? [HKWorkout] else { return [] }

        var out: [WorkoutSample] = []
        for workout in workouts {
            guard let activity = Self.activityName(workout.workoutActivityType) else { continue }

            let distance = workout
                .statistics(for: HKQuantityType(.distanceWalkingRunning))?
                .sumQuantity()?
                .doubleValue(for: .mile())

            let energy = workout
                .statistics(for: HKQuantityType(.activeEnergyBurned))?
                .sumQuantity()?
                .doubleValue(for: .kilocalorie())

            let heart = try? await heartRate(for: workout)

            out.append(
                WorkoutSample(
                    externalId: workout.uuid.uuidString,
                    startAt: workout.startDate,
                    endAt: workout.endDate,
                    activityType: activity,
                    distanceMi: distance,
                    durationSec: workout.duration,
                    avgHr: heart?.average,
                    maxHr: heart?.maximum,
                    activeKcal: energy
                )
            )
        }
        return out
    }

    private func heartRate(for workout: HKWorkout) async throws -> (average: Double?, maximum: Double?) {
        let unit = HKUnit.count().unitDivided(by: .minute())
        let predicate = HKQuery.predicateForObjects(from: workout)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: HKQuantityType(.heartRate),
                quantitySamplePredicate: predicate,
                options: [.discreteAverage, .discreteMax]
            ) { _, statistics, _ in
                continuation.resume(
                    returning: (
                        statistics?.averageQuantity()?.doubleValue(for: unit),
                        statistics?.maximumQuantity()?.doubleValue(for: unit)
                    )
                )
            }
            store.execute(query)
        }
    }

    private static func activityName(_ type: HKWorkoutActivityType) -> String? {
        switch type {
        case .running: return "running"
        case .walking: return "walking"
        case .hiking: return "hiking"
        case .mixedCardio: return "mixedcardio"
        case .crossTraining: return "crosstraining"
        default: return nil
        }
    }

    // MARK: - Sleep

    private func loadSleep(since start: Date) async throws -> [SleepSample] {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date())
        let samples = try await runQuery(sampleType: HKCategoryType(.sleepAnalysis), predicate: predicate)
        guard let entries = (samples as? [HKCategorySample])?.sorted(by: { $0.startDate < $1.startDate }),
              !entries.isEmpty else { return [] }

        var nights: [[HKCategorySample]] = []
        var current: [HKCategorySample] = []
        var lastEnd: Date?

        for entry in entries {
            if let end = lastEnd, entry.startDate.timeIntervalSince(end) > nightGap {
                nights.append(current)
                current = []
            }
            current.append(entry)
            lastEnd = max(lastEnd ?? entry.endDate, entry.endDate)
        }
        if !current.isEmpty { nights.append(current) }

        return nights.compactMap { night in
            let asleep = night.filter { Self.isAsleep($0) }
            guard let first = asleep.map(\.startDate).min(),
                  let last = asleep.map(\.endDate).max() else { return nil }

            let asleepMin = Self.mergedMinutes(asleep.map { ($0.startDate, $0.endDate) })
            guard asleepMin > 0 else { return nil }

            let inBedMin = Self.mergedMinutes(
                night.filter { $0.value == HKCategoryValueSleepAnalysis.inBed.rawValue }
                    .map { ($0.startDate, $0.endDate) }
            )

            return SleepSample(
                startAt: first,
                endAt: last,
                asleepMin: asleepMin,
                inBedMin: inBedMin > 0 ? inBedMin : nil
            )
        }
    }

    private static func isAsleep(_ sample: HKCategorySample) -> Bool {
        switch HKCategoryValueSleepAnalysis(rawValue: sample.value) {
        case .asleepUnspecified, .asleepCore, .asleepDeep, .asleepREM: return true
        default: return false
        }
    }

    /// The Watch and iPhone both write sleep, so overlapping ranges are merged
    /// before counting minutes rather than summed twice.
    private static func mergedMinutes(_ ranges: [(Date, Date)]) -> Int {
        let sorted = ranges.sorted { $0.0 < $1.0 }
        var total: TimeInterval = 0
        var cursor: (start: Date, end: Date)?

        for range in sorted {
            guard var window = cursor else {
                cursor = (range.0, range.1)
                continue
            }
            if range.0 <= window.end {
                window.end = max(window.end, range.1)
                cursor = window
            } else {
                total += window.end.timeIntervalSince(window.start)
                cursor = (range.0, range.1)
            }
        }
        if let window = cursor { total += window.end.timeIntervalSince(window.start) }
        return Int(total / 60)
    }

    // MARK: - Vitals

    private func loadVitals(
        _ type: HKQuantityType,
        unit: HKUnit,
        since start: Date
    ) async throws -> [(date: Date, value: Double)] {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date())
        let samples = try await runQuery(sampleType: type, predicate: predicate)
        guard let quantities = samples as? [HKQuantitySample] else { return [] }
        return quantities.map { ($0.startDate, $0.quantity.doubleValue(for: unit)) }
    }

    // MARK: - Plumbing

    private func runQuery(sampleType: HKSampleType, predicate: NSPredicate) async throws -> [HKSample] {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: sampleType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, samples, error in
                // A denied read type returns an error; treat it as "no data" so one
                // missing permission does not kill the whole sync.
                if error != nil {
                    continuation.resume(returning: [])
                } else {
                    continuation.resume(returning: samples ?? [])
                }
            }
            store.execute(query)
        }
    }
}
