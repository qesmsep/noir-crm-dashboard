/**
 * Zod validation schemas for API inputs
 * Centralized validation for consistency and type safety
 */

import { z } from 'zod';

// ========================================
// Member Validation Schemas
// ========================================

export const memberSchema = z.object({
  // Required identity fields
  first_name: z.string().min(1, 'First name is required').max(50).trim(),
  last_name: z.string().min(1, 'Last name is required').max(50).trim(),
  email: z.string().email('Invalid email address').toLowerCase().optional(),
  phone: z.string()
    .min(10, 'Phone number too short')
    .max(20, 'Phone number too long')
    .regex(/^[\d\s\+\-\(\)]+$/, 'Phone number can only contain digits, spaces, +, -, ( )')
    .transform((val) => {
      // Remove all non-digit characters except leading +
      const cleaned = val.replace(/[^\d+]/g, '');
      // If starts with +, keep it; otherwise prepend +1 for US numbers if exactly 10 digits
      if (cleaned.startsWith('+')) return cleaned;
      return cleaned.length === 10 ? `+1${cleaned}` : cleaned.length === 11 && cleaned.startsWith('1') ? `+${cleaned}` : `+${cleaned}`;
    }),

  // PII - Sensitive
  dob: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine((date) => {
      // Parse date components directly to avoid timezone issues
      const [year, month, day] = date.split('-').map(Number);
      const birthDate = new Date(year, month - 1, day); // month is 0-indexed
      const today = new Date();

      // Set both to midnight for fair comparison
      today.setHours(0, 0, 0, 0);
      birthDate.setHours(0, 0, 0, 0);

      // Validate date is valid (handles leap years, invalid dates like Feb 30)
      if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) {
        return false; // Invalid date
      }

      // Calculate age properly
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();

      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
      }

      return age >= 18 && age <= 120;
    }, 'Member must be at least 18 years old and date must be valid')
    .optional()
    .or(z.literal('')), // Allow empty string

  // Address
  address: z.string().max(200).trim().optional(),
  address_2: z.string().max(200).trim().optional(),
  city: z.string().max(100).trim().optional(),
  state: z.string().max(2).toUpperCase().optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format').optional(),
  country: z.string().max(100).trim().optional(),

  // Membership details
  membership: z.string().max(100).optional(),
  member_type: z.enum(['primary', 'secondary']).optional(),
  monthly_dues: z.number().nonnegative().optional(),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),

  // IDs (must be valid UUIDs)
  member_id: z.string().uuid('Invalid member ID').optional(),
  account_id: z.string().uuid('Invalid account ID').optional(),

  // SECURITY: stripe_customer_id should NEVER be accepted from user input
  // It will be generated server-side only
  // stripe_customer_id: REMOVED FROM SCHEMA

  // Metadata
  company: z.string().max(200).trim().optional(),
  referral: z.string().max(200).trim().optional(),
  photo: z.string().url('Invalid photo URL').optional().or(z.literal('')),

  // System fields
  status: z.enum(['active', 'inactive', 'suspended']).default('active').optional(),
  created_at: z.string().datetime().optional(),

  // Notes
  notes: z.string().max(500).optional(),
}).strict(); // Reject unknown fields to prevent injection

// Create update schema manually to avoid .partial() issue with refinements in Zod v4
export const updateMemberSchema = z.object({
  // Identity fields
  first_name: z.string().min(1, 'First name is required').max(50).trim().optional(),
  last_name: z.string().min(1, 'Last name is required').max(50).trim().optional(),
  email: z.string().email('Invalid email address').toLowerCase().optional(),
  phone: z.string()
    .min(10, 'Phone number too short')
    .max(20, 'Phone number too long')
    .regex(/^[\d\s\+\-\(\)]+$/, 'Phone number can only contain digits, spaces, +, -, ( )')
    .transform((val) => {
      const cleaned = val.replace(/[^\d+]/g, '');
      if (cleaned.startsWith('+')) return cleaned;
      return cleaned.length === 10 ? `+1${cleaned}` : cleaned.length === 11 && cleaned.startsWith('1') ? `+${cleaned}` : `+${cleaned}`;
    })
    .optional(),

  // PII - Sensitive (with same validation as memberSchema)
  dob: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine((date) => {
      // Parse date components directly to avoid timezone issues
      const [year, month, day] = date.split('-').map(Number);
      const birthDate = new Date(year, month - 1, day);
      const today = new Date();

      today.setHours(0, 0, 0, 0);
      birthDate.setHours(0, 0, 0, 0);

      // Validate date is valid (handles leap years, invalid dates like Feb 30)
      if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) {
        return false;
      }

      // Calculate age
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();

      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
      }

      return age >= 18 && age <= 120;
    }, 'Member must be at least 18 years old and date must be valid')
    .optional(),

  // Address
  address: z.string().max(200).trim().optional(),
  address_2: z.string().max(200).trim().optional(),
  city: z.string().max(100).trim().optional(),
  state: z.string().max(2).toUpperCase().optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').optional(),
  country: z.string().max(100).trim().optional(),

  // Membership
  membership: z.string().max(100).optional(),
  monthly_dues: z.number().nonnegative().optional(),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Metadata
  company: z.string().max(200).trim().optional(),
  referral: z.string().max(200).trim().optional(),
  photo: z.string().url('Invalid photo URL').optional().or(z.literal('')),

  // System fields
  status: z.enum(['active', 'inactive', 'suspended']).optional(),

  // Notes
  notes: z.string().max(500).optional(),
}).strict();

export type MemberInput = z.infer<typeof memberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// ========================================
// Reservation Validation Schemas
// ========================================

export const reservationSchema = z.object({
  member_id: z.string().uuid().optional(),
  table_id: z.string().uuid().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  party_size: z.number().int().min(1).max(20),
  event_type: z.string().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['confirmed', 'pending', 'cancelled', 'completed']).optional(),
}).refine(
  (data) => new Date(data.end_time) > new Date(data.start_time),
  {
    message: 'End time must be after start time',
    path: ['end_time'],
  }
);

// Create update schema manually to avoid .partial() issue with refinements in Zod v4
export const updateReservationSchema = z.object({
  member_id: z.string().uuid().optional(),
  table_id: z.string().uuid().optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  party_size: z.number().int().min(1).max(20).optional(),
  event_type: z.string().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['confirmed', 'pending', 'cancelled', 'completed']).optional(),
});

export type ReservationInput = z.infer<typeof reservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;

// ========================================
// Campaign Validation Schemas
// ========================================

export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100),
  trigger_type: z.enum([
    'reservation_created',
    'reservation_reminder',
    'recurring',
    'reservation_range',
    'private_event',
    'all_members',
  ]),
  active: z.boolean().default(true),
  description: z.string().max(500).optional(),
  recurring_schedule: z.object({
    type: z.enum(['daily', 'weekly', 'monthly', 'specific_weekdays']),
    weekdays: z.array(z.number().min(0).max(6)).optional(),
    day_of_month: z.number().min(1).max(31).optional(),
  }).optional(),
  recurring_start_date: z.string().date().optional(),
  recurring_end_date: z.string().date().optional(),
});

export const campaignMessageSchema = z.object({
  campaign_id: z.string().uuid(),
  message_template: z.string().min(1, 'Message template is required'),
  recipient_type: z.enum([
    'member_only',
    'guest_only',
    'both_members',
    'specific_number',
    'reservation_phones',
    'private_event_rsvps',
    'all_primary_members',
  ]),
  send_time_offset: z.number().int().optional(),
  send_time_offset_unit: z.enum(['minutes', 'hours', 'days']).optional(),
  active: z.boolean().default(true),
});

export type CampaignInput = z.infer<typeof campaignSchema>;
export type CampaignMessageInput = z.infer<typeof campaignMessageSchema>;

// ========================================
// Private Event Validation Schemas
// ========================================

export const privateEventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(100),
  event_date: z.string().date(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  capacity: z.number().int().positive().optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['upcoming', 'in_progress', 'completed', 'cancelled']).optional(),
});

export const rsvpSchema = z.object({
  event_id: z.string().uuid(),
  member_id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional(),
  party_size: z.number().int().min(1).max(20),
  status: z.enum(['confirmed', 'pending', 'declined']).default('pending'),
});

export type PrivateEventInput = z.infer<typeof privateEventSchema>;
export type RSVPInput = z.infer<typeof rsvpSchema>;

// ========================================
// Ledger Validation Schemas
// ========================================

export const ledgerEntrySchema = z.object({
  member_id: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['charge', 'credit', 'payment']),
  description: z.string().max(200).optional(),
  date: z.string().date(),
});

export type LedgerEntryInput = z.infer<typeof ledgerEntrySchema>;

// ========================================
// Admin Validation Schemas
// ========================================

export const createAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional(),
  access_level: z.enum(['admin', 'super_admin']).default('admin'),
});

export const updateAdminSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email('Invalid email address').optional(),
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  access_level: z.enum(['admin', 'super_admin']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;

// ========================================
// Query Parameter Schemas
// ========================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  start: z.string().date(),
  end: z.string().date(),
}).refine(
  (data) => new Date(data.end) >= new Date(data.start),
  {
    message: 'End date must be after or equal to start date',
    path: ['end'],
  }
);

export type PaginationParams = z.infer<typeof paginationSchema>;
export type DateRangeParams = z.infer<typeof dateRangeSchema>;

// ========================================
// Validation Helper Functions
// ========================================

/**
 * Validates data against a Zod schema and returns formatted errors
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format Zod errors into a more user-friendly structure
  const errors: Record<string, string> = {};
  result.error.issues.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });

  return { success: false, errors };
}

/**
 * Middleware-style validator that throws on validation failure
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
