import Foundation
import SwiftData
import Supabase

@MainActor
final class SyncService: ObservableObject {
    static let shared = SyncService()

    private let supabase = SupabaseService.shared
    private let container = PersistenceController.shared.container
    private var lastSyncKey = "LastSyncTimestamp"

    private init() {}

    // MARK: - Public

    func sync() async {
        await pushLocalChanges()
        await pullRemoteChanges()
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: lastSyncKey)
    }

    // MARK: - Push
    private func pushLocalChanges() async {
        let lastSync = Date(timeIntervalSince1970: UserDefaults.standard.double(forKey: lastSyncKey))
        let context = container.mainContext
        let descriptor = FetchDescriptor<Task>(predicate: #Predicate { $0.updatedAt > lastSync })
        let dirtyTasks = try? context.fetch(descriptor)

        guard let tasks = dirtyTasks, !tasks.isEmpty else { return }
        for task in tasks {
            await upsert(task: task)
        }
    }

    private func upsert(task: Task) async {
        var json: [String: Any] = [
            "id": task.id.uuidString,
            "title": task.title,
            "objective": task.objective ?? NSNull(),
            "focus": task.focus,
            "nested_rank": task.nestedRank,
            "global_rank": task.globalRank,
            "deadline": task.deadline?.iso8601String ?? NSNull(),
            "is_done": task.isDone,
            "updated_at": task.updatedAt.iso8601String,
            "created_at": task.createdAt.iso8601String
        ]
        if let goal = task.goal {
            json["goal_id"] = goal.id.uuidString
        }
        if let parent = task.parent {
            json["parent_id"] = parent.id.uuidString
        }

        do {
            _ = try await supabase.db
                .from("tasks")
                .upsert(json, returning: .minimal)
                .execute()
        } catch {
            print("Failed to upsert task: \(error)")
        }
    }

    // MARK: - Pull

    private func pullRemoteChanges() async {
        guard let userId = supabase.session?.user.id else { return }
        let lastSync = Date(timeIntervalSince1970: UserDefaults.standard.double(forKey: lastSyncKey))
        do {
            let json = try await supabase.db
                .from("tasks")
                .select()
                .eq("user_id", userId)
                .gte("updated_at", lastSync.iso8601String)
                .execute()
            if let rows = json.value as? [[String: Any]] {
                await updateLocalTasks(rows)
            }
        } catch {
            print("Failed to pull tasks: \(error)")
        }
    }

    private func updateLocalTasks(_ rows: [[String: Any]]) async {
        let context = container.mainContext
        for row in rows {
            guard let idString = row["id"] as? String, let uuid = UUID(uuidString: idString) else { continue }
            let descriptor = FetchDescriptor<Task>(predicate: #Predicate { $0.id == uuid })
            let existing = try? context.fetch(descriptor).first
            let task = existing ?? Task(title: row["title"] as? String ?? "")
            task.id = uuid
            task.title = row["title"] as? String ?? ""
            task.objective = row["objective"] as? String
            task.focus = row["focus"] as? String ?? "speed"
            task.nestedRank = row["nested_rank"] as? Int ?? 0
            task.globalRank = row["global_rank"] as? Int ?? 0
            task.isDone = row["is_done"] as? Bool ?? false
            if let deadlineString = row["deadline"] as? String, let date = ISO8601DateFormatter().date(from: deadlineString) {
                task.deadline = date
            }
            if let updatedString = row["updated_at"] as? String, let date = ISO8601DateFormatter().date(from: updatedString) {
                task.updatedAt = date
            }
            if existing == nil {
                context.insert(task)
            }
        }
    }
}

private extension Date {
    var iso8601String: String {
        ISO8601DateFormatter().string(from: self)
    }
}