import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { generateRegistrationOptions, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import { WEBAUTHN_CONFIG, getWebAuthnConfigFromRequest } from '@/lib/webauthn';
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
    // Get validated WebAuthn config (rpID validated against allowlist, origin from env)
    const { rpID, origin } = getWebAuthnConfigFromRequest(req);

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
    // Convert member_id UUID to Buffer for userID
    const userIDBuffer = Buffer.from(member.member_id.replace(/-/g, ''), 'hex');

    const options: PublicKeyCredentialCreationOptionsJSON = await generateRegistrationOptions({
      rpName: WEBAUTHN_CONFIG.rpName,
      rpID: rpID,
      userID: userIDBuffer,
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

    // Store challenge in database for server-side verification
    // Challenge expires in 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { error: challengeError } = await supabaseAdmin
      .from('webauthn_challenges')
      .insert({
        member_id: member.member_id,
        challenge: options.challenge,
        type: 'registration',
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (challengeError) {
      console.error('Failed to store challenge:', challengeError);
      console.error('Challenge data attempted:', {
        member_id: member.member_id,
        challenge: options.challenge,
        type: 'registration',
        expires_at: expiresAt.toISOString(),
      });
      return res.status(500).json({
        error: 'Failed to generate registration challenge',
        details: challengeError.message,
      });
    }

    // Update session activity
    await supabaseAdmin
      .from('member_portal_sessions')
      .update({
        last_activity: new Date().toISOString(),
      })
      .eq('session_token', sessionToken);

    res.status(200).json({
      options,
    });
  } catch (error) {
    console.error('Registration challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
