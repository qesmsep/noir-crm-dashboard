import { createClient } from '@supabase/supabase-js';

// Singleton instance
let supabaseInstance = null;

export function getSupabaseClient() {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Create new instance only if it doesn't exist
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey);
  return supabaseInstance;
} 