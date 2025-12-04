/**
 * OpenPhone API utility functions
 * Handles contact management and messaging via OpenPhone
 */

import { Logger } from '../lib/logger';

// Types
export interface OpenPhoneContactData {
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  notes?: string;
}

export interface OpenPhoneContact extends OpenPhoneContactData {
  id: string;
  phone_number: string;
}

export interface OpenPhoneSearchResponse {
  data: OpenPhoneContact[];
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Create or update a contact in OpenPhone
 */
export async function createOrUpdateOpenPhoneContact(
  phone: string,
  contactData: OpenPhoneContactData
): Promise<OpenPhoneContact> {
  try {
    Logger.info('Creating/updating OpenPhone contact', { phone, hasData: !!contactData });

    // First, try to find existing contact
    const searchResponse = await fetch(`https://api.openphone.com/v1/contacts?phone_number=${phone}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY || '',
        'Accept': 'application/json'
      }
    });

    let contactId: string | null = null;
    if (searchResponse.ok) {
      const searchResult: OpenPhoneSearchResponse = await searchResponse.json();
      if (searchResult.data && searchResult.data.length > 0) {
        contactId = searchResult.data[0].id;
        Logger.debug('Found existing OpenPhone contact', { contactId });
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

    let response: Response;
    if (contactId) {
      // Update existing contact
      Logger.debug('Updating existing OpenPhone contact', { contactId });
      response = await fetch(`https://api.openphone.com/v1/contacts/${contactId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.OPENPHONE_API_KEY || '',
          'Accept': 'application/json'
        },
        body: JSON.stringify(contactPayload)
      });
    } else {
      // Create new contact
      Logger.debug('Creating new OpenPhone contact');
      response = await fetch('https://api.openphone.com/v1/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.OPENPHONE_API_KEY || '',
          'Accept': 'application/json'
        },
        body: JSON.stringify(contactPayload)
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      Logger.error('OpenPhone contact API error', new Error(errorText), {
        status: response.status,
        phone
      });
      throw new Error(`OpenPhone contact API returned ${response.status}: ${errorText}`);
    }

    const result: OpenPhoneContact = await response.json();
    Logger.info('OpenPhone contact operation successful', { contactId: result.id });
    return result;

  } catch (error) {
    Logger.error('Error creating/updating OpenPhone contact', error, { phone });
    throw error;
  }
}

/**
 * Send personalized SMS with contact name
 */
export async function sendPersonalizedSMS(
  to: string,
  message: string,
  contactName: string | null = null
): Promise<SMSResult> {
  try {
    // If we have a contact name, personalize the message
    let personalizedMessage = message;
    if (contactName) {
      // Replace generic placeholders with actual name
      personalizedMessage = message.replace(/\{name\}/g, contactName);
      personalizedMessage = personalizedMessage.replace(/\{firstName\}/g, contactName.split(' ')[0]);
    }

    Logger.info('Sending personalized SMS', { to, hasContactName: !!contactName });

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
        content: personalizedMessage
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      Logger.error('Failed to send personalized SMS', new Error(errorText), {
        status: response.status,
        to
      });
      return { success: false, error: errorText };
    }

    const result = await response.json();
    Logger.info('Personalized SMS sent successfully', { messageId: result.id });
    return { success: true, messageId: result.id };

  } catch (error) {
    Logger.error('Error sending personalized SMS', error, { to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update OpenPhone contact and send personalized message
 */
export async function updateContactAndSendPersonalizedMessage(
  phone: string,
  contactData: OpenPhoneContactData,
  message: string
): Promise<SMSResult> {
  try {
    // First, create/update the contact in OpenPhone
    await createOrUpdateOpenPhoneContact(phone, contactData);

    // Then send personalized message
    const contactName = contactData.first_name && contactData.last_name
      ? `${contactData.first_name} ${contactData.last_name}`
      : contactData.first_name || contactData.last_name || null;

    return await sendPersonalizedSMS(phone, message, contactName);

  } catch (error) {
    Logger.error('Error in updateContactAndSendPersonalizedMessage', error, { phone });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
