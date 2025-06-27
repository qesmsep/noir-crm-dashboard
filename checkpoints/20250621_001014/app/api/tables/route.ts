import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // It's recommended to use a server-side-only client for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('tables')
      .select('id, table_number, seats')
      .order('table_number', { ascending: true });

    if (error) {
      console.error('Error fetching tables from Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    const mapped = (data || []).map(t => ({
      id: t.id,
      table_number: t.table_number ? String(t.table_number).padStart(2, '0') : 'N/A',
      seats: parseInt(t.seats, 10) || 0
    }));

    return NextResponse.json({ data: mapped });

  } catch (error: any) {
    console.error('Error in /api/tables GET:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error from tables API' },
      { status: 500 }
    );
  }
} 