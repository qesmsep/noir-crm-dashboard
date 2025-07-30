import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'DELETE') {
    try {
      const { reminder_id } = req.query;

      if (!reminder_id || typeof reminder_id !== 'string') {
        return res.status(400).json({ error: 'Reminder ID is required' });
      }

      // Delete the reminder
      const { error: deleteError } = await supabase
        .from('scheduled_reservation_reminders')
        .delete()
        .eq('id', reminder_id);

      if (deleteError) {
        console.error('Error deleting reservation reminder:', deleteError);
        return res.status(500).json({ error: 'Failed to delete reminder' });
      }

      res.status(200).json({ message: 'Reminder deleted successfully' });
    } catch (error) {
      console.error('Error in delete reservation reminder API:', error);
      res.status(500).json({ error: 'Failed to delete reminder' });
    }
  } else {
    res.setHeader('Allow', ['DELETE']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
} 