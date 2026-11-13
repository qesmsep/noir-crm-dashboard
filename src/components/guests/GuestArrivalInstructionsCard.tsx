'use client';

/**
 * Settings → location: guest info used in texts.
 *   Address                 → {{location_address}}
 *   How guests get in       → {{arrival_instructions}}
 *   Parking                 → {{parking_instructions}}
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminRequestHeaders } from '@/lib/adminRequestHeaders';

const ARRIVAL_DEFAULT = "Give your name at the door and we'll take it from there.";
const MAX = 200;

interface GuestInfo {
  address: string;
  guest_arrival_instructions: string;
  parking_instructions: string;
}

const EMPTY: GuestInfo = { address: '', guest_arrival_instructions: '', parking_instructions: '' };

export default function GuestArrivalInstructionsCard({ locationId, locationName }: { locationId: string; locationName: string }) {
  const [value, setValue] = useState<GuestInfo>(EMPTY);
  const [saved, setSaved] = useState<GuestInfo>(EMPTY);
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
        if (!response.ok) {
          setMessage({ type: 'error', text: data.error || 'Could not load.' });
          return;
        }
        const next = {
          address: data.address || '',
          guest_arrival_instructions: data.guest_arrival_instructions || '',
          parking_instructions: data.parking_instructions || '',
        };
        setValue(next);
        setSaved(next);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const changed =
    value.address !== saved.address ||
    value.guest_arrival_instructions !== saved.guest_arrival_instructions ||
    value.parking_instructions !== saved.parking_instructions;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/locations/${locationId}/guest-arrival`, {
        method: 'PATCH',
        headers: await adminRequestHeaders(),
        body: JSON.stringify(value),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save.');
      setSaved(value);
      setMessage({ type: 'success', text: 'Saved.' });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof GuestInfo, label: string, token: string, hint: string, multiline: boolean, placeholder?: string) => {
    const id = `${key}-${locationId}`;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <Label htmlFor={id}>{label}</Label>
          <code className="text-xs text-text-muted">{token}</code>
        </div>
        {multiline ? (
          <Textarea
            id={id}
            rows={3}
            maxLength={MAX}
            className="text-base"
            placeholder={placeholder}
            value={value[key]}
            disabled={!loaded}
            onChange={(e) => setValue((v) => ({ ...v, [key]: e.target.value }))}
          />
        ) : (
          <Input
            id={id}
            maxLength={MAX}
            className="h-11 text-base"
            placeholder={placeholder}
            value={value[key]}
            disabled={!loaded}
            onChange={(e) => setValue((v) => ({ ...v, [key]: e.target.value }))}
          />
        )}
        <p className="text-xs text-text-muted">
          {hint} {value[key].length}/{MAX}
        </p>
      </div>
    );
  };

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border-cream-1 bg-white p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{locationName} — Guest info for texts</h2>
        <p className="text-sm text-text-muted">
          Used in reservation and guest texts wherever the matching placeholder appears. Keep each one short.
        </p>
      </div>
      {field('address', 'Address', '{{location_address}}', 'Blank leaves the placeholder empty.', false, '1234 Main St, Kansas City, MO')}
      {field('guest_arrival_instructions', 'How guests get in', '{{arrival_instructions}}', `Blank uses: “${ARRIVAL_DEFAULT}”`, true, ARRIVAL_DEFAULT)}
      {field('parking_instructions', 'Parking', '{{parking_instructions}}', 'Blank leaves the placeholder empty.', true, 'Free parking in the garage on 13th St.')}
      <div className="flex items-center justify-end">
        <Button className="h-11" onClick={save} disabled={saving || !loaded || !changed}>
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
