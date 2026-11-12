'use client';

/**
 * Campaigns → Reservation guests. Everything about texts to people members
 * bring lives here:
 *   Messages — the four guest texts: edit, on/off, live preview, character count.
 *   Guests   — one row per guest visit for manual follow-up: text a guest,
 *              mark followed up with a note, see sent history, export CSV.
 *
 * ("Guests" here are reservation guests, not the campaign engine's
 * non-member reservation phones.)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { Download, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { adminRequestHeaders } from '@/lib/adminRequestHeaders';
import { renderGuestMessage } from '@/lib/guestMessageRender';

type Kind = 'added' | 'day_of' | 'time_changed' | 'cancelled';

interface Template {
  kind: Kind;
  body: string;
  is_active: boolean;
  send_offset_minutes: number | null;
}

interface Row {
  id: string;
  reservation_id: string;
  guest_name: string;
  phone_display: string;
  host_name: string;
  location_name: string;
  reservation_start: string;
  checked_in: boolean;
  visit_count: number;
  last_visit: string | null;
  opted_out: boolean;
  now_member: boolean;
  followed_up_at: string | null;
  followed_up_by: string | null;
  follow_up_note: string | null;
}

interface SentMessage {
  id: string;
  content: string;
  sent_by: string | null;
  status: string;
  created_at: string;
}

const KIND_LABELS: Record<Kind, { title: string; when: string }> = {
  added: { title: 'Added', when: 'When a member adds them (skipped if the reservation is within 2 hours).' },
  day_of: { title: 'Day of', when: 'Before the reservation, at the time set below.' },
  time_changed: { title: 'Time changed', when: 'To guests already texted, when the reservation moves.' },
  cancelled: { title: 'Cancelled', when: 'To guests already texted, when the reservation is cancelled.' },
};

const TZ = 'America/Chicago';
const fmt = (iso: string | null, f = 'LLL d, h:mm a') => (iso ? DateTime.fromISO(iso, { zone: 'utc' }).setZone(TZ).toFormat(f) : '—');

// ---------------------------------------------------------------------------

function MessagesTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Kind | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/admin/reservation-guests/templates', { headers: await adminRequestHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load messages.');
        setTemplates(data.templates || []);
        setDrafts(Object.fromEntries((data.templates || []).map((t: Template) => [t.kind, t])));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load messages.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (kind: Kind) => {
    const d = drafts[kind];
    setSaving(kind);
    try {
      const body: Record<string, unknown> = { kind, body: d.body, is_active: d.is_active };
      if (kind === 'day_of') body.send_offset_minutes = d.send_offset_minutes ?? 120;
      const response = await fetch('/api/admin/reservation-guests/templates', {
        method: 'PUT',
        headers: await adminRequestHeaders(),
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save.');
      setTemplates((prev) => prev.map((t) => (t.kind === kind ? data.template : t)));
      toast({ title: 'Message saved', variant: 'success' });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Could not save.', variant: 'error' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (error) return <p className="text-sm text-error-red">{error}</p>;

  const previewStart = DateTime.now().setZone(TZ).plus({ days: 2 }).set({ hour: 20, minute: 0 }).toUTC().toISO()!;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Placeholders: {'{{guest_first_name}} {{host_first_name}} {{location_name}} {{date}} {{time}} {{arrival_instructions}}'}. End every text with
        &ldquo;Reply STOP to opt out.&rdquo;
      </p>
      {templates.map((t) => {
        const d = drafts[t.kind] || t;
        const preview = renderGuestMessage(d.body, {
          guestFirstName: 'Ava',
          hostFirstName: 'Tim',
          locationName: 'Noir KC',
          start: previewStart,
          timezone: TZ,
          arrivalInstructions: null,
        });
        const changed = d.body !== t.body || d.is_active !== t.is_active || d.send_offset_minutes !== t.send_offset_minutes;
        const missingStop = !/reply stop to opt out/i.test(d.body);
        return (
          <div key={t.kind} className="flex flex-col gap-3 rounded-2xl border border-border-cream-1 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-text-primary">{KIND_LABELS[t.kind].title}</h3>
                <p className="text-xs text-text-muted">{KIND_LABELS[t.kind].when}</p>
              </div>
              <label className="flex h-11 shrink-0 items-center gap-2 text-sm text-text-muted">
                <Switch
                  checked={d.is_active}
                  onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, [t.kind]: { ...d, is_active: checked } }))}
                  aria-label={`${KIND_LABELS[t.kind].title} on`}
                />
                {d.is_active ? 'On' : 'Off'}
              </label>
            </div>
            <Label htmlFor={`tpl-${t.kind}`} className="sr-only">
              {KIND_LABELS[t.kind].title} message
            </Label>
            <Textarea
              id={`tpl-${t.kind}`}
              rows={4}
              className="text-base"
              value={d.body}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [t.kind]: { ...d, body: e.target.value } }))}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
              <span>{d.body.length} characters (template)</span>
              <span className={preview.length > 300 ? 'text-error-red' : ''}>{preview.length} characters as sent (preview)</span>
            </div>
            {missingStop && <p className="text-xs text-error-red">Add &ldquo;Reply STOP to opt out.&rdquo;</p>}
            {t.kind === 'day_of' && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="tpl-day-of-offset">Minutes before the reservation</Label>
                <Input
                  id="tpl-day-of-offset"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1440}
                  className="h-11 w-32 text-base"
                  value={d.send_offset_minutes ?? 120}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, day_of: { ...d, send_offset_minutes: Number(e.target.value) } }))}
                />
              </div>
            )}
            <div className="rounded-lg bg-bg-cream-1 p-3">
              <p className="mb-1 text-xs font-semibold text-text-muted">Preview</p>
              <p className="whitespace-pre-wrap text-sm text-text-primary">{preview}</p>
            </div>
            <Button className="h-11 self-stretch sm:self-end" disabled={!changed || saving === t.kind || !d.body.trim()} onClick={() => save(t.kind)}>
              {saving === t.kind ? 'Saving…' : 'Save'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function GuestRowCard({ row, onChanged }: { row: Row; onChanged: (patch: Partial<Row>) => void }) {
  const { toast } = useToast();
  const [composeOpen, setComposeOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState(row.follow_up_note || '');
  const [savingFollow, setSavingFollow] = useState(false);
  const [history, setHistory] = useState<SentMessage[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    const response = await fetch(`/api/admin/reservation-guests/${row.id}/messages`, { headers: await adminRequestHeaders() });
    const data = await response.json();
    setHistory(response.ok ? data.messages || [] : []);
  }, [row.id]);

  const send = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/admin/reservation-guests/${row.id}/text`, {
        method: 'POST',
        headers: await adminRequestHeaders(),
        body: JSON.stringify({ content: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send.');
      toast({ title: 'Text sent', variant: 'success' });
      setText('');
      setComposeOpen(false);
      if (historyOpen) loadHistory();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Could not send.', variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const setFollowedUp = async (followed: boolean) => {
    setSavingFollow(true);
    try {
      const response = await fetch(`/api/admin/reservation-guests/${row.id}/follow-up`, {
        method: 'PATCH',
        headers: await adminRequestHeaders(),
        body: JSON.stringify({ followed_up: followed, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save.');
      onChanged({ followed_up_at: data.followed_up_at, followed_up_by: data.followed_up_by, follow_up_note: data.follow_up_note });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Could not save.', variant: 'error' });
    } finally {
      setSavingFollow(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border-cream-1 bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">{row.guest_name || 'Guest'}</p>
          <p className="text-sm text-text-muted">{row.phone_display}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {row.checked_in && <Badge>checked in</Badge>}
          {row.now_member && <Badge variant="secondary">now a member</Badge>}
          {row.opted_out && <Badge variant="outline">opted out</Badge>}
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-1"><dt className="text-text-muted">Host:</dt><dd>{row.host_name || '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-text-muted">Location:</dt><dd>{row.location_name || '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-text-muted">Date:</dt><dd>{fmt(row.reservation_start)}</dd></div>
        <div className="flex gap-1"><dt className="text-text-muted">Visits:</dt><dd>{row.visit_count}{row.last_visit ? ` · last ${fmt(row.last_visit, 'LLL d')}` : ''}</dd></div>
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="h-11 flex-1" disabled={row.opted_out} onClick={() => setComposeOpen((o) => !o)}>
          <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
          {row.opted_out ? 'Opted out' : 'Text'}
        </Button>
        <Button
          variant="ghost"
          className="h-11 flex-1"
          onClick={() => {
            const next = !historyOpen;
            setHistoryOpen(next);
            if (next && history === null) loadHistory();
          }}
        >
          {historyOpen ? 'Hide history' : 'Sent texts'}
        </Button>
      </div>

      {composeOpen && !row.opted_out && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`compose-${row.id}`}>Message to {row.guest_name.split(' ')[0] || 'guest'}</Label>
          <Textarea id={`compose-${row.id}`} rows={3} className="text-base" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{text.length} characters</span>
            <Button className="h-11" disabled={sending || !text.trim()} onClick={send}>
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="rounded-lg bg-bg-cream-1 p-3">
          {history === null ? (
            <Spinner />
          ) : history.length === 0 ? (
            <p className="text-sm text-text-muted">No texts sent yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((m) => (
                <li key={m.id} className="text-sm">
                  <p className="text-xs text-text-muted">
                    {fmt(m.created_at)} · {m.sent_by === 'system:guests' ? 'automatic' : m.sent_by || 'unknown'}
                    {m.status !== 'sent' ? ` · ${m.status}` : ''}
                  </p>
                  <p className="whitespace-pre-wrap text-text-primary">{m.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border-cream-1 pt-3">
        <Label htmlFor={`note-${row.id}`}>Follow-up note</Label>
        <Input id={`note-${row.id}`} className="h-11 text-base" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        <label className="flex h-11 items-center gap-3 text-sm">
          <Switch checked={!!row.followed_up_at} disabled={savingFollow} onCheckedChange={setFollowedUp} aria-label="Followed up" />
          {row.followed_up_at ? `Followed up ${fmt(row.followed_up_at, 'LLL d')}${row.followed_up_by ? ` by ${row.followed_up_by}` : ''}` : 'Followed up'}
        </label>
      </div>
    </li>
  );
}

function GuestsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationId, setLocationId] = useState('');
  const [from, setFrom] = useState(DateTime.now().setZone(TZ).minus({ days: 30 }).toISODate()!);
  const [to, setTo] = useState(DateTime.now().setZone(TZ).plus({ days: 30 }).toISODate()!);
  const [notFollowedUp, setNotFollowedUp] = useState(false);
  const [exporting, setExporting] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (locationId) p.set('location_id', locationId);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (notFollowedUp) p.set('not_followed_up', '1');
    return p.toString();
  }, [locationId, from, to, notFollowedUp]);

  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase.from('locations').select('id, name').eq('status', 'active').order('name');
        setLocations((data as Array<{ id: string; name: string }>) || []);
      } catch {
        setLocations([]);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const response = await fetch(`/api/admin/reservation-guests?${query}`, { headers: await adminRequestHeaders() });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || 'Could not load guests.');
        setRows(data.rows || []);
        setTruncated(!!data.truncated);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load guests.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/admin/reservation-guests?${query}&format=csv`, { headers: await adminRequestHeaders() });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reservation-guests-${DateTime.now().toISODate()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border-cream-1 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="rg-location">Location</Label>
          <Select id="rg-location" className="h-11 text-base" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rg-from">From</Label>
          <Input id="rg-from" type="date" className="h-11 text-base" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rg-to">To</Label>
          <Input id="rg-to" type="date" className="h-11 text-base" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <label className="flex h-11 items-center gap-3 self-end text-sm">
          <Switch checked={notFollowedUp} onCheckedChange={setNotFollowedUp} aria-label="Not followed up yet" />
          Not followed up yet
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {loading ? 'Loading…' : `${rows.length} guest visit${rows.length === 1 ? '' : 's'}${truncated ? ' (first 500)' : ''}`}
        </p>
        <Button variant="outline" className="h-11" onClick={exportCsv} disabled={exporting || rows.length === 0}>
          <Download className="mr-2 h-4 w-4" aria-hidden />
          CSV
        </Button>
      </div>

      {error && <p className="text-sm text-error-red">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border-cream-1 bg-white p-6 text-center text-sm text-text-muted">No guests for these filters.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <GuestRowCard
              key={r.id}
              row={r}
              onChanged={(patch) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...patch } : x)))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReservationGuestsSection() {
  return (
    <section className="mt-10 flex flex-col gap-4" aria-labelledby="reservation-guests-heading">
      <div>
        <h2 id="reservation-guests-heading" className="text-xl font-semibold text-text-primary">
          Reservation guests
        </h2>
        <p className="text-sm text-text-muted">Texts to the people members bring, and follow-up after their visit.</p>
      </div>
      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 p-1 sm:inline-grid sm:w-auto">
          <TabsTrigger value="messages" className="h-11 px-6">Messages</TabsTrigger>
          <TabsTrigger value="guests" className="h-11 px-6">Guests</TabsTrigger>
        </TabsList>
        <TabsContent value="messages" className="mt-4">
          <MessagesTab />
        </TabsContent>
        <TabsContent value="guests" className="mt-4">
          <GuestsTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}
