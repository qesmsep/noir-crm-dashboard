// /api/createUser.js
const { createClient } = require('@supabase/supabase-js');

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // adapt to your env

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email, first_name, last_name, phone, role } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  // Create the user with invite (magic link)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: {
      first_name,
      last_name,
      phone,
      role: role || 'view'
    },
    // Send invitation email (magic link)
    redirectTo: process.env.NEXT_PUBLIC_BASE_URL,
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(200).json({ success: true, user: data.user });
};