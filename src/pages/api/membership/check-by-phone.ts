import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { findMemberByPhone } from '@/lib/security';
import { getClientIP, generateRequestId } from '@/lib/validation';
import { ApiErrorHandler, setCorsHeaders } from '@/lib/error-handler';

interface MemberNameLookup {
  member_id: string;
  first_name: string | null;
  last_name: string | null;
}

/**
 * Checks whether a phone number belongs to an active/paused member.
 *
 * This is an unauthenticated membership oracle by design (the reservation
 * form needs to check before a member has any session), so it is rate
 * limited per IP and returns only the minimum the form needs — never
 * member_id or any other row data.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  const errorHandler = new ApiErrorHandler(requestId);

  setCorsHeaders(res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed`, requestId });
  }

  const { phone } = req.body || {};

  if (!phone || typeof phone !== 'string') {
    return errorHandler.badRequest(res, 'Phone number is required');
  }

  const clientIP = getClientIP(req);
  const endpoint = '/api/membership/check-by-phone';

  try {
    const { data: rateLimitResult, error: rateLimitError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_identifier: clientIP,
      p_endpoint: endpoint,
      p_max_attempts: 20,
      p_window_minutes: 5,
    });

    if (rateLimitError) {
      ApiErrorHandler.logError(requestId, 'Rate limit check failed', rateLimitError);
      return errorHandler.internalError(res, rateLimitError);
    }

    if (rateLimitResult && rateLimitResult.length > 0 && !rateLimitResult[0].allowed) {
      ApiErrorHandler.log(requestId, `Rate limit exceeded for IP: ${clientIP}`);
      return errorHandler.tooManyRequests(res, 300);
    }

    const member = await findMemberByPhone<MemberNameLookup>(phone, 'member_id, first_name, last_name');

    if (!member) {
      return res.status(200).json({ isMember: false, requestId });
    }

    return res.status(200).json({
      isMember: true,
      first_name: member.first_name,
      last_name: member.last_name,
      requestId,
    });
  } catch (error: unknown) {
    ApiErrorHandler.logError(requestId, 'Unexpected error in check-by-phone', error);
    return errorHandler.internalError(res, error);
  }
}
