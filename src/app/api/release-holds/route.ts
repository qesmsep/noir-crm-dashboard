import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    // This endpoint can be called manually or by a cron job
    const body = await request.json();
    const { reservation_id } = body;

    if (reservation_id) {
      // Release hold for a specific reservation
      return await releaseHoldForReservation(reservation_id);
    } else {
      // Release all holds for reservations that are past their date
      return await releaseExpiredHolds();
    }
  } catch (error) {
    console.error('Error in release-holds:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function releaseHoldForReservation(reservationId: string) {
  try {
    // Get the reservation
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (error || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    if (!reservation.payment_intent_id || reservation.hold_status === 'released') {
      return NextResponse.json(
        { message: 'No hold to release' },
        { status: 200 }
      );
    }

    // Release the hold in Stripe
    await stripe.paymentIntents.cancel(reservation.payment_intent_id);

    // Update the reservation
    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        hold_status: 'released',
        hold_released_at: new Date().toISOString()
      })
      .eq('id', reservationId);

    if (updateError) {
      console.error('Error updating reservation:', updateError);
      return NextResponse.json(
        { error: 'Failed to update reservation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Hold released successfully',
      reservation_id: reservationId,
      payment_intent_id: reservation.payment_intent_id
    });
  } catch (error) {
    console.error('Error releasing hold for reservation:', error);
    return NextResponse.json(
      { error: 'Failed to release hold' },
      { status: 500 }
    );
  }
}

async function releaseExpiredHolds() {
  try {
    // Get all reservations with holds that are past their date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const { data: expiredReservations, error } = await supabase
      .from('reservations')
      .select('*')
      .lt('start_time', yesterday.toISOString())
      .eq('hold_status', 'confirmed')
      .not('payment_intent_id', 'is', null);

    if (error) {
      console.error('Error fetching expired reservations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch expired reservations' },
        { status: 500 }
      );
    }

    if (!expiredReservations || expiredReservations.length === 0) {
      return NextResponse.json({
        message: 'No expired holds to release',
        count: 0
      });
    }

    const results: Array<{
      reservation_id: string;
      status: string;
      error?: string;
      payment_intent_id?: string;
    }> = [];
    let successCount = 0;
    let errorCount = 0;

    for (const reservation of expiredReservations) {
      try {
        // Release the hold in Stripe
        await stripe.paymentIntents.cancel(reservation.payment_intent_id!);

        // Update the reservation
        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            hold_status: 'released',
            hold_released_at: new Date().toISOString()
          })
          .eq('id', reservation.id);

        if (updateError) {
          console.error('Error updating reservation:', updateError);
          errorCount++;
          results.push({
            reservation_id: reservation.id,
            status: 'error',
            error: 'Failed to update reservation'
          });
        } else {
          successCount++;
          results.push({
            reservation_id: reservation.id,
            status: 'success',
            payment_intent_id: reservation.payment_intent_id
          });
        }
      } catch (stripeError) {
        console.error('Error releasing hold for reservation:', reservation.id, stripeError);
        errorCount++;
        results.push({
          reservation_id: reservation.id,
          status: 'error',
          error: 'Failed to release hold in Stripe'
        });
      }
    }

    return NextResponse.json({
      message: `Released ${successCount} holds, ${errorCount} errors`,
      total: expiredReservations.length,
      success_count: successCount,
      error_count: errorCount,
      results
    });
  } catch (error) {
    console.error('Error releasing expired holds:', error);
    return NextResponse.json(
      { error: 'Failed to release expired holds' },
      { status: 500 }
    );
  }
} 