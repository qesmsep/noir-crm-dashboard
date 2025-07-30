import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { DateTime } from 'luxon';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { action, templateId, memberId } = req.body;
    
    console.log('=== TESTING CAMPAIGN TIMING ===');
    console.log('Action:', action);
    console.log('Template ID:', templateId);
    console.log('Member ID:', memberId);

    if (action === 'test-template') {
      // Test a specific template's timing logic
      if (!templateId) {
        return res.status(400).json({ error: 'Template ID is required' });
      }

      const { data: template, error: templateError } = await supabaseAdmin
        .from('campaign_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      console.log('Template found:', template);

      // Calculate when this template would be sent
      const now = DateTime.now();
      const businessTimezone = 'America/Chicago';
      
      let targetSendTime: DateTime;
      let triggerDate: DateTime;

      // Simulate different trigger dates for testing
      const testScenarios = [
        { name: 'Member signed up today', triggerDate: now },
        { name: 'Member signed up yesterday', triggerDate: now.minus({ days: 1 }) },
        { name: 'Member signed up 3 days ago', triggerDate: now.minus({ days: 3 }) },
        { name: 'Member signed up 7 days ago', triggerDate: now.minus({ days: 7 }) },
      ];

      const results = testScenarios.map(scenario => {
        if (template.timing_type === 'specific_time') {
          const [hours, minutes] = template.specific_time?.split(':').map(Number) || [10, 0];
          targetSendTime = scenario.triggerDate.setZone(businessTimezone).set({ 
            hour: hours, 
            minute: minutes, 
            second: 0, 
            millisecond: 0 
          });
        } else {
          targetSendTime = scenario.triggerDate.plus({
            [template.duration_unit || 'hr']: template.duration_proximity === 'after' 
              ? template.duration_quantity || 1 
              : -(template.duration_quantity || 1)
          });
        }

        const timeDiff = Math.abs(targetSendTime.diff(now, 'minutes').minutes);
        const shouldSendNow = timeDiff <= 10; // Within 10 minutes

        return {
          scenario: scenario.name,
          triggerDate: scenario.triggerDate.toISO(),
          targetSendTime: targetSendTime.toISO(),
          timeDiffMinutes: Math.round(timeDiff),
          shouldSendNow,
          timingType: template.timing_type,
          timingDetails: template.timing_type === 'specific_time' 
            ? `At ${template.specific_time}` 
            : `${template.duration_quantity} ${template.duration_unit} ${template.duration_proximity} trigger`
        };
      });

      console.log('Test results:', results);

      return res.status(200).json({
        template,
        testResults: results,
        message: 'Template timing analysis complete'
      });

    } else if (action === 'test-member') {
      // Test a specific member's campaign messages
      if (!memberId) {
        return res.status(400).json({ error: 'Member ID is required' });
      }

      const { data: member, error: memberError } = await supabaseAdmin
        .from('members')
        .select('*')
        .eq('member_id', memberId)
        .single();

      if (memberError || !member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      console.log('Member found:', member);

      // Get all active templates
      const { data: templates, error: templatesError } = await supabaseAdmin
        .from('campaign_templates')
        .select('*')
        .eq('is_active', true);

      if (templatesError) {
        return res.status(500).json({ error: 'Failed to fetch templates' });
      }

      const now = DateTime.now();
      const businessTimezone = 'America/Chicago';
      
      const memberMessages = templates.map(template => {
        let targetSendTime: DateTime;
        let triggerDate: DateTime;

        // Determine trigger date based on template trigger type
        if (template.trigger_type === 'member_signup') {
          triggerDate = DateTime.fromISO(member.join_date, { zone: 'utc' }).setZone(businessTimezone);
        } else if (template.trigger_type === 'member_birthday') {
          // Use today as birthday for testing
          triggerDate = now.setZone(businessTimezone);
        } else {
          // For other trigger types, use join date as fallback
          triggerDate = DateTime.fromISO(member.join_date, { zone: 'utc' }).setZone(businessTimezone);
        }

        if (template.timing_type === 'specific_time') {
          const [hours, minutes] = template.specific_time?.split(':').map(Number) || [10, 0];
          targetSendTime = triggerDate.set({ 
            hour: hours, 
            minute: minutes, 
            second: 0, 
            millisecond: 0 
          });
        } else {
          targetSendTime = triggerDate.plus({
            [template.duration_unit || 'hr']: template.duration_proximity === 'after' 
              ? template.duration_quantity || 1 
              : -(template.duration_quantity || 1)
          });
        }

        const timeDiff = Math.abs(targetSendTime.diff(now, 'minutes').minutes);
        const shouldSendNow = timeDiff <= 10;

        return {
          templateId: template.id,
          templateName: template.name,
          triggerType: template.trigger_type,
          timingType: template.timing_type,
          triggerDate: triggerDate.toISO(),
          targetSendTime: targetSendTime.toISO(),
          timeDiffMinutes: Math.round(timeDiff),
          shouldSendNow,
          timingDetails: template.timing_type === 'specific_time' 
            ? `At ${template.specific_time}` 
            : `${template.duration_quantity} ${template.duration_unit} ${template.duration_proximity} trigger`
        };
      });

      console.log('Member message analysis:', memberMessages);

      return res.status(200).json({
        member,
        messages: memberMessages,
        message: 'Member campaign analysis complete'
      });

    } else if (action === 'simulate-cron') {
      // Simulate the cron job processing
      console.log('Simulating cron job processing...');
      
      const now = DateTime.now();
      const businessTimezone = 'America/Chicago';
      
      // Get all active templates
      const { data: templates, error: templatesError } = await supabaseAdmin
        .from('campaign_templates')
        .select('*')
        .eq('is_active', true);

      if (templatesError) {
        return res.status(500).json({ error: 'Failed to fetch templates' });
      }

      console.log(`Found ${templates.length} active templates`);

      const processedMessages: any[] = [];

      for (const template of templates) {
        console.log(`Processing template: ${template.name}`);

        // Get relevant members based on trigger type
        let members: any[] = [];
        
        if (template.trigger_type === 'member_signup') {
          // Get members who joined recently (within last 30 days)
          const thirtyDaysAgo = now.minus({ days: 30 }).toISO();
          const { data: onboardingMembers, error: onboardingError } = await supabaseAdmin
            .from('members')
            .select('*')
            .gte('join_date', thirtyDaysAgo)
            .order('join_date', { ascending: false });

          if (onboardingError) {
            console.error('Error fetching onboarding members:', onboardingError);
            continue;
          }
          members = onboardingMembers || [];
        } else if (template.trigger_type === 'member_birthday') {
          // Get members with birthdays today
          const today = now.toFormat('MM-dd');
          const { data: birthdayMembers, error: birthdayError } = await supabaseAdmin
            .from('members')
            .select('*')
            .filter('dob', 'not.is', null)
            .filter('to_char(dob, \'MM-dd\')', 'eq', today);

          if (birthdayError) {
            console.error('Error fetching birthday members:', birthdayError);
            continue;
          }
          members = birthdayMembers || [];
        }

        console.log(`Found ${members.length} members for template ${template.name}`);

        for (const member of members) {
          try {
            // Calculate send time based on template timing
            let targetSendTime: DateTime;
            let triggerDate: DateTime;

            if (template.trigger_type === 'member_signup') {
              triggerDate = DateTime.fromISO(member.join_date, { zone: 'utc' }).setZone(businessTimezone);
            } else if (template.trigger_type === 'member_birthday') {
              triggerDate = now.setZone(businessTimezone);
            }

            if (template.timing_type === 'specific_time') {
              const [hours, minutes] = template.specific_time?.split(':').map(Number) || [10, 0];
              targetSendTime = triggerDate.set({ 
                hour: hours, 
                minute: minutes, 
                second: 0, 
                millisecond: 0 
              });
            } else {
              targetSendTime = triggerDate.plus({
                [template.duration_unit || 'hr']: template.duration_proximity === 'after' 
                  ? template.duration_quantity || 1 
                  : -(template.duration_quantity || 1)
              });
            }

            // Check if message should be sent now (within 10 minutes of target time)
            const timeDiff = Math.abs(targetSendTime.diff(now, 'minutes').minutes);
            const shouldSendNow = timeDiff <= 10;

            if (shouldSendNow) {
              processedMessages.push({
                templateId: template.id,
                templateName: template.name,
                memberId: member.member_id,
                memberName: `${member.first_name} ${member.last_name}`,
                targetSendTime: targetSendTime.toISO(),
                timeDiffMinutes: Math.round(timeDiff),
                wouldSend: true,
                message: `Would send message to ${member.first_name} ${member.last_name} (${member.phone})`
              });
            } else {
              processedMessages.push({
                templateId: template.id,
                templateName: template.name,
                memberId: member.member_id,
                memberName: `${member.first_name} ${member.last_name}`,
                targetSendTime: targetSendTime.toISO(),
                timeDiffMinutes: Math.round(timeDiff),
                wouldSend: false,
                message: `Not time to send yet (${Math.round(timeDiff)} minutes away)`
              });
            }

          } catch (error) {
            console.error(`Error processing member ${member.member_id}:`, error);
          }
        }
      }

      console.log('Cron simulation complete');
      console.log('Processed messages:', processedMessages);

      return res.status(200).json({
        processedMessages,
        totalTemplates: templates.length,
        totalMessages: processedMessages.length,
        messagesToSend: processedMessages.filter(m => m.wouldSend).length,
        message: 'Cron job simulation complete'
      });

    } else {
      return res.status(400).json({ 
        error: 'Invalid action. Use: test-template, test-member, or simulate-cron',
        availableActions: ['test-template', 'test-member', 'simulate-cron']
      });
    }

  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
} 