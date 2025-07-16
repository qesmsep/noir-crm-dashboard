import SwiftUI
import SwiftData

struct AddTaskView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    
    @State private var title: String = ""
    @State private var objective: String = ""
    @State private var isParent: Bool = false
    @State private var focus: String = "speed"
    @State private var deadline: Date? = nil

    var goal: Goal?
    var parent: Task?
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Title", text: $title)
                    TextField("Objective", text: $objective, axis: .vertical)
                    DatePicker("Deadline", selection: Binding(get: { deadline ?? Date() }, set: { deadline = $0 }), displayedComponents: .date)
                }
                Section("Hierarchy") {
                    Toggle("This task will contain subtasks", isOn: $isParent)
                    if isParent {
                        Picker("Primary focus", selection: $focus) {
                            Text("Speed").tag("speed")
                            Text("Cost").tag("cost")
                            Text("Quality").tag("quality")
                        }
                    }
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
        let task = Task(title: title, objective: objective.isEmpty ? nil : objective, focus: focus, deadline: deadline, goal: goal, parent: parent)
        context.insert(task)
        dismiss()
    }
}

#Preview {
    AddTaskView()
        .modelContainer(PersistenceController.shared.container)
}