import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      visit_frequency,
      go_to_drink,
      referral_code,
      referred_by_member_id
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !phone || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate the referral code exists
    if (referral_code && referred_by_member_id) {
      const { data: referrer, error: referrerError } = await supabaseAdmin
        .from('members')
        .select('member_id, first_name, last_name')
        .eq('member_id', referred_by_member_id)
        .eq('referral_code', referral_code.toUpperCase())
        .single();

      if (referrerError || !referrer) {
        return res.status(400).json({ error: 'Invalid referral code' });
      }
    }

    // Check if there's an existing waitlist entry from the referral link click
    // If so, update it. Otherwise, create a new one.
    let waitlist;
    let waitlistError;

    if (referral_code && referred_by_member_id) {
      // Try to find existing entry
      const { data: existingEntry } = await supabaseAdmin
        .from('waitlist')
        .select('*')
        .eq('referral_code', referral_code.toUpperCase())
        .eq('referred_by_member_id', referred_by_member_id)
        .eq('status', 'link_clicked')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingEntry) {
        // Update existing entry
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('waitlist')
          .update({
            first_name,
            last_name,
            phone,
            email,
            company: company || null,
            city_state: city_state || null,
            visit_frequency: visit_frequency || null,
            go_to_drink: go_to_drink || null,
            status: 'submitted',
            form_step: 5, // Completed all steps
          })
          .eq('id', existingEntry.id)
          .select()
          .single();

        waitlist = updated;
        waitlistError = updateError;
      } else {
        // No existing entry, create new one
        const waitlistData = {
          first_name,
          last_name,
          phone,
          email,
          company: company || null,
          city_state: city_state || null,
          referral: referred_by_member_id
            ? `Referred by member ${referred_by_member_id}`
            : null,
          visit_frequency: visit_frequency || null,
          go_to_drink: go_to_drink || null,
          status: 'submitted',
          form_step: 5,
          referral_code: referral_code?.toUpperCase() || null,
          referred_by_member_id: referred_by_member_id || null
        };

        const { data: created, error: createError } = await supabaseAdmin
          .from('waitlist')
          .insert(waitlistData)
          .select()
          .single();

        waitlist = created;
        waitlistError = createError;
      }
    } else {
      // No referral info, just create new entry
      const waitlistData = {
        first_name,
        last_name,
        phone,
        email,
        company: company || null,
        city_state: city_state || null,
        referral: null,
        visit_frequency: visit_frequency || null,
        go_to_drink: go_to_drink || null,
        status: 'submitted',
        form_step: 5,
        referral_code: null,
        referred_by_member_id: null
      };

      const { data: created, error: createError } = await supabaseAdmin
        .from('waitlist')
        .insert(waitlistData)
        .select()
        .single();

      waitlist = created;
      waitlistError = createError;
    }

    if (waitlistError) {
      console.error('Error creating waitlist entry:', waitlistError);
      return res.status(500).json({ error: 'Failed to submit application' });
    }

    // Send SMS notification to applicant
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: phone,
          message: `Thank you for applying to Noir! ${referred_by_member_id ? 'Your referral has been noted. ' : ''}We'll review your application and get back to you within 72 hours. Reply to this text with any questions.`
        }),
      });
    } catch (smsError) {
      console.error('Error sending SMS:', smsError);
      // Don't fail the request if SMS fails
    }

    // Send notification to referring member if applicable
    if (referred_by_member_id) {
      try {
        const { data: referrer } = await supabaseAdmin
          .from('members')
          .select('phone, first_name')
          .eq('member_id', referred_by_member_id)
          .single();

        if (referrer?.phone) {
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/send-sms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: referrer.phone,
              message: `Great news! ${first_name} ${last_name} just applied to Noir using your referral link. We'll let you know when they become a member. Thank you for helping grow our community!`
            }),
          });
        }
      } catch (referrerNotifError) {
        console.error('Error sending referrer notification:', referrerNotifError);
        // Don't fail the request
      }
    }

    return res.status(200).json({
      success: true,
      waitlist_id: waitlist.id,
      message: 'Application submitted successfully'
    });

  } catch (error: any) {
    console.error('Referral submission error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
