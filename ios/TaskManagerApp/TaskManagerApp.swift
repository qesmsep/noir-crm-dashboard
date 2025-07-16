import SwiftUI
import SwiftData

@main
struct TaskManagerApp: App {
    // Create the ModelContainer at launch (in-memory fallback if migration fails)
    let container: ModelContainer = {
        let config = ModelConfiguration(schema: Schema([
            Goal.self,
            Task.self,
            TaskNote.self
        ]))
        do {
            return try ModelContainer(for: config)
        } catch {
            // Fallback to an in-memory store if persistent store fails
            let inMemory = ModelConfiguration(isStoredInMemoryOnly: true)
            return try! ModelContainer(for: inMemory)
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .modelContainer(container)
        }
    }
}