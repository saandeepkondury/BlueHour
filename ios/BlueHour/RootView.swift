import SwiftUI

enum SyncState: Equatable {
    case idle
    case syncing
    case done(String)
    case failed(String)
}

@MainActor
final class SyncModel: ObservableObject {
    @Published var state: SyncState = .idle
    @Published var showSettings = false
    @Published var reloadToken = 0

    private let bridge = HealthBridge()
    private let client = SyncClient()
    private var inFlight = false

    func syncIfPossible() async {
        guard Settings.isConfigured, !inFlight else { return }
        inFlight = true
        defer { inFlight = false }

        state = .syncing
        do {
            try await bridge.requestAccess()
            let payload = try await bridge.collect()
            let result = try await client.send(payload)
            state = .done(Self.summary(for: result))
            reloadToken += 1
        } catch {
            state = .failed(error.localizedDescription)
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
                        reloadToken: model.reloadToken
                    )
                }
                .ignoresSafeArea(.container, edges: .bottom)
            } else {
                SetupView { model.showSettings = false }
            }
        }
        .task { await model.syncIfPossible() }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await model.syncIfPossible() }
        }
        .sheet(isPresented: $model.showSettings) {
            SetupView { model.showSettings = false }
        }
    }
}

private struct StatusBar: View {
    @ObservedObject var model: SyncModel

    var body: some View {
        HStack(spacing: 10) {
            Text("Blue Hour")
                .font(.system(.footnote, design: .serif))
                .tracking(2)
                .textCase(.uppercase)
                .foregroundStyle(Palette.cream.opacity(0.9))

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
        .background(Palette.skyDeep)
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
            request.timeoutInterval = 15

            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if (200..<300).contains(status) {
                    onDone()
                } else {
                    message = SyncError.server(status: status, message: "").localizedDescription
                }
            } catch {
                message = error.localizedDescription
            }
        }
    }
}

enum Palette {
    static let skyDeep = Color(red: 0.133, green: 0.110, blue: 0.267)
    static let cream = Color(red: 0.976, green: 0.945, blue: 0.867)
    static let warn = Color(red: 0.957, green: 0.812, blue: 0.616)
}
