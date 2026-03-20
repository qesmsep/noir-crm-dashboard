import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { generateRegistrationOptions, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import { WEBAUTHN_CONFIG, CHALLENGE_TTL_MS } from '@/lib/webauthn';
import { Logger } from '@/lib/logger';
import { parse } from 'cookie';

/**
 * Generate WebAuthn registration challenge
 * This is step 1 of biometric registration
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

    // Get existing credentials for this member
    const { data: existingCredentials } = await supabaseAdmin
      .from('biometric_credentials')
      .select('credential_id, transports')
      .eq('member_id', member.member_id);

    // Generate registration options
    // simplewebauthn v13 requires userID as Uint8Array
    const options: PublicKeyCredentialCreationOptionsJSON = await generateRegistrationOptions({
      rpName: WEBAUTHN_CONFIG.rpName,
      rpID: WEBAUTHN_CONFIG.rpID,
      userID: new TextEncoder().encode(member.member_id),
      userName: member.phone,
      userDisplayName: `${member.first_name} ${member.last_name}`,
      timeout: WEBAUTHN_CONFIG.timeout,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Face ID, Touch ID, Windows Hello
        requireResidentKey: false,
        residentKey: 'preferred',
        userVerification: 'required',
      },
      excludeCredentials: existingCredentials?.map((cred) => ({
        id: cred.credential_id,
        type: 'public-key',
        transports: cred.transports as AuthenticatorTransport[],
      })) || [],
    });

    // Store challenge server-side for verification (anti-replay)
    // Clean up any existing unused registration challenges for this member
    await supabaseAdmin
      .from('webauthn_challenges')
      .delete()
      .eq('member_id', member.member_id)
      .eq('type', 'registration')
      .eq('used', false);

    const { error: challengeError } = await supabaseAdmin
      .from('webauthn_challenges')
      .insert({
        member_id: member.member_id,
        challenge: options.challenge,
        type: 'registration',
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      });

    if (challengeError) {
      Logger.error('Failed to store registration challenge', challengeError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.status(200).json({ options });
  } catch (error) {
    Logger.error('Registration challenge error', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Internal server error' });
  }
}
