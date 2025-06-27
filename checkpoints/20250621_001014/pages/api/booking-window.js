import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { start, end } = req.body;
  if (!start || !end) {
    return res.status(400).json({ error: 'Start and end dates are required' });
  }

  try {
    console.log('Saving booking window:', { start, end });
    await supabase.from('booking_window').upsert({ booking_start_date: start, booking_end_date: end });
    console.log('Booking window saved successfully');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving booking window:', error);
    res.status(500).json({ error: 'Failed to save booking window' });
  }
} 