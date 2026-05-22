import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  try {
    // TEST 1: Check active campaigns
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, trigger_type, is_active')
      .eq('is_active', true)
      .limit(5);

    results.tests.push({
      name: 'Active Campaigns',
      status: campaignsError ? 'FAILED' : 'PASSED',
      count: campaigns?.length || 0,
      data: campaigns || null,
      error: campaignsError?.message || null
    });

    // TEST 2: Check for test member (858-412-9797)
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, last_name, phone, email, dob')
      .or('phone.eq.858-412-9797,phone.eq.+18584129797,phone.eq.8584129797')
      .limit(1);

    results.tests.push({
      name: 'Test Member (858-412-9797)',
      status: memberError ? 'FAILED' : (member && member.length > 0 ? 'PASSED' : 'NOT_FOUND'),
      data: member && member.length > 0 ? member[0] : null,
      error: memberError?.message || null
    });

    // TEST 3: Check recent reservations
    const { data: reservations, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('id, first_name, last_name, phone, email, start_time, end_time, party_size, status, location_id')
      .order('created_at', { ascending: false })
      .limit(5);

    results.tests.push({
      name: 'Recent Reservations',
      status: resError ? 'FAILED' : 'PASSED',
      count: reservations?.length || 0,
      data: reservations || null,
      error: resError?.message || null
    });

    // TEST 4: Check scheduled messages for test phones
    const { data: messages, error: msgError } = await supabaseAdmin
      .from('scheduled_messages')
      .select('id, phone_number, message_content, scheduled_time, sent_time, status')
      .or('phone_number.like.%858%,phone_number.like.%913%')
      .order('created_at', { ascending: false })
      .limit(10);

    results.tests.push({
      name: 'Scheduled Messages (Test Phones)',
      status: msgError ? 'FAILED' : 'PASSED',
      count: messages?.length || 0,
      data: messages || null,
      error: msgError?.message || null
    });

    // TEST 5: Check campaign messages with new fields
    const { data: campaignMessages, error: cmError } = await supabaseAdmin
      .from('campaign_messages')
      .select('id, name, timing_type, relative_quantity, relative_unit, relative_proximity, duration_quantity, duration_unit')
      .limit(5);

    results.tests.push({
      name: 'Campaign Messages Schema Check',
      status: cmError ? 'FAILED' : 'PASSED',
      data: campaignMessages || null,
      error: cmError?.message || null,
      note: 'Check if relative_* fields exist vs old duration_* fields'
    });

    // TEST 6: Check locations for timezone
    const { data: locations, error: locError } = await supabaseAdmin
      .from('locations')
      .select('id, name, timezone')
      .limit(5);

    results.tests.push({
      name: 'Locations Timezone Check',
      status: locError ? 'FAILED' : 'PASSED',
      data: locations || null,
      error: locError?.message || null
    });

    return res.status(200).json(results);

  } catch (error: any) {
    return res.status(500).json({
      error: 'Test execution failed',
      message: error.message,
      results
    });
  }
}
