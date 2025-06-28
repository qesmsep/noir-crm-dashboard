import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Supabase Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'MISSING');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(request: Request, { params }: any) {
  const { id } = params;
  const reservationId = id.endsWith('.js') ? id.slice(0, -3) : id;
  console.log('PATCH: Querying for reservation id:', reservationId);
  
  try {
    const body = await request.json();

    const {
      start_time,
      end_time,
      table_id,
      first_name,
      last_name,
      email,
      phone,
      party_size,
      event_type,
      notes
    } = body;

    const updateFields: any = {};
    if (first_name !== undefined) updateFields.first_name = first_name;
    if (last_name !== undefined) updateFields.last_name = last_name;
    if (party_size !== undefined) updateFields.party_size = party_size;
    if (table_id !== undefined) updateFields.table_id = table_id;
    if (start_time !== undefined) updateFields.start_time = start_time;
    if (end_time !== undefined) updateFields.end_time = end_time;
    if (event_type !== undefined) updateFields.event_type = event_type;
    if (notes !== undefined) updateFields.notes = notes;
    if (email !== undefined) updateFields.email = email;
    if (phone !== undefined) updateFields.phone = phone;

    updateFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('reservations')
      .update(updateFields)
      .eq('id', reservationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error(`Error updating reservation ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to update reservation' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, { params }: any) {
  const { id } = params;
  const reservationId = id.endsWith('.js') ? id.slice(0, -3) : id;
  console.log('GET: Querying for reservation id:', reservationId);
  
  try {
    console.log('API: Fetching reservation with ID:', reservationId);
    
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
      .eq('id', reservationId)
      .single();

    console.log('API: Supabase query result:', { data, error });

    if (error) {
      console.error('API: Error fetching reservation:', error);
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    console.log('API: Successfully found reservation:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('API: Error in reservation GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: any) {
  const { id } = params;
  try {
    const reservationId = id.endsWith('.js') ? id.slice(0, -3) : id;

    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservationId);

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