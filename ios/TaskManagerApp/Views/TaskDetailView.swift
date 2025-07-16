import SwiftUI
import SwiftData

struct TaskDetailView: View {
    @Bindable var task: Task

    var body: some View {
        Form {
            Section("Info") {
                TextField("Title", text: $task.title)
                TextField("Objective", text: Binding($task.objective, ""))
            }
            Section("Attributes") {
                Picker("Focus", selection: $task.focus) {
                    Text("Speed").tag("speed")
                    Text("Cost").tag("cost")
                    Text("Quality").tag("quality")
                }
                Toggle("Done", isOn: $task.isDone)
                DatePicker("Deadline", selection: Binding(get: { task.deadline ?? Date() }, set: { task.deadline = $0 }), displayedComponents: .date)
            }
        }
        .navigationTitle("Task Detail")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Clarify") { Task { await clarify() } }
            }
        }
        .alert("Clarify Failed", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }

    @State private var showError = false
    @State private var errorMessage = ""

    private func clarify() async {
        do {
            try await ClarifyService.shared.clarify(task: task)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}

#Preview {
    let container = PersistenceController.shared.container
    let task = Task(title: "Sample")
    container.mainContext.insert(task)
    return TaskDetailView(task: task)
        .modelContainer(container)
}