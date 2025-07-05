import '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  // You can specify your Database schema generics here instead of `any` if desired.
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface SupabaseClient<T = any, R = any, S = any> {}
}