import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Debug endpoint to check profile photo data
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
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Direct query to members table
    const { data: memberDirect, error: memberError } = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, last_name, profile_photo_url')
      .eq('member_id', session.member_id)
      .single();

    // Also check if there's a photo_url column (in case of different migration)
    const { data: memberWithPhotoUrl, error: photoUrlError } = await supabaseAdmin
      .from('members')
      .select('photo_url')
      .eq('member_id', session.member_id)
      .single();

    // Get all columns to see what's actually there
    const { data: memberAll, error: allError } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('member_id', session.member_id)
      .single();

    // Check if there's a typeform response with photo
    const { data: typeformData, error: typeformError } = await supabaseAdmin
      .from('typeform_responses')
      .select('*')
      .eq('member_id', session.member_id)
      .single();

    res.status(200).json({
      debug: {
        member_id: session.member_id,
        direct_query: {
          data: memberDirect,
          error: memberError?.message || null
        },
        photo_url_query: {
          data: memberWithPhotoUrl,
          error: photoUrlError?.message || null
        },
        typeform_response: {
          data: typeformData,
          error: typeformError?.message || null,
          photo_url: typeformData?.photo_url || null,
          response_data: typeformData?.response_data || null
        },
        all_columns: {
          has_profile_photo_url: !!memberAll?.profile_photo_url,
          profile_photo_url_value: memberAll?.profile_photo_url || 'NULL',
          has_photo_url: !!(memberAll as any)?.photo_url,
          photo_url_value: (memberAll as any)?.photo_url || 'NULL',
          all_keys: memberAll ? Object.keys(memberAll) : []
        }
      }
    });
  } catch (error) {
    console.error('Debug photo error:', error);
    res.status(500).json({ error: 'Internal server error', details: error });
  }
}