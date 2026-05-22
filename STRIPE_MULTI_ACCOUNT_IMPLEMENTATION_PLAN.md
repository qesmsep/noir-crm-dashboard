# Stripe Multi-Account Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for adding encrypted, per-location Stripe account management to the Noir CRM Dashboard. The system will support:

1. **One global Stripe account** for membership payments (dues, onboarding, billing)
2. **Per-location Stripe accounts** for reservation holds/fees (NoirKC, RooftopKC)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema Changes](#database-schema-changes)
3. [Security Implementation](#security-implementation)
4. [Payment Routing Strategy](#payment-routing-strategy)
5. [UI/UX Design](#uiux-design)
6. [Files to Modify](#files-to-modify)
7. [Implementation Phases](#implementation-phases)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Checklist](#deployment-checklist)

---

## Architecture Overview

### Current State
- Single Stripe account (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
- All payments (memberships + reservations) use this account
- API keys stored in environment variables only

### Target State
- **Membership Account**: Global Stripe account for all member dues/billing
- **Location Accounts**: Per-location Stripe accounts for reservation payments
- API keys encrypted and stored in database
- Configurable via Admin UI (no code deployments needed)
- Automatic payment routing based on context

---

## Database Schema Changes

### Option: Use Existing `locations` Table + `system_settings`

**Rationale:** Avoid creating new tables; use existing infrastructure

#### Migration 1: Add Stripe Columns to `locations`

**File:** `supabase/migrations/20260519000000_add_stripe_to_locations.sql`

```sql
-- ========================================
-- Migration: Add Encrypted Stripe Account to Locations
-- Created: 2026-05-19
-- Description: Adds encrypted Stripe account credentials to locations table
--
-- Tables Affected: locations
-- Dependencies: pgcrypto extension (already enabled)
-- Breaking Changes: NO - additive only
-- ========================================

-- ========================================
-- STEP 1: ADD COLUMNS
-- ========================================

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_secret_key_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS stripe_account_type TEXT DEFAULT 'standard' CHECK (stripe_account_type IN ('standard', 'express', 'custom')),
  ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_test_mode BOOLEAN DEFAULT false;

-- ========================================
-- STEP 2: COMMENTS
-- ========================================

COMMENT ON COLUMN public.locations.stripe_publishable_key IS
'Stripe publishable key (pk_live_xxx or pk_test_xxx) - safe to expose to frontend';

COMMENT ON COLUMN public.locations.stripe_secret_key_encrypted IS
'Encrypted Stripe secret key (sk_live_xxx or sk_test_xxx) - encrypted using pgcrypto with AES-256-GCM. Only decryptable via service role with ENCRYPTION_KEY.';

COMMENT ON COLUMN public.locations.stripe_webhook_secret_encrypted IS
'Encrypted Stripe webhook signing secret (whsec_xxx) - encrypted using pgcrypto';

COMMENT ON COLUMN public.locations.stripe_account_type IS
'Stripe account type: standard (default), express, or custom';

COMMENT ON COLUMN public.locations.stripe_test_mode IS
'Whether this location uses Stripe test mode keys (true) or live mode (false)';

-- ========================================
-- STEP 3: RLS POLICIES (RESTRICT ACCESS)
-- ========================================

-- Note: Existing RLS policies allow:
--   - Public read for active locations (SELECT on status = 'active')
--   - Service role full access
--   - Admins full access
--   - Members view access

-- To prevent exposure of encrypted blobs, create policy to exclude sensitive columns
-- from public/member SELECT queries

-- Drop existing public read policy and recreate with column exclusions
DROP POLICY IF EXISTS "Allow public read access to active locations" ON public.locations;

CREATE POLICY "Allow public read access to active locations (excluding sensitive data)"
ON public.locations
FOR SELECT
USING (status = 'active')
WITH CHECK (true);

-- Note: This still allows reading encrypted_columns, but they're encrypted blobs (useless without key)
-- For extra security, create views for public access that exclude encrypted columns

-- ========================================
-- STEP 4: CREATE PUBLIC VIEW (OPTIONAL)
-- ========================================

CREATE OR REPLACE VIEW public.locations_public AS
SELECT
  id,
  name,
  slug,
  timezone,
  address,
  cover_enabled,
  cover_price,
  status,
  created_at,
  updated_at,
  minaka_ical_url,
  booking_start_date,
  booking_end_date,
  weekly_hours,
  default_reservation_duration_hours,
  admin_notification_phone,
  stripe_publishable_key,  -- Safe to expose
  stripe_test_mode         -- Safe to expose
FROM public.locations;

-- Grant read access to public view
GRANT SELECT ON public.locations_public TO anon;
GRANT SELECT ON public.locations_public TO authenticated;

-- ========================================
-- STEP 5: VERIFICATION
-- ========================================

SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'locations'
  AND column_name LIKE 'stripe%'
ORDER BY ordinal_position;
```

#### Migration 2: Add Membership Stripe Account to `system_settings`

**File:** `supabase/migrations/20260519000001_add_membership_stripe_account.sql`

```sql
-- ========================================
-- Migration: Add Membership Stripe Account Settings
-- Created: 2026-05-19
-- Description: Adds encrypted Stripe credentials for membership payment processing
--
-- Tables Affected: system_settings
-- Dependencies: Migration 20260519000000
-- Breaking Changes: NO
-- ========================================

-- ========================================
-- STEP 1: INSERT SETTINGS
-- ========================================

INSERT INTO public.system_settings (key, value, description)
VALUES
  (
    'stripe_membership_account',
    '{
      "publishable_key": "",
      "secret_key_encrypted": "",
      "webhook_secret_encrypted": "",
      "account_type": "standard",
      "test_mode": false,
      "connected_at": null
    }'::jsonb,
    'Encrypted Stripe account credentials for membership payments (onboarding, dues, billing)'
  )
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- STEP 2: COMMENTS
-- ========================================

COMMENT ON TABLE public.system_settings IS
'System-wide configuration settings. Sensitive values (e.g., Stripe keys) stored encrypted.';

-- ========================================
-- STEP 3: VERIFICATION
-- ========================================

SELECT key, description, created_at
FROM public.system_settings
WHERE key = 'stripe_membership_account';
```

#### Rollback Scripts

**File:** `supabase/migrations/20260519000000_add_stripe_to_locations_ROLLBACK.sql`

```sql
-- Rollback for 20260519000000_add_stripe_to_locations.sql

-- Drop public view
DROP VIEW IF EXISTS public.locations_public;

-- Restore original RLS policy
DROP POLICY IF EXISTS "Allow public read access to active locations (excluding sensitive data)" ON public.locations;

CREATE POLICY "Allow public read access to active locations"
ON public.locations
FOR SELECT
USING (status = 'active');

-- Remove columns
ALTER TABLE public.locations
  DROP COLUMN IF EXISTS stripe_publishable_key,
  DROP COLUMN IF EXISTS stripe_secret_key_encrypted,
  DROP COLUMN IF EXISTS stripe_webhook_secret_encrypted,
  DROP COLUMN IF EXISTS stripe_account_type,
  DROP COLUMN IF EXISTS stripe_connected_at,
  DROP COLUMN IF EXISTS stripe_test_mode;
```

**File:** `supabase/migrations/20260519000001_add_membership_stripe_account_ROLLBACK.sql`

```sql
-- Rollback for 20260519000001_add_membership_stripe_account.sql

DELETE FROM public.system_settings
WHERE key = 'stripe_membership_account';
```

---

## Security Implementation

### Encryption Strategy: Server-Side AES-256-GCM

**Why not use Supabase Vault/pgsodium?**
- `pgsodium` extension not enabled (would require Supabase team approval)
- `pgcrypto` already available and sufficient
- Server-side encryption with Node.js crypto module provides better control

### Encryption Module

**File:** `src/lib/encryption.ts`

```typescript
import crypto from 'crypto';

// Master encryption key from environment variable (32 bytes)
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES-GCM requires 16-byte IV
const AUTH_TAG_LENGTH = 16; // GCM authentication tag length

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns: base64-encoded string in format: iv:authTag:encrypted
 */
export function encrypt(plaintext: string): string {
  if (!plaintext || plaintext.trim() === '') {
    throw new Error('Cannot encrypt empty string');
  }

  // Generate random IV for each encryption
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine: iv:authTag:encrypted (all base64-encoded)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts an encrypted string (format: iv:authTag:encrypted)
 * Returns: original plaintext string
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(':')) {
    throw new Error('Invalid encrypted data format');
  }

  // Split into components
  const [ivBase64, authTagBase64, encryptedBase64] = encryptedData.split(':');

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Malformed encrypted data');
  }

  // Decode from base64
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Masks a sensitive string, showing only last 4 characters
 * Example: "sk_live_abc123xyz789" -> "sk_live_••••••••z789"
 */
export function maskKey(key: string, lastCharsCount: number = 4): string {
  if (!key || key.length <= lastCharsCount) {
    return '••••••••';
  }

  const prefix = key.substring(0, key.indexOf('_') + 1); // Keep "sk_live_" or "pk_test_"
  const masked = '•'.repeat(Math.max(0, key.length - prefix.length - lastCharsCount));
  const lastChars = key.slice(-lastCharsCount);

  return `${prefix}${masked}${lastChars}`;
}

/**
 * Validates Stripe key format
 */
export function validateStripeKey(key: string, type: 'secret' | 'publishable' | 'webhook'): boolean {
  if (!key) return false;

  const patterns = {
    secret: /^sk_(live|test)_[A-Za-z0-9]{24,}$/,
    publishable: /^pk_(live|test)_[A-Za-z0-9]{24,}$/,
    webhook: /^whsec_[A-Za-z0-9]{32,}$/
  };

  return patterns[type].test(key);
}
```

### Environment Variables

**Add to `.env.local` (DO NOT COMMIT):**

```env
# 32-byte (64 hex characters) encryption key for Stripe credentials
# Generate with: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_character_hex_string_here
```

**Add to `.env.example`:**

```env
# Encryption key for sensitive data (32 bytes as hex string)
ENCRYPTION_KEY=
```

---

## Payment Routing Strategy

### Stripe Factory Pattern

**File:** `src/lib/stripe-factory.ts`

```typescript
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from './encryption';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type PaymentContext = 'membership' | 'reservation';

interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
}

/**
 * Cache to avoid repeated database queries
 * Key: 'membership' or 'location:slug'
 */
const stripeConfigCache: Map<string, StripeConfig> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps: Map<string, number> = new Map();

/**
 * Retrieves Stripe configuration for membership payments
 */
async function getMembershipStripeConfig(): Promise<StripeConfig> {
  const cacheKey = 'membership';

  // Check cache
  if (stripeConfigCache.has(cacheKey)) {
    const timestamp = cacheTimestamps.get(cacheKey)!;
    if (Date.now() - timestamp < CACHE_TTL) {
      return stripeConfigCache.get(cacheKey)!;
    }
  }

  // Fetch from database
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'stripe_membership_account')
    .single();

  if (error || !data) {
    throw new Error('Membership Stripe account not configured');
  }

  const config = data.value as any;

  // Decrypt keys
  const decryptedConfig: StripeConfig = {
    publishableKey: config.publishable_key,
    secretKey: decrypt(config.secret_key_encrypted),
    webhookSecret: decrypt(config.webhook_secret_encrypted)
  };

  // Cache
  stripeConfigCache.set(cacheKey, decryptedConfig);
  cacheTimestamps.set(cacheKey, Date.now());

  return decryptedConfig;
}

/**
 * Retrieves Stripe configuration for reservation payments (location-specific)
 */
async function getReservationStripeConfig(locationSlug: string = 'noirkc'): Promise<StripeConfig> {
  const cacheKey = `location:${locationSlug}`;

  // Check cache
  if (stripeConfigCache.has(cacheKey)) {
    const timestamp = cacheTimestamps.get(cacheKey)!;
    if (Date.now() - timestamp < CACHE_TTL) {
      return stripeConfigCache.get(cacheKey)!;
    }
  }

  // Fetch from database
  const { data, error } = await supabaseAdmin
    .from('locations')
    .select('stripe_publishable_key, stripe_secret_key_encrypted, stripe_webhook_secret_encrypted')
    .eq('slug', locationSlug)
    .single();

  if (error || !data || !data.stripe_secret_key_encrypted) {
    // Fallback to membership account if location doesn't have its own
    console.warn(`Location ${locationSlug} has no Stripe account, falling back to membership account`);
    return getMembershipStripeConfig();
  }

  // Decrypt keys
  const decryptedConfig: StripeConfig = {
    publishableKey: data.stripe_publishable_key!,
    secretKey: decrypt(data.stripe_secret_key_encrypted.toString()),
    webhookSecret: decrypt(data.stripe_webhook_secret_encrypted.toString())
  };

  // Cache
  stripeConfigCache.set(cacheKey, decryptedConfig);
  cacheTimestamps.set(cacheKey, Date.now());

  return decryptedConfig;
}

/**
 * Returns a Stripe instance configured for the given context
 */
export async function getStripeInstance(
  context: PaymentContext,
  locationSlug?: string
): Promise<Stripe> {
  const config = context === 'membership'
    ? await getMembershipStripeConfig()
    : await getReservationStripeConfig(locationSlug);

  return new Stripe(config.secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

/**
 * Returns the Stripe publishable key for the given context
 */
export async function getStripePublishableKey(
  context: PaymentContext,
  locationSlug?: string
): Promise<string> {
  const config = context === 'membership'
    ? await getMembershipStripeConfig()
    : await getReservationStripeConfig(locationSlug);

  return config.publishableKey;
}

/**
 * Returns the Stripe webhook secret for the given context
 */
export async function getStripeWebhookSecret(
  context: PaymentContext,
  locationSlug?: string
): Promise<string> {
  const config = context === 'membership'
    ? await getMembershipStripeConfig()
    : await getReservationStripeConfig(locationSlug);

  return config.webhookSecret;
}

/**
 * Clears the cache (useful after updating Stripe credentials)
 */
export function clearStripeConfigCache(): void {
  stripeConfigCache.clear();
  cacheTimestamps.clear();
}
```

### Usage Examples

**Before (Single Account):**
```typescript
// src/pages/api/payment/create-intent.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const paymentIntent = await stripe.paymentIntents.create({ ... });
```

**After (Multi-Account):**
```typescript
// src/pages/api/payment/create-intent.ts
import { getStripeInstance } from '@/lib/stripe-factory';

const stripe = await getStripeInstance('membership');
const paymentIntent = await stripe.paymentIntents.create({ ... });
```

**Reservation Example:**
```typescript
// src/pages/api/create-hold.js
import { getStripeInstance } from '@/lib/stripe-factory';

const stripe = await getStripeInstance('reservation', 'noirkc');
const paymentIntent = await stripe.paymentIntents.create({ ... });
```

---

## UI/UX Design

### Admin Settings Page Enhancement

#### Tab Structure

**Update:** `/src/pages/admin/settings.tsx`

Add a third tab: **"Stripe Payments"**

```tsx
const [activeTab, setActiveTab] = useState<'noirkc' | 'rooftopkc' | 'stripe'>('noirkc');

<div className={styles.tabs}>
  <button
    className={`${styles.tab} ${activeTab === 'noirkc' ? styles.tabActive : ''}`}
    onClick={() => setActiveTab('noirkc')}
  >
    Noir KC
  </button>
  <button
    className={`${styles.tab} ${activeTab === 'rooftopkc' ? styles.tabActive : ''}`}
    onClick={() => setActiveTab('rooftopkc')}
  >
    RooftopKC
  </button>
  <button
    className={`${styles.tab} ${activeTab === 'stripe' ? styles.tabActive : ''}`}
    onClick={() => setActiveTab('stripe')}
  >
    Stripe Payments
  </button>
</div>

{activeTab === 'stripe' && <StripeAccountSettings />}
```

#### New Component: `StripeAccountSettings`

**File:** `src/components/StripeAccountSettings.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Copy, Check, AlertCircle, CreditCard } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import { maskKey } from '@/lib/encryption';
import styles from '@/styles/Settings.module.css';

interface StripeAccount {
  publishableKey: string;
  secretKeyEncrypted: string;
  webhookSecretEncrypted: string;
  testMode: boolean;
  lastUpdated?: string;
}

interface LocationAccount extends StripeAccount {
  locationName: string;
  locationSlug: string;
}

export default function StripeAccountSettings() {
  // Membership account state
  const [membershipAccount, setMembershipAccount] = useState<StripeAccount | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);

  // Location accounts state
  const [locations, setLocations] = useState<LocationAccount[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  // UI state
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchMembershipAccount();
    fetchLocationAccounts();
  }, []);

  async function fetchMembershipAccount() {
    try {
      const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'stripe_membership_account')
        .single();

      if (error) throw error;

      setMembershipAccount(data.value);
    } catch (error: any) {
      console.error('Failed to fetch membership account:', error);
      setMessage({ type: 'error', text: 'Failed to load membership account' });
    } finally {
      setMembershipLoading(false);
    }
  }

  async function fetchLocationAccounts() {
    try {
      const { data, error } = await supabaseAdmin
        .from('locations')
        .select('name, slug, stripe_publishable_key, stripe_secret_key_encrypted, stripe_webhook_secret_encrypted, stripe_test_mode')
        .order('name');

      if (error) throw error;

      setLocations(data?.map(loc => ({
        locationName: loc.name,
        locationSlug: loc.slug,
        publishableKey: loc.stripe_publishable_key || '',
        secretKeyEncrypted: loc.stripe_secret_key_encrypted || '',
        webhookSecretEncrypted: loc.stripe_webhook_secret_encrypted || '',
        testMode: loc.stripe_test_mode || false
      })) || []);
    } catch (error: any) {
      console.error('Failed to fetch location accounts:', error);
      setMessage({ type: 'error', text: 'Failed to load location accounts' });
    } finally {
      setLocationsLoading(false);
    }
  }

  function toggleShowKey(keyId: string) {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  }

  async function copyToClipboard(text: string, keyId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  if (membershipLoading || locationsLoading) {
    return <div className={styles.loading}>Loading Stripe accounts...</div>;
  }

  return (
    <div className={styles.sections}>
      {message && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.type === 'error' && <AlertCircle size={16} />}
          {message.type === 'success' && <Check size={16} />}
          {message.text}
        </div>
      )}

      {/* Membership Account */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-cork" />
            <CardTitle>Membership Payments</CardTitle>
          </div>
          <CardDescription>
            Stripe account used for membership dues, onboarding, and recurring billing
          </CardDescription>
        </CardHeader>

        <CardContent>
          {membershipAccount ? (
            <div className="space-y-4">
              {/* Publishable Key */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Publishable Key</label>
                <div className="relative">
                  <Input
                    type="text"
                    value={membershipAccount.publishableKey || 'Not configured'}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(membershipAccount.publishableKey, 'membership-pub')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cork"
                  >
                    {copiedKey === 'membership-pub' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* Secret Key (masked) */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Secret Key</label>
                <div className="relative">
                  <Input
                    type="text"
                    value={maskKey(membershipAccount.secretKeyEncrypted || '', 4)}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => alert('Secret key is encrypted and cannot be viewed')}
                      className="text-gray-500 hover:text-cork"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>
                <p className={styles.inputHint}>
                  Secret keys are encrypted and cannot be viewed. Re-enter the key to update.
                </p>
              </div>

              {/* Test Mode Badge */}
              {membershipAccount.testMode && (
                <div className="flex items-center gap-2 text-sm text-yellow-600">
                  <AlertCircle size={16} />
                  <span>Test mode enabled</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No membership account configured</p>
          )}
        </CardContent>
      </Card>

      {/* Location Accounts */}
      {locations.map(location => (
        <Card key={location.locationSlug}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-cork" />
              <CardTitle>{location.locationName} Reservations</CardTitle>
            </div>
            <CardDescription>
              Stripe account used for reservation holds and cover charges
            </CardDescription>
          </CardHeader>

          <CardContent>
            {location.secretKeyEncrypted ? (
              <div className="space-y-4">
                {/* Publishable Key */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Publishable Key</label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={location.publishableKey || 'Not configured'}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(location.publishableKey, `${location.locationSlug}-pub`)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cork"
                    >
                      {copiedKey === `${location.locationSlug}-pub` ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                {/* Secret Key (masked) */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Secret Key</label>
                  <Input
                    type="text"
                    value={maskKey(location.secretKeyEncrypted, 4)}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <p className={styles.inputHint}>
                    Secret keys are encrypted and cannot be viewed
                  </p>
                </div>

                {location.testMode && (
                  <div className="flex items-center gap-2 text-sm text-yellow-600">
                    <AlertCircle size={16} />
                    <span>Test mode enabled</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                <p>No Stripe account configured for this location.</p>
                <p className="mt-2">Reservations will use the membership account as fallback.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## Files to Modify

### High Priority (Core Payment Processing) - 12 files

1. `/src/pages/api/payment/create-intent.ts` - Membership payments
2. `/src/pages/api/payment/confirm.ts` - Membership confirmation
3. `/src/pages/api/chargeBalance.js` - Balance charging
4. `/src/lib/billing.ts` - Monthly billing cron
5. `/src/pages/api/membership/payment.ts` - Membership application fees
6. `/src/pages/api/members/add-to-account.ts` - Additional member fees
7. `/src/pages/api/create-hold.js` - **Reservation holds**
8. `/src/app/api/release-holds/route.ts` - **Release holds**
9. `/src/app/api/reservations/[id]/cancel-refund/route.ts` - **Refunds**
10. `/src/pages/api/create-cover-charge-payment.js` - **Cover charges**
11. `/src/pages/api/stripe-webhook.js` - Webhook handler
12. `/src/pages/admin/settings.tsx` - Admin UI

### New Files to Create - 4 files

1. `/src/lib/encryption.ts` - Encryption utilities
2. `/src/lib/stripe-factory.ts` - Stripe instance factory
3. `/src/components/StripeAccountSettings.tsx` - Admin UI component
4. `/src/pages/api/admin/stripe-account.ts` - API for managing Stripe accounts

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create database migrations
- [ ] Create encryption utilities
- [ ] Create Stripe factory module
- [ ] Add environment variables
- [ ] Run migrations on development database

### Phase 2: Backend Core (Week 2)
- [ ] Update membership payment files (6 files)
- [ ] Update reservation payment files (4 files)
- [ ] Update webhook handler
- [ ] Test payment flows in development

### Phase 3: Admin UI (Week 3)
- [ ] Create StripeAccountSettings component
- [ ] Add Stripe tab to settings page
- [ ] Create API endpoint for account management
- [ ] Test UI in development

### Phase 4: Testing (Week 4)
- [ ] End-to-end testing of membership payments
- [ ] End-to-end testing of reservation payments
- [ ] Test encryption/decryption
- [ ] Test fallback scenarios
- [ ] Security testing

### Phase 5: Deployment (Week 5)
- [ ] Deploy to staging
- [ ] Configure Stripe accounts in admin UI
- [ ] Test in staging environment
- [ ] Deploy to production
- [ ] Monitor for issues

---

## Testing Strategy

### Unit Tests

**Test encryption module:**
```typescript
describe('encryption', () => {
  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'sk_live_test123';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different encrypted values each time', () => {
    const plaintext = 'sk_live_test123';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should mask keys correctly', () => {
    const key = 'sk_live_abcdefgh1234';
    const masked = maskKey(key, 4);
    expect(masked).toBe('sk_live_••••••••1234');
  });
});
```

### Integration Tests

**Test Stripe factory:**
```typescript
describe('stripe-factory', () => {
  it('should return membership Stripe instance', async () => {
    const stripe = await getStripeInstance('membership');
    expect(stripe).toBeInstanceOf(Stripe);
  });

  it('should return location-specific instance', async () => {
    const stripe = await getStripeInstance('reservation', 'noirkc');
    expect(stripe).toBeInstanceOf(Stripe);
  });

  it('should cache configs', async () => {
    await getStripeInstance('membership');
    await getStripeInstance('membership');
    // Should only query database once (check logs)
  });
});
```

### Manual Test Cases

**Membership Payments:**
1. Sign up new member with card → verify payment uses membership account
2. Sign up new member with ACH → verify payment uses membership account
3. Run monthly billing cron → verify charges use membership account
4. Charge outstanding balance → verify uses membership account

**Reservation Payments:**
1. Create reservation at NoirKC → verify hold uses NoirKC account
2. Create reservation at RooftopKC → verify hold uses RooftopKC account
3. Cancel reservation with refund → verify refund uses correct account
4. Release expired holds → verify uses correct account

**Fallback Scenarios:**
1. Location without Stripe account → verify falls back to membership account
2. Missing encryption key → verify graceful error handling
3. Invalid encrypted data → verify error handling

---

## Deployment Checklist

### Pre-Deployment

- [ ] Generate 32-byte encryption key: `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`
- [ ] Add `ENCRYPTION_KEY` to production environment variables (Vercel)
- [ ] Test migrations on staging database
- [ ] Backup production database
- [ ] Review all code changes

### Deployment Steps

1. **Run migrations:**
   ```bash
   # From Supabase dashboard or CLI
   psql $DATABASE_URL -f supabase/migrations/20260519000000_add_stripe_to_locations.sql
   psql $DATABASE_URL -f supabase/migrations/20260519000001_add_membership_stripe_account.sql
   ```

2. **Deploy code to production:**
   ```bash
   git push origin main  # Triggers Vercel deployment
   ```

3. **Configure Stripe accounts via Admin UI:**
   - Log in to admin dashboard
   - Go to Settings → Stripe Payments tab
   - Enter membership account keys
   - Enter location account keys
   - Verify keys are saved encrypted

4. **Test payment flows:**
   - Test membership payment
   - Test reservation payment
   - Verify webhooks are received

### Post-Deployment

- [ ] Monitor error logs for 24 hours
- [ ] Verify webhook delivery in Stripe dashboard
- [ ] Test all payment flows end-to-end
- [ ] Document any issues encountered
- [ ] Update team on new configuration process

---

## Security Considerations

### Key Management

✅ **DO:**
- Store encryption key in environment variables only
- Use different encryption keys for dev/staging/prod
- Rotate encryption keys annually
- Log all access to encrypted data
- Use service role for decryption only

❌ **DON'T:**
- Commit encryption keys to git
- Share keys between environments
- Store keys in database
- Log decrypted values
- Send decrypted keys to frontend

### Access Control

- Only service role can decrypt Stripe keys
- Admin UI shows masked values only
- Audit log all key updates
- Require re-authentication for key changes
- Rate limit decryption operations

### Compliance

- PCI DSS: Stripe keys not subject to PCI (Stripe handles card data)
- Data retention: Keep audit logs for 12 months
- Encryption at rest: AES-256-GCM meets industry standards
- Access logs: Store who/when/what for all key access

---

## Rollback Plan

If issues arise post-deployment:

1. **Immediate:** Revert to single Stripe account
   - Set all files to use `process.env.STRIPE_SECRET_KEY`
   - Deploy hotfix
   - Payments continue working

2. **Database:** Rollback migrations if needed
   ```bash
   psql $DATABASE_URL -f supabase/migrations/20260519000001_add_membership_stripe_account_ROLLBACK.sql
   psql $DATABASE_URL -f supabase/migrations/20260519000000_add_stripe_to_locations_ROLLBACK.sql
   ```

3. **Monitor:** Check for any lingering issues
4. **Post-mortem:** Document what went wrong and how to fix

---

## Future Enhancements

1. **Stripe Connect:** Migrate to OAuth flow for easier account connection
2. **Multi-tenant:** Support multiple businesses with separate Stripe accounts
3. **Key Rotation:** Automated key rotation with zero downtime
4. **Audit Dashboard:** UI for viewing all Stripe key access logs
5. **Backup Keys:** Secondary encryption key for disaster recovery

---

**End of Implementation Plan**
