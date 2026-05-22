import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Use a Symbol as a key to ensure true privacy
const SUPABASE_KEY = Symbol.for('app.supabase.client');
const SUPABASE_ADMIN_KEY = Symbol.for('app.supabase.admin');

// Store on globalThis to survive HMR and React Strict Mode
const globalAny = globalThis as any;

// Initialize client only once - check if it already exists
if (!globalAny[SUPABASE_KEY]) {
  globalAny[SUPABASE_KEY] = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storageKey: 'sb-hkgomdqmzideiwudkbrz-auth-token',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      detectSessionInUrl: true,
      flowType: 'pkce',
      autoRefreshToken: true,
      debug: false,
    },
  });
}

// Initialize admin client only once
if (!globalAny[SUPABASE_ADMIN_KEY] && supabaseServiceKey) {
  globalAny[SUPABASE_ADMIN_KEY] = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Export the singleton instances
export const supabase: SupabaseClient = globalAny[SUPABASE_KEY];
export const supabaseAdmin: SupabaseClient = globalAny[SUPABASE_ADMIN_KEY] || supabase;

// For backward compatibility
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}