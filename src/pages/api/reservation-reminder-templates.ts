import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .select('*')
        .order('reminder_type', { ascending: true })
        .order('send_time', { ascending: true });

      if (error) throw error;
      res.status(200).json({ templates: data });
    } catch (error) {
      console.error('Error fetching reservation reminder templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, description, message_template, reminder_type, send_time, is_active } = req.body;

      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .insert([{
          name,
          description,
          message_template,
          reminder_type,
          send_time,
          is_active: is_active ?? true
        }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      console.error('Error creating reservation reminder template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, name, description, message_template, reminder_type, send_time, is_active } = req.body;

      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .update({
          name,
          description,
          message_template,
          reminder_type,
          send_time,
          is_active
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.status(200).json(data);
    } catch (error) {
      console.error('Error updating reservation reminder template:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      const { error } = await supabase
        .from('reservation_reminder_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.status(200).json({ message: 'Template deleted successfully' });
    } catch (error) {
      console.error('Error deleting reservation reminder template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 