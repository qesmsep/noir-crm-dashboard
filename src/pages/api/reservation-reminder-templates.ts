import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching reservation reminder templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  } else if (req.method === 'POST') {
    try {
      console.log('POST request body:', req.body);
      const { name, description, message_template, quantity, time_unit, proximity, is_active, send_time } = req.body;

      // Validate new fields
      if (quantity < 0 || quantity > 99) {
        return res.status(400).json({ error: 'Quantity must be between 0 and 99' });
      }

      if (!['hr', 'min', 'day'].includes(time_unit)) {
        return res.status(400).json({ error: 'Invalid time_unit. Must be hr, min, or day' });
      }

      if (!['before', 'after'].includes(proximity)) {
        return res.status(400).json({ error: 'Invalid proximity. Must be before or after' });
      }

      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .insert([{
          name,
          description,
          message_template,
          quantity,
          time_unit,
          proximity,
          is_active: is_active ?? true,
          // Add old fields for backward compatibility
          reminder_type: time_unit === 'hr' && quantity === 0 ? 'day_of' : 'hour_before',
          send_time: quantity.toString(),
          send_time_minutes: 0,
          created_by: null
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      res.status(201).json(data);
    } catch (error) {
      console.error('Error creating reservation reminder template:', error);
      res.status(500).json({ error: 'Failed to create template', details: error.message });
    }
  } else if (req.method === 'PUT') {
    try {
      console.log('PUT request query:', req.query);
      console.log('PUT request body:', req.body);
      const { id } = req.query;
      const { name, description, message_template, quantity, time_unit, proximity, is_active, send_time } = req.body;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Template ID is required' });
      }

      // Validate new fields
      if (quantity < 0 || quantity > 99) {
        return res.status(400).json({ error: 'Quantity must be between 0 and 99' });
      }

      if (!['hr', 'min', 'day'].includes(time_unit)) {
        return res.status(400).json({ error: 'Invalid time_unit. Must be hr, min, or day' });
      }

      if (!['before', 'after'].includes(proximity)) {
        return res.status(400).json({ error: 'Invalid proximity. Must be before or after' });
      }

      const { data, error } = await supabase
        .from('reservation_reminder_templates')
        .update({
          name,
          description,
          message_template,
          quantity,
          time_unit,
          proximity,
          is_active: is_active ?? true,
          send_time,
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