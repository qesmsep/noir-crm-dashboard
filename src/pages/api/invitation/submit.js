import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Function to send SMS using OpenPhone
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      first_name, 
      last_name, 
      phone, 
      email, 
      company, 
      city_state, 
      referral, 
      visit_frequency, 
      go_to_drink, 
      token 
    } = req.body;

    // Validate required fields (excluding token since it's optional now)
    if (!first_name || !last_name || !phone || !email || !company || !city_state || !referral || !visit_frequency || !go_to_drink) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    let waitlistEntry;
    let updatedEntry;

    if (token) {
      // If token is provided, validate it and update existing entry
      const { data: existingEntry, error: tokenError } = await supabase
        .from('waitlist')
        .select('*')
        .eq('application_token', token)
        .or('application_expires_at.is.null,application_expires_at.gt.now()')
        .single();

      if (tokenError || !existingEntry) {
        return res.status(404).json({ error: 'Invalid or expired invitation link' });
      }

      // Check if the application has already been submitted
      if (existingEntry.first_name && existingEntry.last_name && existingEntry.email) {
        return res.status(400).json({ error: 'This invitation has already been used' });
      }

      waitlistEntry = existingEntry;

      // Update the waitlist entry with the questionnaire data
      const updateData = {
        first_name,
        last_name,
        phone,
        email,
        company,
        city_state,
        referral,
        visit_frequency,
        go_to_drink,
        status: 'review',
        submitted_at: new Date().toISOString(),
        application_link_opened_at: new Date().toISOString()
      };

      const { data: updated, error: updateError } = await supabase
        .from('waitlist')
        .update(updateData)
        .eq('id', waitlistEntry.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating waitlist entry:', updateError);
        return res.status(500).json({ error: 'Failed to submit application' });
      }

      updatedEntry = updated;
    } else {
      // If no token, create a new waitlist entry
      const newEntryData = {
        first_name,
        last_name,
        phone,
        email,
        company,
        city_state,
        referral,
        visit_frequency,
        go_to_drink,
        status: 'review',
        submitted_at: new Date().toISOString()
      };

      const { data: newEntry, error: createError } = await supabase
        .from('waitlist')
        .insert(newEntryData)
        .select()
        .single();

      if (createError) {
        console.error('Error creating waitlist entry:', createError);
        return res.status(500).json({ error: 'Failed to submit application' });
      }

      updatedEntry = newEntry;
    }

    // Send confirmation SMS - Removed the 72-hour message as requested
    // const smsMessage = "Thank you for submitting an invitation to be a Noir Member. We typically respond to all requests within 72 hours.";
    // await sendSMS(phone, smsMessage);

    return res.status(200).json({
      success: true,
      message: 'Application submitted successfully',
      data: updatedEntry
    });

  } catch (error) {
    console.error('Error submitting invitation application:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 