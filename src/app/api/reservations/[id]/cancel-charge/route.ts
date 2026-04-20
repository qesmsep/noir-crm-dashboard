import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request, { params }: any) {
  const { id } = await params;
  const reservationId = id.endsWith('.js') ? id.slice(0, -3) : id;

  try {
    // Fetch reservation
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    // Delete the reservation (keep the charge - no refund)
    const { error: deleteError } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservationId);

    if (deleteError) {
      console.error('Error deleting reservation:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete reservation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reservation cancelled, payment kept',
      reservationId: reservationId,
    });
  } catch (error: any) {
    console.error('Error cancelling with charge:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel' },
      { status: 500 }
    );
  }
}
