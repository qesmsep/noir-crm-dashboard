import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { DateTime } from 'luxon';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    console.log('🔄 Starting onboarding message processing...');
    
    // Get business timezone
    let businessTimezone = 'America/Chicago';
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('timezone')
      .single();
    if (!settingsError && settings?.timezone) {
      businessTimezone = settings.timezone;
    }

    const now = DateTime.now().setZone(businessTimezone);
    console.log(`⏰ Current time (${businessTimezone}): ${now.toFormat('yyyy-MM-dd HH:mm:ss')}`);

    // Get all active onboarding templates
    const { data: templates, error: templatesError } = await supabase
      .from('onboarding_templates')
      .select('*')
      .eq('is_active', true);

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }

    if (!templates || templates.length === 0) {
      console.log('ℹ️ No active onboarding templates found');
      return res.status(200).json({ message: 'No active templates found', processed: 0 });
    }

    console.log(`📋 Found ${templates.length} active onboarding templates`);

    // Get recent members (joined in the last 30 days)
    const thirtyDaysAgo = now.minus({ days: 30 }).toISO();
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('*')
      .gte('join_date', thirtyDaysAgo)
      .order('join_date', { ascending: false });

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return res.status(500).json({ error: 'Failed to fetch members' });
    }

    if (!members || members.length === 0) {
      console.log('ℹ️ No recent members found');
      return res.status(200).json({ message: 'No recent members found', processed: 0 });
    }

    console.log(`👥 Found ${members.length} recent members`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each template for each member
    for (const template of templates) {
      console.log(`📝 Processing template: ${template.name}`);
      
      for (const member of members) {
        try {
          // Calculate when this message should be sent
          const joinDate = DateTime.fromISO(member.join_date, { zone: 'utc' }).setZone(businessTimezone);
          const targetTime = joinDate
            .plus({ days: template.timing_days })
            .plus({ hours: template.timing_hours })
            .plus({ minutes: template.timing_minutes })
            .set({ 
              hour: parseInt(template.send_time.split(':')[0]), 
              minute: parseInt(template.send_time.split(':')[1]),
              second: 0,
              millisecond: 0
            });

          // Check if it's time to send this message
          if (targetTime > now) {
            console.log(`⏰ Message for ${member.first_name} scheduled for ${targetTime.toFormat('yyyy-MM-dd HH:mm:ss')} - not due yet`);
            continue;
          }

          // Check if message was already sent
          const { data: existingMessage, error: checkError } = await supabase
            .from('scheduled_onboarding_messages')
            .select('id')
            .eq('member_id', member.member_id)
            .eq('template_id', template.id)
            .single();

          if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error checking existing message:', checkError);
            continue;
          }

          if (existingMessage) {
            console.log(`✅ Message already sent for ${member.first_name} with template ${template.name}`);
            continue;
          }

          // Determine recipient phone based on template type
          let recipientPhone = member.phone;
          if (template.recipient_type === 'member') {
            // Get primary member's phone
            const { data: primaryMember, error: primaryError } = await supabase
              .from('members')
              .select('phone')
              .eq('account_id', member.account_id)
              .eq('member_type', 'primary')
              .single();

            if (!primaryError && primaryMember?.phone) {
              recipientPhone = primaryMember.phone;
            }
          } else if (template.recipient_type === 'specific_phone' && template.specific_phone) {
            recipientPhone = template.specific_phone;
          }

          if (!recipientPhone) {
            console.log(`⚠️ No phone number available for ${member.first_name}`);
            results.failed++;
            continue;
          }

          // Create message content with placeholders
          let messageContent = template.content;
          messageContent = messageContent.replace(/\{\{first_name\}\}/g, member.first_name || '');
          messageContent = messageContent.replace(/\{\{last_name\}\}/g, member.last_name || '');
          messageContent = messageContent.replace(/\{\{member_name\}\}/g, `${member.first_name || ''} ${member.last_name || ''}`.trim());
          messageContent = messageContent.replace(/\{\{phone\}\}/g, member.phone || '');
          messageContent = messageContent.replace(/\{\{email\}\}/g, member.email || '');

          // Format phone number for OpenPhone
          let formattedPhone = recipientPhone;
          if (!formattedPhone.startsWith('+')) {
            const digits = formattedPhone.replace(/\D/g, '');
            if (digits.length === 10) {
              formattedPhone = '+1' + digits;
            } else if (digits.length === 11 && digits.startsWith('1')) {
              formattedPhone = '+' + digits;
            } else {
              formattedPhone = '+' + digits;
            }
          }

          // Send SMS using OpenPhone API
          const smsResponse = await fetch('https://api.openphone.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': process.env.OPENPHONE_API_KEY!,
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              to: [formattedPhone],
              from: process.env.OPENPHONE_PHONE_NUMBER_ID!,
              content: messageContent
            })
          });

          if (!smsResponse.ok) {
            throw new Error(`SMS API returned ${smsResponse.status}`);
          }

          const smsResult = await smsResponse.json();

          // Record the sent message
          const { error: insertError } = await supabase
            .from('scheduled_onboarding_messages')
            .insert({
              member_id: member.member_id,
              template_id: template.id,
              message_content: messageContent,
              recipient_phone: recipientPhone,
              scheduled_for: targetTime.toISO(),
              sent_at: now.toISO(),
              status: 'sent',
              openphone_message_id: smsResult.id || null
            });

          if (insertError) {
            console.error('Error recording sent message:', insertError);
          }

          console.log(`  ✅ Message sent successfully to ${member.first_name}`);
          results.sent++;
          results.processed++;

        } catch (error: any) {
          console.error(`  ❌ Error processing message for ${member.first_name}:`, error);
          results.failed++;
          results.errors.push(`Failed to send message to ${member.first_name}: ${error.message}`);
        }
      }
    }

    console.log(`📊 Processing complete: ${results.processed} processed, ${results.sent} sent, ${results.failed} failed`);
    
    res.status(200).json({
      message: 'Onboarding message processing complete',
      results
    });

  } catch (error: any) {
    console.error('❌ Error in onboarding message processing:', error);
    res.status(500).json({ 
      error: 'Failed to process onboarding messages',
      details: error.message 
    });
  }
} 