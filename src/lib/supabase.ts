/**
 * Main Supabase client export
 * This re-exports from the singleton implementation to ensure only one instance
 */
export { supabase, supabaseAdmin, getSupabaseClient } from './supabase-singleton';