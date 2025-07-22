// OpenPhone API utility functions
import fetch from 'node-fetch';

// Function to create or update a contact in OpenPhone
export async function createOrUpdateOpenPhoneContact(phone, contactData) {
  try {
    console.log('Creating/updating OpenPhone contact for:', phone);
    console.log('Contact data:', contactData);

    // First, try to find existing contact
    const searchResponse = await fetch(`https://api.openphone.com/v1/contacts?phone_number=${phone}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY,
        'Accept': 'application/json'
      }
    });

    let contactId = null;
    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      if (searchResult.data && searchResult.data.length > 0) {
        contactId = searchResult.data[0].id;
        console.log('Found existing contact with ID:', contactId);
      }
    }

    // Prepare contact data
    const contactPayload = {
      first_name: contactData.first_name || '',
      last_name: contactData.last_name || '',
      phone_number: phone,
      email: contactData.email || '',
      company: contactData.company || '',
      notes: contactData.notes || ''
    };

    let response;
    if (contactId) {
      // Update existing contact
      console.log('Updating existing contact:', contactId);
      response = await fetch(`https://api.openphone.com/v1/contacts/${contactId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.OPENPHONE_API_KEY,
          'Accept': 'application/json'
        },
        body: JSON.stringify(contactPayload)
      });
    } else {
      // Create new contact
      console.log('Creating new contact');
      response = await fetch('https://api.openphone.com/v1/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.OPENPHONE_API_KEY,
          'Accept': 'application/json'
        },
        body: JSON.stringify(contactPayload)
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenPhone contact API error:', errorText);
      throw new Error(`OpenPhone contact API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('OpenPhone contact operation successful:', result);
    return result;

  } catch (error) {
    console.error('Error creating/updating OpenPhone contact:', error);
    throw error;
  }
}

// Function to send personalized SMS with contact name
export async function sendPersonalizedSMS(to, message, contactName = null) {
  try {
    // If we have a contact name, personalize the message
    let personalizedMessage = message;
    if (contactName) {
      // Replace generic placeholders with actual name
      personalizedMessage = message.replace(/\{name\}/g, contactName);
      personalizedMessage = message.replace(/\{firstName\}/g, contactName.split(' ')[0]);
    }

    console.log('Sending personalized SMS to:', to);
    console.log('Message:', personalizedMessage);

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
        content: personalizedMessage
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send personalized SMS:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log('Personalized SMS sent successfully:', result);
    return { success: true, messageId: result.id };

  } catch (error) {
    console.error('Error sending personalized SMS:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Function to update OpenPhone contact and send personalized message
export async function updateContactAndSendPersonalizedMessage(phone, contactData, message) {
  try {
    // First, create/update the contact in OpenPhone
    await createOrUpdateOpenPhoneContact(phone, contactData);

    // Then send personalized message
    const contactName = contactData.first_name && contactData.last_name 
      ? `${contactData.first_name} ${contactData.last_name}`
      : contactData.first_name || contactData.last_name || null;

    return await sendPersonalizedSMS(phone, message, contactName);

  } catch (error) {
    console.error('Error in updateContactAndSendPersonalizedMessage:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
} 