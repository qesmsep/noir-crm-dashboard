"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MemberLayout from '@/components/member/MemberLayout';
import RSVPModal from '@/components/member/RSVPModal';
import SimpleReservationRequestModal from '@/components/member/SimpleReservationRequestModal';
import NoirLifeEventRow from '@/components/member/NoirLifeEventRow';
import NoirLifeBlocks from '@/components/member/NoirLifeBlocks';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { NOIR_LIFE_CLUB_LABEL, NoirLifeClub, NoirLifePost, formatPostDate } from '@/lib/noirLife';

const serif = { fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', letterSpacing: '0.04em' };
const sans = { fontFamily: 'Montserrat, sans-serif' };

export default function NoirLifePostPage() {
  const params = useParams();
  const router = useRouter();
  const { member } = useMemberAuth();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [post, setPost] = useState<NoirLifePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpUrl, setRsvpUrl] = useState('');
  const [isReserveOpen, setIsReserveOpen] = useState(false);

  useEffect(() => {
    if (!member || !id) return;
    fetch(`/api/member/noir-life?id=${encodeURIComponent(id)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { post: null }))
      .then((d) => setPost(d.post || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [member, id]);

  const linked = post?.private_events && !Array.isArray(post.private_events) ? post.private_events : null;
  const linkedUpcoming = linked && new Date(linked.end_time || linked.start_time) > new Date();
  const rsvpTarget = linked && linkedUpcoming && linked.rsvp_enabled && linked.rsvp_url ? linked.rsvp_url : null;
  // When the post already has its own RSVP/Reserve button, skip the event row
  const hasEventButton = (post?.blocks || []).some(
    (b) => b.type === 'button' && (b.action === 'reserve' || (b.action === 'rsvp' && rsvpTarget))
  );

  return (
    <MemberLayout>
      <div className="max-w-2xl mx-auto pb-6">
        <button
          onClick={() => router.push('/member/noir-life')}
          className="min-h-[44px] text-sm font-medium text-[#A59480]"
          style={sans}
        >
          ← Noir.life
        </button>

        {loading ? (
          <p className="text-sm text-[#8C7C6D]" style={sans}>Loading…</p>
        ) : !post ? (
          <p className="text-sm text-[#8C7C6D]" style={sans}>This post isn&apos;t available.</p>
        ) : (
          <article className="space-y-4">
            {post.cover_image_url && (
              <img src={post.cover_image_url} alt="" className="w-full rounded-2xl aspect-[4/3] object-cover" />
            )}
            <div>
              <p className="text-xs text-[#8C7C6D]" style={sans}>
                <span className="font-semibold text-[#A59480]">
                  {NOIR_LIFE_CLUB_LABEL[post.club as NoirLifeClub]}
                </span>
                {' · '}
                {formatPostDate(post.published_at)}
              </p>
              <h1 className="text-2xl sm:text-3xl text-[#1F1F1F] mt-1" style={serif}>
                {post.title}
              </h1>
            </div>
            <NoirLifeBlocks
              blocks={post.blocks || []}
              onRSVP={rsvpTarget ? () => setRsvpUrl(rsvpTarget) : undefined}
              onReserve={() => setIsReserveOpen(true)}
            />
            {linked && linkedUpcoming && !hasEventButton && (
              <NoirLifeEventRow
                event={linked}
                onRSVP={setRsvpUrl}
                onReserve={() => setIsReserveOpen(true)}
              />
            )}
          </article>
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
