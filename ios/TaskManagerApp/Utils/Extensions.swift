import Foundation

extension DateFormatter {
    static let taskDeadline: DateFormatter = {
        let df = DateFormatter()
        df.dateStyle = .medium
        return df
    }()
}