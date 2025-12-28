import { createClient } from '@supabase/supabase-js';
import { updateContactAndSendPersonalizedMessage } from '../../utils/openphoneUtils';

// Initialize Supabase client with error handling
let supabase;
try {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables');
  }
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
} catch (error) {
  console.error('Error initializing Supabase client:', error);
  // Will be handled in handler
}

// Function to send SMS using OpenPhone (legacy function for backward compatibility)
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
  // Set JSON content type early to prevent HTML error pages
  res.setHeader('Content-Type', 'application/json');
  
  // Check if Supabase is properly initialized
  if (!supabase) {
    console.error('Supabase client not initialized');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Database connection not available'
    });
  }
  
  // Wrap entire handler in try-catch to ensure JSON errors
  try {
    if (req.method === 'GET') {
      try {
        const { status, limit = '10', offset = '0' } = req.query;
        const limitNum = parseInt(limit, 10);
        const offsetNum = parseInt(offset, 10);

        // Validate parsed values
        if (isNaN(limitNum) || isNaN(offsetNum) || limitNum < 0 || offsetNum < 0) {
          return res.status(400).json({ 
            error: 'Invalid pagination parameters',
            message: 'limit and offset must be valid non-negative numbers'
          });
        }

        let query = supabase
          .from('waitlist')
          .select('*', { count: 'exact' })
          .order('submitted_at', { ascending: false });

        if (status) {
          query = query.eq('status', status);
        }

        const { data: waitlistEntries, error, count } = await query
          .range(offsetNum, offsetNum + limitNum - 1);

        if (error) {
          console.error('Error fetching waitlist:', error);
          return res.status(500).json({ 
            error: 'Failed to fetch waitlist', 
            details: error.message || 'Database query failed'
          });
        }

        // Get count by status - handle RPC errors gracefully
        let statusCounts = [];
        try {
          const { data: counts, error: rpcError } = await supabase
            .rpc('get_waitlist_count_by_status');
          
          if (rpcError) {
            console.error('Error fetching status counts:', rpcError);
            // Continue without status counts rather than failing
          } else {
            statusCounts = counts || [];
          }
        } catch (rpcErr) {
          console.error('Exception in RPC call:', rpcErr);
          // Continue without status counts
        }

        return res.status(200).json({
          data: waitlistEntries || [],
          count: count || 0,
          statusCounts: statusCounts
        });

      } catch (error) {
        console.error('Error in waitlist GET:', error);
        return res.status(500).json({ 
          error: 'Internal server error',
          message: error.message || 'Unknown error'
        });
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

      // Send appropriate SMS based on status with personalization
      let smsMessage = '';
      if (status === 'approved') {
        smsMessage = "Hi {firstName} - We've reviewed your request and would like to formally invite you to become a member of Noir.\n\nTo officially join, please complete the following:\n\nhttps://skylineandco.typeform.com/noirkc-signup#auth_code=tw\n\nThe link expires in 24 hours, so please respond to this text with any questions.\n\nThank you.";
      } else if (status === 'waitlisted') {
        smsMessage = "Hi {firstName} - We appreciate your request.\n\nNoir is intentionally intimate—each additional member carefully considered to preserve the experience we value most at Noir.\n\nAt this time, we aren't able to extend an invitation. However, you've been added to our waitlist, and as space allows, your request will be revisited and you'll be notified.\n\nThank you for your patience. We hope to welcome you, when the time is right.";
      } else if (status === 'denied') {
        smsMessage = "Hi {firstName} - Thank you for your interest in Noir. After careful consideration, we are unable to extend an invitation at this time. We wish you the best in your future endeavors.";
      }

      if (smsMessage) {
        // Prepare contact data for OpenPhone
        const contactData = {
          first_name: waitlistEntry.first_name || '',
          last_name: waitlistEntry.last_name || '',
          email: waitlistEntry.email || '',
          company: waitlistEntry.company || '',
          notes: `Waitlist ${status} - ${waitlistEntry.city_state || ''} - ${waitlistEntry.referral || ''}`
        };

        // Update OpenPhone contact and send personalized message
        const result = await updateContactAndSendPersonalizedMessage(
          waitlistEntry.phone, 
          contactData, 
          smsMessage
        );

        if (!result.success) {
          console.error('Failed to send personalized SMS:', result.error);
          // Fallback to regular SMS if personalized fails
          await sendSMS(waitlistEntry.phone, smsMessage.replace(/\{firstName\}/g, waitlistEntry.first_name || 'there'));
        }
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

    // Method not allowed
    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (error) {
    // Catch any unhandled errors (like Supabase initialization failures)
    console.error('Unhandled error in waitlist handler:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 