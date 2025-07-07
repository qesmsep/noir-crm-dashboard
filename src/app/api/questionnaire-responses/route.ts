import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to send email notification
const sendEmailNotification = async (to: string, subject: string, message: string) => {
  try {
    // TODO: Integrate with your email service (SendGrid, AWS SES, etc.)
    console.log('Sending email notification:', { to, subject, message });
    
    // For now, log the notification details
    const { error } = await supabase
      .from('notification_logs')
      .insert({
        type: 'email',
        recipient: to,
        subject,
        message,
        sent_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error logging email notification:', error);
    }
  } catch (err) {
    console.error('Error sending email notification:', err);
  }
};

// Helper function to send SMS notification
const sendSMSNotification = async (to: string, message: string) => {
  try {
    // TODO: Integrate with your SMS service (Twilio, AWS SNS, etc.)
    console.log('Sending SMS notification:', { to, message });
    
    // For now, log the notification details
    const { error } = await supabase
      .from('notification_logs')
      .insert({
        type: 'sms',
        recipient: to,
        message,
        sent_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error logging SMS notification:', error);
    }
  } catch (err) {
    console.error('Error sending SMS notification:', err);
  }
};

// Helper function to track analytics events
const trackAnalyticsEvent = async (questionnaireId: string, eventType: string, meta: any = {}) => {
  try {
    const { error } = await supabase
      .from('questionnaire_analytics')
      .insert({
        questionnaire_id: questionnaireId,
        event_type: eventType,
        session_id: meta.sessionId,
        user_agent: meta.userAgent,
        ip_address: meta.ipAddress,
        referrer: meta.referrer,
        completion_time: meta.completionTime,
      });

    if (error) {
      console.error('Error tracking analytics event:', error);
    }
  } catch (err) {
    console.error('Error tracking analytics:', err);
  }
};

export async function POST(request: NextRequest) {
  try {
    const { questionnaireId, answers, files, signatures, meta } = await request.json();

    // Validate required fields
    if (!questionnaireId || !answers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Track form completion event
    await trackAnalyticsEvent(questionnaireId, 'complete', {
      sessionId: meta?.sessionId,
      userAgent,
      ipAddress,
      referrer: meta?.referrer,
      completionTime: meta?.completionTime,
    });

    // Get questionnaire details for notifications
    const { data: questionnaire, error: questionnaireError } = await supabase
      .from('questionnaire_templates')
      .select('*')
      .eq('id', questionnaireId)
      .single();

    if (questionnaireError) {
      console.error('Error fetching questionnaire:', questionnaireError);
      return NextResponse.json({ error: 'Failed to fetch questionnaire details' }, { status: 500 });
    }

    // Handle file uploads to Supabase storage
    const processedAnswers = { ...answers };
    const fileUrls: { [key: string]: string } = {};

    if (files && Object.keys(files).length > 0) {
      for (const [questionId, fileData] of Object.entries(files)) {
        if (typeof fileData === 'string' && fileData.startsWith('data:')) {
          try {
            // Extract file type and base64 data
            const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const [, mimeType, base64Data] = matches;
              const fileExtension = mimeType.split('/')[1] || 'bin';
              const fileName = `questionnaire-files/${questionnaireId}/${questionId}-${Date.now()}.${fileExtension}`;
              
              // Upload to Supabase storage
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('questionnaire-files')
                .upload(fileName, Buffer.from(base64Data, 'base64'), {
                  contentType: mimeType,
                  upsert: false
                });

              if (uploadError) {
                console.error('File upload error:', uploadError);
                return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
              }

              // Get public URL
              const { data: urlData } = supabase.storage
                .from('questionnaire-files')
                .getPublicUrl(fileName);

              fileUrls[questionId] = urlData.publicUrl;
              processedAnswers[questionId] = urlData.publicUrl;
            }
          } catch (fileError) {
            console.error('File processing error:', fileError);
            return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
          }
        }
      }
    }

    // Store response in database
    const { data: responseData, error: responseError } = await supabase
      .from('questionnaire_responses')
      .insert({
        questionnaire_id: questionnaireId,
        answers: processedAnswers,
        file_urls: fileUrls,
        signatures: signatures || {},
        meta_data: {
          ...meta,
          ipAddress,
          userAgent,
          submittedAt: new Date().toISOString(),
        },
        member_id: meta?.memberId || null,
        tracking_id: meta?.trackingId || null,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (responseError) {
      console.error('Database error:', responseError);
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
    }

    // Send notifications based on questionnaire options
    if (questionnaire.options?.notificationOption) {
      const notificationOption = questionnaire.options.notificationOption;
      const notificationEmail = questionnaire.options.notificationEmail;
      
      // Prepare notification message
      const subject = `New Questionnaire Response: ${questionnaire.name}`;
      const message = `
        A new response has been submitted for the questionnaire "${questionnaire.name}".
        
        Response ID: ${responseData.id}
        Submitted: ${new Date().toLocaleString()}
        Member ID: ${meta?.memberId || 'N/A'}
        
        You can view the full response in the admin dashboard.
      `;

      if (notificationOption === 'email' && notificationEmail) {
        await sendEmailNotification(notificationEmail, subject, message);
      } else if (notificationOption === 'sms' && notificationEmail) {
        await sendSMSNotification(notificationEmail, message);
      } else if (notificationOption === 'both' && notificationEmail) {
        await sendEmailNotification(notificationEmail, subject, message);
        await sendSMSNotification(notificationEmail, message);
      }
    }

    return NextResponse.json({ 
      success: true, 
      responseId: responseData.id,
      answers: processedAnswers 
    });

  } catch (err: any) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
} 