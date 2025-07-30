import { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      console.log('Fetching campaign template with ID:', id);
      
      const { data, error } = await supabaseAdmin
        .from('campaign_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data) {
        console.log('Campaign template not found for ID:', id);
        res.status(404).json({ error: 'Campaign template not found' });
        return;
      }

      console.log('Campaign template data:', data);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching campaign template:', error);
      res.status(500).json({ error: 'Failed to fetch campaign template' });
    }
  } else if (req.method === 'PUT') {
    try {
      const template = req.body;
      console.log('Updating campaign template with ID:', id);
      console.log('Update data:', template);
      
      const { data, error } = await supabaseAdmin
        .from('campaign_templates')
        .update(template)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      if (!data) {
        console.log('Campaign template not found for update with ID:', id);
        res.status(404).json({ error: 'Campaign template not found for update' });
        return;
      }

      console.log('Campaign template updated successfully:', data);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error updating campaign template:', error);
      res.status(500).json({ error: 'Failed to update campaign template' });
    }
  } else if (req.method === 'DELETE') {
    try {
      console.log('Deleting campaign template with ID:', id);
      
      const { error } = await supabaseAdmin
        .from('campaign_templates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }

      console.log('Campaign template deleted successfully');
      res.status(200).json({ message: 'Campaign template deleted successfully' });
    } catch (error) {
      console.error('Error deleting campaign template:', error);
      res.status(500).json({ error: 'Failed to delete campaign template' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 