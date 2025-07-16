# TaskManager iOS App

This directory contains the SwiftUI front-end for the real-time task manager.

## Requirements
* Xcode 15 or later
* iOS 17 SDK (SwiftData)

## Getting Started
1. Open `TaskManagerApp.xcodeproj` or create a new Xcode project and point the source folder to `ios/TaskManagerApp`.
2. Ensure the bundle identifier is unique and that "Enable SwiftData" is ticked.
3. Add Swift Package dependency for Supabase (https://github.com/supabase/supabase-swift) if you plan to sync right away.
4. Configure environment variables / Secrets in Xcode scheme:
   * `SUPABASE_URL`
   * `SUPABASE_ANON_KEY`
   * `BACKEND_URL` (for the /api/optimize-tasks endpoint)

## TODO
* Build SyncService to push/pull tasks between local store and Supabase.
* Implement AddTaskFlow and TaskDetailView.
* Hook up "Order Refresh" button to call the optimize endpoint.