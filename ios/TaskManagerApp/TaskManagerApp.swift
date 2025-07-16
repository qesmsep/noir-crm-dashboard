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

    @StateObject private var supabaseService = SupabaseService.shared

    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            Group {
                if supabaseService.isAuthenticated {
                    ContentView()
                        .task {
                            await SyncService.shared.sync()
                        }
                } else {
                    LoginView()
                }
            }
            .modelContainer(container)
            .environmentObject(supabaseService)
            .onChange(of: scenePhase) { phase in
                if phase == .active {
                    Task { await SyncService.shared.sync() }
                }
            }
        }
    }
}