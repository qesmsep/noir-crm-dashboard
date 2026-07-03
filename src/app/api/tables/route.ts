import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAccess } from '@/lib/admin-middleware';

// Slugs are alphanumeric plus hyphens (e.g. "noirkc", "rooftopkc")
const LOCATION_SLUG_REGEX = /^[a-z0-9-]+$/i;

// Postgres unique_violation error code
const PG_UNIQUE_VIOLATION = '23505';

export async function GET(request: Request) {
  try {
    // NOTE: GET is intentionally public. It backs the calendar resource list
    // and every reservation table picker (including the member-facing booking
    // flow), none of which are authenticated. Only mutations (POST/PUT/DELETE)
    // require admin access.
    const supabase = supabaseAdmin;

    // Parse query parameters with validation
    const { searchParams } = new URL(request.url);
    const locationSlug = searchParams.get('location');
    const statusFilter = searchParams.get('status');

    // Validate locationSlug format (alphanumeric and hyphens only)
    if (locationSlug && !LOCATION_SLUG_REGEX.test(locationSlug)) {
      return NextResponse.json({ error: 'Invalid location parameter' }, { status: 400 });
    }

    // Validate status filter if provided
    if (statusFilter && !['active', 'inactive'].includes(statusFilter)) {
      return NextResponse.json({ error: 'Invalid status parameter' }, { status: 400 });
    }

    // Get location ID if location filter is provided
    let locationId: string | null = null;
    if (locationSlug) {
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('slug', locationSlug)
        .single();

      if (locationError) {
        console.error('Error fetching location:', locationError);
        return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
      }
      locationId = locationData.id;
    }

    // Build query with location filter
    let query = supabase
      .from('tables')
      .select('id, table_number, seats, status, location_id, locations(slug)')
      .order('table_number', { ascending: true });

    // Filter by location_id if provided
    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    // Filter by status if provided (lets booking pickers request active only)
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      // Don't leak raw DB error details to this public, unauthenticated route
      console.error('Error fetching tables from Supabase:', error);
      return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
    }

    const mapped = (data || []).map(t => {
      const location = Array.isArray(t.locations) ? t.locations[0] : t.locations;
      return {
        id: t.id,
        table_number: parseInt(t.table_number, 10) || 0,
        seats: parseInt(t.seats, 10) || 0,
        status: t.status || 'active',
        location_id: t.location_id,
        location_slug: location?.slug || null
      };
    });

    return NextResponse.json({ data: mapped });

  } catch (error: any) {
    console.error('Error in /api/tables GET:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error from tables API' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Verify admin access
    const authCheck = await verifyAdminAccess(request);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const supabase = supabaseAdmin;

    const body = await request.json();
    const { table_number, seats, status, location_slug } = body;

    // Validate location_slug format
    if (location_slug && !LOCATION_SLUG_REGEX.test(location_slug)) {
      return NextResponse.json({ error: 'Invalid location parameter' }, { status: 400 });
    }

    // Validate input
    if (table_number === undefined || !seats || !location_slug) {
      return NextResponse.json(
        { error: 'Missing required fields: table_number, seats, location_slug' },
        { status: 400 }
      );
    }

    // Validate table_number is a positive integer (UI enforces min=1, but the
    // API must guard against direct calls with 0 / negative / non-integer values)
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

    // Validate status against the enum (matches PUT); guards direct API calls
    // so an invalid value returns 400 instead of failing the DB CHECK as a 500
    if (status !== undefined && !['active', 'inactive'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be either active or inactive' },
        { status: 400 }
      );
    }

    // Get location ID
    const { data: locationData, error: locationError } = await supabase
      .from('locations')
      .select('id')
      .eq('slug', location_slug)
      .single();

    if (locationError || !locationData) {
      return NextResponse.json(
        { error: 'Invalid location' },
        { status: 400 }
      );
    }

    const locationId = locationData.id;

    // Fast-path uniqueness check (the DB unique constraint is the real guard
    // against the check-then-write race — see the 23505 handling below).
    const { data: existingTable } = await supabase
      .from('tables')
      .select('id')
      .eq('location_id', locationId)
      .eq('table_number', table_number)
      .maybeSingle();

    if (existingTable) {
      return NextResponse.json(
        { error: `Table ${table_number} already exists at this location` },
        { status: 409 }
      );
    }

    // Create the table (let database handle timestamps)
    const { data, error } = await supabase
      .from('tables')
      .insert({
        table_number,
        seats,
        status: status || 'active',
        location_id: locationId,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation from a concurrent insert of the same number
      if (error.code === PG_UNIQUE_VIOLATION) {
        return NextResponse.json(
          { error: `Table ${table_number} already exists at this location` },
          { status: 409 }
        );
      }
      console.error('Error creating table:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create table' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('Error in /api/tables POST:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
