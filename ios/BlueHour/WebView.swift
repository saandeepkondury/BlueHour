import SwiftUI
import WebKit

/// Blue Hour's own pages, wrapped so the native side can trigger a refresh
/// after Health data lands.
struct WebView: UIViewRepresentable {
    let url: URL
    let reloadToken: Int

    func makeCoordinator() -> Coordinator {
        Coordinator(url: url)
    }

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView()
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        view.scrollView.contentInsetAdjustmentBehavior = .always
        view.isOpaque = false
        view.backgroundColor = UIColor(Palette.skyDeep)
        context.coordinator.attach(view)
        context.coordinator.load(url)
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        context.coordinator.parentURL = url
        guard context.coordinator.loadedToken != reloadToken else { return }
        context.coordinator.loadedToken = reloadToken
        context.coordinator.reloadWhenIdle()
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var loadedToken = 0
        var parentURL: URL
        private weak var webView: WKWebView?
        private var isLoading = false
        private var pendingReload = false
        private var retries = 0

        init(url: URL) {
            parentURL = url
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
    }
}
