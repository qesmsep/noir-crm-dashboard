// /api/listUsers.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req, res) {
  // Auth: optionally check that the user making this request is an admin (by JWT, cookie, etc)
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ users: data.users });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}