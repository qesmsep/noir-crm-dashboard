/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please use: import { supabase } from '@/lib/supabase' instead
 *
 * This file is kept for backward compatibility only.
 */

// Log deprecation warning in development
if (process.env.NODE_ENV === 'development') {
  console.warn(
    '\x1b[33m%s\x1b[0m', // Yellow color in terminal
    'DEPRECATED: src/pages/api/supabaseClient.js is deprecated.\n' +
    'Please update your import to: import { supabase } from "@/lib/supabase"'
  );
}

// Re-export from the new location for backward compatibility
export { supabase as getSupabaseClient } from '../../lib/supabase';