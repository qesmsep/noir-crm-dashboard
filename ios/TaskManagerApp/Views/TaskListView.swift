import SwiftUI
import SwiftData

struct TaskListView: View {
    @Query(sort: \Task.globalRank) private var tasks: [Task]

    var body: some View {
        List {
            ForEach(tasks) { task in
                NavigationLink(value: task) {
                    TaskRowView(task: task)
                }
            }
        }
        .navigationDestination(for: Task.self) { task in
            TaskDetailView(task: task)
        }
    }
}

struct TaskRowView: View {
    var task: Task

    var body: some View {
        HStack {
            Image(systemName: task.isDone ? "checkmark.circle.fill" : "circle")
                .foregroundColor(task.isDone ? .green : .gray)
            VStack(alignment: .leading) {
                Text(task.title).bold()
                if let deadline = task.deadline {
                    Text("Due " + DateFormatter.taskDeadline.string(from: deadline))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            Text("#\(task.globalRank)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}