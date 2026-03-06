import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPersonalizedSMS } from '@/utils/openphoneUtils';
import { z } from 'zod';

const requestSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
});

// Rate limiting constants
const MAX_OTP_REQUESTS_PER_PHONE_15MIN = 3;
const MAX_OTP_REQUESTS_PER_IP_1HOUR = 10;

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

    // Get client IP address
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                     (req.headers['x-real-ip'] as string) ||
                     req.socket.remoteAddress ||
                     'unknown';

    // RATE LIMITING: Check phone-based rate limit (3 requests per 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const { data: recentPhoneRequests, error: phoneCheckError } = await supabaseAdmin
      .from('phone_otp_codes')
      .select('id')
      .or(`phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone}`)
      .gte('created_at', fifteenMinutesAgo.toISOString());

    if (phoneCheckError) {
      console.error('Failed to check phone rate limit:', phoneCheckError);
    } else if (recentPhoneRequests && recentPhoneRequests.length >= MAX_OTP_REQUESTS_PER_PHONE_15MIN) {
      return res.status(429).json({
        error: `Too many code requests. Please wait 15 minutes before requesting another code.`,
        retryAfter: 900, // 15 minutes in seconds
      });
    }

    // RATE LIMITING: Check IP-based rate limit (10 requests per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { data: recentIpRequests, error: ipCheckError } = await supabaseAdmin
      .from('phone_otp_codes')
      .select('id')
      .eq('ip_address', clientIp)
      .gte('created_at', oneHourAgo.toISOString());

    if (ipCheckError) {
      console.error('Failed to check IP rate limit:', ipCheckError);
    } else if (recentIpRequests && recentIpRequests.length >= MAX_OTP_REQUESTS_PER_IP_1HOUR) {
      return res.status(429).json({
        error: `Too many requests from this location. Please try again later.`,
        retryAfter: 3600, // 1 hour in seconds
      });
    }

    // Check if member exists with this phone (try both with and without +1 prefix)
    let member: any = null;

    const result1 = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, email, phone')
      .eq('phone', normalizedPhone)
      .limit(1);

    if (result1.data && result1.data.length > 0) {
      member = result1.data[0];
      if (result1.data.length > 1) {
        console.warn('[SEND-OTP] WARNING: Multiple members found with phone:', normalizedPhone);
      }
    } else {
      const result2 = await supabaseAdmin
        .from('members')
        .select('member_id, first_name, email, phone')
        .eq('phone', `+1${normalizedPhone}`)
        .limit(1);

      if (result2.data && result2.data.length > 0) {
        member = result2.data[0];
        if (result2.data.length > 1) {
          console.warn('[SEND-OTP] WARNING: Multiple members found with phone:', `+1${normalizedPhone}`);
        }
      }
    }

    if (!member) {
      return res.status(404).json({
        error: 'No member found with this phone number. Please contact support.',
      });
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const { error: otpError } = await supabaseAdmin
      .from('phone_otp_codes')
      .insert({
        phone: normalizedPhone,
        code,
        expires_at: expiresAt.toISOString(),
        ip_address: clientIp,
        user_agent: req.headers['user-agent'] || null,
      });

    if (otpError) {
      console.error('Failed to store OTP:', otpError);
      return res.status(500).json({ error: 'Failed to send verification code' });
    }

    // Send SMS via OpenPhone (requires E.164 format: +1XXXXXXXXXX)
    try {
      await sendPersonalizedSMS(
        `+1${normalizedPhone}`,
        `Your Noir verification code is: ${code}\n\nThis code expires in 10 minutes.`,
        member.first_name
      );
    } catch (smsError) {
      console.error('Failed to send SMS via OpenPhone:', smsError);
      return res.status(500).json({
        error: 'Failed to send SMS. Please try again or use email login.',
      });
    }

    // AUDIT LOG: Log successful OTP request
    console.log('[AUTH-AUDIT] OTP Requested', {
      event: 'otp_requested',
      member_id: member.member_id,
      phone: normalizedPhone,
      ip_address: clientIp,
      user_agent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Verification code sent',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Send phone OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
