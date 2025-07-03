import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .select('*')
        .order('reminder_type', { ascending: true })
        .order('send_time', { ascending: true })
        .order('send_time_minutes', { ascending: true });

      if (error) throw error;
      res.status(200).json({ templates: data });
    } catch (error) {
      console.error('Error fetching reservation reminder templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, description, message_template, reminder_type, send_time, is_active } = req.body;

      // Parse send_time to extract hours and minutes
      let sendTimeHours: number;
      let sendTimeMinutes: number = 0;

      if (reminder_type === 'day_of') {
        // send_time format: "10:05" or "14:30"
        const [hours, minutes] = send_time.split(':').map(Number);
        sendTimeHours = hours;
        sendTimeMinutes = minutes || 0;
      } else {
        // send_time format: "1" or "2" (hours before)
        sendTimeHours = parseInt(send_time);
        sendTimeMinutes = 0; // Default to 0 minutes for hour_before
      }

      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .insert([{
          name,
          description,
          message_template,
          reminder_type,
          send_time: sendTimeHours,
          send_time_minutes: sendTimeMinutes,
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
      const { id } = req.query;
      const { name, description, message_template, reminder_type, send_time, is_active } = req.body;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Template ID is required' });
      }

      // Parse send_time to extract hours and minutes
      let sendTimeHours: number;
      let sendTimeMinutes: number = 0;

      if (reminder_type === 'day_of') {
        // send_time format: "10:05" or "14:30"
        const [hours, minutes] = send_time.split(':').map(Number);
        sendTimeHours = hours;
        sendTimeMinutes = minutes || 0;
      } else {
        // send_time format: "1" or "2" (hours before)
        sendTimeHours = parseInt(send_time);
        sendTimeMinutes = 0; // Default to 0 minutes for hour_before
      }

      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .update({
          name,
          description,
          message_template,
          reminder_type,
          send_time: sendTimeHours,
          send_time_minutes: sendTimeMinutes,
          is_active: is_active ?? true
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