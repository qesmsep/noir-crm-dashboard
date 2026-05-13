import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { validateDescription, validateMaxUses, getClientIP, generateRequestId } from '../../../../../lib/validation';
import { ApiErrorHandler, setCorsHeaders } from '../../../../../lib/error-handler';

interface UpdateBypassCodeData {
  description?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  is_active?: boolean;
}

interface BypassCodeChangeRecord {
  description?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  is_active?: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Generate request ID for tracing
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  const errorHandler = new ApiErrorHandler(requestId);

  // Set CORS headers (fails closed in production without ALLOWED_ORIGIN)
  setCorsHeaders(res, 'PUT, DELETE, OPTIONS');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { slug, id } = req.query;

  if (!slug || typeof slug !== 'string' || !id || typeof id !== 'string') {
    return errorHandler.badRequest(res, 'Location slug and code ID are required');
  }

  // Verify admin authentication
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return errorHandler.forbidden(res);
  }

  // PUT - Update an existing bypass code
  if (req.method === 'PUT') {
    try {
      const { description, expires_at, max_uses, is_active } = req.body;
      const clientIP = getClientIP(req);
      const userAgent = req.headers['user-agent'] || 'unknown';

      ApiErrorHandler.log(requestId, `Updating bypass code: ${id} for location: ${slug}`);

      // Validate description if provided
      if (description !== undefined) {
        const descriptionValidation = validateDescription(description);
        if (!descriptionValidation.isValid) {
          return errorHandler.badRequest(res, descriptionValidation.error!);
        }
      }

      // Get location ID from slug to verify ownership
      const { data: location, error: locationError } = await supabaseAdmin
        .from('locations')
        .select('id')
        .eq('slug', slug)
        .single();

      if (locationError || !location) {
        return errorHandler.notFound(res, 'Location');
      }

      // Verify the code belongs to this location and fetch current values
      const { data: existingCode, error: fetchError } = await supabaseAdmin
        .from('location_bypass_codes')
        .select('*')
        .eq('id', id)
        .eq('location_id', location.id)
        .single();

      if (fetchError || !existingCode) {
        return errorHandler.notFound(res, 'Bypass code');
      }

      // Validate max_uses if provided - must be >= current_uses
      if (max_uses !== undefined) {
        const maxUsesValidation = validateMaxUses(max_uses, existingCode.current_uses);
        if (!maxUsesValidation.isValid) {
          return errorHandler.badRequest(res, maxUsesValidation.error!);
        }
      }

      // Build update data
      const updateData: UpdateBypassCodeData = {};
      const oldValues: BypassCodeChangeRecord = {};
      const newValues: BypassCodeChangeRecord = {};

      if (description !== undefined && description !== existingCode.description) {
        updateData.description = description;
        oldValues.description = existingCode.description;
        newValues.description = description;
      }

      if (expires_at !== undefined && expires_at !== existingCode.expires_at) {
        updateData.expires_at = expires_at;
        oldValues.expires_at = existingCode.expires_at;
        newValues.expires_at = expires_at;
      }

      if (max_uses !== undefined && max_uses !== existingCode.max_uses) {
        updateData.max_uses = max_uses;
        oldValues.max_uses = existingCode.max_uses;
        newValues.max_uses = max_uses;
      }

      if (is_active !== undefined && is_active !== existingCode.is_active) {
        updateData.is_active = is_active;
        oldValues.is_active = existingCode.is_active;
        newValues.is_active = is_active;
      }

      // Check if there are any changes
      if (Object.keys(updateData).length === 0) {
        return res.status(200).json({
          message: 'No changes to update',
          code: existingCode,
          requestId,
        });
      }

      // Update the bypass code
      const { data: updatedCode, error: updateError } = await supabaseAdmin
        .from('location_bypass_codes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        ApiErrorHandler.logError(requestId, 'Error updating bypass code', updateError);
        return errorHandler.internalError(res, updateError, 'Failed to update bypass code');
      }

      // Log to audit trail
      try {
        await supabaseAdmin
          .from('location_bypass_code_audit')
          .insert({
            bypass_code_id: id,
            action: 'updated',
            old_values: oldValues,
            new_values: newValues,
            ip_address: clientIP,
            user_agent: userAgent,
          });
      } catch (auditError) {
        // Log but don't fail the request
        ApiErrorHandler.logError(requestId, 'Failed to log audit trail', auditError);
      }

      ApiErrorHandler.log(requestId, `Bypass code updated successfully: ${id}`);

      res.status(200).json({
        message: 'Bypass code updated successfully',
        code: updatedCode,
        requestId,
      });
    } catch (error: unknown) {
      ApiErrorHandler.logError(requestId, 'Unexpected error updating bypass code', error);
      return errorHandler.internalError(res, error);
    }
  }

  // DELETE - Soft delete (deactivate) a bypass code
  else if (req.method === 'DELETE') {
    try {
      const clientIP = getClientIP(req);
      const userAgent = req.headers['user-agent'] || 'unknown';

      ApiErrorHandler.log(requestId, `Deactivating bypass code: ${id} for location: ${slug}`);

      // Get location ID from slug to verify ownership
      const { data: location, error: locationError } = await supabaseAdmin
        .from('locations')
        .select('id')
        .eq('slug', slug)
        .single();

      if (locationError || !location) {
        return errorHandler.notFound(res, 'Location');
      }

      // Verify the code belongs to this location
      const { data: existingCode, error: fetchError } = await supabaseAdmin
        .from('location_bypass_codes')
        .select('*')
        .eq('id', id)
        .eq('location_id', location.id)
        .single();

      if (fetchError || !existingCode) {
        return errorHandler.notFound(res, 'Bypass code');
      }

      // Soft delete by setting is_active to false
      const { error: deleteError } = await supabaseAdmin
        .from('location_bypass_codes')
        .update({ is_active: false })
        .eq('id', id);

      if (deleteError) {
        ApiErrorHandler.logError(requestId, 'Error deactivating bypass code', deleteError);
        return errorHandler.internalError(res, deleteError, 'Failed to deactivate bypass code');
      }

      // Log to audit trail
      try {
        await supabaseAdmin
          .from('location_bypass_code_audit')
          .insert({
            bypass_code_id: id,
            action: 'deactivated',
            old_values: { is_active: true },
            new_values: { is_active: false },
            ip_address: clientIP,
            user_agent: userAgent,
          });
      } catch (auditError) {
        // Log but don't fail the request
        ApiErrorHandler.logError(requestId, 'Failed to log audit trail', auditError);
      }

      ApiErrorHandler.log(requestId, `Bypass code deactivated successfully: ${id}`);

      res.status(200).json({
        message: 'Bypass code deactivated successfully',
        requestId,
      });
    } catch (error: unknown) {
      ApiErrorHandler.logError(requestId, 'Unexpected error deactivating bypass code', error);
      return errorHandler.internalError(res, error);
    }
  }

  else {
    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({
      error: `Method ${req.method} Not Allowed`,
      requestId,
    });
  }
}
