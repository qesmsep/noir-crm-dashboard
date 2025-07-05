declare module '@supabase/supabase-js' {
  import { SupabaseClient } from '@supabase/supabase-js'
  export { SupabaseClient }
  export function createClient<T = any, R = any, S = any>(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): SupabaseClient<T, R, S>
}