/**
 * Zod validation schemas for API inputs
 * Centralized validation for consistency and type safety
 */

import { z } from 'zod';

// ========================================
// Member Validation Schemas
// ========================================

export const memberSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  membership: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const updateMemberSchema = memberSchema.partial();

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

export const updateReservationSchema = reservationSchema.partial();

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
