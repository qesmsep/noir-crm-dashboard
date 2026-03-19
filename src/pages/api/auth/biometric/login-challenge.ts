import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { generateAuthenticationOptions, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import { WEBAUTHN_CONFIG } from '@/lib/webauthn';
import { z } from 'zod';
import { findMemberByPhone } from '@/lib/security';
import { Logger } from '@/lib/logger';

interface BiometricChallengeMember {
  member_id: string;
  phone: string;
  first_name: string;
  last_name: string;
}

const requestSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
});

/** Challenge expires in 2 minutes */
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

/**
 * Generate WebAuthn authentication challenge
 * This is step 1 of biometric login
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone } = requestSchema.parse(req.body);

    // findMemberByPhone normalizes internally
    const member = await findMemberByPhone<BiometricChallengeMember>(
      phone,
      'member_id, phone, first_name, last_name'
    );

    if (!member) {
      return res.status(404).json({
        error: 'No member found with this phone number',
      });
    }

    // Get all biometric credentials for this member
    const { data: credentials, error: credsError } = await supabaseAdmin
      .from('biometric_credentials')
      .select('credential_id, transports')
      .eq('member_id', member.member_id);

    if (credsError || !credentials || credentials.length === 0) {
      return res.status(400).json({
        error: 'No biometric credentials found. Please set up biometric authentication first.',
        needsSetup: true,
      });
    }

    // Generate authentication options
    const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
      rpID: WEBAUTHN_CONFIG.rpID,
      timeout: WEBAUTHN_CONFIG.timeout,
      allowCredentials: credentials.map((cred) => ({
        id: cred.credential_id,
        type: 'public-key',
        transports: cred.transports as AuthenticatorTransport[],
      })),
      userVerification: 'required',
    });

    // Store challenge server-side (required by WebAuthn spec for anti-replay)
    // Clean up any existing unused challenges for this member first
    await supabaseAdmin
      .from('webauthn_challenges')
      .delete()
      .eq('member_id', member.member_id)
      .eq('type', 'authentication')
      .eq('used', false);

    const { error: challengeError } = await supabaseAdmin
      .from('webauthn_challenges')
      .insert({
        member_id: member.member_id,
        challenge: options.challenge,
        type: 'authentication',
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      });

    if (challengeError) {
      Logger.error('Failed to store WebAuthn challenge', challengeError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.status(200).json({
      options,
      memberId: member.member_id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    Logger.error('Login challenge error', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Internal server error' });
  }
}
