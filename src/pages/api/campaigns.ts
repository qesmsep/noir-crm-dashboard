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
      const { location_ids, ...campaign } = req.body;
      console.log('Creating campaign with data:', campaign);
      console.log('Location IDs:', location_ids);

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

      // Create campaign
      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .insert([campaign])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Insert campaign location assignments if provided and not applies_to_all_locations
      if (location_ids && location_ids.length > 0 && !campaign.applies_to_all_locations) {
        const locationInserts = location_ids.map((location_id: string) => ({
          campaign_id: data.id,
          location_id: location_id,
        }));

        const { error: locationError } = await supabaseAdmin
          .from('campaign_locations')
          .insert(locationInserts);

        if (locationError) {
          console.error('Error inserting campaign locations:', locationError);
          // Rollback by deleting the campaign
          await supabaseAdmin.from('campaigns').delete().eq('id', data.id);
          return res.status(500).json({
            error: 'Failed to assign campaign to locations',
            details: locationError.message
          });
        }
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