import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Function to send SMS using OpenPhone
async function sendSMS(to, message) {
  try {
    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [to],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: message
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send SMS:', errorText);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { status, limit = '10', offset = '0' } = req.query;
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);

      let query = supabase
        .from('waitlist')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: waitlistEntries, error, count } = await query
        .range(offsetNum, offsetNum + limitNum - 1);

      if (error) {
        console.error('Error fetching waitlist:', error);
        return res.status(500).json({ error: 'Failed to fetch waitlist' });
      }

      // Get count by status
      const { data: statusCounts } = await supabase
        .rpc('get_waitlist_count_by_status');

      return res.status(200).json({
        data: waitlistEntries,
        count: count || 0,
        statusCounts: statusCounts || []
      });

    } catch (error) {
      console.error('Error in waitlist GET:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, status, review_notes } = req.body;

      if (!id || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get the waitlist entry to send SMS
      const { data: waitlistEntry, error: fetchError } = await supabase
        .from('waitlist')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !waitlistEntry) {
        return res.status(404).json({ error: 'Waitlist entry not found' });
      }

      // Update the waitlist entry
      const updateData = {
        status,
        reviewed_at: new Date().toISOString(),
        review_notes
      };

      const { data: updatedEntry, error: updateError } = await supabase
        .from('waitlist')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating waitlist entry:', updateError);
        return res.status(500).json({ error: 'Failed to update waitlist entry' });
      }

      // Send appropriate SMS based on status
      let smsMessage = '';
      if (status === 'approved') {
        smsMessage = "We've reviewed your request and would like to formally invite you to become a member of Noir.\n\nTo officially join, please complete the following:\n\nhttps://skylineandco.typeform.com/noirkc-signup#auth_code=tw\n\nThe link expires in 24 hours, so please respond to this text with any questions.\n\nThank you.";
      } else if (status === 'waitlisted') {
        smsMessage = "We appreciate your request.\n\nNoir is intentionally intimate—each additional member carefully considered to preserve the experience we value most at Noir.\n\nAt this time, we aren't able to extend an invitation. However, you've been added to our waitlist, and as space allows, your request will be revisited and you'll be notified.\n\nThank you for your patience. We hope to welcome you, when the time is right.";
      } else if (status === 'denied') {
        smsMessage = "Thank you for your interest in Noir. After careful consideration, we are unable to extend an invitation at this time. We wish you the best in your future endeavors.";
      }

      if (smsMessage) {
        await sendSMS(waitlistEntry.phone, smsMessage);
      }

      return res.status(200).json({
        success: true,
        data: updatedEntry,
        message: `Waitlist entry ${status} successfully`
      });

    } catch (error) {
      console.error('Error in waitlist PATCH:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
} 