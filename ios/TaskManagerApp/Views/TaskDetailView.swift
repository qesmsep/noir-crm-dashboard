import SwiftUI
import SwiftData

struct TaskDetailView: View {
    @Bindable var task: Task

    var body: some View {
        Form {
            Section("Info") {
                TextField("Title", text: $task.title)
                TextField("Objective", text: Binding($task.objective, replacingNilWith: ""))
            }
            Section("Attributes") {
                Picker("Focus", selection: $task.focus) {
                    Text("Speed").tag("speed")
                    Text("Cost").tag("cost")
                    Text("Quality").tag("quality")
                }
                Toggle("Done", isOn: $task.isDone)
                DatePicker("Deadline", selection: Binding($task.deadline, Date()), displayedComponents: .date)
            }
        }
        .navigationTitle("Task Detail")
    }
}

#Preview {
    let container = PersistenceController.shared.container
    let task = Task(title: "Sample")
    container.mainContext.insert(task)
    return TaskDetailView(task: task)
        .modelContainer(container)
}