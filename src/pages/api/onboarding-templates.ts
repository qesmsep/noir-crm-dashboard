import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('onboarding_templates')
        .select('*')
        .order('timing_days', { ascending: true });

      if (error) throw error;

      res.status(200).json({ templates: data || [] });
    } catch (error) {
      console.error('Error fetching onboarding templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, content, recipient_type, specific_phone, timing_days, timing_hours, timing_minutes, send_time, is_active } = req.body;

      if (!name || !content || !recipient_type) {
        return res.status(400).json({ error: 'Name, content, and recipient_type are required' });
      }

      const { data, error } = await supabase
        .from('onboarding_templates')
        .insert({
          name,
          content,
          recipient_type,
          specific_phone: recipient_type === 'specific_phone' ? specific_phone : null,
          timing_days: timing_days || 0,
          timing_hours: timing_hours || 0,
          timing_minutes: timing_minutes || 0,
          send_time: send_time || '10:00:00',
          is_active: is_active !== undefined ? is_active : true
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ template: data });
    } catch (error) {
      console.error('Error creating onboarding template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, name, content, recipient_type, specific_phone, timing_days, timing_hours, timing_minutes, send_time, is_active } = req.body;

      if (!id || !name || !content || !recipient_type) {
        return res.status(400).json({ error: 'ID, name, content, and recipient_type are required' });
      }

      const { data, error } = await supabase
        .from('onboarding_templates')
        .update({
          name,
          content,
          recipient_type,
          specific_phone: recipient_type === 'specific_phone' ? specific_phone : null,
          timing_days: timing_days || 0,
          timing_hours: timing_hours || 0,
          timing_minutes: timing_minutes || 0,
          send_time: send_time || '10:00:00',
          is_active: is_active !== undefined ? is_active : true
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.status(200).json({ template: data });
    } catch (error) {
      console.error('Error updating onboarding template:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Template ID is required' });
      }

      const { error } = await supabase
        .from('onboarding_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(200).json({ message: 'Template deleted successfully' });
    } catch (error) {
      console.error('Error deleting onboarding template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 