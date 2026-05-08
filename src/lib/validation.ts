import { randomUUID } from 'crypto';

/**
 * Input validation utilities for bypass codes and other user input
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate bypass code format
 * - Minimum 6 characters
 * - Maximum 50 characters
 * - Only alphanumeric characters (A-Z, 0-9)
 */
export function validateBypassCode(code: string): ValidationResult {
  if (!code || typeof code !== 'string') {
    return { isValid: false, error: 'Code is required' };
  }

  const trimmedCode = code.trim();

  if (trimmedCode.length < 6) {
    return { isValid: false, error: 'Code must be at least 6 characters' };
  }

  if (trimmedCode.length > 50) {
    return { isValid: false, error: 'Code must be 50 characters or less' };
  }

  // Only alphanumeric characters
  if (!/^[A-Z0-9]+$/i.test(trimmedCode)) {
    return { isValid: false, error: 'Code can only contain letters and numbers' };
  }

  return { isValid: true };
}

/**
 * Validate bypass code description
 * - Maximum 500 characters
 * - No HTML tags
 */
export function validateDescription(description: string | null | undefined): ValidationResult {
  if (!description) {
    return { isValid: true }; // Optional field
  }

  if (typeof description !== 'string') {
    return { isValid: false, error: 'Description must be a string' };
  }

  if (description.length > 500) {
    return { isValid: false, error: 'Description must be 500 characters or less' };
  }

  // Check for HTML tags (basic XSS prevention)
  if (/<[^>]*>/g.test(description)) {
    return { isValid: false, error: 'Description cannot contain HTML tags' };
  }

  return { isValid: true };
}

/**
 * Validate party size
 */
export function validatePartySize(partySize: number): ValidationResult {
  if (typeof partySize !== 'number' || isNaN(partySize)) {
    return { isValid: false, error: 'Party size must be a number' };
  }

  if (partySize < 1) {
    return { isValid: false, error: 'Party size must be at least 1' };
  }

  if (partySize > 100) {
    return { isValid: false, error: 'Party size must be 100 or less' };
  }

  return { isValid: true };
}

/**
 * Validate max uses
 */
export function validateMaxUses(maxUses: number | null | undefined, currentUses?: number): ValidationResult {
  if (maxUses === null || maxUses === undefined) {
    return { isValid: true }; // Optional field
  }

  if (typeof maxUses !== 'number' || isNaN(maxUses)) {
    return { isValid: false, error: 'Max uses must be a number' };
  }

  if (maxUses < 1) {
    return { isValid: false, error: 'Max uses must be at least 1' };
  }

  if (maxUses > 999999) {
    return { isValid: false, error: 'Max uses must be 999,999 or less' };
  }

  // Check against current uses if provided
  if (currentUses !== undefined && maxUses < currentUses) {
    return {
      isValid: false,
      error: `Max uses cannot be less than current uses (${currentUses})`
    };
  }

  return { isValid: true };
}

/**
 * Get client IP address from request.
 *
 * Only trusts the X-Forwarded-For header when TRUSTED_PROXY=true is set in the
 * environment, because clients can fabricate this header to bypass rate limiting.
 * Without that flag we use the socket address, which cannot be spoofed.
 */
export function getClientIP(req: any): string {
  if (process.env.TRUSTED_PROXY === 'true') {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : forwarded[0];
    }
    const realIp = req.headers['x-real-ip'];
    if (realIp) return typeof realIp === 'string' ? realIp : realIp[0];
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Generate a cryptographically random request ID for tracing.
 */
export function generateRequestId(): string {
  return `req_${randomUUID()}`;
}
