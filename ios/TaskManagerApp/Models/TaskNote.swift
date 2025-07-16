import Foundation
import SwiftData

@Model
final class TaskNote {
    @Attribute(.unique) var id: UUID
    var body: String
    var createdAt: Date

    // Relationship
    @Relationship(inverse: \Task.notes) var task: Task?

    init(id: UUID = UUID(), body: String, createdAt: Date = .now, task: Task? = nil) {
        self.id = id
        self.body = body
        self.createdAt = createdAt
        self.task = task
    }
}