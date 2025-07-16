import Foundation
import SwiftData

@Model
final class Goal {
    @Attribute(.unique) var id: UUID
    var period: String      // "quarter" or "year"
    var label: String       // e.g., "Q1 2025"
    var createdAt: Date
    var updatedAt: Date
    
    // Relationship: tasks under this goal
    @Relationship(deleteRule: .cascade, inverse: \Task.goal)
    var tasks: [Task] = []

    init(id: UUID = UUID(), period: String, label: String, createdAt: Date = .now, updatedAt: Date = .now) {
        self.id = id
        self.period = period
        self.label = label
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}