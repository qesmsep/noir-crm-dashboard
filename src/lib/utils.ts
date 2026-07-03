import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx and tailwind-merge for optimal class handling
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a table number for display as a zero-padded, minimum-2-digit label
 * (e.g. 1 -> "01", 12 -> "12"). Centralizes the padding convention used across
 * the calendar, table pickers, and tables admin so it isn't repeated inline.
 */
export function formatTableNumber(tableNumber: number | string | null | undefined): string {
  if (tableNumber === null || tableNumber === undefined || tableNumber === '') {
    return 'N/A';
  }
  return String(tableNumber).padStart(2, '0');
}

/**
 * Get current date in Kansas City timezone (America/Chicago) as YYYY-MM-DD
 * Avoids timezone conversion issues with toISOString()
 */
export function getTodayLocalDate(): string {
  // Use America/Chicago timezone to ensure consistent dates
  const now = new Date();
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const year = chicagoDate.getFullYear();
  const month = String(chicagoDate.getMonth() + 1).padStart(2, '0');
  const day = String(chicagoDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
