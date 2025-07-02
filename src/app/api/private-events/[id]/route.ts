import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Extract updatable fields
    const {
      title,
      event_type,
      start_time,
      end_time,
      max_guests,
      total_attendees_maximum,
      deposit_required,
      event_description,
      rsvp_enabled,
      background_image_url,
      require_time_selection,
      status,
      full_day
    } = body;

    // Build update object with only provided fields
    const updateFields: any = {};
    if (title !== undefined) updateFields.title = title;
    if (event_type !== undefined) updateFields.event_type = event_type;
    if (start_time !== undefined) updateFields.start_time = start_time;
    if (end_time !== undefined) updateFields.end_time = end_time;
    if (max_guests !== undefined) updateFields.max_guests = max_guests;
    if (total_attendees_maximum !== undefined) updateFields.total_attendees_maximum = total_attendees_maximum;
    if (deposit_required !== undefined) updateFields.deposit_required = deposit_required;
    if (event_description !== undefined) updateFields.event_description = event_description;
    if (rsvp_enabled !== undefined) updateFields.rsvp_enabled = rsvp_enabled;
    if (background_image_url !== undefined) updateFields.background_image_url = background_image_url;
    if (require_time_selection !== undefined) updateFields.require_time_selection = require_time_selection;
    if (status !== undefined) updateFields.status = status;
    if (full_day !== undefined) updateFields.full_day = full_day;

    // Add updated_at timestamp
    updateFields.updated_at = new Date().toISOString();

    // Update the private event
    const { data, error } = await supabase
      .from('private_events')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating private event:', error);
      return NextResponse.json(
        { error: 'Failed to update private event' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in private event PATCH:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Delete the private event
    const { error } = await supabase
      .from('private_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting private event:', error);
      return NextResponse.json(
        { error: 'Failed to delete private event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in private event DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data, error } = await supabase
      .from('private_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching private event:', error);
      return NextResponse.json(
        { error: 'Private event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in private event GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 