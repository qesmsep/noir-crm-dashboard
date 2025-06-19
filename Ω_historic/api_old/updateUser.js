// /api/updateUser.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id, first_name, last_name, email, phone, role } = req.body;

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(id, {
      email,
      user_metadata: {
        first_name,
        last_name,
        phone,
        role,
      },
    });

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, user: data.user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}