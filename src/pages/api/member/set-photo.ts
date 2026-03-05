import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Set the profile photo URL for the current member
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    console.log('Set photo API - Session token present:', !!sessionToken);

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
      console.error('Session error:', sessionError);
      return res.status(401).json({ error: 'Invalid session' });
    }

    console.log('Set photo API - Member ID:', session.member_id);

    const { photo_url } = req.body;

    if (!photo_url) {
      return res.status(400).json({ error: 'photo_url is required' });
    }

    console.log('Set photo API - Photo URL length:', photo_url.length);

    // Update both photo fields (photo is the primary one used in display logic)
    const { data, error } = await supabaseAdmin
      .from('members')
      .update({
        photo: photo_url,
        profile_photo_url: photo_url
      })
      .eq('member_id', session.member_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile photo:', error);
      return res.status(500).json({ error: 'Failed to update profile photo' });
    }

    console.log('Set photo API - Successfully updated photo for member:', session.member_id);

    res.status(200).json({
      success: true,
      member: data,
      message: 'Profile photo updated successfully'
    });
  } catch (error) {
    console.error('Set photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}