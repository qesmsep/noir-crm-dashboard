import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    // It's recommended to use a server-side-only client for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Parse location query parameter
    const { searchParams } = new URL(request.url);
    const locationSlug = searchParams.get('location');

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
      .select('id, table_number, seats, location_id, locations(slug)')
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
        table_number: t.table_number ? String(t.table_number).padStart(2, '0') : 'N/A',
        seats: parseInt(t.seats, 10) || 0,
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