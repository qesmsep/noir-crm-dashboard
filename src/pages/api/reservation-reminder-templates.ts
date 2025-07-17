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
      console.log('POST request body:', req.body);
      const { name, description, message_template, reminder_type, send_time, is_active } = req.body;

      // Validate send_time format based on reminder type
      let validatedSendTime: string;

      if (reminder_type === 'day_of') {
        // send_time format: "HH:MM" (e.g., "10:05", "14:30") or "HH:MMZZ" (e.g., "10:05-05:00")
        const timeRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):([0-5][0-9])$/;
        const timezoneRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):([0-5][0-9])([+-][0-9]{2}:[0-9]{2})$/;
        if (!timeRegex.test(send_time) && !timezoneRegex.test(send_time)) {
          return res.status(400).json({ error: 'Invalid time format for day_of reminder. Use HH:MM format (e.g., "10:05") or HH:MMZZ format (e.g., "10:05-05:00")' });
        }
        validatedSendTime = send_time;
      } else if (reminder_type === 'hour_before') {
        // send_time format: "H:M" or "H" (e.g., "1:30", "2:00", "1")
        const timeRegex = /^([0-9]|[1-9][0-9]):([0-5][0-9])$|^([0-9]|[1-9][0-9])$/;
        if (!timeRegex.test(send_time)) {
          return res.status(400).json({ error: 'Invalid time format for hour_before reminder. Use H:M or H format (e.g., "1:30" or "2")' });
        }
        validatedSendTime = send_time;
      } else {
        return res.status(400).json({ error: 'Invalid reminder_type' });
      }

      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .insert([{
          name,
          description,
          message_template,
          reminder_type,
          send_time: validatedSendTime,
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
      console.log('PUT request query:', req.query);
      console.log('PUT request body:', req.body);
      const { id } = req.query;
      const { name, description, message_template, reminder_type, send_time, is_active } = req.body;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Template ID is required' });
      }

      // Validate send_time format based on reminder type
      let validatedSendTime: string;

      if (reminder_type === 'day_of') {
        // send_time format: "HH:MM" (e.g., "10:05", "14:30") or "HH:MMZZ" (e.g., "10:05-05:00")
        const timeRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):([0-5][0-9])$/;
        const timezoneRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):([0-5][0-9])([+-][0-9]{2}:[0-9]{2})$/;
        if (!timeRegex.test(send_time) && !timezoneRegex.test(send_time)) {
          return res.status(400).json({ error: 'Invalid time format for day_of reminder. Use HH:MM format (e.g., "10:05") or HH:MMZZ format (e.g., "10:05-05:00")' });
        }
        validatedSendTime = send_time;
      } else if (reminder_type === 'hour_before') {
        // send_time format: "H:M" or "H" (e.g., "1:30", "2:00", "1")
        const timeRegex = /^([0-9]|[1-9][0-9]):([0-5][0-9])$|^([0-9]|[1-9][0-9])$/;
        if (!timeRegex.test(send_time)) {
          return res.status(400).json({ error: 'Invalid time format for hour_before reminder. Use H:M or H format (e.g., "1:30" or "2")' });
        }
        validatedSendTime = send_time;
      } else {
        return res.status(400).json({ error: 'Invalid reminder_type' });
      }

      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .update({
          name,
          description,
          message_template,
          reminder_type,
          send_time: validatedSendTime,
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