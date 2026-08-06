import SwiftUI
import WebKit

/// Blue Hour's own pages, wrapped so the native side can trigger a refresh
/// after Health data lands — and so the web Sync button can ask for one.
struct WebView: UIViewRepresentable {
    let url: URL
    let reloadToken: Int
    let pathToken: Int
    let path: String
    var notice: SyncNotice?
    var onRequestSync: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(url: url, onRequestSync: onRequestSync)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "blueHour")
        config.userContentController.addUserScript(
            WKUserScript(
                source: "window.__BLUE_HOUR_NATIVE__ = true;",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        view.scrollView.contentInsetAdjustmentBehavior = .always
        view.isOpaque = false
        view.backgroundColor = UIColor(red: 0.949, green: 0.941, blue: 0.918, alpha: 1)
        context.coordinator.attach(view)
        context.coordinator.load(url)
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        context.coordinator.parentURL = url
        context.coordinator.onRequestSync = onRequestSync
        if let notice, context.coordinator.lastNoticeId != notice.id {
            context.coordinator.lastNoticeId = notice.id
            context.coordinator.notifySync(ok: notice.ok, message: notice.message)
        }
        if context.coordinator.loadedPathToken != pathToken {
            context.coordinator.loadedPathToken = pathToken
            if let page = Settings.pageURL(path: path) {
                context.coordinator.load(page)
            }
        }
        guard context.coordinator.loadedToken != reloadToken else { return }
        context.coordinator.loadedToken = reloadToken
        context.coordinator.reloadWhenIdle()
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "blueHour")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var loadedToken = 0
        var loadedPathToken = 0
        var lastNoticeId: UUID?
        var parentURL: URL
        var onRequestSync: () -> Void
        private weak var webView: WKWebView?
        private var isLoading = false
        private var pendingReload = false
        private var retries = 0

        init(url: URL, onRequestSync: @escaping () -> Void) {
            parentURL = url
            self.onRequestSync = onRequestSync
        }

        func attach(_ view: WKWebView) {
            webView = view
        }

        func load(_ url: URL) {
            let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 90)
            isLoading = true
            webView?.load(request)
        }

        func reloadWhenIdle() {
            guard let webView else { return }
            if isLoading {
                pendingReload = true
                return
            }
            webView.reload()
        }

        func notifySync(ok: Bool, message: String) {
            let payload = #"{"ok":\#(ok ? "true" : "false"),"message":\#(Self.jsonString(message))}"#
            webView?.evaluateJavaScript("window.__blueHourOnSync && window.__blueHourOnSync(\(payload))")
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "blueHour" else { return }
            let action: String
            if let body = message.body as? [String: Any], let value = body["action"] as? String {
                action = value
            } else if let value = message.body as? String {
                action = value
            } else {
                return
            }
            if action == "syncHealth" {
                onRequestSync()
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            isLoading = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoading = false
            retries = 0
            if pendingReload {
                pendingReload = false
                webView.reload()
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            handleFailure(webView, error: error)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handleFailure(webView, error: error)
        }

        private func handleFailure(_ webView: WKWebView, error: Error) {
            isLoading = false
            let urlError = error as? URLError
            let cancelled = urlError?.code == .cancelled || (error as NSError).code == NSURLErrorCancelled
            if cancelled { return }

            guard retries < 1 else { return }
            retries += 1
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                guard let self else { return }
                self.load(self.parentURL)
            }
        }

        private static func jsonString(_ value: String) -> String {
            let data = try? JSONSerialization.data(withJSONObject: value, options: .fragmentsAllowed)
            return String(data: data ?? Data("\"\"".utf8), encoding: .utf8) ?? "\"\""
        }
    }
}
