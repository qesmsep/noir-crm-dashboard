/**
 * WebAuthn configuration and utilities
 * For biometric authentication (Face ID, Touch ID, Windows Hello, etc.)
 */

import type { NextApiRequest } from 'next';
import { Logger } from './logger';

export const WEBAUTHN_CONFIG = {
  rpName: 'Noir Member Portal',
  rpID: process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost',
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  timeout: 60000, // 60 seconds
};

/**
 * Allowed rpID domains for WebAuthn
 * Add your production/staging domains here
 *
 * IMPORTANT: Update this list with your actual production domains
 */
const ALLOWED_RP_IDS = [
  'localhost',
  'noir-crm-dashboard.vercel.app',
  // Vercel preview deployments (if needed)
  // 'noir-crm-dashboard-git-*.vercel.app',
  // Add your custom domain here
  // 'yourdomain.com',
  // 'www.yourdomain.com',
];

/**
 * Derive WebAuthn configuration from request headers
 *
 * Security considerations:
 * - rpID is derived from the Host header and validated against an allowlist
 * - origin uses env var as source of truth to prevent x-forwarded-proto spoofing
 * - Falls back to localhost for local development
 *
 * @throws Error if rpID is not in allowlist
 */
export function getWebAuthnConfigFromRequest(req: NextApiRequest): {
  rpID: string;
  origin: string;
} {
  // Derive rpID from host header (needed for multi-domain support)
  const host = req.headers.host || 'localhost:3000';
  const rpID = host.split(':')[0]; // Remove port if present

  // Validate rpID against allowlist to prevent host header manipulation
  const isAllowed = ALLOWED_RP_IDS.includes(rpID) ||
    // Allow Vercel preview deployments: *.vercel.app
    (rpID.endsWith('.vercel.app') && rpID.startsWith('noir-crm-dashboard'));

  if (!isAllowed) {
    Logger.error('WebAuthn rpID not in allowlist', undefined, { rpID, host });
    throw new Error(`Invalid rpID: ${rpID}`);
  }

  // Use env var for origin (trusted source) to prevent x-forwarded-proto spoofing
  // In production on Vercel, NEXT_PUBLIC_APP_URL should be set to https://yourdomain.com
  let origin = WEBAUTHN_CONFIG.origin;

  // If env var not set and we're on Vercel, construct origin from validated rpID
  if (origin === 'http://localhost:3000' && rpID !== 'localhost') {
    origin = `https://${rpID}`;
    if (process.env.NODE_ENV === 'development') {
      Logger.debug('Constructed origin from rpID', { rpID, origin });
    }
  }

  if (process.env.NODE_ENV === 'development') {
    Logger.debug('WebAuthn config', { rpID, origin });
  }

  return { rpID, origin };
}

export function getWebAuthnRPID(): string {
  if (typeof window !== 'undefined') {
    // In browser, use current hostname
    return window.location.hostname;
  }
  return WEBAUTHN_CONFIG.rpID;
}

export function getWebAuthnOrigin(): string {
  if (typeof window !== 'undefined') {
    // In browser, use current origin
    return window.location.origin;
  }
  return WEBAUTHN_CONFIG.origin;
}

/**
 * Convert ArrayBuffer to base64url string
 */
export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Convert base64url string to ArrayBuffer
 */
export function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Check if browser supports WebAuthn
 */
export function isBiometricSupported(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.PublicKeyCredential !== undefined &&
    navigator.credentials !== undefined &&
    navigator.credentials.create !== undefined
  );
}

/**
 * Check if platform authenticator (Face ID/Touch ID) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch (error) {
    console.error('Error checking platform authenticator:', error);
    return false;
  }
}

/**
 * Get user-friendly device name based on platform
 */
export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device';

  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone/.test(userAgent)) return 'iPhone';
  if (/ipad/.test(userAgent)) return 'iPad';
  if (/mac/.test(userAgent)) return 'Mac';
  if (/android/.test(userAgent)) return 'Android';
  if (/windows/.test(userAgent)) return 'Windows PC';
  if (/linux/.test(userAgent)) return 'Linux';

  return 'This Device';
}
