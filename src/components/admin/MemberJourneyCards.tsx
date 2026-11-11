import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { JourneySettings, JourneyStep, TeamAction } from '@/lib/memberJourney';
import type { RosterRow, TodaysLocation } from '@/lib/memberJourneyData';

// Cards for the 90-day member journey, shown on the business dashboard and on
// Admin > Member journey. Data comes from /api/admin/member-journey.

export interface JourneyStepView extends JourneyStep {
  postPublished: boolean | null;
  preview: string | null;
}

export interface JourneyData {
  today: string;
  ready: boolean;
  settings: JourneySettings;
  steps: JourneyStepView[];
  roster: RosterRow[];
  todaysMembers: TodaysLocation[];
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function journeyRequest(method: 'POST' | 'PUT', body: unknown): Promise<any> {
  const res = await fetch('/api/admin/member-journey', {
    method,
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export function useMemberJourney() {
  const [data, setData] = useState<JourneyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/member-journey', { headers: await authHeaders(), cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `${res.status}`);
      setData(json);
    } catch (err: any) {
      console.error('Member journey fetch error:', err);
      setError(err.message || 'failed to load');
    }
  }, []);

  const markDone = useCallback(async (memberId: string, key: string) => {
    try {
      await journeyRequest('POST', { memberId, key });
      await reload();
    } catch (err: any) {
      window.alert(`Could not mark done: ${err.message || err}`);
    }
  }, [reload]);

  useEffect(() => { reload(); }, [reload]);

  return { data, error, reload, markDone };
}

const card = 'w-full box-border bg-white rounded-xl px-4 py-3.5 my-2 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)] text-[#1d1d1f]';
const muted = 'text-[#86868b]';

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function fmtTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------------------------------------------------------------------------
// Today's member details
// ---------------------------------------------------------------------------

export function TodaysMembersCard({ data, error }: { data: JourneyData | null; error: string | null }) {
  if (error) return <div className={`${card} ${muted} text-sm`}>Couldn&apos;t load today&apos;s members: {error}</div>;
  if (!data) return <div className={`${card} ${muted} text-sm`}>Loading today&apos;s members…</div>;

  const total = data.todaysMembers.reduce((n, l) => n + l.members.length, 0);
  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
        <span className="text-base font-bold">Today&apos;s Member Details</span>
        <span className={`text-[0.8125rem] font-semibold ${total ? '' : muted}`}>
          {total === 0 ? 'No members booked today' : `${total} member reservation${total > 1 ? 's' : ''}`}
        </span>
      </div>

      {data.todaysMembers.map(loc => (
        <div key={loc.locationId || 'none'} className="mt-3">
          <div className="flex items-baseline justify-between gap-2 border-b border-black/10 pb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#A59480]">{loc.name}</span>
            <span className={`text-xs ${muted}`}>
              {loc.members.length} member{loc.members.length === 1 ? '' : 's'}
              {loc.guestReservations > 0 && ` · ${loc.guestReservations} other reservation${loc.guestReservations > 1 ? 's' : ''}`}
            </span>
          </div>
          {loc.members.length === 0 && <div className={`py-2 text-[0.8125rem] ${muted}`}>No members booked here today.</div>}
          <ul className="list-none m-0 p-0">
            {loc.members.map(m => (
              <li key={m.reservationId} className="py-2.5 border-b border-black/5 last:border-b-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[0.8125rem] font-semibold tabular-nums w-[4.5rem] shrink-0">{fmtTime(m.startTime, loc.timezone)}</span>
                  <a href={`/admin/members/${m.accountId}`} className="text-[0.9375rem] font-semibold text-inherit underline-offset-2 hover:underline min-h-[28px] inline-flex items-center">
                    {m.name}
                  </a>
                  {m.day !== null && (
                    <span className="rounded-full bg-[#A59480] text-white text-[0.6875rem] font-semibold px-2 py-0.5">
                      New · Day {m.day}
                    </span>
                  )}
                  <span className="rounded-full bg-[#f0f0f2] text-[0.6875rem] font-semibold px-2 py-0.5">
                    {ordinal(m.visitNumber)} visit
                  </span>
                </div>
                <div className={`mt-0.5 text-xs ${muted} sm:pl-[5rem]`}>
                  {[
                    m.partySize ? `Party of ${m.partySize}` : null,
                    m.table ? `Table ${m.table}` : null,
                    m.lastVisit ? `Last in ${fmtDate(m.lastVisit)}` : 'First time in',
                    m.memberSince ? `Member since ${fmtDate(m.memberSince)}, ${m.memberSince.slice(0, 4)}` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
                {m.brief && (
                  <div className="mt-1.5 sm:ml-[5rem] rounded-lg bg-[#FFF7EC] border border-[#E7C9A0] px-2.5 py-1.5 text-[0.8125rem] text-[#5A4A35]">
                    {m.brief}
                  </div>
                )}
                {(m.attributes.length > 0 || m.notes.length > 0 || m.reservationNotes) && (
                  <div className="mt-1.5 sm:pl-[5rem] flex flex-col gap-1">
                    {m.attributes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.attributes.map(a => (
                          <span key={a.key} className="rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-xs">
                            <span className={muted}>{a.key}:</span> {a.value}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.reservationNotes && <div className="text-xs"><span className={muted}>Reservation note:</span> {m.reservationNotes}</div>}
                    {m.notes.map((n, i) => (
                      <div key={i} className="text-xs"><span className={muted}>Note:</span> {n}</div>
                    ))}
                  </div>
                )}
                {m.day !== null && m.attributes.length === 0 && (
                  <div className={`mt-1 sm:pl-[5rem] text-xs ${muted}`}>
                    Nothing on their profile yet. Add what you learn tonight.
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New members: what needs a person, and where everyone is
// ---------------------------------------------------------------------------

const toneClass: Record<TeamAction['tone'], string> = {
  alert: 'bg-[#ff3b30]',
  todo: 'bg-[#A59480]',
  milestone: 'bg-[#34c759]',
};

export function JourneyProgress({ row }: { row: RosterRow }) {
  const pct = Math.min(100, Math.round((row.day / 90) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-[#ececf0] overflow-hidden" aria-label={`Day ${row.day} of 90`}>
      <div className="h-full rounded-full bg-[#A59480]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function JourneyAttentionCard({
  data,
  error,
  onDone,
  showRoster = true,
}: {
  data: JourneyData | null;
  error: string | null;
  onDone: (memberId: string, key: string) => void;
  showRoster?: boolean;
}) {
  if (error) return <div className={`${card} ${muted} text-sm`}>Couldn&apos;t load the member journey: {error}</div>;
  if (!data) return <div className={`${card} ${muted} text-sm`}>Loading new members…</div>;
  if (!data.ready) {
    return (
      <div className={`${card} text-sm`}>
        <span className="font-bold">90-Day Member Journey</span>
        <div className={`mt-1 ${muted}`}>Not set up yet: the journey migration has not been applied to the database.</div>
      </div>
    );
  }

  const withActions = data.roster.filter(r => r.actions.length > 0);
  const count = withActions.reduce((n, r) => n + r.actions.length, 0);
  const waiting = [...new Set(data.roster.flatMap(r => r.waitingOnPost))];
  const current = data.roster.filter(r => r.day <= 90);

  return (
    <div className={`${card} ${withActions.some(r => r.actions.some(a => a.tone === 'alert')) ? 'border-l-4 border-l-[#ff3b30]' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
        <span className="text-base font-bold">90-Day Member Journey</span>
        <a href="/admin/member-journey" className="text-[0.8125rem] font-semibold text-[#A59480] min-h-[28px] inline-flex items-center">
          {current.length} new member{current.length === 1 ? '' : 's'} · manage ›
        </a>
      </div>

      {!data.settings.enabled && (
        <div className="rounded-lg bg-[#FFF7EC] border border-[#E7C9A0] px-2.5 py-1.5 text-[0.8125rem] text-[#5A4A35] mb-2">
          The onboarding texts are off. Turn them on in <a className="underline" href="/admin/member-journey">Member journey</a> when the texts and posts are ready.
        </div>
      )}
      {data.settings.enabled && waiting.length > 0 && (
        <div className="rounded-lg bg-[#FFF7EC] border border-[#E7C9A0] px-2.5 py-1.5 text-[0.8125rem] text-[#5A4A35] mb-2">
          Waiting on a how-to post to be published in <a className="underline" href="/admin/noir-life">Noir.life</a>: {waiting.join(', ')}.
        </div>
      )}

      {count === 0 ? (
        <div className="text-sm font-medium text-[#248a3d]">✓ Nothing needs you right now.</div>
      ) : (
        <ul className="list-none m-0 p-0">
          {withActions.flatMap(r => r.actions.map(a => (
            <li key={`${r.memberId}-${a.key}`} className="flex items-start gap-2.5 py-2.5 border-b border-black/5 last:border-b-0">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneClass[a.tone]}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-[0.9375rem]">
                  <a href={`/admin/members/${r.accountId}`} className="font-semibold text-inherit hover:underline">{r.name}</a>
                  <span className="font-medium"> · {a.title}</span>
                </div>
                <div className={`text-xs ${muted}`}>{a.detail}</div>
                {a.script && (
                  <div className="mt-1 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-xs italic select-all">{a.script}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDone(r.memberId, a.key)}
                className="shrink-0 min-h-[44px] min-w-[44px] rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                {a.tone === 'milestone' ? 'Got it' : 'Done'}
              </button>
            </li>
          )))}
        </ul>
      )}

      {showRoster && current.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[0.8125rem] font-semibold min-h-[32px] flex items-center">Where every new member is</summary>
          <JourneyRoster rows={current} />
        </details>
      )}
    </div>
  );
}

export function JourneyRoster({ rows }: { rows: RosterRow[] }) {
  if (rows.length === 0) return <div className={`py-2 text-sm ${muted}`}>No members in their first 90 days.</div>;
  return (
    <ul className="list-none m-0 p-0">
      {rows.map(r => (
        <li key={r.memberId} className="py-2.5 border-b border-black/5 last:border-b-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <a href={`/admin/members/${r.accountId}`} className="text-[0.9375rem] font-semibold text-inherit hover:underline">{r.name}</a>
            <span className="text-[0.8125rem] font-semibold tabular-nums">
              {r.day <= 90 ? `Day ${r.day} · Week ${r.week}` : `Day ${r.day}`}
            </span>
          </div>
          <div className="my-1.5"><JourneyProgress row={r} /></div>
          <div className={`text-xs ${muted}`}>
            {[
              `Joined ${fmtDate(r.joinDate)}`,
              r.visits.length === 0 ? 'No visits yet' : `${r.visits.length} visit${r.visits.length > 1 ? 's' : ''}, last ${fmtDate(r.visits[r.visits.length - 1])}`,
              `${r.textsSent} of ${r.textsTotal} texts sent`,
              r.notTexting ? r.notTexting : r.nextText ? `Next: ${r.nextText.label.replace(/^Week \d+: /, '')}, ${fmtDate(r.nextText.date)}` : 'All texts sent',
            ].join(' · ')}
          </div>
        </li>
      ))}
    </ul>
  );
}
