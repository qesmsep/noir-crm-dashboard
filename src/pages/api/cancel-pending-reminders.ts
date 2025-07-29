import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { template_id } = req.body;

    if (!template_id) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    // Update all pending reminders for this template to cancelled status
    const { data, error } = await supabase
      .from('scheduled_reservation_reminders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('template_id', template_id)
      .eq('status', 'pending')
      .select();

    if (error) {
      console.error('Error cancelling pending reminders:', error);
      return res.status(500).json({ error: 'Failed to cancel pending reminders' });
    }

    const cancelledCount = data?.length || 0;

    res.status(200).json({ 
      message: 'Pending reminders cancelled successfully',
      cancelled_count: cancelledCount
    });

  } catch (error) {
    console.error('Error cancelling pending reminders:', error);
    res.status(500).json({ error: 'Failed to cancel pending reminders' });
  }
} 