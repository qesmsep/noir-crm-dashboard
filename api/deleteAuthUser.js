// pages/api/deleteAuthUser.js

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id, supabase_user_id: initial_supabase_user_id, requester_token } = req.body;
  if (!member_id) {
    return res.status(400).json({ error: 'Missing member_id' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const service_role_key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Use anon key for client calls
  const supabase = createClient(supabaseUrl, anonKey);

  let isAdmin = false;
  try {
    let user = null;
    if (requester_token) {
      const { data, error } = await supabase.auth.getUser(requester_token);
      if (error || !data?.user) throw new Error('Requester not authenticated');
      user = data.user;
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check admin role in app_metadata or user_metadata
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

  let supabase_user_id = initial_supabase_user_id;

  // If no supabase_user_id provided, look it up from the members table
  if (!supabase_user_id) {
    if (!service_role_key) {
      return res.status(500).json({ error: 'Server misconfiguration: missing service role key' });
    }
    // Look up the linked auth user ID from the members table
    const supabaseAdmin = createClient(supabaseUrl, service_role_key);
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('supabase_user_id')
      .eq('id', member_id)
      .single();
    if (error || !data || !data.supabase_user_id) {
      return res.status(400).json({ error: 'No linked auth user found for this member.' });
    }
    supabase_user_id = data.supabase_user_id;
  }

  // Use direct fetch with service role for the admin delete call
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${supabase_user_id}`, {
      method: 'DELETE',
      headers: {
        apiKey: service_role_key,
        Authorization: `Bearer ${service_role_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      // Delete the user from the members table as well
      const supabaseDb = createClient(supabaseUrl, service_role_key);
      // LOG member_id before deleting
      console.log('Deleting member with id:', member_id);
      const { data, error: dbError } = await supabaseDb
        .from('members')
        .delete()
        .eq('id', member_id)
        .select(); // fetch deleted rows for debugging

      if (dbError) {
        return res.status(500).json({ error: 'User deleted from Auth, but failed to delete from members', details: dbError.message });
      }
      // LOG data returned from deletion
      console.log('Deleted member row:', data);
      return res.status(200).json({ success: true, deleted: data });
    } else {
      const error = await response.json();
      return res.status(response.status).json({ error });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
}