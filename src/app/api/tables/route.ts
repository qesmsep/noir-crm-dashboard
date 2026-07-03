import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAccess } from '@/lib/admin-middleware';

export async function GET(request: Request) {
  try {
    // Verify admin access
    const authCheck = await verifyAdminAccess(request);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    // It's recommended to use a server-side-only client for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Parse location query parameter with validation
    const { searchParams } = new URL(request.url);
    const locationSlug = searchParams.get('location');

    // Validate locationSlug format (alphanumeric and hyphens only)
    if (locationSlug && !/^[a-z0-9-]+$/i.test(locationSlug)) {
      return NextResponse.json({ error: 'Invalid location parameter' }, { status: 400 });
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

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tables from Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { table_number, seats, status, location_slug } = body;

    // Validate location_slug format
    if (location_slug && !/^[a-z0-9-]+$/i.test(location_slug)) {
      return NextResponse.json({ error: 'Invalid location parameter' }, { status: 400 });
    }

    // Validate input
    if (table_number === undefined || !seats || !location_slug) {
      return NextResponse.json(
        { error: 'Missing required fields: table_number, seats, location_slug' },
        { status: 400 }
      );
    }

    if (seats < 1 || seats > 20) {
      return NextResponse.json(
        { error: 'Seats must be between 1 and 20' },
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

    // Check for unique table_number per location
    const { data: existingTable } = await supabase
      .from('tables')
      .select('id')
      .eq('location_id', locationId)
      .eq('table_number', table_number)
      .single();

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