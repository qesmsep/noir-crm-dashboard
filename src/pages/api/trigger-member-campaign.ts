import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { member_id } = req.query;

      if (!member_id) {
        return res.status(400).json({ error: 'Member ID is required' });
      }

      // Get campaign status for the member
      const { data: campaigns, error } = await supabase
        .from('member_campaigns')
        .select(`
          *,
          campaign_templates (
            id,
            name,
            description,
            default_delay_days,
            default_send_time
          )
        `)
        .eq('member_id', member_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching member campaigns:', error);
        return res.status(500).json({ error: 'Failed to fetch campaign status' });
      }

      res.status(200).json({
        member_id,
        campaigns: campaigns || []
      });
    } catch (error) {
      console.error('Error in trigger member campaign GET:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { member_id, template_id, activation_date } = req.body;

      if (!member_id || !template_id || !activation_date) {
        return res.status(400).json({ 
          error: 'Member ID, template ID, and activation date are required' 
        });
      }

      // Check if member exists
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('member_id, first_name, last_name, phone')
        .eq('member_id', member_id)
        .single();

      if (memberError || !member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      // Check if template exists
      const { data: template, error: templateError } = await supabase
        .from('campaign_templates')
        .select('*')
        .eq('id', template_id)
        .eq('is_active', true)
        .single();

      if (templateError || !template) {
        return res.status(404).json({ error: 'Template not found or inactive' });
      }

      // Check if campaign already exists for this member and template
      const { data: existingCampaign, error: existingError } = await supabase
        .from('member_campaigns')
        .select('id')
        .eq('member_id', member_id)
        .eq('template_id', template_id)
        .single();

      if (existingCampaign) {
        return res.status(409).json({ 
          error: 'Campaign already exists for this member and template' 
        });
      }

      // Calculate scheduled date
      const scheduledDate = new Date(activation_date);
      scheduledDate.setDate(scheduledDate.getDate() + template.default_delay_days);
      
      // Set the time
      const [hours, minutes] = template.default_send_time.split(':');
      scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Create message content with member name
      let messageContent = template.message_template;
      messageContent = messageContent.replace(/\{\{first_name\}\}/g, member.first_name || 'there');
      messageContent = messageContent.replace(/\{\{last_name\}\}/g, member.last_name || '');

      // Create the campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('member_campaigns')
        .insert({
          member_id,
          template_id,
          activation_date,
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
        return res.status(500).json({ error: 'Failed to create campaign' });
      }

      // Create the scheduled message
      const { data: scheduledMessage, error: messageError } = await supabase
        .from('scheduled_messages')
        .insert({
          member_id,
          campaign_id: campaign.id,
          template_id,
          message_content: messageContent,
          scheduled_for: scheduledDate.toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error creating scheduled message:', messageError);
        return res.status(500).json({ error: 'Failed to create scheduled message' });
      }

      res.status(201).json({
        success: true,
        message: 'Campaign triggered successfully',
        campaign,
        scheduled_message: scheduledMessage
      });

    } catch (error) {
      console.error('Error in trigger member campaign POST:', error);
      res.status(500).json({ error: 'Failed to trigger campaign' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 