import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { parse } from 'cookie';
import { logAuthEvent, getClientIP, getUserAgent } from '@/lib/security';

const requestSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
});

/**
 * Remove a biometric device for the logged-in member
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
    const { deviceId } = requestSchema.parse(req.body);

    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get member from session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .select('member_id, members(phone)')
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session || !session.members) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const member = Array.isArray(session.members) ? session.members[0] : session.members;

    // Get device details before deleting
    const { data: device } = await supabaseAdmin
      .from('biometric_credentials')
      .select('device_name')
      .eq('id', deviceId)
      .eq('member_id', session.member_id)
      .single();

    // Delete the biometric device
    const { error: deleteError } = await supabaseAdmin
      .from('biometric_credentials')
      .delete()
      .eq('id', deviceId)
      .eq('member_id', session.member_id);

    if (deleteError) {
      console.error('Failed to remove biometric device:', deleteError);
      return res.status(500).json({ error: 'Failed to remove device' });
    }

    // Log the removal (using 'logout' as closest valid event type for device removal)
    await logAuthEvent({
      memberId: session.member_id,
      phone: member.phone,
      eventType: 'logout',
      ipAddress,
      userAgent,
      metadata: {
        action: 'biometric_device_removed',
        device_name: device?.device_name,
        device_id: deviceId,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Biometric device removed successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Remove biometric error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
