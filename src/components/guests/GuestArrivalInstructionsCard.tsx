'use client';

/**
 * Settings → location: how reservation guests get in. Goes into guest texts
 * as {{arrival_instructions}}.
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminRequestHeaders } from '@/lib/adminRequestHeaders';

const PLACEHOLDER = "Give your name at the door and we'll take it from there.";
const MAX = 200;

export default function GuestArrivalInstructionsCard({ locationId, locationName }: { locationId: string; locationName: string }) {
  const [value, setValue] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setMessage(null);
    (async () => {
      try {
        const response = await fetch(`/api/admin/locations/${locationId}/guest-arrival`, { headers: await adminRequestHeaders() });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) setMessage({ type: 'error', text: data.error || 'Could not load.' });
        else setValue(data.guest_arrival_instructions || '');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/locations/${locationId}/guest-arrival`, {
        method: 'PATCH',
        headers: await adminRequestHeaders(),
        body: JSON.stringify({ guest_arrival_instructions: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save.');
      setMessage({ type: 'success', text: 'Saved.' });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  const id = `arrival-${locationId}`;
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border-cream-1 bg-white p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{locationName} — How guests get in</h2>
        <p className="text-sm text-text-muted">
          Sent to reservation guests in their texts. Keep it short. Leave blank to use: &ldquo;{PLACEHOLDER}&rdquo;
        </p>
      </div>
      <Label htmlFor={id} className="sr-only">
        Arrival instructions
      </Label>
      <Textarea
        id={id}
        rows={3}
        maxLength={MAX}
        className="text-base"
        placeholder={PLACEHOLDER}
        value={value}
        disabled={!loaded}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-muted">
          {value.length}/{MAX}
        </span>
        <Button className="h-11" onClick={save} disabled={saving || !loaded}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {message && (
        <p role="status" className={message.type === 'error' ? 'text-sm text-error-red' : 'text-sm text-text-muted'}>
          {message.text}
        </p>
      )}
    </div>
  );
}
