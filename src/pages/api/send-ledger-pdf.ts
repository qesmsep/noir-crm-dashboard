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
          'Authorization': process.env.OPENPHONE_API_KEY || '',
          'Accept': 'application/json'
        },
      body: JSON.stringify({
        to: [to],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: message
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`SMS API error: ${errorData.message || response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  console.log('📄 Generating and sending ledger PDF...');

  try {
    const { member_id, account_id, start_date, end_date, phone, member_name } = req.body;

    if (!member_id || !account_id || !start_date || !end_date || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate PDF
    const pdfGenerator = new LedgerPdfGenerator();
    const pdfBuffer = await pdfGenerator.generateLedgerPdf(member_id, account_id, start_date, end_date);

    let pdfUrl: string | null = null;
    let uploadSuccess = false;

    // Try to upload to Supabase Storage
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `ledger_${member_id}_${start_date}_${end_date}_${timestamp}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ledger-pdfs')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Error uploading PDF:', uploadError);
        if (uploadError.message === 'The resource already exists') {
          console.log('⚠️  File already exists, using fallback method');
        } else {
          throw new Error('Storage upload failed');
        }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('ledger-pdfs')
        .getPublicUrl(fileName);

      pdfUrl = publicUrl;
      uploadSuccess = true;
      console.log('✅ PDF uploaded to storage successfully');

    } catch (storageError) {
      console.log('⚠️  Storage upload failed, using fallback method');
      console.log('Storage error:', storageError);
      
      // Fallback: Create a data URL for the PDF
      const base64Pdf = pdfBuffer.toString('base64');
      pdfUrl = `data:application/pdf;base64,${base64Pdf}`;
      uploadSuccess = false;
    }

    // Send SMS with PDF link
    const message = uploadSuccess 
      ? `Hi ${member_name}, here's your ledger for ${start_date} to ${end_date}: ${pdfUrl}`
      : `Hi ${member_name}, your ledger PDF for ${start_date} to ${end_date} has been generated. Please contact us to receive it.`;
    
    const smsResult = await sendSMS(phone, message);

    // Log the notification (only if the table exists)
    try {
      const { error: logError } = await supabase
        .from('scheduled_ledger_notifications')
        .insert({
          member_id,
          account_id,
          renewal_date: new Date().toISOString().split('T')[0], // Not a renewal, but for tracking
          ledger_start_date: start_date,
          ledger_end_date: end_date,
          scheduled_for: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          status: 'sent',
          pdf_url: pdfUrl,
          sms_message_id: smsResult.id || null
        });

      if (logError) {
        console.error('Error logging notification:', logError);
        // Don't fail the request if logging fails
      }
    } catch (logError) {
      console.log('⚠️  Could not log notification (table may not exist yet)');
    }

    console.log(`✅ PDF sent successfully to ${member_name} (${phone})`);

    res.status(200).json({
      message: 'PDF sent successfully',
      pdf_url: pdfUrl,
      sms_id: smsResult.id,
      storage_uploaded: uploadSuccess,
      note: uploadSuccess ? 'PDF uploaded to storage' : 'PDF generated but not uploaded to storage'
    });

  } catch (error: any) {
    console.error('Error sending ledger PDF:', error);
    res.status(500).json({ error: error.message || 'Failed to send PDF' });
  }
} 