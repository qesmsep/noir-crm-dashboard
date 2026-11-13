'use client';

/**
 * No-login "add your guests" page, for members who reply to a text. Shows the
 * location, date, time, host's first name and who's already on the list (first
 * name and last initial) — never guests' phones or any member data.
 */
import React, { use, useEffect, useState } from 'react';
import { CheckCircle2, UserRound } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import AddGuestsForm, { toSubmitResult } from '@/components/guests/AddGuestsForm';

interface Summary {
  location_name: string;
  date: string;
  time: string;
  host_first_name: string;
  spots_left: number;
  guests?: string[];
  party_size?: number;
  max_more?: number;
}

export default function GuestLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<number | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/guest-link/${encodeURIComponent(token)}`);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) setError(data.error || 'This link is not valid.');
        else setSummary(data.reservation);
      } catch {
        if (!cancelled) setError('Could not load this page. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-bg-cream-2 px-4 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        {loading && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-border-cream-1 bg-white p-6 text-center">
            <h1 className="text-lg font-semibold text-text-primary">{error}</h1>
            <p className="mt-2 text-sm text-text-muted">Reply to our text and we&apos;ll help.</p>
          </div>
        )}

        {!loading && summary && (
          <>
            <header className="rounded-2xl border border-border-cream-1 bg-white p-5">
              <p className="text-sm text-text-muted">{summary.host_first_name}&apos;s reservation</p>
              <h1 className="mt-1 text-xl font-semibold text-text-primary">{summary.location_name}</h1>
              <p className="mt-1 text-base text-text-primary">
                {summary.date} at {summary.time}
              </p>
            </header>

            {done !== null && (
              <div role="status" className="flex items-start gap-3 rounded-2xl border border-border-cream-1 bg-white p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cork" aria-hidden />
                <p className="text-sm text-text-primary">
                  {done === 1 ? 'Guest added.' : 'Guests added.'} We&apos;ll text them how to get in.
                </p>
              </div>
            )}

            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Who&apos;s coming?</h2>
                <p className="text-sm text-text-muted">We&apos;ll text them how to get in and greet them by name.</p>
              </div>
              {summary.guests && summary.guests.length > 0 && (
                <div className="rounded-2xl border border-border-cream-1 bg-white p-4">
                  <p className="text-sm font-medium text-text-primary">On the list</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {summary.guests.map((name, i) => (
                      <li key={`${name}-${i}`} className="flex items-center gap-2 text-base text-text-primary">
                        <UserRound className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.spots_left === 0 && (summary.max_more ?? 0) > 0 && (
                <p className="text-sm text-text-muted">
                  Your reservation is for {summary.party_size}. Adding someone raises it, as long as we have room.
                </p>
              )}
              <AddGuestsForm
                key={formKey}
                idPrefix="link-guest"
                allowContacts
                maxGuests={summary.max_more ?? summary.spots_left}
                submitLabel="Send"
                onSubmit={async (guests) => {
                  const response = await fetch(`/api/guest-link/${encodeURIComponent(token)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guests }),
                  });
                  const result = await toSubmitResult(response.clone());
                  if (result.ok) {
                    const data = await response.json();
                    setSummary(data.reservation);
                    setDone(guests.length);
                    setFormKey((k) => k + 1);
                  }
                  return result;
                }}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
