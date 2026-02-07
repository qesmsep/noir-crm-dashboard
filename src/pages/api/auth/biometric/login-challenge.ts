import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { generateAuthenticationOptions, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import { WEBAUTHN_CONFIG } from '@/lib/webauthn';
import { z } from 'zod';

const requestSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
});

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

    // Normalize phone number (remove all non-digits, then take last 10 digits)
    const digitsOnly = phone.replace(/\D/g, '');
    const normalizedPhone = digitsOnly.slice(-10);

    // Get member by phone (try both with and without +1 prefix)
    let member: { member_id: string; phone: string; first_name: string; last_name: string } | null = null;
    let memberError: any = null;

    const result1 = await supabaseAdmin
      .from('members')
      .select('member_id, phone, first_name, last_name')
      .eq('phone', normalizedPhone)
      .limit(1);

    if (result1.data && result1.data.length > 0) {
      member = result1.data[0];
      if (result1.data.length > 1) {
        console.warn('[BIOMETRIC-LOGIN] WARNING: Multiple members found with phone:', normalizedPhone);
      }
    } else {
      const result2 = await supabaseAdmin
        .from('members')
        .select('member_id, phone, first_name, last_name')
        .eq('phone', `+1${normalizedPhone}`)
        .limit(1);

      if (result2.data && result2.data.length > 0) {
        member = result2.data[0];
        if (result2.data.length > 1) {
          console.warn('[BIOMETRIC-LOGIN] WARNING: Multiple members found with phone:', `+1${normalizedPhone}`);
        }
      }
      memberError = result2.error;
    }

    if (memberError || !member) {
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

    res.status(200).json({
      options,
      challenge: options.challenge,
      memberId: member.member_id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Login challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
