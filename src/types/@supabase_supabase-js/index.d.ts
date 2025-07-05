declare module "@supabase/supabase-js" {
  import { SupabaseClient } from "@supabase/supabase-js/dist/module/lib/SupabaseClient";
  export const createClient: (...args: any[]) => SupabaseClient;
  export type { SupabaseClient };
}