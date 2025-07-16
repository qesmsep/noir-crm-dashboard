import Foundation
import SwiftData

struct PersistenceController {
    static let shared = PersistenceController()
    let container: ModelContainer

    init(inMemory: Bool = false) {
        let config = inMemory ? ModelConfiguration(isStoredInMemoryOnly: true) : ModelConfiguration()
        self.container = try! ModelContainer(for: Schema([Goal.self, Task.self, TaskNote.self]), configurations: config)
    }
}