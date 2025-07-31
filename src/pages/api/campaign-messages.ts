import { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { campaign_id } = req.query;
      
      let query = supabaseAdmin
        .from('campaign_messages')
        .select(`
          *,
          campaigns (
            id,
            name,
            description,
            trigger_type
          )
        `);

      // Filter by campaign if specified
      if (campaign_id) {
        query = query.eq('campaign_id', campaign_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('Successfully fetched campaign messages:', data?.length || 0, 'messages');
      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching campaign messages:', error);
      res.status(500).json({ error: 'Failed to fetch campaign messages' });
    }
  } else if (req.method === 'POST') {
    try {
      const message = req.body;
      console.log('Creating campaign message with data:', message);
      
      // Validate required fields
      if (!message.campaign_id || !message.name || !message.content) {
        console.log('Validation failed:', { 
          campaign_id: message.campaign_id, 
          name: message.name, 
          content: message.content 
        });
        res.status(400).json({ error: 'campaign_id, name, and content are required' });
        return;
      }

      // Validate recipient_type
      const validRecipientTypes = [
        'member', 'all_members', 'specific_phone', 'both_members',
        'reservation_phones', 'private_event_rsvps', 'all_primary_members'
      ];
      if (message.recipient_type && !validRecipientTypes.includes(message.recipient_type)) {
        res.status(400).json({ 
          error: 'Invalid recipient_type', 
          details: `Must be one of: ${validRecipientTypes.join(', ')}` 
        });
        return;
      }

      // Validate timing_type
      const validTimingTypes = ['specific_time', 'recurring', 'relative'];
      if (message.timing_type && !validTimingTypes.includes(message.timing_type)) {
        res.status(400).json({ 
          error: 'Invalid timing_type', 
          details: `Must be one of: ${validTimingTypes.join(', ')}` 
        });
        return;
      }

      // Check if campaign exists
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('campaigns')
        .select('id, name')
        .eq('id', message.campaign_id)
        .single();

      if (campaignError || !campaign) {
        res.status(404).json({ 
          error: 'Campaign not found',
          campaign_id: message.campaign_id
        });
        return;
      }

      // Use supabaseAdmin to bypass RLS for admin operations
      const { data, error } = await supabaseAdmin
        .from('campaign_messages')
        .insert([message])
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
        console.error('Supabase error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('Campaign message created successfully:', data);
      res.status(201).json(data);
    } catch (error) {
      console.error('Error creating campaign message:', error);
      res.status(500).json({ 
        error: 'Failed to create campaign message',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 