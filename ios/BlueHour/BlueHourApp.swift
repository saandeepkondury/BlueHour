import SwiftUI
import UserNotifications
import AppIntents

@main
struct BlueHourApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        // Re-index App Shortcuts after every install/rebuild so they show up
        // again in the Shortcuts app (debug reinstalls wipe the previous index).
        BlueHourShortcuts.updateAppShortcutParameters()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        NotificationScheduler.registerCategories()
        UNUserNotificationCenter.current().delegate = self
        BlueHourShortcuts.updateAppShortcutParameters()
        return true
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        await NotificationScheduler.handleResponse(response)
    }
}
