console.log('[WAITLIST API] Module loading started at', new Date().toISOString());

import { createClient } from '@supabase/supabase-js';
import { updateContactAndSendPersonalizedMessage } from '../../utils/openphoneUtils';

console.log('[WAITLIST API] Supabase and openphoneUtils imported successfully');

// Initialize Supabase client with error handling
let supabase;
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[WAITLIST API] Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey
    });
  } else {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (error) {
  console.error('[WAITLIST API] Error initializing Supabase client:', error);
  console.error('[WAITLIST API] Error stack:', error.stack);
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

console.log('[WAITLIST API] Handler function defined');

export default async function handler(req, res) {
  // CRITICAL: Log immediately when handler is called
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[WAITLIST API] ========== HANDLER CALLED [${requestId}] ==========`);
  console.log(`[WAITLIST API] Handler invoked at: ${new Date().toISOString()}`);
  console.log(`[WAITLIST API] Request method: ${req?.method}`);
  console.log(`[WAITLIST API] Request URL: ${req?.url}`);
  console.log(`[WAITLIST API] Request query:`, JSON.stringify(req?.query));
  console.log(`[WAITLIST API] Environment: ${process.env.NODE_ENV || 'unknown'}`);
  console.log(`[WAITLIST API] Response object exists: ${!!res}`);
  console.log(`[WAITLIST API] Response methods:`, {
    hasSetHeader: typeof res?.setHeader === 'function',
    hasStatus: typeof res?.status === 'function',
    hasJson: typeof res?.json === 'function'
  });

  // Set JSON content type early to prevent HTML error pages
  // This must be done BEFORE any operations that might throw
  try {
    console.log('[WAITLIST API] Attempting to set Content-Type header...');
    if (!res || typeof res.setHeader !== 'function') {
      console.error('[WAITLIST API] Invalid response object');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    console.log('[WAITLIST API] Content-Type header set successfully');
  } catch (headerError) {
    console.error('[WAITLIST API] ERROR setting Content-Type header:', headerError);
    console.error('[WAITLIST API] Error setting response headers:', headerError);
    // If we can't set headers, return immediately
    try {
      if (res && typeof res.status === 'function') {
        return res.status(500).json({ 
          error: 'Server configuration error',
          message: 'Failed to set response headers'
        });
      }
    } catch (e) {
      // If even JSON response fails, log and return nothing
      console.error('[WAITLIST API] Critical: Cannot send JSON response:', e);
      return;
    }
  }
  
  // Add request logging for debugging
  console.log('[WAITLIST API] Request received:', {
    method: req.method,
    url: req.url,
    query: req.query,
    timestamp: new Date().toISOString()
  });
  
  // Check if Supabase is properly initialized
  if (!supabase) {
    console.error('[WAITLIST API] Supabase client not initialized');
    console.error('[WAITLIST API] Env vars check:', {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Database connection not available',
      debug: process.env.NODE_ENV === 'development' ? 'Supabase client initialization failed' : undefined
    });
  }
  
  // Wrap entire handler in try-catch to ensure JSON errors
  try {
    if (req.method === 'GET') {
      try {
        console.log('[WAITLIST API] Processing GET request');
        const { status, limit = '10', offset = '0' } = req.query;
        console.log('[WAITLIST API] Query params:', { status, limit, offset });
        
        const limitNum = parseInt(limit, 10);
        const offsetNum = parseInt(offset, 10);

        // Validate parsed values
        if (isNaN(limitNum) || isNaN(offsetNum) || limitNum < 0 || offsetNum < 0) {
          console.error('[WAITLIST API] Invalid pagination params:', { limitNum, offsetNum });
          return res.status(400).json({ 
            error: 'Invalid pagination parameters',
            message: 'limit and offset must be valid non-negative numbers',
            received: { limit, offset, limitNum, offsetNum }
          });
        }

        console.log('[WAITLIST API] Building query with:', { status, limitNum, offsetNum });
        let query = supabase
          .from('waitlist')
          .select('*', { count: 'exact' })
          .order('submitted_at', { ascending: false });

        if (status) {
          query = query.eq('status', status);
        }

        console.log('[WAITLIST API] Executing database query...');
        const queryResult = await query.range(offsetNum, offsetNum + limitNum - 1);
        const { data: waitlistEntries, error, count } = queryResult;

        if (error) {
          console.error('[WAITLIST API] Database query error:', error);
          console.error('[WAITLIST API] Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          return res.status(500).json({ 
            error: 'Failed to fetch waitlist', 
            details: error.message || 'Database query failed',
            code: error.code,
            debug: process.env.NODE_ENV === 'development' ? {
              hint: error.hint,
              details: error.details
            } : undefined
          });
        }

        console.log('[WAITLIST API] Query successful:', {
          entriesCount: waitlistEntries?.length || 0,
          totalCount: count
        });

        // Get count by status - handle RPC errors gracefully
        let statusCounts = [];
        try {
          console.log('[WAITLIST API] Fetching status counts...');
          const { data: counts, error: rpcError } = await supabase
            .rpc('get_waitlist_count_by_status');
          
          if (rpcError) {
            console.error('[WAITLIST API] RPC error (non-fatal):', rpcError);
            // Continue without status counts rather than failing
          } else {
            statusCounts = counts || [];
            console.log('[WAITLIST API] Status counts retrieved:', statusCounts.length);
          }
        } catch (rpcErr) {
          console.error('[WAITLIST API] Exception in RPC call (non-fatal):', rpcErr);
          // Continue without status counts
        }

        const response = {
          data: waitlistEntries || [],
          count: count || 0,
          statusCounts: statusCounts
        };
        
        console.log('[WAITLIST API] Sending successful response');
        return res.status(200).json(response);

      } catch (error) {
        console.error('[WAITLIST API] Error in GET handler:', error);
        console.error('[WAITLIST API] Error stack:', error.stack);
        return res.status(500).json({ 
          error: 'Internal server error',
          message: error.message || 'Unknown error',
          type: error.constructor?.name || 'Error',
          debug: process.env.NODE_ENV === 'development' ? {
            stack: error.stack
          } : undefined
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
        console.error('[WAITLIST API] Error updating waitlist entry:', updateError);
        console.error('[WAITLIST API] Update error details:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        });
        
        // Check if it's an invalid enum value error
        if (updateError.code === '23502' || updateError.message?.includes('invalid input value') || updateError.message?.includes('enum')) {
          return res.status(400).json({ 
            error: 'Invalid status value',
            message: `The status '${status}' is not valid. Please ensure the database migration has been run to add the 'archived' status.`,
            details: updateError.message
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to update waitlist entry',
          message: updateError.message || 'Database update failed',
          details: process.env.NODE_ENV === 'development' ? updateError.details : undefined
        });
      }

      // Send appropriate SMS based on status with personalization
      // Note: archived status does not send SMS
      let smsMessage = '';
      if (status === 'approved') {
        smsMessage = "Hi {firstName} - We've reviewed your request and would like to formally invite you to become a member of Noir.\n\nTo officially join, please complete the following:\n\nhttps://skylineandco.typeform.com/noirkc-signup#auth_code=tw\n\nThe link expires in 24 hours, so please respond to this text with any questions.\n\nThank you.";
      } else if (status === 'waitlisted') {
        smsMessage = "Hi {firstName} - We appreciate your request.\n\nNoir is intentionally intimate—each additional member carefully considered to preserve the experience we value most at Noir.\n\nAt this time, we aren't able to extend an invitation. However, you've been added to our waitlist, and as space allows, your request will be revisited and you'll be notified.\n\nThank you for your patience. We hope to welcome you, when the time is right.";
      } else if (status === 'denied') {
        smsMessage = "Hi {firstName} - Thank you for your interest in Noir. After careful consideration, we are unable to extend an invitation at this time. We wish you the best in your future endeavors.";
      }
      // archived status intentionally does not send SMS

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
        let result;
        try {
          result = await updateContactAndSendPersonalizedMessage(
            waitlistEntry.phone, 
            contactData, 
            smsMessage
          );
        } catch (smsError) {
          console.error('[WAITLIST API] Error calling updateContactAndSendPersonalizedMessage:', smsError);
          result = { success: false, error: smsError.message };
        }

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
    const errorId = `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.error(`[WAITLIST API] [${requestId}] Unhandled error [${errorId}]:`, error);
    console.error(`[WAITLIST API] [${requestId}] Error type:`, error.constructor?.name);
    console.error(`[WAITLIST API] [${requestId}] Error message:`, error.message);
    console.error(`[WAITLIST API] [${requestId}] Error stack:`, error.stack);
    console.error(`[WAITLIST API] [${requestId}] Error details:`, {
      name: error.name,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      path: error.path
    });
    
    // Try to send JSON response, but if that fails, we're in trouble
    try {
      // Ensure Content-Type is set before sending response
      if (res && typeof res.setHeader === 'function' && !res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
      }
      
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        type: error.constructor?.name || 'Error',
        errorId: errorId, // Include error ID for tracking in logs
        debug: process.env.NODE_ENV === 'development' ? {
          stack: error.stack,
          name: error.name,
          code: error.code,
          errno: error.errno,
          syscall: error.syscall,
          path: error.path
        } : undefined
      });
    } catch (jsonError) {
      console.error(`[WAITLIST API] [${requestId}] CRITICAL: Cannot send JSON error response:`, jsonError);
      console.error(`[WAITLIST API] [${requestId}] JSON error stack:`, jsonError.stack);
      // Last resort - try to end the response
      try {
        if (res && !res.headersSent) {
          res.status(500).end();
        }
      } catch (e) {
        console.error(`[WAITLIST API] [${requestId}] CRITICAL: Cannot end response:`, e);
      }
    }
  }
}
