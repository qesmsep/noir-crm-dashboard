// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TaskManagerApp",
    platforms: [
        .iOS("17.0")
    ],
    products: [
        .library(name: "TaskManagerApp", targets: ["TaskManagerApp"])
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift", from: "1.0.0"),
    ],
    targets: [
        .target(
            name: "TaskManagerApp",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift")
            ],
            path: "TaskManagerApp"
        )
    ]
)