import Foundation
import Security

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
    private static let secretAccount = "bh.ingestSecret"
    private static let service = "com.bluehour.trainer"

    static var baseURL: String {
        get { UserDefaults.standard.string(forKey: urlKey) ?? "" }
        set { UserDefaults.standard.set(newValue.trimmed, forKey: urlKey) }
    }

    /// Shown on the Connect screen so it is obvious which account this phone syncs.
    static var accountEmail: String {
        get { UserDefaults.standard.string(forKey: emailKey) ?? "" }
        set { UserDefaults.standard.set(newValue.trimmed, forKey: emailKey) }
    }

    /// Issued by signing in. Sent as a Bearer on every request this app makes.
    static var deviceToken: String {
        get { keychainRead() ?? "" }
        set { keychainWrite(newValue.trimmed) }
    }

    static var isConfigured: Bool {
        !baseURL.isEmpty && !deviceToken.isEmpty && URL(string: baseURL) != nil
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

    static func pageURL(path: String) -> URL? {
        guard let base = URL(string: baseURL) else { return nil }
        if path == "/" || path.isEmpty { return base }
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return base.appendingPathComponent(trimmed)
    }

    private static func keychainQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: secretAccount,
        ]
    }

    private static func keychainRead() -> String? {
        var query = keychainQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func keychainWrite(_ value: String) {
        SecItemDelete(keychainQuery() as CFDictionary)
        guard !value.isEmpty, let data = value.data(using: .utf8) else { return }

        var query = keychainQuery()
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(query as CFDictionary, nil)
    }
}

extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
