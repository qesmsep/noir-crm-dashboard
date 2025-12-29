import { createClient } from '@supabase/supabase-js';
import { ApiResponse } from '../../lib/api-response';
import { memberSchema, updateMemberSchema, validateWithSchema } from '../../lib/validations';
import { Logger } from '../../lib/logger';

// Initialize Supabase client with validation
let supabase;
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  // Will be handled in the handler
}

const ALLOWED_MEMBER_FIELDS = [
  'account_id', 'first_name', 'last_name', 'email', 'phone', 'stripe_customer_id',
  'join_date', 'company', 'address', 'address_2', 'city', 'state', 'zip', 'country',
  'referral', 'membership', 'monthly_dues', 'photo', 'dob', 'auth_code', 'token', 'created_at',
  'member_type', 'member_id'
];

function cleanMemberObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => ALLOWED_MEMBER_FIELDS.includes(key))
  );
}

function getMonthlyDues(membership) {
  if (!membership) return 0;
  const map = {
    'Membership': 100,
    'Membership + Partner': 125,
    'Membership + Daytime': 350,
    'Membership + Partner + Daytime': 375,
    // Keep legacy support for existing members
    'Solo': 100,
    'Duo': 125,
    'Premier': 250,
    'Reserve': 1000,
    'Host': 1
  };
  return map[membership] || 0;
}

export default async function handler(req, res) {
  // Set JSON content type early to prevent HTML error pages
  try {
    res.setHeader('Content-Type', 'application/json');
  } catch (headerError) {
    console.error('[MEMBERS API] Error setting Content-Type header:', headerError);
    try {
      if (res && typeof res.status === 'function') {
        return res.status(500).json({ 
          error: 'Server configuration error',
          message: 'Failed to set response headers'
        });
      }
    } catch (e) {
      console.error('[MEMBERS API] Critical: Cannot send JSON response:', e);
      return;
    }
  }
  
  const requestId = req.headers['x-request-id'] || 'unknown';

  // Check if Supabase client is initialized
  if (!supabase) {
    Logger.error('Supabase client not initialized', null, { requestId });
    return ApiResponse.internalError(
      res,
      'Database connection not configured. Please check environment variables.',
      new Error('Supabase client not initialized'),
      requestId
    );
  }

  if (req.method === 'GET') {
    try {
      Logger.info('Fetching all members', { requestId });
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('deactivated', false);
      if (error) {
        Logger.error('Supabase error fetching members', error, { requestId });
        throw error;
      }
      return ApiResponse.success(res, data || [], 'Members retrieved successfully');
    } catch (error) {
      Logger.error('Error fetching members', error, { requestId });
      return ApiResponse.error(res, error, requestId);
    }
  }
  
  if (req.method === 'PUT') {
    try {
      const { member_id, ...updateData } = req.body;

      if (!member_id) {
        return ApiResponse.badRequest(res, 'Missing required field: member_id', requestId);
      }

      // Validate update data with Zod
      const validation = validateWithSchema(updateMemberSchema, updateData);
      if (!validation.success) {
        return ApiResponse.validationError(res, validation.errors, 'Invalid member data', requestId);
      }

      // Clean the update data to only include allowed fields
      const cleanedData = cleanMemberObject(validation.data);

      Logger.info('Updating member', { requestId, member_id, fields: Object.keys(cleanedData) });

      const { data, error } = await supabase
        .from('members')
        .update(cleanedData)
        .eq('member_id', member_id)
        .select()
        .single();

      if (error) {
        Logger.error('Error updating member', error, { requestId, member_id });
        throw error;
      }

      return ApiResponse.success(res, data, 'Member updated successfully');
    } catch (error) {
      Logger.error('Error updating member', error, { requestId });
      return ApiResponse.error(res, error, requestId);
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Extract member_id from the URL path
      const member_id = req.url.split('/').pop();

      if (!member_id) {
        return ApiResponse.badRequest(res, 'Missing required field: member_id', requestId);
      }

      Logger.info('Deactivating member', { requestId, member_id });

      // Instead of deleting, set a deactivated flag
      const { error } = await supabase
        .from('members')
        .update({ deactivated: true })
        .eq('member_id', member_id);

      if (error) {
        Logger.error('Error deactivating member', error, { requestId, member_id });
        throw error;
      }

      return ApiResponse.success(res, { member_id }, 'Member deactivated successfully');
    } catch (error) {
      Logger.error('Error deactivating member', error, { requestId });
      return ApiResponse.error(res, error, requestId);
    }
  }
  
  if (req.method !== 'POST') {
    return ApiResponse.methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE'], requestId);
  }

  try {
    const { account_id, primary_member, secondary_member } = req.body;

    if (!account_id || !primary_member) {
      return ApiResponse.badRequest(res, 'Missing required fields: account_id and primary_member', requestId);
    }

    // Validate primary member data with Zod
    const primaryValidation = validateWithSchema(memberSchema, primary_member);
    if (!primaryValidation.success) {
      return ApiResponse.validationError(res, primaryValidation.errors, 'Invalid primary member data', requestId);
    }

    // Validate secondary member if provided
    if (secondary_member) {
      const secondaryValidation = validateWithSchema(memberSchema, secondary_member);
      if (!secondaryValidation.success) {
        return ApiResponse.validationError(res, secondaryValidation.errors, 'Invalid secondary member data', requestId);
      }
    }

    Logger.info('Creating new member(s)', {
      requestId,
      account_id,
      has_secondary: !!secondary_member
    });

    // Insert primary member
    const { data: primaryMemberData, error: primaryError } = await supabase
      .from('members')
      .insert([primaryValidation.data])
      .select()
      .single();

    if (primaryError) {
      Logger.error('Error inserting primary member', primaryError, { requestId, account_id });
      throw primaryError;
    }

    // If there's a secondary member, add them too
    if (secondary_member) {
      const secondaryValidation = validateWithSchema(memberSchema, secondary_member);
      const { error: secondaryError } = await supabase
        .from('members')
        .insert([secondaryValidation.data]);

      if (secondaryError) {
        Logger.error('Error inserting secondary member', secondaryError, { requestId, account_id });
        throw secondaryError;
      }
    }

    return ApiResponse.success(res, primaryMemberData, 'Member created successfully');
  } catch (error) {
    Logger.error('Error creating member', error, { requestId });
    return ApiResponse.error(res, error, requestId);
  }
} 