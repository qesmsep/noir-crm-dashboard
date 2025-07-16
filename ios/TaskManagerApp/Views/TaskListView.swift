import SwiftUI
import SwiftData
import Combine

struct TaskListView: View {
    @Query(sort: \Task.globalRank) private var allTasks: [Task]

    var rootTasks: [Task] {
        allTasks.filter { $0.parent == nil }.sorted { $0.globalRank < $1.globalRank }
    }

    var body: some View {
        List {
            OutlineGroup(rootTasks, children: { task in
                task.children.sorted { $0.nestedRank < $1.nestedRank }
            }) { task in
                NavigationLink(value: task) {
                    TaskRowView(task: task)
                }
            }
        }
        .refreshable {
            await SyncService.shared.sync()
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