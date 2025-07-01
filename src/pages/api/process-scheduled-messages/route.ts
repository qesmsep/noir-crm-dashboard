import { NextRequest, NextResponse } from 'next/server';
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
      return { success: false, error: errorText };
    }
    
    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return { success: false, error: error.message };
  }
}

// POST - Process and send scheduled messages
export async function POST(request: NextRequest) {
  try {
    // Get all pending messages that are due to be sent
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select(`
        *,
        members (
          first_name,
          last_name,
          phone
        ),
        campaign_templates (
          name
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      console.error('Error fetching pending messages:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch pending messages' }, { status: 500 });
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return NextResponse.json({ 
        message: 'No pending messages to process',
        processed: 0,
        successful: 0,
        failed: 0
      });
    }

    console.log(`Processing ${pendingMessages.length} scheduled messages`);

    let successful = 0;
    let failed = 0;
    const results: Array<{
      id: string;
      status: string;
      messageId?: string;
      error?: string;
    }> = [];

    for (const message of pendingMessages) {
      try {
        // Replace placeholders in message content
        let processedContent = message.message_content;
        if (message.members?.first_name) {
          processedContent = processedContent.replace(/\{\{first_name\}\}/g, message.members.first_name);
        }

        // Send the SMS
        const smsResult = await sendSMS(message.members.phone, processedContent);

        // Update message status
        const updateData: any = {
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (smsResult.success) {
          updateData.status = 'sent';
          updateData.openphone_message_id = smsResult.messageId;
          successful++;
          results.push({
            id: message.id,
            status: 'sent',
            messageId: smsResult.messageId
          });
        } else {
          updateData.status = 'failed';
          updateData.error_message = smsResult.error;
          failed++;
          results.push({
            id: message.id,
            status: 'failed',
            error: smsResult.error
          });
        }

        const { error: updateError } = await supabase
          .from('scheduled_messages')
          .update(updateData)
          .eq('id', message.id);

        if (updateError) {
          console.error('Error updating message status:', updateError);
        }

      } catch (error) {
        console.error('Error processing message:', error);
        failed++;
        
        // Mark as failed
        await supabase
          .from('scheduled_messages')
          .update({
            status: 'failed',
            error_message: error.message,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);

        results.push({
          id: message.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return NextResponse.json({
      message: 'Scheduled messages processed',
      processed: pendingMessages.length,
      successful,
      failed,
      results
    });

  } catch (error) {
    console.error('Error in process scheduled messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get statistics about scheduled messages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get message statistics
    const { data: messageStats, error: statsError } = await supabase
      .from('scheduled_messages')
      .select('status, created_at')
      .gte('created_at', startDate.toISOString());

    if (statsError) {
      console.error('Error fetching message stats:', statsError);
      return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
    }

    // Get pending messages count
    const { count: pendingCount, error: pendingError } = await supabase
      .from('scheduled_messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (pendingError) {
      console.error('Error fetching pending count:', pendingError);
      return NextResponse.json({ error: 'Failed to fetch pending count' }, { status: 500 });
    }

    // Calculate statistics
    const stats = {
      total: messageStats?.length || 0,
      pending: pendingCount || 0,
      sent: messageStats?.filter(m => m.status === 'sent').length || 0,
      failed: messageStats?.filter(m => m.status === 'failed').length || 0,
      cancelled: messageStats?.filter(m => m.status === 'cancelled').length || 0
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error in scheduled messages stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 