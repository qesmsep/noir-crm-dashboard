// Utility functions for sorting campaign messages by proximity to trigger events

export interface CampaignTemplate {
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
  created_at: string;
  updated_at: string;
}

/**
 * Calculate the relative time offset for a campaign template
 * Returns a number representing minutes from trigger (negative = before, positive = after)
 */
export function calculateTimeOffset(template: CampaignTemplate): number {
  if (template.timing_type === 'specific_time') {
    const quantity = template.specific_time_quantity || 0;
    const unit = template.specific_time_unit || 'day';
    const proximity = template.specific_time_proximity || 'after';
    
    // Convert to minutes for consistent comparison
    const minutesPerUnit: Record<string, number> = {
      'min': 1,
      'hr': 60,
      'day': 24 * 60,
      'month': 30 * 24 * 60, // Approximate
      'year': 365 * 24 * 60 // Approximate
    };
    
    const totalMinutes = quantity * (minutesPerUnit[unit] || 60);
    return proximity === 'before' ? -totalMinutes : totalMinutes;
  } else {
    // duration timing type
    const quantity = template.duration_quantity || 1;
    const unit = template.duration_unit || 'hr';
    const proximity = template.duration_proximity || 'after';
    
    // Convert to minutes for consistent comparison
    const minutesPerUnit: Record<string, number> = {
      'min': 1,
      'hr': 60,
      'day': 24 * 60,
      'month': 30 * 24 * 60, // Approximate
      'year': 365 * 24 * 60 // Approximate
    };
    
    const totalMinutes = quantity * (minutesPerUnit[unit] || 60);
    return proximity === 'before' ? -totalMinutes : totalMinutes;
  }
}

/**
 * Sort campaign templates by proximity to trigger event
 * Messages sent before the trigger come first, then messages sent after
 * Within each group, sort by how close they are to the trigger
 */
export function sortCampaignTemplates(templates: CampaignTemplate[]): CampaignTemplate[] {
  return [...templates].sort((a, b) => {
    const offsetA = calculateTimeOffset(a);
    const offsetB = calculateTimeOffset(b);
    
    // First, separate before and after messages
    const isBeforeA = offsetA < 0;
    const isBeforeB = offsetB < 0;
    
    if (isBeforeA && !isBeforeB) {
      return -1; // A is before, B is after, so A comes first
    }
    if (!isBeforeA && isBeforeB) {
      return 1; // A is after, B is before, so B comes first
    }
    
    // Both are in the same category (before or after), sort by proximity
    // For both "before" and "after" messages: closest to trigger comes first
    if (isBeforeA) {
      // Both are "before" - sort by proximity (closest first)
      // Since offsetA and offsetB are negative, we want the larger (less negative) first
      return offsetB - offsetA;
    } else {
      // Both are "after" - sort by proximity (closest first)
      return offsetA - offsetB;
    }
  });
} 