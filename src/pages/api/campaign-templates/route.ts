import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all campaign templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active_only') === 'true';

    let query = supabase
      .from('campaign_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('Error fetching campaign templates:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    return NextResponse.json({ templates: templates || [] });
  } catch (error) {
    console.error('Error in campaign templates GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new campaign template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, message_template, default_delay_days, default_send_time } = body;

    // Validate required fields
    if (!name || !message_template) {
      return NextResponse.json({ error: 'Name and message template are required' }, { status: 400 });
    }

    // Validate delay days
    if (default_delay_days !== undefined && (default_delay_days < 0 || default_delay_days > 365)) {
      return NextResponse.json({ error: 'Delay days must be between 0 and 365' }, { status: 400 });
    }

    // Validate send time format
    if (default_send_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(default_send_time)) {
      return NextResponse.json({ error: 'Send time must be in HH:MM:SS format' }, { status: 400 });
    }

    const { data: template, error } = await supabase
      .from('campaign_templates')
      .insert([{
        name,
        description,
        message_template,
        default_delay_days: default_delay_days || 1,
        default_send_time: default_send_time || '10:00:00',
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating campaign template:', error);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error in campaign templates POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a campaign template
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, message_template, default_delay_days, default_send_time, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Validate required fields
    if (!name || !message_template) {
      return NextResponse.json({ error: 'Name and message template are required' }, { status: 400 });
    }

    // Validate delay days
    if (default_delay_days !== undefined && (default_delay_days < 0 || default_delay_days > 365)) {
      return NextResponse.json({ error: 'Delay days must be between 0 and 365' }, { status: 400 });
    }

    // Validate send time format
    if (default_send_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(default_send_time)) {
      return NextResponse.json({ error: 'Send time must be in HH:MM:SS format' }, { status: 400 });
    }

    const updateData: any = {
      name,
      description,
      message_template,
      updated_at: new Date().toISOString()
    };

    if (default_delay_days !== undefined) updateData.default_delay_days = default_delay_days;
    if (default_send_time !== undefined) updateData.default_send_time = default_send_time;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: template, error } = await supabase
      .from('campaign_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating campaign template:', error);
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error in campaign templates PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a campaign template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Check if template is being used in any active campaigns
    const { data: activeCampaigns, error: campaignError } = await supabase
      .from('member_campaigns')
      .select('id')
      .eq('template_id', id)
      .eq('campaign_status', 'active');

    if (campaignError) {
      console.error('Error checking active campaigns:', campaignError);
      return NextResponse.json({ error: 'Failed to check template usage' }, { status: 500 });
    }

    if (activeCampaigns && activeCampaigns.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete template that is being used in active campaigns',
        active_campaigns: activeCampaigns.length
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('campaign_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting campaign template:', error);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in campaign templates DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 