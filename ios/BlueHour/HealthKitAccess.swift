import HealthKit

/// One read-set for the Health sheet, observers, and collect — so Connect asks
/// for every type Blue Hour actually uses, and a later feature does not require
/// a trip into Health → Sharing.
enum HealthKitAccess {
    /// Shown on the system Health permission sheet. Characteristic types (sex,
    /// date of birth) appear there too; they cannot be observed in the background.
    static var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = Set(observedTypes.map { $0 as HKObjectType })
        types.insert(HKQuantityType(.height))
        types.insert(HKQuantityType(.distanceWalkingRunning))
        if let sex = HKObjectType.characteristicType(forIdentifier: .biologicalSex) {
            types.insert(sex)
        }
        if let birth = HKObjectType.characteristicType(forIdentifier: .dateOfBirth) {
            types.insert(birth)
        }
        return types
    }

    /// Types HealthKit can wake us for. Keep this in lockstep with `readTypes`
    /// minus characteristics and workout-statistic helpers.
    static var observedTypes: [HKSampleType] {
        [
            HKObjectType.workoutType(),
            HKCategoryType(.sleepAnalysis),
            HKQuantityType(.heartRate),
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.walkingHeartRateAverage),
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.stepCount),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.bodyMass),
            HKQuantityType(.bodyFatPercentage),
            HKQuantityType(.waistCircumference),
        ]
    }
}
