import SwiftUI
import UIKit

enum SyncState: Equatable {
    case idle
    case syncing
    case done(String)
    case failed(String)
}

struct SyncNotice: Equatable {
    let id = UUID()
    let ok: Bool
    let message: String
}

@MainActor
final class SyncModel: ObservableObject {
    @Published var state: SyncState = .idle
    @Published var showSettings = false
    @Published var reloadToken = 0
    @Published var notice: SyncNotice?

    private var inFlight = false

    func syncIfPossible() async {
        let outcome = await sync(reload: true, notifyWeb: false)
        // Runner refreshes briefs on a successful ingest; still try when sync failed.
        if !outcome.ok {
            await NotificationScheduler.refresh()
        }
    }

    func syncFromWeb() async {
        while inFlight {
            try? await Task.sleep(for: .milliseconds(150))
        }
        let result = await sync(reload: false, notifyWeb: true)
        if result.ok {
            try? await Task.sleep(for: .milliseconds(450))
            reloadToken += 1
        }
    }

    @discardableResult
    private func sync(reload: Bool, notifyWeb: Bool) async -> (ok: Bool, message: String) {
        guard Settings.isConfigured else {
            let message = SyncError.notConfigured.localizedDescription
            if notifyWeb { notice = SyncNotice(ok: false, message: message) }
            return (false, message)
        }
        guard !inFlight else { return (false, "Already syncing") }
        inFlight = true
        defer { inFlight = false }

        state = .syncing
        do {
            let result = try await HealthSyncRunner.sync()
            let message = HealthSyncRunner.summary(for: result)
            state = .done(message)
            BackgroundHealthSync.shared.startIfConfigured()
            if notifyWeb { notice = SyncNotice(ok: true, message: message) }
            if reload { reloadToken += 1 }
            return (true, message)
        } catch {
            let message = error.localizedDescription
            state = .failed(message)
            if notifyWeb { notice = SyncNotice(ok: false, message: message) }
            return (false, message)
        }
    }
}

struct RootView: View {
    @StateObject private var model = SyncModel()
    @ObservedObject private var deepLinks = DeepLinkRouter.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if Settings.isConfigured {
                VStack(spacing: 0) {
                    StatusBar(model: model)
                    WebView(
                        url: URL(string: Settings.baseURL)!,
                        reloadToken: model.reloadToken,
                        pathToken: deepLinks.pathToken,
                        path: deepLinks.webPath,
                        notice: model.notice,
                        onRequestSync: {
                            Task { await model.syncFromWeb() }
                        }
                    )
                }
                .ignoresSafeArea(.container, edges: .bottom)
            } else {
                SetupView {
                    Task { await model.syncIfPossible() }
                }
            }
        }
        .task {
            BlueHourShortcuts.updateAppShortcutParameters()
            await model.syncIfPossible()
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            BlueHourShortcuts.updateAppShortcutParameters()
            Task { await model.syncIfPossible() }
        }
        .onChange(of: deepLinks.syncToken) { _, _ in
            Task { await model.syncIfPossible() }
        }
        .onOpenURL { url in
            guard url.scheme == "bluehour" else { return }
            if url.host == "test-water" {
                Task { await NotificationScheduler.sendTest() }
                return
            }
            if DeepLinkRouter.shared.handle(url: url) {
                return
            }
            Task { await model.syncIfPossible() }
        }
        .sheet(isPresented: $model.showSettings) {
            SetupView {
                model.showSettings = false
                Task { await model.syncIfPossible() }
            }
        }
    }
}

private struct StatusBar: View {
    @ObservedObject var model: SyncModel

    var body: some View {
        HStack(spacing: 10) {
            BrandMark(size: 22, tone: .glyph)

            Text("Blue Hour")
                .font(.system(.footnote, design: .serif).italic())
                .tracking(0.4)
                .foregroundStyle(Palette.cream.opacity(0.95))

            Spacer()

            switch model.state {
            case .idle:
                EmptyView()
            case .syncing:
                ProgressView()
                    .controlSize(.small)
                    .tint(Palette.cream)
            case let .done(message):
                Text(message)
                    .font(.caption2)
                    .foregroundStyle(Palette.cream.opacity(0.75))
            case let .failed(message):
                Text(message)
                    .font(.caption2)
                    .lineLimit(1)
                    .foregroundStyle(Palette.warn)
            }

            Button {
                Task { await model.syncIfPossible() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .tint(Palette.cream.opacity(0.85))

            Button {
                model.showSettings = true
            } label: {
                Image(systemName: "gearshape")
            }
            .tint(Palette.cream.opacity(0.85))
        }
        .font(.footnote)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Palette.skyDeep.gradient)
    }
}

private struct SetupView: View {
    var onDone: () -> Void

    @State private var baseURL = Settings.baseURL
    @State private var email = Settings.accountEmail
    @State private var password = ""
    @State private var creatingAccount = false
    @State private var checking = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 12) {
                        BrandMark(size: 72)
                        Text("Blue Hour")
                            .font(.system(.title2, design: .serif))
                        Text("Connect this phone to the trainer.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .listRowBackground(Color.clear)
                }

                Section {
                    TextField("https://blue-hour.vercel.app", text: $baseURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                } header: {
                    Text("Blue Hour address")
                } footer: {
                    Text("The deployed site, or http://<your-mac-ip>:3000 while developing.")
                }

                Section {
                    TextField("you@example.com", text: $email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                    SecureField("Password", text: $password)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Toggle("Create a new account", isOn: $creatingAccount)
                } header: {
                    Text("Your account")
                } footer: {
                    Text("Your plan, Watch data, and meals belong to this account. Nobody else on Blue Hour can see them.")
                }

                if let message {
                    Section { Text(message).font(.footnote) }
                }

                Section {
                    Button(buttonTitle) { save() }
                        .disabled(checking || baseURL.trimmed.isEmpty || email.trimmed.isEmpty || password.isEmpty)
                }

                if Settings.isConfigured, !Settings.accountEmail.isEmpty {
                    Section {
                        Text("Signed in as \(Settings.accountEmail)").font(.footnote)
                        Button("Sign out on this phone", role: .destructive) {
                            Settings.signOut()
                            password = ""
                            message = "Signed out. Sign in again to resume syncing."
                        }
                    }
                }

                if Settings.isConfigured {
                    Section {
                        Button("Send a test notification") {
                            Task { await NotificationScheduler.sendTest() }
                        }
                    } header: {
                        Text("Notifications")
                    } footer: {
                        Text("Morning briefs and water reminders (one per cup, 9am–8pm Austin) are scheduled on this phone. Water banners include a + Cup button that logs without opening the app. Siri can also log water, read today's plan, sync Health, or open a screen — try “Hey Siri, log a cup in Blue Hour.” Open once a day so copy stays current. Pause reminders in the website Settings if you want silence.")
                    }
                }
            }
            .navigationTitle("Connect")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if Settings.isConfigured {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close", action: onDone)
                    }
                }
            }
        }
    }

    private var buttonTitle: String {
        if checking { return "Signing in…" }
        return creatingAccount ? "Create account and connect" : "Sign in and connect"
    }

    private struct AuthResponse: Decodable {
        let token: String
        let email: String
    }

    private struct AuthError: Decodable {
        let error: String
    }

    /// Signs in against the server and keeps the device token it returns, so the
    /// runner never has to paste a shared secret. A bad password shows up here as
    /// a clear message instead of an empty sync later.
    private func save() {
        Settings.baseURL = baseURL
        checking = true
        message = nil

        Task {
            defer { checking = false }
            guard let url = creatingAccount ? Settings.signUpURL() : Settings.signInURL() else {
                message = "That does not look like a valid address."
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 45
            request.httpBody = try? JSONSerialization.data(withJSONObject: [
                "email": email.trimmed,
                "password": password,
                "label": UIDevice.current.name,
            ])

            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0

                if (200..<300).contains(status),
                   let auth = try? JSONDecoder().decode(AuthResponse.self, from: data) {
                    Settings.deviceToken = auth.token
                    Settings.accountEmail = auth.email
                    password = ""
                    onDone()
                    return
                }

                if let failure = try? JSONDecoder().decode(AuthError.self, from: data) {
                    message = failure.error
                } else {
                    message = SyncError.server(status: status, message: "").localizedDescription
                }
            } catch let error as URLError where error.code == .timedOut {
                message = SyncError.timeout.localizedDescription
            } catch let error as URLError {
                message = SyncError.unreachable.localizedDescription + " (\(error.localizedDescription))"
            } catch {
                message = error.localizedDescription
            }
        }
    }
}

