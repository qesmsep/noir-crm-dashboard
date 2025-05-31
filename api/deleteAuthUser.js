// pages/api/deleteAuthUser.js

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id, supabase_user_id: initial_supabase_user_id, requester_token } = req.body;
  if (!member_id && !initial_supabase_user_id) {
    return res.status(400).json({ error: 'Missing member_id or supabase_user_id' });
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

  // Optionally look up supabase_user_id if not provided
  if (!supabase_user_id && service_role_key) {
    const supabaseAdmin = createClient(supabaseUrl, service_role_key);
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('supabase_user_id')
      .eq('member_id', member_id)
      .single();
    if (!error && data?.supabase_user_id) {
      supabase_user_id = data.supabase_user_id;
    } else {
      console.log('No linked auth user for member, skipping auth deletion');
    }
  }

  // If we have a linked Auth user, delete them via the Admin API
  if (supabase_user_id) {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${supabase_user_id}`, {
        method: 'DELETE',
        headers: {
          apiKey: service_role_key,
          Authorization: `Bearer ${service_role_key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const err = await response.json();
        console.warn('Failed to delete Auth user:', err);
      }
    } catch (err) {
      console.warn('Error deleting Auth user:', err);
    }
  }

  // Delete the member row (always)
  const supabaseDb = createClient(supabaseUrl, service_role_key);
  console.log('Deleting member with id:', member_id);
  const { data: deletedRows, error: dbError } = await supabaseDb
    .from('members')
    .delete()
    .eq('member_id', member_id)
    .select();
  if (dbError) {
    return res.status(500).json({ error: 'Failed to delete member row', details: dbError.message });
  }
  console.log('Deleted member row:', deletedRows);
  return res.status(200).json({ success: true, deleted: deletedRows });
}