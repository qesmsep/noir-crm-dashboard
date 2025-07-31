import { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  } else if (req.method === 'POST') {
    try {
      const campaign = req.body;
      console.log('Creating campaign with data:', campaign);
      
      // Validate required fields
      if (!campaign.name || !campaign.trigger_type) {
        console.log('Validation failed:', { name: campaign.name, trigger_type: campaign.trigger_type });
        res.status(400).json({ error: 'Name and trigger_type are required' });
        return;
      }

      // Validate trigger_type
      const validTriggerTypes = [
        'member_signup', 'member_birthday', 'member_renewal', 'reservation', 'reservation_time', 'reservation_created',
        'recurring', 'reservation_range', 'private_event', 'all_members'
      ];
      if (!validTriggerTypes.includes(campaign.trigger_type)) {
        console.log('Invalid trigger_type:', campaign.trigger_type);
        res.status(400).json({ 
          error: 'Invalid trigger_type', 
          details: `Must be one of: ${validTriggerTypes.join(', ')}` 
        });
        return;
      }

      // Check if campaign with this name already exists
      const { data: existingCampaign } = await supabaseAdmin
        .from('campaigns')
        .select('id, name')
        .eq('name', campaign.name)
        .single();

      if (existingCampaign) {
        console.log('Campaign with this name already exists:', existingCampaign);
        res.status(409).json({ 
          error: 'Campaign with this name already exists',
          existingCampaign: existingCampaign
        });
        return;
      }

      // Use supabaseAdmin to bypass RLS for admin operations
      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .insert([campaign])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Campaign created successfully:', data);
      res.status(201).json(data);
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(500).json({ 
        error: 'Failed to create campaign',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 