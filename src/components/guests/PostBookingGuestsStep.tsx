'use client';

/**
 * Shown after a member books (member bookings only — never public or admin
 * bookings): "Would you like to add anybody?"
 */
import React from 'react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useToast } from '@/hooks/useToast';
import AddGuestsForm, { toSubmitResult } from './AddGuestsForm';

interface Props {
  reservationId: string;
  partySize: number;
  onDone: () => void;
}

export default function PostBookingGuestsStep({ reservationId, partySize, onDone }: Props) {
  const { toast } = useToast();
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onDone();
      }}
      title="Would you like to add anybody?"
      description="We'll text them how to get in and greet them by name."
    >
      <AddGuestsForm
        idPrefix="booking-guest"
        maxGuests={Math.max(0, partySize - 1)}
        submitLabel="Send"
        onSkip={onDone}
        onSubmit={async (guests) => {
          const response = await fetch(`/api/member/reservations/${reservationId}/guests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ guests }),
          });
          const result = await toSubmitResult(response);
          if (result.ok) {
            toast({
              title: guests.length === 1 ? 'Guest added' : 'Guests added',
              description: "We'll text them before you arrive.",
              variant: 'success',
            });
            onDone();
          }
          return result;
        }}
      />
    </ResponsiveDialog>
  );
}
