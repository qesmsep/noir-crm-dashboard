// pages/api/deleteAuthUser.js

// This endpoint expects: { user_id: "SUPABASE_USER_UUID" } in POST body

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, requester_token } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  // Secure check: Ensure the requester is an admin
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const service_role_key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, anonKey);

  let isAdmin = false;
  try {
    // Option 1: Use token from the client, if provided
    let user = null;
    if (requester_token) {
      const { data, error } = await supabase.auth.getUser(requester_token);
      if (error || !data?.user) throw new Error('Requester not authenticated');
      user = data.user;
    } else {
      // Option 2: Look for a session cookie if using server-side auth
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check role in app_metadata or user_metadata
    const role =
      user?.app_metadata?.role ||
      user?.user_metadata?.role ||
      (user?.role === 'admin' ? 'admin' : undefined);

    if (role === 'admin') isAdmin = true;
  } catch (e) {
    return res.status(403).json({ error: 'Invalid authentication or not admin', details: e.message });
  }

  if (!isAdmin) {
    return res.status(403).json({ error: 'Only admins may delete users' });
  }

  // Proceed to delete from Auth
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user_id}`, {
      method: 'DELETE',
      headers: {
        apiKey: service_role_key,
        Authorization: `Bearer ${service_role_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      const error = await response.json();
      return res.status(response.status).json({ error });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
}