import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Function to send SMS using OpenPhone
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

    // Send appropriate SMS based on status
    let smsMessage = '';
    if (status === 'approved') {
      smsMessage = "We've reviewed your request and would like to formally invite you to become a member of Noir.\n\nTo officially join, please complete the following:\n\nhttps://skylineandco.typeform.com/noirkc-signup#auth_code=tw\n\nThe link expires in 24 hours, so please respond to this text with any questions.\n\nThank you.";
    } else if (status === 'waitlisted') {
      smsMessage = "Thank you for your membership invitation request. At this time, our membership is full, and we will keep your information on file should any spots become available. Thank you again.";
    } else if (status === 'denied') {
      smsMessage = "Thank you for your interest in Noir. After careful consideration, we are unable to extend an invitation at this time. We wish you the best in your future endeavors.";
    }

    if (smsMessage) {
      await sendSMS(waitlistEntry.phone, smsMessage);
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