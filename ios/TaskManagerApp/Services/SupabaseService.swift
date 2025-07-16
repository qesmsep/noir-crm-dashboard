import Foundation
import Supabase
import Combine

@MainActor
final class SupabaseService: ObservableObject {
    static let shared = SupabaseService()

    private let client: SupabaseClient
    @Published private(set) var session: Session?

    private init() {
        let url = URL(string: ProcessInfo.processInfo.environment["SUPABASE_URL"] ?? "")!
        let anon = ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"] ?? ""
        self.client = SupabaseClient(supabaseURL: url, supabaseKey: anon)
        self.session = client.auth.session
    }

    // MARK: - Auth

    func signIn(email: String, password: String) async throws {
        let session = try await client.auth.signIn(email: email, password: password)
        self.session = session
    }

    func signUp(email: String, password: String) async throws {
        let session = try await client.auth.signUp(email: email, password: password)
        self.session = session
    }

    func signOut() async throws {
        try await client.auth.signOut()
        self.session = nil
    }

    var isAuthenticated: Bool { session != nil }

    // Expose client for database operations
    var db: PostgrestClient { client.database }
}