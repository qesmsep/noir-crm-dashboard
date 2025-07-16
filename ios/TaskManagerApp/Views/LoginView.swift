import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var supabase: SupabaseService
    
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Credentials") {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.username)
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                }
                if let error = error {
                    Section {
                        Text(error).foregroundColor(.red)
                    }
                }
                Section {
                    Button {
                        Task { await signIn() }
                    } label: {
                        if isLoading {
                            ProgressView()
                        } else {
                            Text("Sign In")
                        }
                    }
                    .disabled(email.isEmpty || password.isEmpty || isLoading)
                }
            }
            .navigationTitle("Login")
        }
    }

    private func signIn() async {
        isLoading = true
        do {
            try await supabase.signIn(email: email, password: password)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

#Preview {
    LoginView()
        .environmentObject(SupabaseService.shared)
}