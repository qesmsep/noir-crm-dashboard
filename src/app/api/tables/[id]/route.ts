import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAccess } from '@/lib/admin-middleware';

// Postgres unique_violation error code
const PG_UNIQUE_VIOLATION = '23505';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const authCheck = await verifyAdminAccess(request);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const supabase = supabaseAdmin;

    const { id } = await params;
    const body = await request.json();
    const { table_number, seats, status } = body;

    // Validate input
    if (table_number === undefined || seats === undefined || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: table_number, seats, status' },
        { status: 400 }
      );
    }

    // Validate table_number is a positive integer (guards direct API calls)
    if (!Number.isInteger(table_number) || table_number < 1) {
      return NextResponse.json(
        { error: 'Table number must be a positive integer' },
        { status: 400 }
      );
    }

    // Integer guard matches table_number: a non-numeric seats value makes the
    // range comparison NaN-based (silently false) and would only fail at the DB
    if (!Number.isInteger(seats) || seats < 1 || seats > 20) {
      return NextResponse.json(
        { error: 'Seats must be an integer between 1 and 20' },
        { status: 400 }
      );
    }

    if (!['active', 'inactive'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be either active or inactive' },
        { status: 400 }
      );
    }

    // Get the current table to check location_id
    const { data: currentTable, error: fetchError } = await supabase
      .from('tables')
      .select('location_id')
      .eq('id', id)
      .single();

    if (fetchError || !currentTable) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Check for unique table_number per location (excluding current table)
    const { data: existingTable } = await supabase
      .from('tables')
      .select('id')
      .eq('location_id', currentTable.location_id)
      .eq('table_number', table_number)
      .neq('id', id)
      .single();

    if (existingTable) {
      return NextResponse.json(
        { error: `Table ${table_number} already exists at this location` },
        { status: 409 }
      );
    }

    // Update the table (let database handle updated_at)
    const { data, error } = await supabase
      .from('tables')
      .update({
        table_number,
        seats,
        status,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Unique constraint violation from a concurrent update to the same number
      if (error.code === PG_UNIQUE_VIOLATION) {
        return NextResponse.json(
          { error: `Table ${table_number} already exists at this location` },
          { status: 409 }
        );
      }
      console.error('Error updating table:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update table' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in /api/tables/[id] PUT:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const authCheck = await verifyAdminAccess(request);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const supabase = supabaseAdmin;

    const { id } = await params;

    // Check for reservations that would be orphaned by deleting this table:
    // any non-cancelled reservation that has not yet ended (upcoming OR
    // currently in progress). Using end_time > now catches occupied tables
    // that gte('start_time', now) would miss, and excluding cancelled ones
    // mirrors the assign-table conflict check.
    const now = new Date().toISOString();
    const { data: futureReservations, error: reservationError } = await supabase
      .from('reservations')
      .select('id')
      .eq('table_id', id)
      .neq('status', 'cancelled')
      .gt('end_time', now)
      .limit(1);

    if (reservationError) {
      console.error('Error checking reservations:', reservationError);
      return NextResponse.json(
        { error: 'Failed to check reservations' },
        { status: 500 }
      );
    }

    if (futureReservations && futureReservations.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete table with future reservations' },
        { status: 409 }
      );
    }

    // Delete the table
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting table:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to delete table' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in /api/tables/[id] DELETE:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
