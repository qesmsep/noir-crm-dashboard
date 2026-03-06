import { supabaseAdmin } from '@/lib/supabase';

interface TriggerCampaignParams {
  memberId: string;
  templateId: string;
  activationDate: string;
}

/**
 * Trigger a member campaign
 */
export async function triggerMemberCampaign({ memberId, templateId, activationDate }: TriggerCampaignParams): Promise<{ success: boolean; error?: string; campaignId?: string }> {
  try {
    // Check if member exists
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, last_name, phone')
      .eq('member_id', memberId)
      .single();

    if (memberError || !member) {
      return { success: false, error: 'Member not found' };
    }

    // Check if template exists
    const { data: template, error: templateError } = await supabaseAdmin
      .from('campaign_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      return { success: false, error: 'Template not found or inactive' };
    }

    // Check if campaign already exists for this member and template
    const { data: existingCampaign } = await supabaseAdmin
      .from('member_campaigns')
      .select('id')
      .eq('member_id', memberId)
      .eq('template_id', templateId)
      .single();

    if (existingCampaign) {
      return { success: false, error: 'Campaign already exists for this member and template' };
    }

    // Calculate scheduled date
    const scheduledDate = new Date(activationDate);
    scheduledDate.setDate(scheduledDate.getDate() + template.default_delay_days);

    // Set the time
    const [hours, minutes] = template.default_send_time.split(':');
    scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Create message content with member name
    let messageContent = template.message_template;
    messageContent = messageContent.replace(/\{\{first_name\}\}/g, member.first_name || 'there');
    messageContent = messageContent.replace(/\{\{last_name\}\}/g, member.last_name || '');

    // Create the campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('member_campaigns')
      .insert({
        member_id: memberId,
        template_id: templateId,
        activation_date: activationDate,
        campaign_status: 'active',
        scheduled_messages: [{
          scheduled_for: scheduledDate.toISOString(),
          message_content: messageContent,
          template_id: template.id
        }]
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Error creating campaign:', campaignError);
      return { success: false, error: 'Failed to create campaign' };
    }

    // Create the scheduled message
    const { error: messageError } = await supabaseAdmin
      .from('scheduled_messages')
      .insert({
        member_id: memberId,
        campaign_id: campaign.id,
        template_id: templateId,
        message_content: messageContent,
        scheduled_for: scheduledDate.toISOString(),
        status: 'pending'
      });

    if (messageError) {
      console.error('Error creating scheduled message:', messageError);
      return { success: false, error: 'Failed to create scheduled message' };
    }

    return { success: true, campaignId: campaign.id };
  } catch (error: any) {
    console.error('Error triggering member campaign:', error);
    return { success: false, error: error.message };
  }
}
