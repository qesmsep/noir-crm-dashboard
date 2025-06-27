import { NextResponse } from 'next/server';
import { supabase } from '../../../../pages/api/supabaseClient';

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const id = context.params.id;
    const body = await request.json();
    
    // Extract updatable fields
    const {
      first_name,
      last_name,
      party_size,
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
    if (start_time !== undefined) {
      // Convert local datetime string to UTC ISO before saving
      updateFields.start_time = new Date(start_time).toISOString();
    }
    if (end_time !== undefined) {
      updateFields.end_time = new Date(end_time).toISOString();
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
  context: { params: { id: string } }
) {
  try {
    const id = context.params.id;
    
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