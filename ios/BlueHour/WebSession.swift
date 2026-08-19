import Foundation
import WebKit

/// Signs the embedded web view in as the same account the app authenticated as.
///
/// The native side holds a device token in the keychain; WKWebView keeps its own
/// cookie store and knows nothing about it. This trades the device token for a
/// session cookie and installs it, so the runner signs in once on the phone
/// rather than once natively and again inside the pages.
enum WebSession {
    private struct Response: Decodable {
        let cookieName: String
        let token: String
        let expiresAt: String
    }

    static func install(into store: WKHTTPCookieStore) async {
        guard Settings.isConfigured,
              let url = Settings.webSessionURL(),
              let host = URL(string: Settings.baseURL)?.host else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(Settings.deviceToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 30

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (200..<300).contains((response as? HTTPURLResponse)?.statusCode ?? 0),
                  let session = try? JSONDecoder().decode(Response.self, from: data) else { return }

            var properties: [HTTPCookiePropertyKey: Any] = [
                .name: session.cookieName,
                .value: session.token,
                .domain: host,
                .path: "/",
            ]
            if let expires = ISO8601DateFormatter().date(from: session.expiresAt) {
                properties[.expires] = expires
            }
            // Only mark the cookie secure for https, or it is dropped when
            // developing against http://<mac-ip>:3000.
            if Settings.baseURL.hasPrefix("https") {
                properties[.secure] = "TRUE"
            }

            guard let cookie = HTTPCookie(properties: properties) else { return }
            await store.setCookie(cookie)
        } catch {
            // A failed handoff just means the web view shows its own sign-in.
        }
    }
}
