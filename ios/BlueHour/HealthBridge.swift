import Foundation
import HealthKit

/// Reads Watch data and posts it to Blue Hour. Everything here is read-only —
/// Blue Hour never writes back into Apple Health.
///
/// Sleep, vitals, and workouts are read from HealthKit in full, but the
/// server only keeps samples on or after the training start date so pre-app
/// history does not crowd Sleep, Rest HR, HRV, or Runs.
struct HealthBridge {
    private let store = HKHealthStore()

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
            HKQuantityType(.walkingHeartRateAverage),
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
        let bpm = HKUnit.count().unitDivided(by: .minute())

        // nil start = every sample HealthKit still has.
        async let workouts = loadWorkouts(since: nil)
        async let sleep = loadSleep(since: nil)
        async let resting = loadVitals(HKQuantityType(.restingHeartRate), unit: bpm, since: nil)
        async let walking = loadVitals(HKQuantityType(.walkingHeartRateAverage), unit: bpm, since: nil)
        async let hrv = loadVitals(HKQuantityType(.heartRateVariabilitySDNN), unit: .secondUnit(with: .milli), since: nil)
        async let ranges = loadDailyHeartRanges(since: nil)

        var vitals: [VitalSample] = []
        for sample in try await resting {
            vitals.append(
                VitalSample(at: sample.date, restingHr: sample.value, hrvMs: nil, walkingHr: nil, hrMin: nil, hrAvg: nil, hrMax: nil)
            )
        }
        for sample in try await walking {
            vitals.append(
                VitalSample(at: sample.date, restingHr: nil, hrvMs: nil, walkingHr: sample.value, hrMin: nil, hrAvg: nil, hrMax: nil)
            )
        }
        for sample in try await hrv {
            vitals.append(
                VitalSample(at: sample.date, restingHr: nil, hrvMs: sample.value, walkingHr: nil, hrMin: nil, hrAvg: nil, hrMax: nil)
            )
        }
        for sample in try await ranges {
            vitals.append(
                VitalSample(
                    at: sample.date,
                    restingHr: nil,
                    hrvMs: nil,
                    walkingHr: nil,
                    hrMin: sample.min,
                    hrAvg: sample.average,
                    hrMax: sample.max
                )
            )
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

    private func loadWorkouts(since start: Date?) async throws -> [WorkoutSample] {
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

    private func loadSleep(since start: Date?) async throws -> [SleepSample] {
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

        var out: [SleepSample] = []
        for night in nights {
            let asleep = night.filter { Self.isAsleep($0) }
            let inBed = night.filter { Self.isInBed($0) }

            // Prefer staged/asleep samples. Some phones only write In Bed
            // (no Watch stages) — count that so Today is not blank.
            let counted = asleep.isEmpty ? inBed : asleep
            guard let first = counted.map(\.startDate).min(),
                  let last = counted.map(\.endDate).max() else { continue }

            let asleepMin = Self.mergedMinutes(counted.map { ($0.startDate, $0.endDate) })
            guard asleepMin > 0 else { continue }

            let inBedMin = Self.mergedMinutes(inBed.map { ($0.startDate, $0.endDate) })
            let remMin = Self.mergedMinutes(night.filter { Self.isStage($0, .asleepREM) }.map { ($0.startDate, $0.endDate) })
            let coreMin = Self.mergedMinutes(night.filter { Self.isStage($0, .asleepCore) }.map { ($0.startDate, $0.endDate) })
            let deepMin = Self.mergedMinutes(night.filter { Self.isStage($0, .asleepDeep) }.map { ($0.startDate, $0.endDate) })
            let avgHr = try? await averageHeartRate(from: first, to: last)

            out.append(
                SleepSample(
                    startAt: first,
                    endAt: last,
                    asleepMin: asleepMin,
                    inBedMin: inBedMin > 0 ? inBedMin : nil,
                    remMin: remMin > 0 ? remMin : nil,
                    coreMin: coreMin > 0 ? coreMin : nil,
                    deepMin: deepMin > 0 ? deepMin : nil,
                    avgHr: avgHr
                )
            )
        }
        return out
    }

    private func averageHeartRate(from start: Date, to end: Date) async throws -> Double? {
        let unit = HKUnit.count().unitDivided(by: .minute())
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: HKQuantityType(.heartRate),
                quantitySamplePredicate: predicate,
                options: .discreteAverage
            ) { _, statistics, _ in
                continuation.resume(
                    returning: statistics?.averageQuantity()?.doubleValue(for: unit)
                )
            }
            store.execute(query)
        }
    }

    private static func isAsleep(_ sample: HKCategorySample) -> Bool {
        guard let value = HKCategoryValueSleepAnalysis(rawValue: sample.value) else {
            // Unknown writers — anything that is not awake/in-bed is sleep.
            return !isAwake(sample) && !isInBed(sample)
        }
        switch value {
        case .asleepUnspecified, .asleepCore, .asleepDeep, .asleepREM:
            return true
        case .awake, .inBed:
            return false
        @unknown default:
            // Future Apple sleep stages should count as asleep.
            return true
        }
    }

    private static func isStage(_ sample: HKCategorySample, _ stage: HKCategoryValueSleepAnalysis) -> Bool {
        sample.value == stage.rawValue
    }

    private static func isInBed(_ sample: HKCategorySample) -> Bool {
        sample.value == HKCategoryValueSleepAnalysis.inBed.rawValue
    }

    private static func isAwake(_ sample: HKCategorySample) -> Bool {
        sample.value == HKCategoryValueSleepAnalysis.awake.rawValue
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
        since start: Date?
    ) async throws -> [(date: Date, value: Double)] {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date())
        let samples = try await runQuery(sampleType: type, predicate: predicate)
        guard let quantities = samples as? [HKQuantitySample] else { return [] }
        return quantities.map { ($0.startDate, $0.quantity.doubleValue(for: unit)) }
    }

    /// Min / avg / max heart rate for each calendar day from continuous Watch samples.
    private func loadDailyHeartRanges(
        since start: Date?
    ) async throws -> [(date: Date, min: Double, average: Double, max: Double)] {
        let type = HKQuantityType(.heartRate)
        let unit = HKUnit.count().unitDivided(by: .minute())
        let calendar = Calendar.current
        // Anchor needs a concrete day even when the predicate has no floor.
        let queryStart = start ?? Date(timeIntervalSince1970: 0)
        let anchor = calendar.startOfDay(for: queryStart)
        let interval = DateComponents(day: 1)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: Date()),
                options: [.discreteMin, .discreteAverage, .discreteMax],
                anchorDate: anchor,
                intervalComponents: interval
            )
            query.initialResultsHandler = { _, collection, error in
                if error != nil {
                    continuation.resume(returning: [])
                    return
                }
                guard let collection else {
                    continuation.resume(returning: [])
                    return
                }

                var out: [(date: Date, min: Double, average: Double, max: Double)] = []
                collection.enumerateStatistics(from: queryStart, to: Date()) { stats, _ in
                    guard let minQ = stats.minimumQuantity(),
                          let avgQ = stats.averageQuantity(),
                          let maxQ = stats.maximumQuantity() else { return }
                    out.append(
                        (
                            stats.startDate,
                            minQ.doubleValue(for: unit),
                            avgQ.doubleValue(for: unit),
                            maxQ.doubleValue(for: unit)
                        )
                    )
                }
                continuation.resume(returning: out)
            }
            store.execute(query)
        }
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
