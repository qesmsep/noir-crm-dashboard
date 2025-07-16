import SwiftUI

extension Binding where Value: ExpressibleByNilLiteral {
    /// Returns a non-optional binding replacing nil with the provided fallback.
    init(_ source: Binding<Value?>, _ fallback: Value) {
        self.init(get: { source.wrappedValue ?? fallback }, set: { source.wrappedValue = $0 })
    }
}

extension Binding where Value == Date? {
    init(_ source: Binding<Date?>, _ fallback: Date) {
        self.init(get: { source.wrappedValue ?? fallback }, set: { source.wrappedValue = $0 })
    }
}