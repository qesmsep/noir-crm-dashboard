import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { member_id, member_phone, member_first_name } = req.body;

    if (!member_id || !member_phone) {
      return res.status(400).json({ error: 'Member ID and phone are required' });
    }

    // Get active campaign templates
    const { data: templates, error: templateError } = await supabase
      .from('campaign_templates')
      .select('*')
      .eq('is_active', true)
      .order('default_delay_days', { ascending: true });

    if (templateError) {
      console.error('Error fetching templates:', templateError);
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }

    if (!templates || templates.length === 0) {
      return res.status(200).json({ message: 'No active templates found' });
    }

    const campaigns: any[] = [];
    const scheduledMessages: any[] = [];

    // Create campaigns and scheduled messages for each template
    for (const template of templates) {
      // Create campaign record
      const { data: campaign, error: campaignError } = await supabase
        .from('member_campaigns')
        .insert([{
          member_id,
          template_id: template.id,
          campaign_status: 'active',
          total_messages: 1,
          sent_messages: 0
        }])
        .select()
        .single();

      if (campaignError) {
        console.error('Error creating campaign:', campaignError);
        continue;
      }

      campaigns.push(campaign);

      // Calculate scheduled time
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + template.default_delay_days);
      
      const [hours, minutes] = template.default_send_time.split(':');
      scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Create scheduled message
      const messageContent = template.message_template.replace(
        /\{\{first_name\}\}/g, 
        member_first_name || 'there'
      );

      const { data: scheduledMessage, error: messageError } = await supabase
        .from('scheduled_messages')
        .insert([{
          member_id,
          campaign_id: campaign.id,
          template_id: template.id,
          message_content: messageContent,
          phone_number: member_phone,
          scheduled_time: scheduledDate.toISOString(),
          message_status: 'pending'
        }])
        .select()
        .single();

      if (messageError) {
        console.error('Error creating scheduled message:', messageError);
        continue;
      }

      scheduledMessages.push(scheduledMessage);
    }

    res.status(200).json({
      message: 'Campaign triggered successfully',
      campaigns_created: campaigns.length,
      messages_scheduled: scheduledMessages.length,
      campaigns,
      scheduled_messages: scheduledMessages
    });

  } catch (error) {
    console.error('Error triggering member campaign:', error);
    res.status(500).json({ error: 'Failed to trigger campaign' });
  }
} 