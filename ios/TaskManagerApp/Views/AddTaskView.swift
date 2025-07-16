import SwiftUI
import SwiftData

struct AddTaskView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    
    @State private var title: String = ""
    @State private var objective: String = ""

    var goal: Goal?
    var parent: Task?
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Title", text: $title)
                    TextField("Objective", text: $objective, axis: .vertical)
                }
            }
            .navigationTitle("New Task")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.disabled(title.isEmpty)
                }
            }
        }
    }

    private func save() {
        let task = Task(title: title, objective: objective, goal: goal, parent: parent)
        context.insert(task)
        dismiss()
    }
}

#Preview {
    AddTaskView()
        .modelContainer(PersistenceController.shared.container)
}