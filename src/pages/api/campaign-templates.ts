import { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('campaign_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching campaign templates:', error);
      res.status(500).json({ error: 'Failed to fetch campaign templates' });
    }
  } else if (req.method === 'POST') {
    try {
      const template = req.body;
      console.log('Creating campaign template with data:', template);
      
      const { data, error } = await supabaseAdmin
        .from('campaign_templates')
        .insert([template])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Campaign template created successfully:', data);
      res.status(201).json(data);
    } catch (error) {
      console.error('Error creating campaign template:', error);
      res.status(500).json({ error: 'Failed to create campaign template' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 