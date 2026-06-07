// Types for hours and scheduling functionality

export interface TimeRange {
  start: string; // HH:MM format
  end: string;   // HH:MM format
}

export interface DayHours {
  open: string;  // HH:MM format
  close: string; // HH:MM format
}

export interface WeeklyHours {
  sunday: DayHours | null;
  monday: DayHours | null;
  tuesday: DayHours | null;
  wednesday: DayHours | null;
  thursday: DayHours | null;
  friday: DayHours | null;
  saturday: DayHours | null;
}

export interface BaseHour {
  enabled: boolean;
  timeRanges: TimeRange[];
}

export interface LocationHours {
  weeklyHours: WeeklyHours | null;
  weeklyHoursWeekStart: string | null; // YYYY-MM-DD format
  baseHours: Array<{
    day_of_week: number;
    time_ranges: TimeRange[];
    type: string;
    location_id?: string;
  }>;
  timezone: string;
}

export interface ExceptionalOpen {
  id: number;
  date: string;
  time_ranges: TimeRange[];
  label?: string;
}

export interface ExceptionalClosure {
  id: number;
  date: string;
  reason?: string;
  full_day?: boolean;
  time_ranges?: TimeRange[];
  sms_notification?: string;
}

// Constants
export const DAYS_IN_WEEK = 7;
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export type WeekdayName = typeof WEEKDAYS[number];