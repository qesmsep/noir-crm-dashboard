import { supabaseAdmin } from '../../lib/supabase';

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

    // Find existing settings row (there should be at most one)
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('settings')
      .select('id')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching settings:', fetchError);
      return res.status(500).json({ error: 'Failed to save booking window' });
    }

    if (fetchError && fetchError.code === 'PGRST116') {
      // No settings row exists; create one with the booking window
      const { error: insertError } = await supabaseAdmin
        .from('settings')
        .insert([{ booking_start_date: start, booking_end_date: end }]);
      if (insertError) {
        console.error('Error inserting settings:', insertError);
        return res.status(500).json({ error: 'Failed to save booking window' });
      }
    } else {
      // Update existing row by id
      const { error: updateError } = await supabaseAdmin
        .from('settings')
        .update({ booking_start_date: start, booking_end_date: end })
        .eq('id', existing.id);
      if (updateError) {
        console.error('Error updating settings:', updateError);
        return res.status(500).json({ error: 'Failed to save booking window' });
      }
    }

    console.log('Booking window saved successfully');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving booking window:', error);
    res.status(500).json({ error: 'Failed to save booking window' });
  }
} 