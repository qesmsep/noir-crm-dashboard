import '@supabase/supabase-js';

// Augment the Supabase client to allow project-specific generics without losing the official typings.
declare module '@supabase/supabase-js' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface SupabaseClient<Database = any, SchemaName extends string = any, Schema = any> {}
}