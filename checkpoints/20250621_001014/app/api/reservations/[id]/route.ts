import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    // Extract updatable fields, including table_id
    const {
      first_name,
      last_name,
      party_size,
      table_id,
      start_time,
      end_time,
      event_type,
      notes,
      email,
      phone
    } = body;

    // Build update object with only provided fields
    const updateFields: any = {};
    if (first_name !== undefined) updateFields.first_name = first_name;
    if (last_name !== undefined) updateFields.last_name = last_name;
    if (party_size !== undefined) updateFields.party_size = party_size;
    if (table_id !== undefined) updateFields.table_id = table_id;
    if (start_time !== undefined) {
      // Times are already in CST format from frontend
      updateFields.start_time = start_time;
    }
    if (end_time !== undefined) {
      // Times are already in CST format from frontend
      updateFields.end_time = end_time;
    }
    if (event_type !== undefined) updateFields.event_type = event_type;
    if (notes !== undefined) updateFields.notes = notes;
    if (email !== undefined) updateFields.email = email;
    if (phone !== undefined) updateFields.phone = phone;

    // Add updated_at timestamp
    updateFields.updated_at = new Date().toISOString();

    // Update the reservation
    const { data, error } = await supabase
      .from('reservations')
      .update(updateFields)
      .eq('id', id)
      .select(`
        *,
        tables (
          id,
          table_number,
          seats
        )
      `)
      .single();

    if (error) {
      console.error('Error updating reservation:', error);
      return NextResponse.json(
        { error: 'Failed to update reservation' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in reservation PATCH:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        tables (
          id,
          table_number,
          seats
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching reservation:', error);
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in reservation GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting reservation:', error);
      return NextResponse.json(
        { error: 'Failed to delete reservation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Reservation deleted successfully' });

  } catch (error) {
    console.error('Error in reservation DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 