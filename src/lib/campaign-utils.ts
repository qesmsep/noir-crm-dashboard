// Campaign utility functions to avoid hardcoded UUIDs
import { supabase } from './supabase';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  trigger_type: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  content: string;
  recipient_type: 'member' | 'all_members' | 'specific_phone';
  specific_phone?: string;
  timing_type: 'specific_time' | 'duration';
  specific_time?: string;
  specific_time_quantity?: number;
  specific_time_unit?: 'min' | 'hr' | 'day' | 'month' | 'year';
  specific_time_proximity?: 'before' | 'after';
  duration_quantity?: number;
  duration_unit?: 'min' | 'hr' | 'day' | 'month' | 'year';
  duration_proximity?: 'before' | 'after';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  campaigns?: Campaign;
}

/**
 * Get campaign by name instead of hardcoded UUID
 * This prevents the "snippet not found" errors
 */
export async function getCampaignByName(name: string): Promise<Campaign | null> {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      console.error('Error fetching campaign by name:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getCampaignByName:', error);
    return null;
  }
}

/**
 * Get or create campaign by name
 * This ensures campaigns exist when needed
 */
export async function getOrCreateCampaign(
  name: string, 
  description: string, 
  trigger_type: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time'
): Promise<Campaign | null> {
  try {
    // First try to get existing campaign
    let campaign = await getCampaignByName(name);
    
    if (campaign) {
      return campaign;
    }

    // Create new campaign if it doesn't exist
    const { data, error } = await supabase
      .from('campaigns')
      .insert([{
        name,
        description,
        trigger_type,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating campaign:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getOrCreateCampaign:', error);
    return null;
  }
}

/**
 * Common campaign names that should always exist
 */
export const CAMPAIGN_NAMES = {
  RESERVATION_REMINDER: 'reservation-reminder',
  WELCOME_SERIES: 'welcome-series',
  BIRTHDAY_CAMPAIGN: 'birthday-campaign',
  ONBOARDING_FOLLOWUP: 'onboarding-followup',
  TEST_CAMPAIGN: 'test-campaign'
} as const;

/**
 * Initialize common campaigns if they don't exist
 */
export async function initializeCommonCampaigns(): Promise<void> {
  const campaigns = [
    {
      name: CAMPAIGN_NAMES.RESERVATION_REMINDER,
      description: 'Reservation reminder messages',
      trigger_type: 'reservation_time' as const
    },
    {
      name: CAMPAIGN_NAMES.WELCOME_SERIES,
      description: 'Welcome messages for new members',
      trigger_type: 'member_signup' as const
    },
    {
      name: CAMPAIGN_NAMES.BIRTHDAY_CAMPAIGN,
      description: 'Birthday messages for members',
      trigger_type: 'member_birthday' as const
    },
    {
      name: CAMPAIGN_NAMES.ONBOARDING_FOLLOWUP,
      description: 'Follow-up messages for new members',
      trigger_type: 'member_signup' as const
    },
    {
      name: CAMPAIGN_NAMES.TEST_CAMPAIGN,
      description: 'Test campaign for development',
      trigger_type: 'member_signup' as const
    }
  ];

  for (const campaign of campaigns) {
    await getOrCreateCampaign(campaign.name, campaign.description, campaign.trigger_type);
  }
}

/**
 * Get campaign messages by campaign ID
 */
export async function getCampaignMessages(campaignId: string): Promise<CampaignMessage[]> {
  try {
    const { data, error } = await supabase
      .from('campaign_messages')
      .select(`
        *,
        campaigns (
          id,
          name,
          description,
          trigger_type
        )
      `)
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaign messages:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getCampaignMessages:', error);
    return [];
  }
}

/**
 * Get campaign message by ID
 */
export async function getCampaignMessage(messageId: string): Promise<CampaignMessage | null> {
  try {
    const { data, error } = await supabase
      .from('campaign_messages')
      .select(`
        *,
        campaigns (
          id,
          name,
          description,
          trigger_type
        )
      `)
      .eq('id', messageId)
      .single();

    if (error) {
      console.error('Error fetching campaign message:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getCampaignMessage:', error);
    return null;
  }
}

/**
 * Create or update campaign message
 */
export async function saveCampaignMessage(message: Partial<CampaignMessage>): Promise<CampaignMessage | null> {
  try {
    const { data, error } = await supabase
      .from('campaign_messages')
      .upsert([message])
      .select(`
        *,
        campaigns (
          id,
          name,
          description,
          trigger_type
        )
      `)
      .single();

    if (error) {
      console.error('Error saving campaign message:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in saveCampaignMessage:', error);
    return null;
  }
} 