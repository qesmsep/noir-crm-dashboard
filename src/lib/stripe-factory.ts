import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from './encryption';

// Use consistent Stripe API version across entire app (matches existing webhook handler)
const STRIPE_API_VERSION = '2023-08-16' as const;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type PaymentContext = 'membership' | 'reservation';

interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  testMode: boolean;
}

interface StripeConfigRow {
  publishable_key: string | null;
  secret_key_encrypted: string | null;
  webhook_secret_encrypted: string | null;
  test_mode: boolean | null;
}

/**
 * Cache to avoid repeated database queries and decryption
 * Key: 'membership' or 'location:slug'
 */
const stripeConfigCache = new Map<string, StripeConfig>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Feature flag to enable/disable multi-account routing
 * Set to 'false' to use legacy single-account behavior
 */
const MULTI_ACCOUNT_ENABLED = process.env.STRIPE_MULTI_ACCOUNT_ENABLED !== 'false';

/**
 * Retrieves Stripe configuration for membership payments
 * Uses secure database function to access encrypted keys
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

  // Fetch from database using secure function
  const { data, error } = await supabase
    .rpc('get_membership_stripe_config')
    .single();

  if (error) {
    console.error('Failed to fetch membership Stripe config:', error);
    throw new Error('Membership Stripe account not configured');
  }

  if (!data) {
    throw new Error('Membership Stripe account not found');
  }

  const row = data as unknown as StripeConfigRow;

  // Validate required fields
  if (!row.publishable_key || !row.secret_key_encrypted || !row.webhook_secret_encrypted) {
    throw new Error('Membership Stripe account is incomplete - missing required keys');
  }

  // Decrypt keys
  let secretKey: string;
  let webhookSecret: string;

  try {
    secretKey = decrypt(row.secret_key_encrypted);
    webhookSecret = decrypt(row.webhook_secret_encrypted);
  } catch (error: any) {
    console.error('Failed to decrypt membership Stripe keys:', error.message);
    throw new Error('Failed to decrypt Stripe credentials - check ENCRYPTION_KEY');
  }

  const config: StripeConfig = {
    publishableKey: row.publishable_key,
    secretKey,
    webhookSecret,
    testMode: row.test_mode ?? false
  };

  // Cache the decrypted config
  stripeConfigCache.set(cacheKey, config);
  cacheTimestamps.set(cacheKey, Date.now());

  return config;
}

/**
 * Retrieves Stripe configuration for reservation payments (location-specific)
 * Falls back to membership account if location doesn't have its own
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

  // Fetch from database using secure function
  const { data, error } = await supabase
    .rpc('get_location_stripe_config', { location_slug: locationSlug })
    .single();

  if (error) {
    console.warn(`Failed to fetch Stripe config for location ${locationSlug}:`, error);
    console.log('Falling back to membership account');
    return getMembershipStripeConfig();
  }

  if (!data) {
    console.warn(`No Stripe config found for location ${locationSlug}`);
    console.log('Falling back to membership account');
    return getMembershipStripeConfig();
  }

  const row = data as unknown as StripeConfigRow;

  // If location doesn't have encrypted keys, fall back to membership account
  if (!row.secret_key_encrypted || !row.publishable_key || !row.webhook_secret_encrypted) {
    console.log(`Location ${locationSlug} has no Stripe account, falling back to membership account`);
    return getMembershipStripeConfig();
  }

  // Decrypt keys
  let secretKey: string;
  let webhookSecret: string;

  try {
    secretKey = decrypt(row.secret_key_encrypted);
    webhookSecret = decrypt(row.webhook_secret_encrypted);
  } catch (error: any) {
    console.error(`Failed to decrypt Stripe keys for location ${locationSlug}:`, error.message);
    console.log('Falling back to membership account');
    return getMembershipStripeConfig();
  }

  const config: StripeConfig = {
    publishableKey: row.publishable_key,
    secretKey,
    webhookSecret,
    testMode: row.test_mode ?? false
  };

  // Cache the decrypted config
  stripeConfigCache.set(cacheKey, config);
  cacheTimestamps.set(cacheKey, Date.now());

  return config;
}

/**
 * Returns a Stripe instance configured for the given context
 *
 * @param context - 'membership' for dues/billing, 'reservation' for holds/fees
 * @param locationSlug - Location slug (required for reservation context)
 * @returns Configured Stripe instance
 */
export async function getStripeInstance(
  context: PaymentContext,
  locationSlug?: string
): Promise<Stripe> {
  // Feature flag: If multi-account disabled, use legacy single account
  if (!MULTI_ACCOUNT_ENABLED) {
    return new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: STRIPE_API_VERSION as any,
    });
  }

  const config = context === 'membership'
    ? await getMembershipStripeConfig()
    : await getReservationStripeConfig(locationSlug);

  return new Stripe(config.secretKey, {
    apiVersion: STRIPE_API_VERSION as any,
  });
}

/**
 * Returns the Stripe publishable key for the given context
 * Used by frontend components to initialize Stripe.js
 *
 * @param context - 'membership' or 'reservation'
 * @param locationSlug - Location slug (required for reservation context)
 * @returns Stripe publishable key (safe to expose to client)
 */
export async function getStripePublishableKey(
  context: PaymentContext,
  locationSlug?: string
): Promise<string> {
  // Feature flag: If multi-account disabled, use legacy key
  if (!MULTI_ACCOUNT_ENABLED) {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;
  }

  const config = context === 'membership'
    ? await getMembershipStripeConfig()
    : await getReservationStripeConfig(locationSlug);

  return config.publishableKey;
}

/**
 * Returns the Stripe webhook secret for the given context
 * Used by webhook handlers to verify signatures
 *
 * @param context - 'membership' or 'reservation'
 * @param locationSlug - Location slug (required for reservation context)
 * @returns Webhook signing secret
 */
export async function getStripeWebhookSecret(
  context: PaymentContext,
  locationSlug?: string
): Promise<string> {
  // Feature flag: If multi-account disabled, use legacy secret
  if (!MULTI_ACCOUNT_ENABLED) {
    return process.env.STRIPE_WEBHOOK_SECRET!;
  }

  const config = context === 'membership'
    ? await getMembershipStripeConfig()
    : await getReservationStripeConfig(locationSlug);

  return config.webhookSecret;
}

/**
 * Returns all configured webhook secrets for signature verification
 * Used by webhook handlers to try multiple accounts
 *
 * @returns Array of webhook secrets with their context labels
 */
export async function getAllWebhookSecrets(): Promise<Array<{ context: string; secret: string }>> {
  const secrets: Array<{ context: string; secret: string }> = [];

  try {
    // Get membership secret
    const membershipConfig = await getMembershipStripeConfig();
    secrets.push({ context: 'membership', secret: membershipConfig.webhookSecret });
  } catch (error) {
    console.warn('Failed to load membership webhook secret:', error);
  }

  try {
    // Get location secrets
    const { data: locations } = await supabase
      .from('locations')
      .select('slug')
      .not('stripe_secret_key_encrypted', 'is', null);

    if (locations) {
      for (const location of locations) {
        try {
          const locationConfig = await getReservationStripeConfig(location.slug);
          secrets.push({ context: `location:${location.slug}`, secret: locationConfig.webhookSecret });
        } catch (error) {
          console.warn(`Failed to load webhook secret for ${location.slug}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load location webhook secrets:', error);
  }

  return secrets;
}

/**
 * Clears the cache (useful after updating Stripe credentials via admin UI)
 * Call this after saving new keys to force immediate reload
 */
export function clearStripeConfigCache(): void {
  stripeConfigCache.clear();
  cacheTimestamps.clear();
  console.log('Stripe config cache cleared');
}

/**
 * Preloads Stripe configurations for multiple locations (batch optimization)
 * Useful for cron jobs that process many reservations
 *
 * @param locationSlugs - Array of location slugs to preload
 */
export async function preloadStripeConfigs(locationSlugs: string[]): Promise<void> {
  await Promise.all(
    locationSlugs.map(slug => getReservationStripeConfig(slug).catch(err => {
      console.warn(`Failed to preload config for ${slug}:`, err);
    }))
  );
  console.log(`Preloaded Stripe configs for ${locationSlugs.length} locations`);
}
