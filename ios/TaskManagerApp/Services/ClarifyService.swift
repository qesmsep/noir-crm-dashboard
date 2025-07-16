import Foundation

@MainActor
final class ClarifyService {
    static let shared = ClarifyService()
    private let supabase = SupabaseService.shared

    enum ClarifyError: Error {
        case unauthenticated
        case server(String)
    }

    private init() {}

    func clarify(task: Task) async throws {
        guard let token = supabase.session?.accessToken else { throw ClarifyError.unauthenticated }
        guard let baseURLString = ProcessInfo.processInfo.environment["BACKEND_URL"],
              let url = URL(string: baseURLString + "/api/clarify-task") else { throw ClarifyError.server("Invalid URL") }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = ["taskId": task.id.uuidString]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw ClarifyError.server("Invalid response") }
        guard 200..<300 ~= http.statusCode else {
            throw ClarifyError.server(String(data: data, encoding: .utf8) ?? "Unknown server error")
        }

        // After clarification, sync to receive new subtasks
        await SyncService.shared.sync()
    }
}