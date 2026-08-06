import SwiftUI

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

    private let bridge = HealthBridge()
    private let client = SyncClient()
    private var inFlight = false

    func syncIfPossible() async {
        await sync(reload: true, notifyWeb: false)
        await NotificationScheduler.refresh()
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
            try await bridge.requestAccess()
            let payload = try await bridge.collect()
            let result = try await client.send(payload)
            let message = Self.summary(for: result)
            state = .done(message)
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

    private static func summary(for result: IngestResponse) -> String {
        if result.workoutsWritten > 0 {
            let runs = result.workoutsWritten == 1 ? "1 run" : "\(result.workoutsWritten) runs"
            return "Synced \(runs) and \(result.daysWritten) days"
        }
        if result.daysWritten > 0 {
            return "Synced \(result.daysWritten) days"
        }
        return "Nothing new in Health"
    }
}

struct RootView: View {
    @StateObject private var model = SyncModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if Settings.isConfigured {
                VStack(spacing: 0) {
                    StatusBar(model: model)
                    WebView(
                        url: URL(string: Settings.baseURL)!,
                        reloadToken: model.reloadToken,
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
        .task { await model.syncIfPossible() }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await model.syncIfPossible() }
        }
        .onOpenURL { url in
            guard url.scheme == "bluehour" else { return }
            if url.host == "test-water" {
                Task { await NotificationScheduler.sendTest() }
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
    @State private var secret = Settings.ingestSecret
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
                    SecureField("Sync key", text: $secret)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Sync key")
                } footer: {
                    Text("Must match HEALTH_INGEST_SECRET in the app's environment.")
                }

                if let message {
                    Section { Text(message).font(.footnote) }
                }

                Section {
                    Button(checking ? "Checking…" : "Save and connect") { save() }
                        .disabled(checking || baseURL.trimmed.isEmpty || secret.trimmed.isEmpty)
                }

                if Settings.isConfigured {
                    Section {
                        Button("Send a test notification") {
                            Task { await NotificationScheduler.sendTest() }
                        }
                    } header: {
                        Text("Notifications")
                    } footer: {
                        Text("Morning briefs and water reminders (every 2 hours, 8am–10pm Austin) are scheduled on this phone. Water banners include a + Cup button that logs without opening the app. Open once a day so copy stays current. Pause them in the website Settings if you want silence.")
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

    /// Confirms the URL and key before asking for Health permission, so a typo
    /// shows up as a clear message instead of an empty sync.
    private func save() {
        Settings.baseURL = baseURL
        Settings.ingestSecret = secret
        checking = true
        message = nil

        Task {
            defer { checking = false }
            guard let url = Settings.ingestURL() else {
                message = "That does not look like a valid address."
                return
            }

            var request = URLRequest(url: url)
            request.setValue("Bearer \(Settings.ingestSecret)", forHTTPHeaderField: "Authorization")
            request.timeoutInterval = 45

            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if (200..<300).contains(status) {
                    onDone()
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

