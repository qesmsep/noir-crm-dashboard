"use client";

import React, { useEffect, useState } from 'react';
import MemberLayout from '@/components/member/MemberLayout';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { MEMBER_UPDATES, CLUB_LABEL, UpdateClub, formatUpdateDate } from '@/lib/memberUpdates';

// Member portal Updates section: Noir and Noir OP news, one tab each.
// Gated by MemberLayout (phone-number member login).

const serif = { fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', letterSpacing: '0.06em' };
const sans = { fontFamily: 'Montserrat, sans-serif' };
const NOIR_TEXT_LINE = '9137774488';

const INTRO: Record<UpdateClub, React.ReactNode> = {
  noir: (
    <>
      <p>
        Noir sits on the ground floor of The Mark at 106 W 11th Street, in downtown Kansas City.
        It was built as one room for people who care about a good drink and a good conversation,
        and want somewhere to have both without the noise of a crowded bar.
      </p>
      <p>
        Our rule for the room has always been the same: elegant to impress, comfortable to stay.
        Membership is by invitation, from people who know the room and who would be right in it.
      </p>
      {/* PLACEHOLDER: Tim and Louise's own two or three lines on why they started Noir. */}
      <p className="text-sm italic text-[#8C7C6D]">
        [Placeholder: a few lines from Tim and Louise on why they started Noir.]
      </p>
    </>
  ),
  'noir-op': (
    <>
      <p>
        Noir&apos;s second room is coming to Corbin Park, on 135th Street in Overland Park. It is
        not a copy of Noir KC. It is a deeper version of it: a main lounge with a long bar, three
        smaller rooms each with its own character, and a heated patio.
      </p>
      <p>
        Your membership carries over. Charter members are helping fund the build and shape the
        room, and we will share how it comes together here, week by week.
      </p>
    </>
  ),
};

export default function MemberUpdatesPage() {
  const { member } = useMemberAuth();
  const [tab, setTab] = useState<UpdateClub>('noir');

  // Allow /member/updates?tab=noir-op so a text can link straight to a tab
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'noir' || t === 'noir-op') setTab(t);
  }, []);

  const updates = MEMBER_UPDATES.filter((u) => u.club === tab);

  const referralLink =
    member?.referral_code && typeof window !== 'undefined'
      ? `${window.location.origin}/refer/${member.referral_code}`
      : null;
  const shareText = referralLink ? `I'd like you to see Noir. This is my personal invitation: ${referralLink}` : '';

  return (
    <MemberLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#A59480]" style={sans}>
            For members
          </p>
          <h1 className="text-3xl sm:text-4xl text-[#1F1F1F] uppercase" style={serif}>
            Updates
          </h1>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-white rounded-full p-1 border border-[#ECEAE5]" role="tablist">
          {(['noir', 'noir-op'] as UpdateClub[]).map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={tab === c}
              onClick={() => setTab(c)}
              className={`py-3 rounded-full text-sm font-semibold transition-colors ${
                tab === c ? 'bg-[#23201C] text-[#ECEDE8]' : 'text-[#5A5A5A]'
              }`}
              style={{ ...sans, touchAction: 'manipulation' }}
            >
              {CLUB_LABEL[c]}
            </button>
          ))}
        </div>

        {/* Feed */}
        <section className="space-y-3">
          {updates.length === 0 ? (
            <p className="text-sm text-[#8C7C6D]" style={sans}>No updates yet.</p>
          ) : (
            updates.map((u) => (
              <article key={u.id} className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-5">
                <p className="text-xs font-semibold text-[#A59480]" style={sans}>
                  {formatUpdateDate(u.date)}
                </p>
                <h2 className="text-lg font-semibold text-[#1F1F1F] mt-1" style={sans}>
                  {u.title}
                </h2>
                <p className="text-[15px] leading-relaxed text-[#2C2C2C] mt-2" style={sans}>
                  {u.body}
                </p>
              </article>
            ))
          )}
        </section>

        {/* About this club */}
        <section className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#A59480] mb-2" style={sans}>
            About {CLUB_LABEL[tab]}
          </p>
          <div className="space-y-3 text-[15px] leading-relaxed text-[#2C2C2C]" style={sans}>
            {INTRO[tab]}
          </div>
        </section>

        {/* Share and ask */}
        <section className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-5 space-y-3">
          <p className="text-[15px] text-[#2C2C2C]" style={sans}>
            Know someone who belongs here? Noir grows one invitation at a time.
          </p>
          {referralLink && (
            <a
              href={`sms:?&body=${encodeURIComponent(shareText)}`}
              className="block w-full text-center px-6 py-4 rounded-full bg-[#23201C] text-[#ECEDE8] text-base font-semibold active:scale-95 transition-all"
              style={{ ...sans, letterSpacing: '0.05em', touchAction: 'manipulation' }}
            >
              Send my invitation
            </a>
          )}
          <a
            href={`sms:${NOIR_TEXT_LINE}?body=${encodeURIComponent(`${CLUB_LABEL[tab]} question: `)}`}
            className="block w-full text-center px-6 py-4 rounded-full border border-[#A59480] text-[#A59480] text-base font-semibold active:scale-95 transition-all"
            style={{ ...sans, letterSpacing: '0.05em', touchAction: 'manipulation' }}
          >
            Text a question
          </a>
        </section>
      </div>
    </MemberLayout>
  );
}
