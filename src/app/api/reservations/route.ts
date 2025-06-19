import { NextResponse } from 'next/server';
import { supabase } from '@/api/supabaseClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      start_time,
      end_time,
      party_size,
      event_type,
      notes,
      phone,
      email,
      first_name,
      last_name,
      payment_method_id,
      member_id,
      is_member
    } = body;

    // Validate required fields
    if (!start_time || !end_time || !party_size || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For non-members, validate additional required fields
    if (!is_member && (!email || !first_name || !last_name)) {
      return NextResponse.json(
        { error: 'Missing required fields for non-member reservation' },
        { status: 400 }
      );
    }

    // For members, verify membership status and use their details
    if (is_member) {
      // If member_id is provided, use it directly
      if (member_id) {
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('*')
          .eq('member_id', member_id)
          .single();

        if (memberError || !member) {
          return NextResponse.json(
            { error: 'Invalid member ID' },
            { status: 400 }
          );
        }
        // Use member details for reservation
        body.first_name = member.first_name;
        body.last_name = member.last_name;
        body.email = member.email;
        body.phone = member.phone;
      } else {
        // Otherwise, try to find member by phone
        const digits = phone.replace(/\D/g, '');
        const possiblePhones = [digits, '+1' + digits, '1' + digits];
        // Try to match any of these formats
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('*')
          .in('phone', possiblePhones)
          .single();

        if (memberError || !member) {
          return NextResponse.json(
            { error: 'Invalid member phone number' },
            { status: 400 }
          );
        }
        // Use member details for reservation
        body.first_name = member.first_name;
        body.last_name = member.last_name;
        body.email = member.email;
        body.phone = member.phone;
      }
    }

    // Assign a table automatically
    // 1. Get all tables that fit the party size
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .gte('capacity', party_size);
    if (tablesError) {
      return NextResponse.json({ error: 'Error fetching tables' }, { status: 500 });
    }
    if (!tables || tables.length === 0) {
      return NextResponse.json({ error: 'No available table for this party size' }, { status: 400 });
    }
    // 2. Get all reservations for that date
    const startOfDay = new Date(start_time);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(start_time);
    endOfDay.setHours(23, 59, 59, 999);
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    if (resError) {
      return NextResponse.json({ error: 'Error fetching reservations' }, { status: 500 });
    }
    // 3. Find the smallest available table
    const slotStart = new Date(start_time);
    const slotEnd = new Date(end_time);
    const availableTable = tables
      .sort((a, b) => a.capacity - b.capacity)
      .find(table => {
        const tableReservations = reservations.filter(r => r.table_id === table.id);
        // Check for overlap
        return !tableReservations.some(r => {
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          return (
            (slotStart < resEnd) && (slotEnd > resStart)
          );
        });
      });
    if (!availableTable) {
      return NextResponse.json({ error: 'No available table for this time and party size' }, { status: 400 });
    }
    // Create reservation with assigned table_id
    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert([
        {
          start_time,
          end_time,
          party_size,
          event_type,
          notes,
          phone: body.phone,
          email: body.email,
          first_name: body.first_name,
          last_name: body.last_name,
          membership_type: body.is_member ? 'member' : 'non-member',
          payment_method_id,
          table_id: availableTable.id
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating reservation:', error);
      return NextResponse.json(
        { error: 'Failed to create reservation' },
        { status: 500 }
      );
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error in reservations POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
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
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching reservations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reservations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in reservations GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 