import Foundation
import Security

/// Keychain items the app and the home screen widget both read. Each target lists
/// the same `keychain-access-groups` entry, which works on free personal teams
/// (App Groups do not), so this is how the widget learns the trainer's address
/// and the account this phone signed in as.
enum SharedKeychain {
    static let service = "com.bluehour.trainer"
    static let tokenAccount = "bh.ingestSecret"
    static let baseURLAccount = "bh.baseURL"

    /// Info.plist carries `$(AppIdentifierPrefix)`, the team id plus a trailing dot.
    /// When a build is unsigned the prefix is blank and items stay app-private.
    static var accessGroup: String? {
        guard let prefix = Bundle.main.object(forInfoDictionaryKey: "AppIdentifierPrefix") as? String,
              prefix.count > 1, prefix.hasSuffix(".") else { return nil }
        return prefix + "com.bluehour.trainer.shared"
    }

    private static func query(_ account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    /// Searches every group this target can see, so an item saved before the
    /// shared group existed is still found.
    static func read(_ account: String, sharedOnly: Bool = false) -> String? {
        var lookup = query(account)
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        if sharedOnly {
            guard let accessGroup else { return nil }
            lookup[kSecAttrAccessGroup as String] = accessGroup
        }

        var item: CFTypeRef?
        guard SecItemCopyMatching(lookup as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func write(_ account: String, _ value: String) {
        SecItemDelete(query(account) as CFDictionary)
        guard !value.isEmpty, let data = value.data(using: .utf8) else { return }

        var item = query(account)
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        if let accessGroup {
            item[kSecAttrAccessGroup as String] = accessGroup
        }
        SecItemAdd(item as CFDictionary, nil)
    }
}
