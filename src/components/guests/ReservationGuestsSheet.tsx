'use client';

/**
 * Member portal: manage the guests on one upcoming reservation.
 * Shows first name, last name and a masked phone for existing guests only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import AddGuestsForm, { toSubmitResult } from './AddGuestsForm';

interface MemberGuest {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_masked: string;
}

interface Props {
  reservationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any change so the list can refresh its counts. */
  onChanged?: () => void;
}

export default function ReservationGuestsSheet({ reservationId, open, onOpenChange, onChanged }: Props) {
  const { toast } = useToast();
  const [guests, setGuests] = useState<MemberGuest[]>([]);
  const [partySize, setPartySize] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; first_name: string; last_name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const base = reservationId ? `/api/member/reservations/${reservationId}/guests` : null;

  const apply = (data: { guests?: MemberGuest[]; party_size?: number }) => {
    setGuests(data.guests || []);
    if (data.party_size) setPartySize(data.party_size);
  };

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(base, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load guests.');
      apply(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load guests.');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const remove = async (id: string) => {
    if (!base) return;
    setBusyId(id);
    try {
      const response = await fetch(`${base}/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not remove guest.');
      apply(data);
      onChanged?.();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Could not remove guest.', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async () => {
    if (!base || !editing) return;
    setBusyId(editing.id);
    try {
      const response = await fetch(`${base}/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ first_name: editing.first_name, last_name: editing.last_name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save.');
      apply(data);
      setEditing(null);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Could not save.', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const spotsLeft = Math.max(0, partySize - 1 - guests.length);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-4 pb-8 sm:mx-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle>Guests</SheetTitle>
          <SheetDescription>We&apos;ll text them how to get in and greet them by name.</SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {loadError && <p className="mt-4 text-sm text-error-red">{loadError}</p>}

        {!loading && !loadError && (
          <div className="mt-4 flex flex-col gap-6">
            {guests.length > 0 && (
              <ul className="flex flex-col divide-y divide-border-cream-1 rounded-lg border border-border-cream-1 bg-white">
                {guests.map((g) =>
                  editing?.id === g.id ? (
                    <li key={g.id} className="flex flex-col gap-3 p-3">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-first-${g.id}`}>First name</Label>
                        <Input
                          id={`edit-first-${g.id}`}
                          className="h-11 text-base"
                          value={editing.first_name}
                          onChange={(e) => setEditing({ ...editing, first_name: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-last-${g.id}`}>
                          Last name <span className="font-normal text-text-muted">(optional)</span>
                        </Label>
                        <Input
                          id={`edit-last-${g.id}`}
                          className="h-11 text-base"
                          value={editing.last_name}
                          onChange={(e) => setEditing({ ...editing, last_name: e.target.value })}
                        />
                      </div>
                      <p className="text-xs text-text-muted">To change the number, remove this guest and add them again.</p>
                      <div className="flex gap-2">
                        <Button className="h-11 flex-1" onClick={saveEdit} disabled={busyId === g.id || !editing.first_name.trim()}>
                          Save
                        </Button>
                        <Button variant="ghost" className="h-11 flex-1" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </li>
                  ) : (
                    <li key={g.id} className="flex items-center gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-text-primary">
                          {g.first_name} {g.last_name || ''}
                        </p>
                        <p className="text-sm text-text-muted">{g.phone_masked}</p>
                      </div>
                      <Button
                        variant="ghost"
                        className="h-11 w-11 p-0"
                        aria-label={`Edit ${g.first_name}`}
                        onClick={() => setEditing({ id: g.id, first_name: g.first_name, last_name: g.last_name || '' })}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-11 w-11 p-0"
                        aria-label={`Remove ${g.first_name}`}
                        disabled={busyId === g.id}
                        onClick={() => remove(g.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </li>
                  ),
                )}
              </ul>
            )}

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text-primary">Add guests</h3>
              <AddGuestsForm
                key={formKey}
                idPrefix="portal-guest"
                maxGuests={spotsLeft}
                submitLabel="Send"
                onSubmit={async (rows) => {
                  if (!base) return { ok: false, error: 'No reservation selected.' };
                  const response = await fetch(base, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ guests: rows }),
                  });
                  const result = await toSubmitResult(response.clone());
                  if (result.ok) {
                    apply(await response.json());
                    setFormKey((k) => k + 1);
                    onChanged?.();
                    toast({ title: 'Guests saved', description: "We'll text them before you arrive.", variant: 'success' });
                  }
                  return result;
                }}
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
