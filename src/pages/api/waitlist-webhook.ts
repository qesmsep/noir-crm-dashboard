import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { FIELD_MAPPING, FIELD_TYPES, REQUIRED_FIELDS } from '../../../config/typeform-mapping';

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

// Enhanced function to find answer in Typeform response
function findAnswer(answers: any[], fieldRefs: string[], type?: string) {
  for (const ref of fieldRefs) {
    const answer = answers.find(
      a => (a.field.ref === ref || a.field.id === ref || a.field.title === ref) &&
           (!type || a.type === type)
    );
    
    if (answer) {
      // Extract value based on type
      if (type === 'choice' && answer.choice) return answer.choice.label;
      if (type === 'file_url' && answer.file_url) return answer.file_url;
      if (type === 'phone_number' && answer.phone_number) return answer.phone_number;
      if (type === 'email' && answer.email) return answer.email;
      if (type === 'date' && answer.date) return answer.date;
      if (type === 'long_text' && answer.text) return answer.text;
      if (answer.text) return answer.text;
      
      return null;
    }
  }
  return null;
}

// Function to extract all form data using dynamic mapping
function extractFormData(answers: any[]) {
  const data: any = {};
  
  Object.entries(FIELD_MAPPING).forEach(([dbField, fieldRefs]) => {
    const fieldType = FIELD_TYPES[dbField as keyof typeof FIELD_TYPES];
    const value = findAnswer(answers, fieldRefs, fieldType);
    if (value !== null) {
      data[dbField] = value;
    }
  });
  
  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    console.log('Waitlist webhook received:', body);

    // Extract form response
    const formResponse = body.form_response || body;
    
    if (!formResponse || !formResponse.answers) {
      console.error('Invalid form response structure');
      return res.status(400).json({ error: 'Invalid form response' });
    }

    const answers = formResponse.answers;

    // Debug: Log the actual field structure to help identify correct refs
    console.log('=== TYPEFORM WEBHOOK DEBUG ===');
    console.log('Form response ID:', formResponse.response_id || formResponse.token);
    console.log('Number of answers:', answers.length);
    console.log('Typeform answers structure:', JSON.stringify(answers, null, 2));
    console.log('=== END DEBUG ===');

    // Extract form data using dynamic mapping
    const waitlistData = extractFormData(answers);
    
    // Add Typeform response ID
    waitlistData.typeform_response_id = formResponse.response_id || formResponse.token;

    // Validate required fields using dynamic configuration
    const missingFields = REQUIRED_FIELDS.filter(field => !waitlistData[field]);
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields, 'Received data:', waitlistData);
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing: missingFields,
        received: Object.keys(waitlistData)
      });
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
      return res.status(409).json({ 
        error: 'Already submitted', 
        message: 'You have already submitted a waitlist application' 
      });
    }

    // Insert into waitlist table
    const { data: waitlistEntry, error: insertError } = await supabase
      .from('waitlist')
      .insert([waitlistData])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting waitlist entry:', insertError);
      return res.status(500).json({ error: 'Failed to save application' });
    }

    // Send confirmation SMS - Removed the 72-hour message as requested
    // const confirmationMessage = "Thank you for submitting an invitation request. We typically respond to all requests within 72 hours.";
    // await sendSMS(formattedPhone, confirmationMessage);

    console.log('Waitlist entry created successfully:', waitlistEntry.id);

    return res.status(200).json({ 
      success: true, 
      message: 'Application submitted successfully',
      id: waitlistEntry.id 
    });

  } catch (error) {
    console.error('Error processing waitlist webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 