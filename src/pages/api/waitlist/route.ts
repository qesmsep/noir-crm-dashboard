import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateContactAndSendPersonalizedMessage } from '../../../utils/openphoneUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Function to send SMS using OpenPhone (legacy function for backward compatibility)
async function sendSMS(to: string, message: string) {
  try {
    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY!,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [to],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID!,
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('waitlist')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: waitlistEntries, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching waitlist:', error);
      return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
    }

    // Get count by status
    const { data: statusCounts } = await supabase
      .rpc('get_waitlist_count_by_status');

    return NextResponse.json({
      data: waitlistEntries,
      count: count || 0,
      statusCounts: statusCounts || []
    });

  } catch (error) {
    console.error('Error in waitlist GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, review_notes } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the waitlist entry to send SMS
    const { data: waitlistEntry, error: fetchError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !waitlistEntry) {
      return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 });
    }

    // Update the waitlist entry
    const updateData: any = {
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
      return NextResponse.json({ error: 'Failed to update waitlist entry' }, { status: 500 });
    }

    // Send appropriate SMS based on status with personalization
    let smsMessage = '';
    if (status === 'approved') {
      smsMessage = "Hi {firstName} - We've reviewed your request and would like to formally invite you to become a member of Noir.\n\nTo officially join, please complete the following:\n\nhttps://skylineandco.typeform.com/noirkc-signup#auth_code=tw\n\nThe link expires in 24 hours, so please respond to this text with any questions.\n\nThank you.";
    } else if (status === 'waitlisted') {
      smsMessage = "Hi {firstName} - Thank you for your membership invitation request. At this time, our membership is full, and we will keep your information on file should any spots become available. Thank you again.";
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

    return NextResponse.json({
      success: true,
      data: updatedEntry,
      message: `Waitlist entry ${status} successfully`
    });

  } catch (error) {
    console.error('Error in waitlist PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Default export required for Next.js 16 compatibility in pages directory
export default async function handler(req: Request) {
  if (req.method === 'GET') {
    return GET(req);
  } else if (req.method === 'PATCH') {
    return PATCH(req);
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 