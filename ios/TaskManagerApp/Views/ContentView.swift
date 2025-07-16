import SwiftUI
import SwiftData

struct ContentView: View {
    @Query(sort: \Task.globalRank) private var tasks: [Task]
    
    @State private var showingAdd = false

    var body: some View {
        NavigationStack {
            TaskListView()
                .navigationTitle("Tasks")
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(action: { showingAdd = true }) {
                            Image(systemName: "plus")
                        }
                    }
                }
                .sheet(isPresented: $showingAdd) {
                    AddTaskView()
                }
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(PersistenceController.shared.container)
}