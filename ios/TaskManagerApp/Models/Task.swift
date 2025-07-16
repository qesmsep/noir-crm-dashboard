import Foundation
import SwiftData

@Model
final class Task {
    @Attribute(.unique) var id: UUID
    var title: String
    var objective: String?
    var focus: String = "speed"   // "speed" | "cost" | "quality"
    var nestedRank: Int = 0       // order within siblings
    var globalRank: Int = 0       // overall priority rank
    var deadline: Date?
    var isDone: Bool = false
    var createdAt: Date
    var updatedAt: Date

    // Relationships
    @Relationship(inverse: \Goal.tasks) var goal: Goal?
    @Relationship(deleteRule: .nullify, inverse: \Task.children) var parent: Task?
    @Relationship(deleteRule: .cascade, inverse: \Task.parent) var children: [Task] = []
    @Relationship(deleteRule: .cascade, inverse: \TaskNote.task) var notes: [TaskNote] = []

    init(id: UUID = UUID(), title: String, objective: String? = nil, focus: String = "speed", nestedRank: Int = 0, globalRank: Int = 0, deadline: Date? = nil, isDone: Bool = false, createdAt: Date = .now, updatedAt: Date = .now, goal: Goal? = nil, parent: Task? = nil) {
        self.id = id
        self.title = title
        self.objective = objective
        self.focus = focus
        self.nestedRank = nestedRank
        self.globalRank = globalRank
        self.deadline = deadline
        self.isDone = isDone
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.goal = goal
        self.parent = parent
    }
}