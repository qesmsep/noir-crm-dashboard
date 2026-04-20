import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

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

    // Check if reservation has a payment to refund
    const paymentIntentId = reservation.payment_intent_id || reservation.stripe_payment_intent_id;
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'No payment found for this reservation' },
        { status: 400 }
      );
    }

    // Refund the payment via Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: {
        reservation_id: reservationId,
        refund_type: 'admin_cancelled',
      },
    });

    // Delete the reservation
    const { error: deleteError } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservationId);

    if (deleteError) {
      console.error('Error deleting reservation after refund:', deleteError);
      return NextResponse.json(
        {
          error: 'Refund succeeded but failed to delete reservation',
          refundId: refund.id
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amount: refund.amount / 100,
      message: 'Reservation cancelled and payment refunded',
    });
  } catch (error: any) {
    console.error('Error cancelling with refund:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel and refund' },
      { status: 500 }
    );
  }
}
