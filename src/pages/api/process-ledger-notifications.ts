import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { LedgerPdfGenerator } from '../../utils/ledgerPdfGenerator';

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
    
    const result = await response.json();
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Function to send admin notification
async function sendAdminNotification(message: string) {
  try {
    // Get admin phone number from settings or environment
    const { data: settings } = await supabase
      .from('settings')
      .select('admin_notification_phone')
      .single();

    const adminPhone = settings?.admin_notification_phone || process.env.ADMIN_PHONE;
    
    if (!adminPhone) {
      console.error('No admin phone number configured');
      return false;
    }

    const result = await sendSMS(adminPhone, message);
    return result.success;
  } catch (error) {
    console.error('Error sending admin notification:', error);
    return false;
  }
}

// Function to upload PDF to Supabase storage
async function uploadPdfToStorage(pdfBuffer: Buffer, memberId: string, renewalDate: string): Promise<string> {
  try {
    const fileName = `ledger-${memberId}-${renewalDate}.pdf`;
    const filePath = `ledger-pdfs/${fileName}`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading PDF:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  console.log('🔄 Processing ledger notifications...');

  try {
    // Get pending notifications that are due to be sent
    const now = new Date().toISOString();
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('scheduled_ledger_notifications')
      .select(`
        *,
        members (
          first_name,
          last_name,
          phone,
          email
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      console.error('Error fetching pending notifications:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch pending notifications' });
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('✅ No pending ledger notifications to process');
      return res.status(200).json({ message: 'No pending notifications to process' });
    }

    console.log(`📱 Found ${pendingNotifications.length} pending notifications to process`);

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Get notification settings
    const { data: settings, error: settingsError } = await supabase
      .from('ledger_notification_settings')
      .select('*')
      .eq('is_enabled', true)
      .single();

    if (settingsError || !settings) {
      console.error('Error fetching notification settings:', settingsError);
      return res.status(500).json({ error: 'Failed to fetch notification settings' });
    }

    // Process each pending notification
    for (const notification of pendingNotifications) {
      try {
        console.log(`📤 Processing notification ${notification.id} for ${notification.members.first_name} ${notification.members.last_name}`);
        
        const member = notification.members;
        
        if (!member.phone) {
          throw new Error('Member has no phone number');
        }

        // Generate PDF
        console.log('📄 Generating PDF...');
        const pdfGenerator = new LedgerPdfGenerator();
        const pdfBuffer = await pdfGenerator.generateLedgerPdf(
          notification.member_id,
          notification.account_id,
          notification.ledger_start_date,
          notification.ledger_end_date
        );

        // Upload PDF to storage
        console.log('☁️ Uploading PDF to storage...');
        const pdfUrl = await uploadPdfToStorage(pdfBuffer, notification.member_id, notification.renewal_date);

        // Create message content
        let messageContent = settings.message_template;
        messageContent = messageContent.replace('{{first_name}}', member.first_name || 'Member');
        messageContent = messageContent.replace('{{renewal_date}}', new Date(notification.renewal_date).toLocaleDateString());
        messageContent += `\n\nView your ledger: ${pdfUrl}`;

        // Format phone number
        let formattedPhone = member.phone;
        if (!formattedPhone.startsWith('+')) {
          const digits = formattedPhone.replace(/\D/g, '');
          if (digits.length === 10) {
            formattedPhone = '+1' + digits;
          } else if (digits.length === 11 && digits.startsWith('1')) {
            formattedPhone = '+' + digits;
          } else {
            formattedPhone = '+' + digits;
          }
        }

        // Send SMS
        console.log('📱 Sending SMS...');
        const smsResult = await sendSMS(formattedPhone, messageContent);

        if (!smsResult.success) {
          throw new Error(`SMS failed: ${smsResult.error}`);
        }

        // Update notification status
        const { error: updateError } = await supabase
          .from('scheduled_ledger_notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            pdf_url: pdfUrl,
            sms_message_id: smsResult.messageId || null
          })
          .eq('id', notification.id);

        if (updateError) {
          console.error('Error updating notification status:', updateError);
          results.errors.push(`Failed to update notification ${notification.id}: ${updateError.message}`);
        } else {
          results.successful++;
          console.log(`✅ Successfully sent ledger notification to ${formattedPhone}`);
        }

        results.processed++;

      } catch (error) {
        console.error('Error processing notification:', error);

        // Update notification status to failed
        const { error: updateError } = await supabase
          .from('scheduled_ledger_notifications')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', notification.id);

        if (updateError) {
          console.error('Error updating failed notification status:', updateError);
        }

        results.failed++;
        results.errors.push(`Failed to process notification ${notification.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Send admin notification for failures
        const adminMessage = `Ledger notification failed for ${notification.members.first_name} ${notification.members.last_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        await sendAdminNotification(adminMessage);
      }
    }

    console.log(`✅ Processed ${results.processed} notifications: ${results.successful} successful, ${results.failed} failed`);

    res.status(200).json({
      message: `Processed ${results.processed} ledger notifications`,
      processed: results.processed,
      successful: results.successful,
      failed: results.failed,
      errors: results.errors
    });

  } catch (error) {
    console.error('Error processing ledger notifications:', error);
    res.status(500).json({ error: 'Failed to process notifications' });
  }
} 