import { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      console.log('Fetching campaign with ID:', id);

      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .select(`
          *,
          campaign_locations(
            location_id,
            created_at,
            location:locations(id, name, slug)
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Supabase error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // Check if it's an RLS error
        if (error.code === '42501') {
          res.status(500).json({ 
            error: 'Row Level Security policy violation',
            details: error.message,
            code: error.code,
            hint: 'Check RLS policies for campaigns table'
          });
          return;
        }
        
        throw error;
      }

      if (!data) {
        console.log('Campaign not found for ID:', id);
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }

      console.log('Campaign data:', data);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      console.error('Error type:', typeof error);
      console.error('Error instanceof Error:', error instanceof Error);
      console.error('Error message:', error instanceof Error ? error.message : 'No message');
      
      res.status(500).json({ 
        error: 'Failed to fetch campaign',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: typeof error
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const { location_ids, ...campaign } = req.body;
      console.log('Updating campaign with ID:', id);
      console.log('Update data:', campaign);
      console.log('Location IDs:', location_ids);

      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .update(campaign)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      if (!data) {
        console.log('Campaign not found for update with ID:', id);
        res.status(404).json({ error: 'Campaign not found for update' });
        return;
      }

      // Update campaign location assignments with proper error handling
      try {
        // First, delete existing assignments
        const { error: deleteError } = await supabaseAdmin
          .from('campaign_locations')
          .delete()
          .eq('campaign_id', id);

        if (deleteError) {
          throw new Error(`Failed to delete existing locations: ${deleteError.message}`);
        }

        // Then insert new assignments if not applies_to_all_locations
        if (location_ids && location_ids.length > 0 && !campaign.applies_to_all_locations) {
          const locationInserts = location_ids.map((location_id: string) => ({
            campaign_id: id as string,
            location_id: location_id,
          }));

          const { error: locationError } = await supabaseAdmin
            .from('campaign_locations')
            .insert(locationInserts);

          if (locationError) {
            throw new Error(`Failed to insert new locations: ${locationError.message}`);
          }
        }
      } catch (locationUpdateError) {
        console.error('Error updating campaign locations:', locationUpdateError);
        return res.status(500).json({
          error: 'Failed to update campaign locations',
          details: locationUpdateError instanceof Error ? locationUpdateError.message : 'Unknown error'
        });
      }

      console.log('Campaign updated successfully:', data);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error updating campaign:', error);
      console.error('Error type:', typeof error);
      console.error('Error instanceof Error:', error instanceof Error);
      console.error('Error message:', error instanceof Error ? error.message : 'No message');

      res.status(500).json({
        error: 'Failed to update campaign',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: typeof error
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      console.log('Deleting campaign with ID:', id);
      
      const { error } = await supabaseAdmin
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('Campaign deleted successfully');
      res.status(200).json({ message: 'Campaign deleted successfully' });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      console.error('Error type:', typeof error);
      console.error('Error instanceof Error:', error instanceof Error);
      console.error('Error message:', error instanceof Error ? error.message : 'No message');
      
      res.status(500).json({ 
        error: 'Failed to delete campaign',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: typeof error
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 