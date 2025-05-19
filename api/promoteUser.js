

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Only use service role key on the server!
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Find the user by email
  const { data: users, error: fetchError } = await supabase.auth.admin.listUsers({ email });

  if (fetchError || !users || users.users.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users.users[0];

  // Promote to admin
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { role: 'admin' },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json({ success: true, user: data });
};