import Foundation
import SwiftData

@MainActor
final class OrderRefreshService {
    static let shared = OrderRefreshService()

    private let container = PersistenceController.shared.container
    private let supabase = SupabaseService.shared

    private init() {}

    enum RefreshError: Error {
        case unauthenticated
        case invalidURL
        case server(String)
    }

    /// Calls the backend /api/optimize-tasks endpoint, updates local tasks' globalRank accordingly, then saves.
    func refresh() async throws {
        guard let token = supabase.session?.accessToken else { throw RefreshError.unauthenticated }
        guard let baseURLString = ProcessInfo.processInfo.environment["BACKEND_URL"],
              let url = URL(string: baseURLString + "/api/optimize-tasks") else { throw RefreshError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw RefreshError.server("Invalid response") }
        guard 200..<300 ~= http.statusCode else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown"
            throw RefreshError.server(msg)
        }
        let decoded = try JSONDecoder().decode(OrderResponse.self, from: data)
        await applyOrder(decoded.order)
    }

    private func applyOrder(_ order: [String]) async {
        let context = container.mainContext
        for (idx, idStr) in order.enumerated() {
            if let uuid = UUID(uuidString: idStr) {
                let descriptor = FetchDescriptor<Task>(predicate: #Predicate { $0.id == uuid })
                if let task = try? context.fetch(descriptor).first {
                    task.globalRank = idx
                }
            }
        }
        // Save context
        try? context.save()
    }

    private struct OrderResponse: Decodable {
        let order: [String]
    }
}