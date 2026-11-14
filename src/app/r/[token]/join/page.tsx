'use client';

/**
 * No-login self-register page a member sends to their guests. A guest adds only
 * themselves: first name, mobile, last name optional. Shows the location, date,
 * time and host's first name; never the guest list or any member data.
 */
import React, { use, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import AddGuestsForm, { toSubmitResult } from '@/components/guests/AddGuestsForm';
import LocationLogo from '@/components/guests/LocationLogo';

interface Summary {
  location_name: string;
  location_slug?: string | null;
  date: string;
  time: string;
  host_first_name: string;
}

export default function GuestJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinedAs, setJoinedAs] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/guest-join/${encodeURIComponent(token)}`);
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
            <p className="mt-2 text-sm text-text-muted">Ask the person who invited you to add you.</p>
          </div>
        )}

        {!loading && summary && (
          <>
            <LocationLogo slug={summary.location_slug} />
            <header className="rounded-2xl border border-border-cream-1 bg-white p-5">
              <p className="text-sm text-text-muted">You&apos;re invited by {summary.host_first_name}</p>
              <h1 className="mt-1 text-xl font-semibold text-text-primary">{summary.location_name}</h1>
              <p className="mt-1 text-base text-text-primary">
                {summary.date} at {summary.time}
              </p>
            </header>

            {joinedAs ? (
              <div role="status" className="flex items-start gap-3 rounded-2xl border border-border-cream-1 bg-white p-5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cork" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-text-primary">You&apos;re on the list, {joinedAs}.</p>
                  <p className="mt-1 text-sm text-text-muted">We&apos;ll text you how to get in.</p>
                </div>
              </div>
            ) : (
              <section className="flex flex-col gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Add yourself to the list</h2>
                  <p className="text-sm text-text-muted">We&apos;ll text you how to get in and greet you by name.</p>
                </div>
                <AddGuestsForm
                  idPrefix="join-guest"
                  allowContacts={false}
                  maxGuests={1}
                  rowLabel={() => 'You'}
                  submitLabel="Add me"
                  onSubmit={async (guests) => {
                    const me = guests[0];
                    const response = await fetch(`/api/guest-join/${encodeURIComponent(token)}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(me),
                    });
                    const result = await toSubmitResult(response);
                    if (result.ok) setJoinedAs(me.first_name.trim());
                    return result;
                  }}
                />
                <p className="text-xs text-text-muted">
                  By adding yourself, you agree to get texts about this reservation. Reply STOP to opt out.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
