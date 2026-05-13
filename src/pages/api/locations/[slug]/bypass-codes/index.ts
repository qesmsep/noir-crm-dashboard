import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { validateBypassCode, validateDescription, validateMaxUses, getClientIP, generateRequestId } from '../../../../../lib/validation';
import { ApiErrorHandler, setCorsHeaders } from '../../../../../lib/error-handler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Generate request ID for tracing
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  const errorHandler = new ApiErrorHandler(requestId);

  // Set CORS headers (fails closed in production without ALLOWED_ORIGIN)
  setCorsHeaders(res, 'GET, POST, OPTIONS');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return errorHandler.badRequest(res, 'Location slug is required');
  }

  // Verify admin authentication
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return errorHandler.forbidden(res);
  }

  // GET - List bypass codes for a location
  if (req.method === 'GET') {
    try {
      ApiErrorHandler.log(requestId, `Fetching bypass codes for location: ${slug}`);

      // Get location ID from slug
      const { data: location, error: locationError } = await supabaseAdmin
        .from('locations')
        .select('id, name')
        .eq('slug', slug)
        .single();

      if (locationError || !location) {
        return errorHandler.notFound(res, 'Location');
      }

      // Fetch bypass codes for this location
      const { data: codes, error: codesError } = await supabaseAdmin
        .from('location_bypass_codes')
        .select('*')
        .eq('location_id', location.id)
        .order('created_at', { ascending: false });

      if (codesError) {
        ApiErrorHandler.logError(requestId, 'Error fetching bypass codes', codesError);
        return errorHandler.internalError(res, codesError, 'Failed to fetch bypass codes');
      }

      // Add usage statistics for each code
      const codesWithStats = codes?.map(code => ({
        ...code,
        usage_percentage: code.max_uses
          ? Math.round((code.current_uses / code.max_uses) * 100)
          : null,
        is_expired: code.expires_at && new Date(code.expires_at) < new Date(),
        is_maxed_out: code.max_uses && code.current_uses >= code.max_uses,
      }));

      res.status(200).json({
        location,
        codes: codesWithStats || [],
        requestId,
      });
    } catch (error: unknown) {
      ApiErrorHandler.logError(requestId, 'Unexpected error fetching bypass codes', error);
      return errorHandler.internalError(res, error);
    }
  }

  // POST - Create a new bypass code
  else if (req.method === 'POST') {
    try {
      const { code, description, expires_at, max_uses } = req.body;
      const clientIP = getClientIP(req);
      const userAgent = req.headers['user-agent'] || 'unknown';

      ApiErrorHandler.log(requestId, `Creating bypass code for location: ${slug}`);

      // Validate code
      const codeValidation = validateBypassCode(code);
      if (!codeValidation.isValid) {
        return errorHandler.badRequest(res, codeValidation.error!);
      }

      // Validate description
      const descriptionValidation = validateDescription(description);
      if (!descriptionValidation.isValid) {
        return errorHandler.badRequest(res, descriptionValidation.error!);
      }

      // Validate max_uses
      const maxUsesValidation = validateMaxUses(max_uses);
      if (!maxUsesValidation.isValid) {
        return errorHandler.badRequest(res, maxUsesValidation.error!);
      }

      // Get location ID from slug
      const { data: location, error: locationError } = await supabaseAdmin
        .from('locations')
        .select('id')
        .eq('slug', slug)
        .single();

      if (locationError || !location) {
        return errorHandler.notFound(res, 'Location');
      }

      // Check if code already exists for this location (case-insensitive, exact match)
      const { data: existingCode } = await supabaseAdmin
        .from('location_bypass_codes')
        .select('id')
        .eq('location_id', location.id)
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (existingCode) {
        return errorHandler.badRequest(res, 'This code already exists for this location');
      }

      // Create the bypass code
      const { data: newCode, error: createError } = await supabaseAdmin
        .from('location_bypass_codes')
        .insert({
          location_id: location.id,
          code: code.toUpperCase(), // Store in uppercase for consistency
          description: description || null,
          expires_at: expires_at || null,
          max_uses: max_uses || null,
          current_uses: 0,
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        ApiErrorHandler.logError(requestId, 'Error creating bypass code', createError);
        return errorHandler.internalError(res, createError, 'Failed to create bypass code');
      }

      // Log to audit trail
      try {
        await supabaseAdmin
          .from('location_bypass_code_audit')
          .insert({
            bypass_code_id: newCode.id,
            action: 'created',
            new_values: {
              code: newCode.code,
              description: newCode.description,
              expires_at: newCode.expires_at,
              max_uses: newCode.max_uses,
            },
            ip_address: clientIP,
            user_agent: userAgent,
          });
      } catch (auditError) {
        // Log but don't fail the request
        ApiErrorHandler.logError(requestId, 'Failed to log audit trail', auditError);
      }

      ApiErrorHandler.log(requestId, `Bypass code created successfully: ${newCode.id}`);

      res.status(201).json({
        message: 'Bypass code created successfully',
        code: newCode,
        requestId,
      });
    } catch (error: unknown) {
      ApiErrorHandler.logError(requestId, 'Unexpected error creating bypass code', error);
      return errorHandler.internalError(res, error);
    }
  }

  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      error: `Method ${req.method} Not Allowed`,
      requestId,
    });
  }
}
