import { supabase } from '../lib/supabase';

export interface HoldFeeConfig {
  enabled: boolean;
  amount: number;
}

export async function getHoldFeeConfig(): Promise<HoldFeeConfig> {
  try {
    // Check if we're on the client side
    if (typeof window !== 'undefined') {
      // Client-side: fetch from API endpoint
      const response = await fetch('/api/settings/hold-fee-config');
      if (response.ok) {
        const data = await response.json();
        return {
          enabled: data.hold_fee_enabled ?? true,
          amount: data.hold_fee_amount ?? 25.00
        };
      } else {
        console.warn('Failed to fetch hold fee config from API, using defaults');
        return { enabled: true, amount: 25.00 };
      }
    } else {
      // Server-side: direct database access
      const { data, error } = await supabase
        .from('settings')
        .select('hold_fee_enabled, hold_fee_amount')
        .single();

      if (error) {
        console.error('Error fetching hold fee config:', error);
        return { enabled: true, amount: 25.00 }; // Default fallback
      }

      return {
        enabled: data.hold_fee_enabled ?? true,
        amount: data.hold_fee_amount ?? 25.00
      };
    }
  } catch (error) {
    console.error('Error in getHoldFeeConfig:', error);
    return { enabled: true, amount: 25.00 }; // Default fallback
  }
}

export function getHoldAmount(partySize: number, holdFeeConfig: HoldFeeConfig): number {
  if (!holdFeeConfig.enabled) {
    return 0;
  }
  return holdFeeConfig.amount;
} 