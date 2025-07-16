import SwiftUI
import SwiftData

struct GoalProgressView: View {
    @Query private var goals: [Goal]

    init() {
        _goals = Query(sort: \Goal.createdAt)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(goals) { goal in
                let total = goal.tasks.count
                let done = goal.tasks.filter { $0.isDone }.count
                if total > 0 {
                    VStack(alignment: .leading) {
                        Text(goal.label).font(.caption).bold()
                        ProgressView(value: Double(done), total: Double(total))
                    }
                }
            }
        }
        .padding(.horizontal)
    }
}

#Preview {
    GoalProgressView()
        .modelContainer(PersistenceController.shared.container)
}