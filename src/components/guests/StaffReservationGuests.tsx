'use client';

/**
 * Staff view of a reservation's guests (inside ReservationEditDrawer): names,
 * member / opted-out badges, per-guest check-in, add / edit / remove, the
 * no-login guest link with a Copy button, and "Text link to member" (sends the
 * "Member guest link" message from Campaigns → Reservation guests).
 *
 * Used by ReservationEditModal (timeline) and ReservationEditDrawer (calendar).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { adminRequestHeaders } from '@/lib/adminRequestHeaders';
import AddGuestsForm, { toSubmitResult } from './AddGuestsForm';

interface StaffGuest {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_display: string;
  is_member: boolean;
  opted_out: boolean;
  checked_in_at: string | null;
  notified_at: string | null;
}

interface Props {
  reservationId: string;
  partySize: number;
  /** Cancelled or past reservations can't take new guests. */
  canAdd: boolean;
  /** The reservation has a phone to text the guest link to. */
  hasHostPhone?: boolean;
}

export default function StaffReservationGuests({ reservationId, partySize, canAdd, hasHostPhone = true }: Props) {
  const { toast } = useToast();
  const [guests, setGuests] = useState<StaffGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; first_name: string; last_name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [texting, setTexting] = useState(false);

  const base = `/api/admin/reservations/${reservationId}/guests`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(base, { headers: await adminRequestHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load guests.');
      setGuests(data.guests || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load guests.');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    load();
    setLink(null);
  }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    try {
      const response = await fetch(`${base}/${id}`, { method: 'PATCH', headers: await adminRequestHeaders(), body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save.');
      setGuests(data.guests || []);
      return true;
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Could not save.', variant: 'error' });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    try {
      const response = await fetch(`${base}/${id}`, { method: 'DELETE', headers: await adminRequestHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not remove.');
      setGuests(data.guests || []);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Could not remove.', variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const getLink = async () => {
    setLinkLoading(true);
    try {
      const response = await fetch(`/api/admin/reservations/${reservationId}/guest-link`, { method: 'POST', headers: await adminRequestHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create the link.');
      setLink(data.url);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Could not create the link.', variant: 'error' });
    } finally {
      setLinkLoading(false);
    }
  };

  const textLinkToMember = async () => {
    setTexting(true);
    try {
      const response = await fetch(`/api/admin/reservations/${reservationId}/guest-link-text`, { method: 'POST', headers: await adminRequestHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send the link.');
      setLink(data.url);
      toast({ title: 'Link texted to the member', variant: 'success' });
    } catch (e) {
      toast({ title: 'Not sent', description: e instanceof Error ? e.message : 'Could not send the link.', variant: 'error' });
    } finally {
      setTexting(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copied', variant: 'success' });
    } catch {
      toast({ title: 'Copy failed', description: link, variant: 'error' });
    }
  };

  const spotsLeft = Math.max(0, partySize - 1 - guests.length);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border-cream-1 bg-white p-3" aria-label="Guests">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Guests {guests.length > 0 && <span className="font-normal text-text-muted">({guests.length})</span>}
        </h3>
      </div>

      {loading && (
        <div className="flex justify-center py-3">
          <Spinner />
        </div>
      )}
      {error && <p className="text-sm text-error-red">{error}</p>}

      {!loading && !error && guests.length === 0 && <p className="text-sm text-text-muted">No guests added.</p>}

      {!loading && guests.length > 0 && (
        <ul className="flex flex-col divide-y divide-border-cream-1">
          {guests.map((g) => (
            <li key={g.id} className="flex flex-col gap-2 py-2">
              {editing?.id === g.id ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`staff-first-${g.id}`}>First name</Label>
                    <Input id={`staff-first-${g.id}`} className="h-11" value={editing.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`staff-last-${g.id}`}>Last name</Label>
                    <Input id={`staff-last-${g.id}`} className="h-11" value={editing.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="h-11 flex-1"
                      disabled={busy === g.id || !editing.first_name.trim()}
                      onClick={async () => {
                        if (await patch(g.id, { first_name: editing.first_name, last_name: editing.last_name })) setEditing(null);
                      }}
                    >
                      Save
                    </Button>
                    <Button variant="ghost" className="h-11 flex-1" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">
                      {g.first_name} {g.last_name || ''}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className="text-xs text-text-muted">{g.phone_display}</span>
                      {g.is_member && <Badge variant="secondary">member</Badge>}
                      {g.opted_out && <Badge variant="outline">opted out</Badge>}
                    </div>
                  </div>
                  <label className="flex h-11 items-center gap-2 text-xs text-text-muted">
                    <Switch
                      checked={!!g.checked_in_at}
                      disabled={busy === g.id}
                      onCheckedChange={(checked) => patch(g.id, { checked_in: checked })}
                      aria-label={`Check in ${g.first_name}`}
                    />
                    In
                  </label>
                  <Button variant="ghost" className="h-11 w-11 p-0" aria-label={`Edit ${g.first_name}`} onClick={() => setEditing({ id: g.id, first_name: g.first_name, last_name: g.last_name || '' })}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" className="h-11 w-11 p-0" aria-label={`Remove ${g.first_name}`} disabled={busy === g.id} onClick={() => remove(g.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAdd && !adding && (
        <Button variant="outline" className="h-11 w-full" onClick={() => setAdding(true)} disabled={spotsLeft === 0}>
          {spotsLeft === 0 ? 'Party is full' : 'Add guest'}
        </Button>
      )}
      {canAdd && adding && (
        <AddGuestsForm
          idPrefix="staff-guest"
          allowContacts={false}
          maxGuests={spotsLeft}
          submitLabel="Save guests"
          skipLabel="Cancel"
          onSkip={() => setAdding(false)}
          onSubmit={async (rows) => {
            const response = await fetch(base, { method: 'POST', headers: await adminRequestHeaders(), body: JSON.stringify({ guests: rows }) });
            const result = await toSubmitResult(response.clone());
            if (result.ok) {
              const data = await response.json();
              setGuests(data.guests || []);
              setAdding(false);
            }
            return result;
          }}
        />
      )}

      {canAdd && (
        <div className="flex flex-col gap-2 border-t border-border-cream-1 pt-3">
          <p className="text-xs text-text-muted">
            Guest link: the member adds guests without logging in. If they text you names instead, add them above.
          </p>
          <Button className="h-11 w-full" onClick={textLinkToMember} disabled={texting || !hasHostPhone}>
            <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
            {texting ? 'Sending…' : hasHostPhone ? 'Text link to member' : 'No phone on reservation'}
          </Button>
          {link ? (
            <div className="flex gap-2">
              <Input readOnly value={link} className="h-11 flex-1 text-xs" aria-label="Guest link" onFocus={(e) => e.currentTarget.select()} />
              <Button className="h-11" onClick={copyLink} aria-label="Copy guest link">
                <Copy className="mr-1 h-4 w-4" aria-hidden />
                Copy
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="h-11 w-full" onClick={getLink} disabled={linkLoading}>
              <Link2 className="mr-2 h-4 w-4" aria-hidden />
              {linkLoading ? 'Creating…' : 'Get guest link'}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
