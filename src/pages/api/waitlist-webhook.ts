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

// Function to find answer in Typeform response
function findAnswer(answers: any[], fieldRefs: string[], type?: string) {
  const answer = answers.find(
    a => (fieldRefs.includes(a.field.ref) || fieldRefs.includes(a.field.id)) &&
         (!type || a.type === type)
  );
  
  if (!answer) return null;
  
  if (type === 'choice' && answer.choice) return answer.choice.label;
  if (type === 'file_url' && answer.file_url) return answer.file_url;
  if (type === 'phone_number' && answer.phone_number) return answer.phone_number;
  if (type === 'email' && answer.email) return answer.email;
  if (type === 'date' && answer.date) return answer.date;
  if (answer.text) return answer.text;
  
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Waitlist webhook received:', body);

    // Extract form response
    const formResponse = body.form_response || body;
    
    if (!formResponse || !formResponse.answers) {
      console.error('Invalid form response structure');
      return NextResponse.json({ error: 'Invalid form response' }, { status: 400 });
    }

    const answers = formResponse.answers;

    // Extract form data - adjust field references based on your actual Typeform
    const waitlistData = {
      first_name: findAnswer(answers, ['first_name_field_ref']), // Replace with actual field ref
      last_name: findAnswer(answers, ['last_name_field_ref']), // Replace with actual field ref
      email: findAnswer(answers, ['email_field_ref'], 'email'),
      phone: findAnswer(answers, ['phone_field_ref'], 'phone_number'),
      company: findAnswer(answers, ['company_field_ref']),
      referral: findAnswer(answers, ['referral_field_ref']),
      how_did_you_hear: findAnswer(answers, ['how_did_you_hear_field_ref']),
      why_noir: findAnswer(answers, ['why_noir_field_ref']),
      occupation: findAnswer(answers, ['occupation_field_ref']),
      industry: findAnswer(answers, ['industry_field_ref']),
      typeform_response_id: formResponse.response_id || formResponse.token
    };

    // Validate required fields
    if (!waitlistData.first_name || !waitlistData.last_name || !waitlistData.email || !waitlistData.phone) {
      console.error('Missing required fields:', waitlistData);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Format phone number
    let formattedPhone = waitlistData.phone;
    if (formattedPhone) {
      const digits = formattedPhone.replace(/\D/g, '');
      if (digits.length === 10) {
        formattedPhone = '+1' + digits;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        formattedPhone = '+' + digits;
      } else {
        formattedPhone = '+' + digits;
      }
    }
    waitlistData.phone = formattedPhone;

    // Check if this email or phone already exists in waitlist
    const { data: existingEntry } = await supabase
      .from('waitlist')
      .select('id, status')
      .or(`email.eq.${waitlistData.email},phone.eq.${waitlistData.phone}`)
      .single();

    if (existingEntry) {
      console.log('Duplicate waitlist entry found:', existingEntry);
      return NextResponse.json({ 
        error: 'Already submitted', 
        message: 'You have already submitted a waitlist application' 
      }, { status: 409 });
    }

    // Insert into waitlist table
    const { data: waitlistEntry, error: insertError } = await supabase
      .from('waitlist')
      .insert([waitlistData])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting waitlist entry:', insertError);
      return NextResponse.json({ error: 'Failed to save application' }, { status: 500 });
    }

    // Send confirmation SMS
    const confirmationMessage = "Thank you for submitting an invitation request. We typically respond to all requests within 72 hours.";
    await sendSMS(formattedPhone, confirmationMessage);

    console.log('Waitlist entry created successfully:', waitlistEntry.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Application submitted successfully',
      id: waitlistEntry.id 
    });

  } catch (error) {
    console.error('Error processing waitlist webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 