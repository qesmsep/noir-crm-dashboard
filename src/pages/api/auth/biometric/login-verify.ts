import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from '@simplewebauthn/server';
import { getWebAuthnConfigFromRequest } from '@/lib/webauthn';
import { logAuthEvent, getClientIP, getUserAgent, recordSuccessfulLogin, getSessionCookieDomain } from '@/lib/security';
import { Logger } from '@/lib/logger';
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
    // Get validated WebAuthn config (rpID validated against allowlist, origin from env)
    const { rpID, origin } = getWebAuthnConfigFromRequest(req);

    const { credential, memberId } = req.body as {
      credential: AuthenticationResponseJSON;
      memberId: string;
    };

    if (!credential || !memberId) {
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

    // Retrieve server-stored challenge (NOT from request body — WebAuthn spec requirement)
    const { data: challengeRecord, error: challengeError } = await supabaseAdmin
      .from('webauthn_challenges')
      .select('id, challenge, expires_at')
      .eq('member_id', memberId)
      .eq('type', 'authentication')
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (challengeError || !challengeRecord) {
      return res.status(400).json({ error: 'No pending authentication challenge found. Please try again.' });
    }

    // Check challenge expiry
    if (new Date(challengeRecord.expires_at) < new Date()) {
      // Mark as used so it can't be retried
      await supabaseAdmin
        .from('webauthn_challenges')
        .update({ used: true })
        .eq('id', challengeRecord.id);
      return res.status(400).json({ error: 'Authentication challenge expired. Please try again.' });
    }

    // Mark challenge as used immediately (single-use)
    await supabaseAdmin
      .from('webauthn_challenges')
      .update({ used: true })
      .eq('id', challengeRecord.id);

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

    // Verify the authentication response against the SERVER-STORED challenge
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
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
      Logger.error('Failed to create session', sessionError);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    // Record successful login (pass member_id to skip redundant phone lookup)
    await recordSuccessfulLogin(member.phone, ipAddress, member.member_id);
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
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = getSessionCookieDomain();
    res.setHeader('Set-Cookie', [
      serialize('member_session', sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
        path: '/',
        ...(cookieDomain && { domain: cookieDomain }),
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
    Logger.error('Login verification error', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Internal server error' });
  }
}
