import { createClient } from '@supabase/supabase-js';
import { ApiResponse } from '../../lib/api-response';
import { memberSchema, updateMemberSchema, validateWithSchema } from '../../lib/validations';
import { Logger } from '../../lib/logger';
import Stripe from 'stripe';
import { DateTime } from 'luxon';

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

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

const ALLOWED_MEMBER_FIELDS = [
  'account_id', 'first_name', 'last_name', 'email', 'phone', 'stripe_customer_id',
  'join_date', 'company', 'address', 'address_2', 'city', 'state', 'zip', 'country',
  'referral', 'membership', 'monthly_dues', 'photo', 'dob', 'auth_code', 'token', 'created_at',
  'member_type', 'member_id',
  // Subscription tracking fields
  'stripe_subscription_id', 'subscription_status', 'subscription_start_date',
  'subscription_cancel_at', 'subscription_canceled_at', 'next_renewal_date',
  'payment_method_type', 'payment_method_last4', 'payment_method_brand'
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
      const { member_id, phone } = req.query;

      // If phone is provided, search by phone number
      if (phone) {
        // Validate phone format to prevent SQL injection
        const phoneRegex = /^[\d\s\+\-\(\)]+$/;
        if (!phoneRegex.test(phone)) {
          Logger.warn('Invalid phone number format in search', { requestId });
          return ApiResponse.badRequest(res, 'Invalid phone number format', requestId);
        }

        // Normalize phone number for search
        const phoneDigits = phone.replace(/\D/g, '');

        // Validate digits length
        if (phoneDigits.length < 10 || phoneDigits.length > 15) {
          Logger.warn('Phone number length invalid', { requestId });
          return ApiResponse.badRequest(res, 'Phone number length invalid', requestId);
        }

        // Redact phone for logging (GDPR compliance)
        const redactedPhone = phone.replace(/\d(?=\d{4})/g, '*');
        Logger.info('Fetching member by phone', { requestId, phone: redactedPhone });

        const phoneVariants = [
          phone,
          phoneDigits.length === 10 ? '+1' + phoneDigits : '+' + phoneDigits,
          phoneDigits.length === 11 && phoneDigits.startsWith('1') ? '+' + phoneDigits : phoneDigits,
          phoneDigits.slice(-10),
          phoneDigits
        ];

        let memberData = null;
        for (const phoneVariant of phoneVariants) {
          const { data, error } = await supabase
            .from('members')
            .select('*')
            .eq('phone', phoneVariant)
            .eq('member_type', 'primary')
            .limit(1)
            .maybeSingle();

          if (data) {
            memberData = data;
            break;
          }
        }

        if (memberData) {
          return res.status(200).json({ members: [memberData] });
        } else {
          return res.status(200).json({ members: [] });
        }
      }

      // If member_id is provided, fetch single member
      if (member_id) {
        Logger.info('Fetching single member', { requestId, member_id });
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .eq('member_id', member_id)
          .single();
        if (error) {
          Logger.error('Supabase error fetching member', error, { requestId, member_id });
          throw error;
        }
        return ApiResponse.success(res, data, 'Member retrieved successfully');
      }

      // Otherwise fetch all members
      Logger.info('Fetching all members', { requestId });
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('status', 'active');
      if (error) {
        Logger.error('Supabase error fetching members', error, { requestId });
        throw error;
      }
      return ApiResponse.success(res, data || [], 'Members retrieved successfully');
    } catch (error) {
      Logger.error('Error fetching members', error, { requestId });
      return ApiResponse.internalError(
        res,
        'An error occurred while fetching members.',
        error,
        requestId
      );
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
      return ApiResponse.internalError(
        res,
        'An error occurred while updating the member.',
        error,
        requestId
      );
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

      // Instead of deleting, set status to inactive
      const { error } = await supabase
        .from('members')
        .update({ status: 'inactive' })
        .eq('member_id', member_id);

      if (error) {
        Logger.error('Error deactivating member', error, { requestId, member_id });
        throw error;
      }

      return ApiResponse.success(res, { member_id }, 'Member deactivated successfully');
    } catch (error) {
      Logger.error('Error deactivating member', error, { requestId });
      return ApiResponse.internalError(
        res,
        'An error occurred while deactivating the member.',
        error,
        requestId
      );
    }
  }
  
  if (req.method !== 'POST') {
    return ApiResponse.methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE'], requestId);
  }

  // CRITICAL: Authenticate and authorize admin access
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      Logger.warn('POST /api/members attempted without authentication', { requestId });
      return ApiResponse.unauthorized(res, 'Authentication required', requestId);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      Logger.warn('POST /api/members attempted with invalid token', { requestId, authError });
      return ApiResponse.unauthorized(res, 'Invalid authentication token', requestId);
    }

    // Verify admin role
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('access_level')
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .single();

    if (adminError || !admin) {
      Logger.warn('POST /api/members attempted by non-admin user', { requestId, user_id: user.id });
      return ApiResponse.forbidden(res, 'Admin access required', requestId);
    }

    Logger.info('Admin authenticated for member creation', {
      requestId,
      admin_user_id: user.id,
      access_level: admin.access_level
    });

    // Rate limiting: Check recent member creations by this admin
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentCreations, error: rateLimitError } = await supabase
      .from('members')
      .select('created_at, member_id')
      .gte('created_at', fifteenMinutesAgo)
      .eq('member_type', 'primary') // Only count primary members
      .order('created_at', { ascending: false });

    if (rateLimitError) {
      Logger.warn('Rate limit check failed, allowing request', rateLimitError, { requestId });
      // Non-fatal - if rate limit check fails, allow the request to proceed
    } else if (recentCreations && recentCreations.length >= 10) {
      Logger.warn('Rate limit exceeded for admin', null, {
        requestId,
        admin_user_id: user.id,
        recent_count: recentCreations.length
      });
      return ApiResponse.rateLimitExceeded(
        res,
        900, // Retry after 15 minutes
        requestId
      );
    }

    const { account_id, primary_member, secondary_member, payment_method_id, membership_plan_id } = req.body;

    if (!account_id || !primary_member) {
      return ApiResponse.badRequest(res, 'Missing required fields: account_id and primary_member', requestId);
    }

    // SECURITY: Never accept stripe_customer_id from user input - remove it
    if (primary_member.stripe_customer_id) {
      Logger.warn('Ignoring stripe_customer_id from request - will be generated server-side', { requestId });
      delete primary_member.stripe_customer_id;
    }
    if (secondary_member?.stripe_customer_id) {
      Logger.warn('Ignoring stripe_customer_id from secondary member request', { requestId });
      delete secondary_member.stripe_customer_id;
    }

    // CRITICAL: Email is required and must be valid if payment method is provided
    if (payment_method_id && (!primary_member.email || primary_member.email.trim() === '')) {
      return ApiResponse.badRequest(res, 'Valid email is required for payment processing', requestId);
    }

    // Validate primary member data with Zod
    const primaryValidation = validateWithSchema(memberSchema, primary_member);
    if (!primaryValidation.success) {
      return ApiResponse.validationError(res, primaryValidation.errors, 'Invalid primary member data', requestId);
    }

    // Validate secondary member if provided and store result
    let secondaryValidationData = null;
    if (secondary_member) {
      const secondaryValidation = validateWithSchema(memberSchema, secondary_member);
      if (!secondaryValidation.success) {
        return ApiResponse.validationError(res, secondaryValidation.errors, 'Invalid secondary member data', requestId);
      }
      secondaryValidationData = secondaryValidation.data; // Store validated data
    }

    // Check for duplicate account_id
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('account_id')
      .eq('account_id', account_id)
      .maybeSingle();

    if (existingAccount) {
      return ApiResponse.conflict(res, 'Account already exists with this ID', requestId);
    }

    // Check for duplicate member_id
    const { data: existingMember } = await supabase
      .from('members')
      .select('member_id')
      .eq('member_id', primary_member.member_id)
      .maybeSingle();

    if (existingMember) {
      return ApiResponse.conflict(res, 'Member already exists with this ID', requestId);
    }

    // Check for duplicate email or phone
    const { data: duplicateMember } = await supabase
      .from('members')
      .select('member_id, email, phone')
      .or(`email.eq.${primary_member.email},phone.eq.${primary_member.phone}`)
      .limit(1)
      .maybeSingle();

    if (duplicateMember) {
      const duplicateField = duplicateMember.email === primary_member.email ? 'email' : 'phone';
      return ApiResponse.conflict(
        res,
        `A member with this ${duplicateField} already exists`,
        requestId
      );
    }

    Logger.info('Creating new member(s) via admin', {
      requestId,
      account_id,
      has_secondary: !!secondary_member,
      has_payment_method: !!payment_method_id
    });

    // If payment_method_id is provided, create Stripe customer and subscription
    let stripeCustomerId = null;
    let stripeCustomerCreated = false;
    let paymentMethodType = null;
    let paymentMethodLast4 = null;
    let paymentMethodBrand = null;

    if (payment_method_id) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: primary_member.email,
        name: `${primary_member.first_name} ${primary_member.last_name}`,
        phone: primary_member.phone,
        payment_method: payment_method_id,
        invoice_settings: {
          default_payment_method: payment_method_id,
        },
        metadata: {
          account_id: account_id,
          member_id: primary_member.member_id,
        },
      });

      stripeCustomerId = customer.id;
      stripeCustomerCreated = true;

      // Get payment method details - MUST succeed for valid payment processing
      const pm = await stripe.paymentMethods.retrieve(payment_method_id);
      if (pm.card) {
        paymentMethodType = 'card';
        paymentMethodLast4 = pm.card.last4;
        paymentMethodBrand = pm.card.brand;
      } else if (pm.us_bank_account) {
        paymentMethodType = 'us_bank_account';
        paymentMethodLast4 = pm.us_bank_account.last4;
        paymentMethodBrand = pm.us_bank_account.bank_name || null;
      } else {
        Logger.error('Unsupported payment method type', null, {
          requestId,
          payment_method_type: pm.type
        });
        throw new Error(`Unsupported payment method type: ${pm.type}`);
      }

      Logger.info('Retrieved payment method details', {
        requestId,
        payment_method_type: paymentMethodType
      });

      Logger.info('Created Stripe customer', {
        requestId,
        customer_id: stripeCustomerId,
        payment_method_type: paymentMethodType
      });
    }

    // Get membership plan details
    let planDetails = null;
    if (membership_plan_id) {
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', membership_plan_id)
        .single();
      planDetails = plan;
    }

    const basePriceAmount = planDetails?.monthly_price || primary_member.monthly_dues || 0;
    const billingInterval = planDetails?.interval || 'month';
    const additionalMemberFee = planDetails?.additional_member_fee || 25;
    const administrativeFee = planDetails?.administrative_fee || 0;

    // Calculate next billing date
    const CHICAGO_TZ = 'America/Chicago';
    const startDateTime = DateTime.now().setZone(CHICAGO_TZ).startOf('day');
    const nextBillingDateTime = billingInterval === 'year'
      ? startDateTime.plus({ years: 1 })
      : startDateTime.plus({ months: 1 });

    const startDate = startDateTime.toISO();
    const nextBillingDate = nextBillingDateTime.toISO();

    const additionalMemberCount = secondary_member ? 1 : 0;
    const feeMultiplier = billingInterval === 'year' ? 12 : 1;
    const monthlyDues = basePriceAmount + (additionalMemberCount * additionalMemberFee * feeMultiplier);

    // Track created resources for rollback on failure
    let accountCreated = false;
    let primaryMemberCreated = false;
    let secondaryMemberCreated = false;
    let ledgerEntriesCreated = false;
    let createdAccountId = null;
    let createdPrimaryMemberId = null;
    let createdSecondaryMemberId = null;

    try {
      // Create account
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert({
          account_id: account_id,
          stripe_customer_id: stripeCustomerId,
          subscription_status: 'active',
          subscription_start_date: startDate,
          next_billing_date: nextBillingDate,
          monthly_dues: monthlyDues,
          membership_plan_id: membership_plan_id,
          payment_method_type: paymentMethodType,
          payment_method_last4: paymentMethodLast4,
          payment_method_brand: paymentMethodBrand,
          administrative_fee: administrativeFee,
          additional_member_fee: additionalMemberFee
        })
        .select()
        .single();

      if (accountError) {
        Logger.error('Error creating account', accountError, { requestId, account_id });
        throw accountError;
      }

      accountCreated = true;
      createdAccountId = account.account_id;

      // Update primary member with stripe_customer_id
      if (!primaryValidation.data) {
        throw new Error('Primary member validation failed unexpectedly');
      }
      primaryValidation.data.stripe_customer_id = stripeCustomerId;

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

      primaryMemberCreated = true;
      createdPrimaryMemberId = primaryMemberData.member_id;

      // If there's a secondary member, add them too
      if (secondaryValidationData) {
        secondaryValidationData.stripe_customer_id = stripeCustomerId;

        const { data: secondaryMemberData, error: secondaryError } = await supabase
          .from('members')
          .insert([secondaryValidationData])
          .select()
          .single();

        if (secondaryError) {
          Logger.error('Error inserting secondary member', secondaryError, { requestId, account_id });
          throw secondaryError;
        }

        secondaryMemberCreated = true;
        createdSecondaryMemberId = secondaryMemberData.member_id;
      }

      // Create initial ledger entries if payment was processed
      if (payment_method_id) {
        const ledgerEntries = [];

        // Payment entry (base price + additional member fees)
        ledgerEntries.push({
          account_id: account_id,
          member_id: primary_member.member_id,
          type: 'payment',
          amount: monthlyDues.toFixed(2),
          date: startDate,
          note: `Initial ${primary_member.membership} membership payment (admin created)`,
          status: paymentMethodType === 'card' ? 'cleared' : 'pending'
        });

        // Admin fee charge
        if (administrativeFee > 0) {
          ledgerEntries.push({
            account_id: account_id,
            member_id: primary_member.member_id,
            type: 'charge',
            amount: (-administrativeFee).toFixed(2),
            date: startDate,
            note: 'Membership administration fee',
            status: 'cleared'
          });
        }

        // Additional member fee charge
        if (additionalMemberCount > 0 && additionalMemberFee > 0) {
          ledgerEntries.push({
            account_id: account_id,
            member_id: primary_member.member_id,
            type: 'charge',
            amount: (-(additionalMemberCount * additionalMemberFee * feeMultiplier)).toFixed(2),
            date: startDate,
            note: `Additional members fee (${additionalMemberCount} member${additionalMemberCount > 1 ? 's' : ''})`,
            status: 'cleared'
          });
        }

        const { error: ledgerError } = await supabase
          .from('ledger')
          .insert(ledgerEntries);

        if (ledgerError) {
          Logger.error('Error creating ledger entries - rolling back transaction', ledgerError, {
            requestId,
            account_id
          });
          throw ledgerError; // FATAL - triggers rollback
        }

        ledgerEntriesCreated = true;
      }

      // Success - return the created member
      return ApiResponse.success(res, primaryMemberData, 'Member created successfully');

    } catch (innerError) {
      // ROLLBACK: Clean up created resources
      Logger.error('Error during member creation, initiating rollback', innerError, {
        requestId,
        account_id,
        accountCreated,
        primaryMemberCreated
      });

      // Rollback ALL resources in parallel to ensure complete cleanup even if some fail
      const rollbackPromises = [];

      // Rollback ledger entries (they reference account_id)
      if (ledgerEntriesCreated && createdAccountId) {
        rollbackPromises.push(
          supabase
            .from('ledger')
            .delete()
            .eq('account_id', createdAccountId)
            .then(({ error }) => ({
              type: 'ledger',
              success: !error,
              error,
              context: { account_id: createdAccountId }
            }))
        );
      }

      // Rollback secondary member
      if (secondaryMemberCreated && createdSecondaryMemberId) {
        rollbackPromises.push(
          supabase
            .from('members')
            .delete()
            .eq('member_id', createdSecondaryMemberId)
            .then(({ error }) => ({
              type: 'secondary_member',
              success: !error,
              error,
              context: { member_id: createdSecondaryMemberId }
            }))
        );
      }

      // Rollback primary member
      if (primaryMemberCreated && createdPrimaryMemberId) {
        rollbackPromises.push(
          supabase
            .from('members')
            .delete()
            .eq('member_id', createdPrimaryMemberId)
            .then(({ error }) => ({
              type: 'primary_member',
              success: !error,
              error,
              context: { member_id: createdPrimaryMemberId }
            }))
        );
      }

      // Rollback account
      if (accountCreated && createdAccountId) {
        rollbackPromises.push(
          supabase
            .from('accounts')
            .delete()
            .eq('account_id', createdAccountId)
            .then(({ error }) => ({
              type: 'account',
              success: !error,
              error,
              context: { account_id: createdAccountId }
            }))
        );
      }

      // Rollback Stripe customer
      if (stripeCustomerCreated && stripeCustomerId) {
        rollbackPromises.push(
          stripe.customers.del(stripeCustomerId)
            .then(() => ({
              type: 'stripe_customer',
              success: true,
              error: null,
              context: { customer_id: stripeCustomerId }
            }))
            .catch((error) => ({
              type: 'stripe_customer',
              success: false,
              error,
              context: { customer_id: stripeCustomerId }
            }))
        );
      }

      // Wait for ALL rollbacks to complete (even if some fail)
      const rollbackResults = await Promise.allSettled(rollbackPromises);

      // Log results
      rollbackResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { type, success, error, context } = result.value;
          if (success) {
            Logger.info(`Rolled back ${type}`, { requestId, ...context });
          } else {
            Logger.error(`Failed to rollback ${type} - MANUAL CLEANUP REQUIRED`, error, {
              requestId,
              ...context,
              alert: 'CRITICAL - Orphaned resource'
            });
          }
        } else {
          // Promise itself rejected (shouldn't happen with our error handling)
          Logger.error('Rollback promise rejected unexpectedly', result.reason, {
            requestId,
            alert: 'CRITICAL - Rollback failure'
          });
        }
      });

      // Re-throw to be caught by outer catch
      throw innerError;
    }
  } catch (error) {
    Logger.error('Error creating member', error, { requestId });
    // Return generic error message to prevent information leakage
    return ApiResponse.internalError(
      res,
      'An error occurred while creating the member. Please try again.',
      error,
      requestId
    );
  }
} 