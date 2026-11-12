'use client';

/**
 * Rows of First name + Mobile + Last name (optional) for adding reservation
 * guests. Shared by the post-booking step, the member portal Guests sheet, the
 * no-login guest link page and the staff drawer.
 *
 * Mobile-first: single column, 44px controls, works at 320px.
 */
import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface GuestRowInput {
  first_name: string;
  last_name: string;
  phone: string;
}

export interface RowError {
  index: number;
  field?: 'first_name' | 'phone' | 'last_name';
  error: string;
}

export type SubmitResult = { ok: true } | { ok: false; error: string; rowErrors?: RowError[] };

interface Props {
  /** How many guests can still be added (party size − 1 − existing). */
  maxGuests: number;
  onSubmit: (guests: GuestRowInput[]) => Promise<SubmitResult>;
  submitLabel?: string;
  onSkip?: () => void;
  skipLabel?: string;
  /** Offer "Choose from contacts" where the Contact Picker API exists. */
  allowContacts?: boolean;
  idPrefix?: string;
}

const emptyRow = (): GuestRowInput => ({ first_name: '', last_name: '', phone: '' });

interface ContactsManagerLike {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
}

export function contactPickerAvailable(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
}

/** "Ava Marie Stone" → first "Ava", last "Marie Stone". */
export function splitContactName(full: string | undefined): { first_name: string; last_name: string } {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') };
}

export default function AddGuestsForm({
  maxGuests,
  onSubmit,
  submitLabel = 'Send',
  onSkip,
  skipLabel = 'Skip',
  allowContacts = true,
  idPrefix = 'guest',
}: Props) {
  const [rows, setRows] = useState<GuestRowInput[]>([emptyRow()]);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const showContacts = useMemo(() => allowContacts && contactPickerAvailable(), [allowContacts]);

  if (maxGuests <= 0) {
    return (
      <div className="rounded-lg border border-border-cream-1 bg-bg-cream-1 p-4 text-sm text-text-muted">
        Your party is full. Raise the party size on the reservation to add more guests.
        {onSkip && (
          <Button type="button" variant="ghost" className="mt-3 h-11 w-full" onClick={onSkip}>
            {skipLabel}
          </Button>
        )}
      </div>
    );
  }

  const update = (i: number, patch: Partial<GuestRowInput>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    const changed = Object.keys(patch);
    setRowErrors((prev) => prev.filter((e) => !(e.index === i && e.field && changed.includes(e.field))));
  };

  const pickContacts = async () => {
    try {
      const contacts = (navigator as unknown as { contacts: ContactsManagerLike }).contacts;
      const picked = await contacts.select(['name', 'tel'], { multiple: true });
      const fromContacts = picked
        .map((c) => ({ ...splitContactName(c.name?.[0]), phone: c.tel?.[0] || '' }))
        .filter((c) => c.first_name || c.phone);
      if (fromContacts.length === 0) return;
      setRows((prev) => {
        const kept = prev.filter((r) => r.first_name || r.phone || r.last_name);
        return [...kept, ...fromContacts].slice(0, maxGuests);
      });
    } catch {
      // Cancelled or not allowed — nothing to do.
    }
  };

  const filled = rows.filter((r) => r.first_name.trim() || r.phone.trim() || r.last_name.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    // Ignore completely blank rows; every other row needs a first name and mobile.
    const local: RowError[] = [];
    rows.forEach((r, index) => {
      const blank = !r.first_name.trim() && !r.phone.trim() && !r.last_name.trim();
      if (blank) return;
      if (!r.first_name.trim()) local.push({ index, field: 'first_name', error: 'First name is required.' });
      if (!r.phone.trim()) local.push({ index, field: 'phone', error: 'Mobile number is required.' });
    });
    if (filled.length === 0) {
      setFormError('Add at least one guest, or skip.');
      return;
    }
    if (local.length) {
      setRowErrors(local);
      return;
    }
    // Map server row indexes back to on-screen rows.
    const indexMap: number[] = [];
    const payload = rows.filter((r, i) => {
      const keep = !!(r.first_name.trim() || r.phone.trim() || r.last_name.trim());
      if (keep) indexMap.push(i);
      return keep;
    });
    setSubmitting(true);
    try {
      const result = await onSubmit(payload);
      if (!result.ok) {
        setFormError(result.error);
        setRowErrors((result.rowErrors || []).map((er) => ({ ...er, index: indexMap[er.index] ?? er.index })));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const errorFor = (i: number, field: RowError['field']) => rowErrors.find((e) => e.index === i && e.field === field)?.error;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {showContacts && (
        <Button type="button" variant="outline" className="h-11 w-full" onClick={pickContacts}>
          <Users className="mr-2 h-4 w-4" aria-hidden />
          Choose from contacts
        </Button>
      )}

      {rows.map((row, i) => {
        const firstErr = errorFor(i, 'first_name');
        const phoneErr = errorFor(i, 'phone');
        const lastErr = errorFor(i, 'last_name');
        return (
          <fieldset key={i} className="flex flex-col gap-3 rounded-lg border border-border-cream-1 bg-white p-3">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-semibold text-text-primary">Guest {i + 1}</legend>
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-11 p-0"
                  aria-label={`Remove guest ${i + 1}`}
                  onClick={() => {
                    setRows((prev) => prev.filter((_, idx) => idx !== i));
                    setRowErrors([]);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${idPrefix}-${i}-first`}>First name</Label>
              <Input
                id={`${idPrefix}-${i}-first`}
                className="h-11 text-base"
                autoComplete="off"
                value={row.first_name}
                onChange={(e) => update(i, { first_name: e.target.value })}
                aria-invalid={!!firstErr}
              />
              {firstErr && <p className="text-sm text-error-red">{firstErr}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${idPrefix}-${i}-phone`}>Mobile</Label>
              <Input
                id={`${idPrefix}-${i}-phone`}
                className="h-11 text-base"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="(913) 555-0123"
                value={row.phone}
                onChange={(e) => update(i, { phone: e.target.value })}
                aria-invalid={!!phoneErr}
              />
              {phoneErr && <p className="text-sm text-error-red">{phoneErr}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${idPrefix}-${i}-last`}>
                Last name <span className="font-normal text-text-muted">(optional)</span>
              </Label>
              <Input
                id={`${idPrefix}-${i}-last`}
                className="h-11 text-base"
                autoComplete="off"
                value={row.last_name}
                onChange={(e) => update(i, { last_name: e.target.value })}
                aria-invalid={!!lastErr}
              />
              {lastErr && <p className="text-sm text-error-red">{lastErr}</p>}
            </div>
          </fieldset>
        );
      })}

      {rows.length < maxGuests && (
        <Button type="button" variant="ghost" className="h-11 w-full" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add another
        </Button>
      )}

      {formError && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-error-red">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? 'Sending…' : submitLabel}
        </Button>
        {onSkip && (
          <Button type="button" variant="ghost" className="h-11 w-full" onClick={onSkip} disabled={submitting}>
            {skipLabel}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Turn an API error response into a SubmitResult. */
export async function toSubmitResult(response: Response): Promise<SubmitResult> {
  if (response.ok) return { ok: true };
  let body: { error?: string; rowErrors?: RowError[] } = {};
  try {
    body = await response.json();
  } catch {
    // non-JSON error
  }
  return { ok: false, error: body.error || 'Something went wrong. Please try again.', rowErrors: body.rowErrors };
}
