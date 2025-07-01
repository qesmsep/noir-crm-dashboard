import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Trigger followup campaign for a newly activated member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { member_id, activation_date } = body;

    if (!member_id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    // Use provided activation date or current time
    const memberActivationDate = activation_date || new Date().toISOString();

    // Get all active campaign templates
    const { data: templates, error: templatesError } = await supabase
      .from('campaign_templates')
      .select('*')
      .eq('is_active', true)
      .order('default_delay_days', { ascending: true });

    if (templatesError) {
      console.error('Error fetching campaign templates:', templatesError);
      return NextResponse.json({ error: 'Failed to fetch campaign templates' }, { status: 500 });
    }

    if (!templates || templates.length === 0) {
      return NextResponse.json({ 
        message: 'No active campaign templates found',
        triggered: 0
      });
    }

    // Get member details
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('member_id, first_name, last_name, phone')
      .eq('member_id', member_id)
      .single();

    if (memberError || !member) {
      console.error('Error fetching member:', memberError);
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    let triggeredCount = 0;
    const results: Array<{
      template_id: string;
      template_name: string;
      scheduled_for?: string;
      message_id?: string;
      error?: string;
    }> = [];

    // Create campaigns and scheduled messages for each template
    for (const template of templates) {
      try {
        // Calculate scheduled date
        const scheduledDate = new Date(memberActivationDate);
        scheduledDate.setDate(scheduledDate.getDate() + template.default_delay_days);
        
        // Set the time
        const [hours, minutes, seconds] = template.default_send_time.split(':');
        scheduledDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);

        // Replace placeholders in message content
        let messageContent = template.message_template;
        if (member.first_name) {
          messageContent = messageContent.replace(/\{\{first_name\}\}/g, member.first_name);
        }

        // Create or update member campaign
        const { data: campaign, error: campaignError } = await supabase
          .from('member_campaigns')
          .upsert({
            member_id: member.member_id,
            template_id: template.id,
            campaign_status: 'active',
            activation_date: memberActivationDate,
            scheduled_messages: [{
              scheduled_for: scheduledDate.toISOString(),
              message_content: messageContent,
              template_id: template.id
            }]
          }, {
            onConflict: 'member_id,template_id'
          })
          .select()
          .single();

        if (campaignError) {
          console.error('Error creating member campaign:', campaignError);
          continue;
        }

        // Create scheduled message
        const { data: scheduledMessage, error: messageError } = await supabase
          .from('scheduled_messages')
          .insert({
            member_id: member.member_id,
            campaign_id: campaign.id,
            template_id: template.id,
            message_content: messageContent,
            scheduled_for: scheduledDate.toISOString(),
            status: 'pending'
          })
          .select()
          .single();

        if (messageError) {
          console.error('Error creating scheduled message:', messageError);
          continue;
        }

        triggeredCount++;
        results.push({
          template_id: template.id,
          template_name: template.name,
          scheduled_for: scheduledDate.toISOString(),
          message_id: scheduledMessage.id
        });

      } catch (error) {
        console.error('Error processing template:', template.id, error);
        results.push({
          template_id: template.id,
          template_name: template.name,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      message: 'Member followup campaign triggered',
      member_id,
      activation_date: memberActivationDate,
      triggered: triggeredCount,
      total_templates: templates.length,
      results
    });

  } catch (error) {
    console.error('Error in trigger member campaign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get campaign status for a member
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const member_id = searchParams.get('member_id');

    if (!member_id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    // Get member campaigns with template details
    const { data: campaigns, error: campaignsError } = await supabase
      .from('member_campaigns')
      .select(`
        *,
        campaign_templates (
          name,
          description,
          default_delay_days,
          default_send_time
        )
      `)
      .eq('member_id', member_id)
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error('Error fetching member campaigns:', campaignsError);
      return NextResponse.json({ error: 'Failed to fetch member campaigns' }, { status: 500 });
    }

    // Get scheduled messages for this member
    const { data: scheduledMessages, error: messagesError } = await supabase
      .from('scheduled_messages')
      .select(`
        *,
        campaign_templates (
          name
        )
      `)
      .eq('member_id', member_id)
      .order('scheduled_for', { ascending: true });

    if (messagesError) {
      console.error('Error fetching scheduled messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch scheduled messages' }, { status: 500 });
    }

    return NextResponse.json({
      campaigns: campaigns || [],
      scheduled_messages: scheduledMessages || []
    });

  } catch (error) {
    console.error('Error in get member campaign status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 