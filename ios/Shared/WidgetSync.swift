import Foundation
import WidgetKit

/// One chime for "the Today card changed." The widget refetches, and if the
/// app is awake it refreshes the Habits page so both show the same snapshot.
enum WidgetSync {
    static let darwinName = "com.bluehour.trainer.widget-changed" as CFString
    static let changed = Notification.Name("blueHourWidgetChanged")

    static func broadcast() {
        WidgetCenter.shared.reloadAllTimelines()
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(darwinName),
            nil,
            nil,
            true
        )
    }

    /// App process only. The widget extension posts; it does not listen.
    static func listenInApp() {
        _ = DarwinHook.shared
    }
}

private final class DarwinHook {
    static let shared = DarwinHook()

    private init() {
        let pointer = Unmanaged.passUnretained(self).toOpaque()
        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            pointer,
            { _, _, _, _, _ in
                DispatchQueue.main.async {
                    NotificationCenter.default.post(name: WidgetSync.changed, object: nil)
                }
            },
            WidgetSync.darwinName,
            nil,
            .deliverImmediately
        )
    }
}
