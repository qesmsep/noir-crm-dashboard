import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from '@simplewebauthn/server';
import { WEBAUTHN_CONFIG } from '@/lib/webauthn';
import { logAuthEvent, getClientIP, getUserAgent, recordSuccessfulLogin } from '@/lib/security';
import { serialize } from 'cookie';

const SESSION_DURATION_DAYS = 7;

/**
 * Verify WebAuthn authentication response
 * This is step 2 of biometric login
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
    const { credential, challenge, memberId } = req.body as {
      credential: AuthenticationResponseJSON;
      challenge: string;
      memberId: string;
    };

    if (!credential || !challenge || !memberId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get member
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('member_id, auth_user_id, email, first_name, last_name, phone, membership')
      .eq('member_id', memberId)
      .single();

    if (memberError || !member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get the credential used
    const credentialID = credential.id;
    const { data: dbCredential, error: credError } = await supabaseAdmin
      .from('biometric_credentials')
      .select('*')
      .eq('member_id', member.member_id)
      .eq('credential_id', credentialID)
      .single();

    if (credError || !dbCredential) {
      return res.status(400).json({ error: 'Credential not found' });
    }

    // Convert stored public key from base64url to Buffer
    const publicKey = Buffer.from(dbCredential.public_key, 'base64url');

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: WEBAUTHN_CONFIG.origin,
      expectedRPID: WEBAUTHN_CONFIG.rpID,
      credential: {
        id: dbCredential.credential_id,
        publicKey: publicKey,
        counter: dbCredential.counter || 0,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      await logAuthEvent({
        memberId: member.member_id,
        phone: member.phone,
        eventType: 'login_failed',
        ipAddress,
        userAgent,
        metadata: { reason: 'biometric_verification_failed' },
      });

      return res.status(400).json({ error: 'Biometric authentication failed' });
    }

    // Update credential counter and last used
    await supabaseAdmin
      .from('biometric_credentials')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', dbCredential.id);

    // Generate session token
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    // Create member portal session
    const { error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .insert({
        member_id: member.member_id,
        session_token: sessionToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    // Record successful login
    await recordSuccessfulLogin(member.phone, ipAddress);
    await logAuthEvent({
      memberId: member.member_id,
      phone: member.phone,
      eventType: 'biometric_login',
      ipAddress,
      userAgent,
      metadata: {
        membership: member.membership,
        device_name: dbCredential.device_name,
        credential_id: dbCredential.credential_id,
      },
    });

    // Set httpOnly cookie for session
    res.setHeader('Set-Cookie', [
      serialize('member_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
        path: '/',
      }),
    ]);

    res.status(200).json({
      success: true,
      member: {
        id: member.member_id,
        email: member.email,
        firstName: member.first_name,
        lastName: member.last_name,
        phone: member.phone,
        membership: member.membership,
      },
    });
  } catch (error) {
    console.error('Login verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
