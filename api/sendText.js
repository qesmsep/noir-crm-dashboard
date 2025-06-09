import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;
const OPENPHONE_PHONE_NUMBER_ID = process.env.OPENPHONE_PHONE_NUMBER_ID;

export default async function handler(req, res) {
  if (req.method === 'POST') {
    console.log('sendText handler invoked with body:', req.body);
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_ids, content, template, sent_by, direct_phone } = req.body;
  if ((!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) && !direct_phone) {
    return res.status(400).json({ error: 'Either member_ids (array) or direct_phone is required' });
  }
  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  // Prepare results
  const results = [];

  // If direct_phone is provided, send SMS directly
  if (direct_phone) {
    try {
      // Ensure direct_phone is sanitized to include '+'
      const toPhone = direct_phone.startsWith('+') ? direct_phone : '+' + direct_phone;
      const response = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': OPENPHONE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: [toPhone],
          from: OPENPHONE_PHONE_NUMBER_ID,
          content: content,
        }),
      });

      const textResponse = await response.text();
      let apiResult;
      if (textResponse.trim().startsWith('<!DOCTYPE html')) {
        apiResult = { error: 'HTML response received — likely SSL or domain issue', raw: textResponse };
      } else {
        try {
          apiResult = JSON.parse(textResponse);
        } catch (e) {
          apiResult = { error: 'Invalid JSON response from OpenPhone', raw: textResponse };
        }
      }
      const status = response.ok ? 'sent' : 'failed';
      results.push({ phone: toPhone, status, apiResult });
    } catch (err) {
      results.push({ phone: direct_phone, status: 'failed', error: err.message });
    }
  } else {
    // Fetch members' phone numbers
    const { data: members, error: memberError } = await supabase
      .from('members')
      .select('member_id, first_name, last_name, phone')
      .in('member_id', member_ids);

    if (memberError) {
      return res.status(500).json({ error: 'Failed to fetch members', details: memberError.message });
    }

    for (const member of members) {
      const toPhone = member.phone ? (member.phone.startsWith('+') ? member.phone : '+' + member.phone) : null;
      if (!toPhone) {
        results.push({ member_id: member.member_id, status: 'failed', error: 'No phone number' });
        continue;
      }
      try {
        // Send SMS via OpenPhone API
        const response = await fetch('https://api.openphone.com/v1/messages', {
          method: 'POST',
          headers: {
            'Authorization': OPENPHONE_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: [toPhone],
            from: OPENPHONE_PHONE_NUMBER_ID,
            content: content,
          }),
        });

        const textResponse = await response.text();
        let apiResult;
        if (textResponse.trim().startsWith('<!DOCTYPE html')) {
          apiResult = { error: 'HTML response received — likely SSL or domain issue', raw: textResponse };
        } else {
          try {
            apiResult = JSON.parse(textResponse);
          } catch (e) {
            apiResult = { error: 'Invalid JSON response from OpenPhone', raw: textResponse };
          }
        }
        const status = response.ok ? 'sent' : 'failed';
        // Store in messages table
        await supabase.from('messages').insert({
          member_id: member.member_id,
          content,
          timestamp: new Date().toISOString(),
          status,
          error_message: status === 'failed' ? (apiResult.error || JSON.stringify(apiResult)) : null,
          sent_by: sent_by || null,
        });
        results.push({ member_id: member.member_id, status, apiResult });
      } catch (err) {
        await supabase.from('messages').insert({
          member_id: member.member_id,
          content,
          timestamp: new Date().toISOString(),
          status: 'failed',
          error_message: err.message,
          sent_by: sent_by || null,
        });
        results.push({ member_id: member.member_id, status: 'failed', error: err.message });
      }
    }
  }

  return res.status(200).json({ results });
} 