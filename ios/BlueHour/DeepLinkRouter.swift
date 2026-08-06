import Foundation

/// Paths the native shell can open in the WebView from Siri or `bluehour://` URLs.
enum AppDestination: String, CaseIterable {
    case today
    case water
    case coach
    case fuel
    case plan
    case progress
    case sync

    var webPath: String? {
        switch self {
        case .today: return "/"
        case .water: return "/water"
        case .coach: return "/coach"
        case .fuel: return "/fuel"
        case .plan: return "/plan"
        case .progress: return "/progress"
        case .sync: return nil
        }
    }

    static func from(url: URL) -> AppDestination? {
        guard url.scheme == "bluehour" else { return nil }
        let host = (url.host ?? "").lowercased()
        if host.isEmpty || host == "open" {
            let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")).lowercased()
            if path.isEmpty { return .today }
            return AppDestination(rawValue: path)
        }
        return AppDestination(rawValue: host)
    }
}

/// Bridges Siri intents and `onOpenURL` into the SwiftUI root without coupling App Intents to views.
@MainActor
final class DeepLinkRouter: ObservableObject {
    static let shared = DeepLinkRouter()

    @Published private(set) var webPath = "/"
    @Published private(set) var pathToken = 0
    @Published private(set) var syncToken = 0

    func open(_ destination: AppDestination) {
        if destination == .sync {
            syncToken += 1
            return
        }
        guard let path = destination.webPath else { return }
        webPath = path
        pathToken += 1
    }

    func handle(url: URL) -> Bool {
        guard let destination = AppDestination.from(url: url) else { return false }
        if url.host == "test-water" {
            return false
        }
        open(destination)
        return true
    }
}
