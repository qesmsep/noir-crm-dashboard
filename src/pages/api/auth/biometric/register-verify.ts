import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server';
import { WEBAUTHN_CONFIG } from '@/lib/webauthn';
import { logAuthEvent, getClientIP, getUserAgent } from '@/lib/security';
import { parse } from 'cookie';

/**
 * Verify WebAuthn registration response
 * This is step 2 of biometric registration
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { credential, challenge, deviceName } = req.body as {
      credential: RegistrationResponseJSON;
      challenge: string;
      deviceName?: string;
    };

    if (!credential || !challenge) {
      return res.status(400).json({ error: 'Missing credential or challenge' });
    }

    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get member from session
    const { data: session } = await supabaseAdmin
      .from('member_portal_sessions')
      .select('member_id, members(*)')
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (!session || !session.members) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const member = Array.isArray(session.members) ? session.members[0] : session.members;

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: WEBAUTHN_CONFIG.origin,
      expectedRPID: WEBAUTHN_CONFIG.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Biometric registration failed verification' });
    }

    const { credential: registeredCredential } = verification.registrationInfo;

    // Store the credential
    const { error: insertError } = await supabaseAdmin
      .from('biometric_credentials')
      .insert({
        member_id: member.member_id,
        credential_id: Buffer.from(registeredCredential.id).toString('base64url'),
        public_key: Buffer.from(registeredCredential.publicKey).toString('base64url'),
        counter: registeredCredential.counter || 0,
        device_name: deviceName || 'Unknown Device',
        device_type: 'platform',
        transports: credential.response.transports || [],
        aaguid: verification.registrationInfo.aaguid
          ? Buffer.from(verification.registrationInfo.aaguid).toString('hex')
          : null,
        last_used_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Failed to store biometric credential:', insertError);
      return res.status(500).json({ error: 'Failed to save biometric credential' });
    }

    // Log the event
    await logAuthEvent({
      memberId: member.member_id,
      phone: member.phone,
      eventType: 'biometric_registered',
      ipAddress: getClientIP(req),
      userAgent: getUserAgent(req),
      metadata: {
        device_name: deviceName,
        credential_id: Buffer.from(registeredCredential.id).toString('base64url'),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Biometric authentication enabled successfully',
    });
  } catch (error) {
    console.error('Registration verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
