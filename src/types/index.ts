/**
 * Shared TypeScript types for the application
 * Central location for all type definitions
 */

// ========================================
// User & Authentication Types
// ========================================

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'admin' | 'super_admin' | 'member';
  created_at: string;
  updated_at: string;
}

export interface Admin extends User {
  access_level: 'admin' | 'super_admin';
  status: 'active' | 'inactive';
  last_login_at?: string;
}

// ========================================
// Member Types
// ========================================

export interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone: string;
  membership?: string;
  status?: string;
  balance?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface MemberAttribute {
  attribute_type: string;
  attribute_value: string;
}

// ========================================
// Reservation Types
// ========================================

export interface Reservation {
  id: string;
  member_id?: string;
  table_id?: string;
  start_time: string;
  end_time: string;
  party_size: number;
  event_type?: string;
  notes?: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  created_at: string;
  updated_at?: string;
}

export interface Table {
  id: string;
  name: string;
  capacity: number;
  location?: string;
  status: 'available' | 'occupied' | 'reserved';
}

// ========================================
// Campaign Types
// ========================================

export type CampaignTriggerType =
  | 'reservation_created'
  | 'reservation_reminder'
  | 'recurring'
  | 'reservation_range'
  | 'private_event'
  | 'all_members';

export type CampaignRecipientType =
  | 'member_only'
  | 'guest_only'
  | 'both_members'
  | 'specific_number'
  | 'reservation_phones'
  | 'private_event_rsvps'
  | 'all_primary_members';

export interface Campaign {
  id: string;
  name: string;
  trigger_type: CampaignTriggerType;
  active: boolean;
  description?: string;
  recurring_schedule?: RecurringSchedule;
  recurring_start_date?: string;
  recurring_end_date?: string;
  created_at: string;
  updated_at?: string;
}

export interface RecurringSchedule {
  type: 'daily' | 'weekly' | 'monthly' | 'specific_weekdays';
  weekdays?: number[];
  day_of_month?: number;
}

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  message_template: string;
  recipient_type: CampaignRecipientType;
  send_time_offset?: number;
  send_time_offset_unit?: 'minutes' | 'hours' | 'days';
  active: boolean;
  created_at: string;
}

// ========================================
// Private Event Types
// ========================================

export interface PrivateEvent {
  id: string;
  name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  capacity?: number;
  description?: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at?: string;
}

export interface RSVP {
  id: string;
  event_id: string;
  member_id?: string;
  name: string;
  email?: string;
  phone?: string;
  party_size: number;
  status: 'confirmed' | 'pending' | 'declined';
  created_at: string;
}

// ========================================
// Ledger & Payment Types
// ========================================

export interface LedgerEntry {
  id: string;
  member_id: string;
  amount: number;
  type: 'charge' | 'credit' | 'payment';
  description?: string;
  date: string;
  created_at: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  metadata?: Record<string, any>;
}

// ========================================
// Settings Types
// ========================================

export interface AppSettings {
  hold_fee_enabled: boolean;
  hold_fee_amount: number;
  booking_window_start?: string;
  booking_window_end?: string;
  timezone: string;
}

// ========================================
// API Response Types
// ========================================

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
    requestId?: string;
  };
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// ========================================
// Utility Types
// ========================================

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type ID = string;

export type Timestamp = string;

export type DateString = string;

// ========================================
// Form Types
// ========================================

export interface FormErrors {
  [key: string]: string | undefined;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// ========================================
// Pagination Types
// ========================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ========================================
// Filter Types
// ========================================

export interface DateRangeFilter {
  start: DateString;
  end: DateString;
}

export interface SearchFilters {
  query?: string;
  dateRange?: DateRangeFilter;
  status?: string;
  [key: string]: any;
}
