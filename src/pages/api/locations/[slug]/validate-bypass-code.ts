import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { validateBypassCode, validatePartySize, getClientIP, generateRequestId } from '../../../../lib/validation';
import { ApiErrorHandler } from '../../../../lib/error-handler';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Generate request ID for tracing
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  const errorHandler = new ApiErrorHandler(requestId);

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed`, requestId });
  }

  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return errorHandler.badRequest(res, 'Location slug is required');
  }

  const { code, partySize } = req.body;

  // Validate inputs
  const codeValidation = validateBypassCode(code);
  if (!codeValidation.isValid) {
    return errorHandler.badRequest(res, codeValidation.error!);
  }

  const partySizeValidation = validatePartySize(partySize);
  if (!partySizeValidation.isValid) {
    return errorHandler.badRequest(res, partySizeValidation.error!);
  }

  // Get client IP for rate limiting
  const clientIP = getClientIP(req);
  const endpoint = `/api/locations/${slug}/validate-bypass-code`;

  ApiErrorHandler.log(requestId, `Validating bypass code for location: ${slug}, IP: ${clientIP}`);

  try {
    // Check rate limit using database function
    const { data: rateLimitResult, error: rateLimitError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_identifier: clientIP,
      p_endpoint: endpoint,
      p_max_attempts: 5,
      p_window_minutes: 1,
    });

    if (rateLimitError) {
      ApiErrorHandler.logError(requestId, 'Rate limit check failed', rateLimitError);
      return errorHandler.internalError(res, rateLimitError);
    }

    if (rateLimitResult && rateLimitResult.length > 0) {
      const { allowed, attempts_remaining } = rateLimitResult[0];

      if (!allowed) {
        ApiErrorHandler.log(requestId, `Rate limit exceeded for IP: ${clientIP}`);
        return errorHandler.tooManyRequests(res, 60);
      }

      ApiErrorHandler.log(requestId, `Rate limit OK. Attempts remaining: ${attempts_remaining}`);
    }

    // Validate code using new function (validation only, no increment)
    const { data: validationResult, error: validationError } = await supabaseAdmin.rpc('check_bypass_code_validity', {
      p_location_slug: slug,
      p_code: code.trim(),
    });

    if (validationError) {
      ApiErrorHandler.logError(requestId, 'Code validation failed', validationError);
      return errorHandler.internalError(res, validationError, 'Failed to validate code');
    }

    if (!validationResult || validationResult.length === 0) {
      return errorHandler.badRequest(res, 'Invalid validation response');
    }

    const result = validationResult[0];

    if (!result.is_valid) {
      ApiErrorHandler.log(requestId, `Invalid code: ${result.message}`);
      return res.status(200).json({
        isValid: false,
        message: result.message,
        requestId,
      });
    }

    // Generate validation ID for idempotency
    const validationId = uuidv4();

    // Calculate amount waived
    const amountWaived = (result.cover_price || 0) * partySize;

    ApiErrorHandler.log(requestId, `Code validated successfully: ${result.bypass_code_id}`);

    return res.status(200).json({
      isValid: true,
      message: 'Code validated successfully',
      bypassCodeId: result.bypass_code_id,
      validationId, // Return this for idempotency in reservation creation
      locationName: result.location_name,
      locationId: result.location_id,
      amountWaived,
      coverPricePerPerson: result.cover_price,
      requestId,
    });
  } catch (error: any) {
    ApiErrorHandler.logError(requestId, 'Unexpected error in validate-bypass-code', error);
    return errorHandler.internalError(res, error);
  }
}
