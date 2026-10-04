import Foundation
import WidgetKit

/// Where the phone sends Health data, and as whom. The URL and the signed-in
/// email are preferences; the device token is a credential, so it lives in the
/// keychain instead of UserDefaults.
///
/// The keychain account name is unchanged from when this held a shared
/// `HEALTH_INGEST_SECRET`, so a phone that was set up before accounts existed
/// keeps working until the runner signs in.
struct Settings {
    private static let urlKey = "bh.baseURL"
    private static let emailKey = "bh.accountEmail"

    static var baseURL: String {
        get { UserDefaults.standard.string(forKey: urlKey) ?? "" }
        set {
            UserDefaults.standard.set(newValue.trimmed, forKey: urlKey)
            SharedKeychain.write(SharedKeychain.baseURLAccount, newValue.trimmed)
        }
    }

    /// Shown on the Connect screen so it is obvious which account this phone syncs.
    static var accountEmail: String {
        get { UserDefaults.standard.string(forKey: emailKey) ?? "" }
        set { UserDefaults.standard.set(newValue.trimmed, forKey: emailKey) }
    }

    /// Issued by signing in. Sent as a Bearer on every request this app makes.
    static var deviceToken: String {
        get { SharedKeychain.read(SharedKeychain.tokenAccount) ?? "" }
        set {
            SharedKeychain.write(SharedKeychain.tokenAccount, newValue.trimmed)
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    static var isConfigured: Bool {
        !baseURL.isEmpty && !deviceToken.isEmpty && URL(string: baseURL) != nil
    }

    /// Phones signed in before the widget existed hold the token in an app-only
    /// keychain item. Rewrite both values into the shared group once.
    static func shareWithWidget() {
        let token = deviceToken
        if !token.isEmpty, SharedKeychain.read(SharedKeychain.tokenAccount, sharedOnly: true) == nil {
            deviceToken = token
        }
        let url = baseURL
        if !url.isEmpty, SharedKeychain.read(SharedKeychain.baseURLAccount, sharedOnly: true) != url {
            baseURL = url
        }
    }

    static func signOut() {
        deviceToken = ""
        accountEmail = ""
    }

    static func ingestURL() -> URL? {
        guard let base = URL(string: baseURL) else { return nil }
        return base.appendingPathComponent("api/health/ingest")
    }

    static func signInURL() -> URL? {
        guard let base = URL(string: baseURL) else { return nil }
        return base.appendingPathComponent("api/auth/signin")
    }

    static func signUpURL() -> URL? {
        guard let base = URL(string: baseURL) else { return nil }
        return base.appendingPathComponent("api/auth/signup")
    }

    static func appleSignInURL() -> URL? {
        guard let base = URL(string: baseURL) else { return nil }
        return base.appendingPathComponent("api/auth/apple")
    }

    static func webSessionURL() -> URL? {
        guard let base = URL(string: baseURL) else { return nil }
        return base.appendingPathComponent("api/auth/web-session")
    }

    static func waterLogURL() -> URL? {
        guard let base = URL(string: baseURL) else { return nil }
        return base.appendingPathComponent("api/water/log")
    }

    static func siriTodayURL() -> URL? {
        guard let base = URL(string: baseURL) else { return nil }
        return base.appendingPathComponent("api/siri/today")
    }

    /// `path` may carry a query (`/fuel?compose=1`), which `appendingPathComponent` would escape.
    static func pageURL(path: String) -> URL? {
        guard let base = URL(string: baseURL) else { return nil }
        if path == "/" || path.isEmpty { return base }
        let parts = path.split(separator: "?", maxSplits: 1).map(String.init)
        let route = parts[0].hasPrefix("/") ? String(parts[0].dropFirst()) : parts[0]
        let page = base.appendingPathComponent(route)
        guard parts.count == 2,
              var components = URLComponents(url: page, resolvingAgainstBaseURL: false) else { return page }
        components.percentEncodedQuery = parts[1]
        return components.url ?? page
    }
}

extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
