import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { parse } from 'cookie';
import { logAuthEvent, getClientIP, getUserAgent } from '@/lib/security';

const requestSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  contact_preferences: z.object({
    sms: z.boolean(),
    email: z.boolean(),
  }),
  profile_photo_url: z.string().url().nullable().optional(),
});

/**
 * Update member profile information
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ipAddress = getClientIP(req);
  const userAgent = getUserAgent(req);

  try {
    const profileData = requestSchema.parse(req.body);

    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get member from session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .select('member_id, members(member_id, phone)')
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session || !session.members) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const member = Array.isArray(session.members) ? session.members[0] : session.members;

    // Update member profile
    const updatePayload: Record<string, any> = {
      first_name: profileData.first_name,
      last_name: profileData.last_name,
      email: profileData.email,
      contact_preferences: profileData.contact_preferences,
      updated_at: new Date().toISOString(),
    };

    if (profileData.profile_photo_url !== undefined) {
      updatePayload.profile_photo_url = profileData.profile_photo_url;
    }

    const { error: updateError } = await supabaseAdmin
      .from('members')
      .update(updatePayload)
      .eq('member_id', member.member_id);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    // Log profile update (using 'login_success' as closest valid event type)
    await logAuthEvent({
      memberId: member.member_id,
      phone: member.phone,
      eventType: 'login_success',
      ipAddress,
      userAgent,
      metadata: {
        action: 'profile_updated',
        fields_updated: ['first_name', 'last_name', 'email', 'contact_preferences'],
      },
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
