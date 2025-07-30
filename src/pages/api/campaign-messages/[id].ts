import { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      console.log('Fetching campaign message with ID:', id);
      
      const { data, error } = await supabaseAdmin
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
        .eq('id', id)
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data) {
        console.log('Campaign message not found for ID:', id);
        res.status(404).json({ error: 'Campaign message not found' });
        return;
      }

      console.log('Campaign message data:', data);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching campaign message:', error);
      res.status(500).json({ 
        error: 'Failed to fetch campaign message',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const message = req.body;
      console.log('Updating campaign message with ID:', id);
      console.log('Update data:', message);
      
      const { data, error } = await supabaseAdmin
        .from('campaign_messages')
        .update(message)
        .eq('id', id)
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
        console.error('Supabase update error:', error);
        throw error;
      }

      if (!data) {
        console.log('Campaign message not found for update with ID:', id);
        res.status(404).json({ error: 'Campaign message not found for update' });
        return;
      }

      console.log('Campaign message updated successfully:', data);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error updating campaign message:', error);
      res.status(500).json({ 
        error: 'Failed to update campaign message',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      console.log('Deleting campaign message with ID:', id);
      
      const { error } = await supabaseAdmin
        .from('campaign_messages')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }

      console.log('Campaign message deleted successfully');
      res.status(200).json({ message: 'Campaign message deleted successfully' });
    } catch (error) {
      console.error('Error deleting campaign message:', error);
      res.status(500).json({ 
        error: 'Failed to delete campaign message',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 