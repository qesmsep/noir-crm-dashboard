import SwiftUI
import SwiftData

struct ContentView: View {
    @Query(sort: \Task.globalRank) private var tasks: [Task]
    
    @State private var showingAdd = false
    @State private var optimizing = false

    var body: some View {
        NavigationStack {
            TaskListView()
                .navigationTitle("Tasks")
                .toolbar {
                    ToolbarItemGroup(placement: .navigationBarTrailing) {
                        Button(action: { Task { await runOptimize() } }) {
                            if optimizing {
                                ProgressView()
                            } else {
                                Image(systemName: "arrow.triangle.2.circlepath")
                            }
                        }
                        Button(action: { showingAdd = true }) {
                            Image(systemName: "plus")
                        }
                    }
                }
                .sheet(isPresented: $showingAdd) {
                    AddTaskView()
                }
        }
        .alert("Optimization Failed", isPresented: $showingError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }

    @State private var showingError = false
    @State private var errorMessage = ""

    private func runOptimize() async {
        optimizing = true
        do {
            try await OrderRefreshService.shared.refresh()
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
        optimizing = false
    }
}

#Preview {
    ContentView()
        .modelContainer(PersistenceController.shared.container)
}