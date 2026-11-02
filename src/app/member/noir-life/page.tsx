"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MemberLayout from '@/components/member/MemberLayout';
import RSVPModal from '@/components/member/RSVPModal';
import SimpleReservationRequestModal from '@/components/member/SimpleReservationRequestModal';
import NoirLifeEventRow from '@/components/member/NoirLifeEventRow';
import { useMemberAuth } from '@/context/MemberAuthContext';
import {
  NOIR_LIFE_CLUB_LABEL,
  NoirLifeClub,
  NoirLifeEvent,
  NoirLifePost,
  formatPostDate,
} from '@/lib/noirLife';

// Noir.life: news, updates and upcoming member events, written by staff in Admin > Noir.life.

const serif = { fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', letterSpacing: '0.06em' };
const sans = { fontFamily: 'Montserrat, sans-serif' };

type Filter = 'all' | 'noir' | 'noir-op' | 'events';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'events', label: 'Events' },
  { key: 'noir', label: 'Noir' },
  { key: 'noir-op', label: 'Noir OP' },
];

export default function NoirLifePage() {
  const router = useRouter();
  const { member } = useMemberAuth();
  const [posts, setPosts] = useState<NoirLifePost[]>([]);
  const [events, setEvents] = useState<NoirLifeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [rsvpUrl, setRsvpUrl] = useState('');
  const [isReserveOpen, setIsReserveOpen] = useState(false);

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('filter');
    if (f && FILTERS.some((x) => x.key === f)) setFilter(f as Filter);
  }, []);

  useEffect(() => {
    if (!member) return;
    fetch('/api/member/noir-life', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { posts: [], events: [] }))
      .then((d) => {
        setPosts(d.posts || []);
        setEvents(d.events || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [member]);

  const visiblePosts =
    filter === 'events'
      ? posts.filter((p) => p.private_event_id)
      : filter === 'all'
      ? posts
      : posts.filter((p) => p.club === filter || p.club === 'all');
  const showEvents = filter === 'all' || filter === 'events' || filter === 'noir';
  const visibleEvents = filter === 'events' ? events : events.slice(0, 3);

  return (
    <MemberLayout>
      <div className="max-w-2xl mx-auto space-y-5 pb-6">
        <h1 className="text-3xl sm:text-4xl text-[#1F1F1F]" style={serif}>
          Noir.life
        </h1>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 min-h-[40px] px-4 rounded-full text-sm font-semibold border transition-colors ${
                filter === f.key
                  ? 'bg-[#23201C] text-[#ECEDE8] border-[#23201C]'
                  : 'bg-white text-[#5A5A5A] border-[#ECEAE5]'
              }`}
              style={{ ...sans, touchAction: 'manipulation' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-[#8C7C6D]" style={sans}>Loading…</p>
        ) : (
          <>
            {/* Upcoming events */}
            {showEvents && visibleEvents.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#A59480]" style={sans}>
                    Upcoming
                  </p>
                  {filter !== 'events' && events.length > 3 && (
                    <button
                      onClick={() => setFilter('events')}
                      className="text-sm font-medium text-[#A59480]"
                      style={sans}
                    >
                      See all
                    </button>
                  )}
                </div>
                {visibleEvents.map((e) => (
                  <NoirLifeEventRow
                    key={e.id}
                    event={e}
                    onRSVP={setRsvpUrl}
                    onReserve={() => setIsReserveOpen(true)}
                  />
                ))}
              </section>
            )}

            {/* Posts */}
            <section className="space-y-3">
              {visiblePosts.map((p) => (
                <article
                  key={p.id}
                  onClick={() => router.push(`/member/noir-life/${p.id}`)}
                  className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
                >
                  {p.cover_image_url && (
                    <img src={p.cover_image_url} alt="" className="w-full aspect-[16/9] object-cover" />
                  )}
                  <div className="p-4">
                    <p className="text-xs text-[#8C7C6D]" style={sans}>
                      <span className="font-semibold text-[#A59480]">
                        {NOIR_LIFE_CLUB_LABEL[p.club as NoirLifeClub]}
                      </span>
                      {' · '}
                      {formatPostDate(p.published_at)}
                      {p.is_pinned && ' · Pinned'}
                    </p>
                    <h2 className="text-lg font-semibold text-[#1F1F1F] mt-1" style={sans}>
                      {p.title}
                    </h2>
                    {p.summary && (
                      <p className="text-[15px] leading-relaxed text-[#2C2C2C] mt-1 line-clamp-3" style={sans}>
                        {p.summary}
                      </p>
                    )}
                  </div>
                </article>
              ))}

              {visiblePosts.length === 0 && !(showEvents && visibleEvents.length > 0) && (
                <p className="text-sm text-[#8C7C6D]" style={sans}>Nothing posted here yet.</p>
              )}
            </section>
          </>
        )}
      </div>

      <RSVPModal isOpen={!!rsvpUrl} onClose={() => setRsvpUrl('')} rsvpUrl={rsvpUrl} />
      <SimpleReservationRequestModal
        isOpen={isReserveOpen}
        onClose={() => setIsReserveOpen(false)}
        memberName={member ? `${member.first_name} ${member.last_name}` : ''}
        memberPhone={member?.phone || ''}
        memberId={member?.member_id}
        accountId={member?.account_id}
        hideTableSelection={true}
      />
    </MemberLayout>
  );
}
