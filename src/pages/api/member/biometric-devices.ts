import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Get all biometric devices for the logged-in member
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get member from session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .select('member_id')
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get all biometric credentials for this member
    const { data: devices, error: devicesError } = await supabaseAdmin
      .from('biometric_credentials')
      .select('id, device_name, device_type, last_used_at, created_at')
      .eq('member_id', session.member_id)
      .order('created_at', { ascending: false });

    if (devicesError) {
      console.error('Error fetching biometric devices:', devicesError);
      return res.status(500).json({ error: 'Failed to fetch devices' });
    }

    res.status(200).json({
      devices: devices || [],
    });
  } catch (error) {
    console.error('Biometric devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
