"use client";

import React from 'react';
import Image from 'next/image';
import MemberLayout from '@/components/member/MemberLayout';
import { useMemberAuth } from '@/context/MemberAuthContext';

// Members-only page: what Noir KC is, and where Noir OP stands.
// Gated by MemberLayout, which sends signed-out visitors to the
// phone-number login and back here afterwards.

const serif = { fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', letterSpacing: '0.06em' };
const sans = { fontFamily: 'Montserrat, sans-serif' };

const NOIR_TEXT_LINE = '9137774488';

// Weekly build updates go here, newest first. Keep each one to a line or two.
const OP_UPDATES: { date: string; text: string }[] = [
  {
    date: 'November 2026',
    text: 'The lease at Corbin Park is in its final round of edits. Design work is ready to start once it is signed.',
  },
];

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-5 sm:p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-[#A59480] mb-2" style={sans}>
        {eyebrow}
      </p>
      <h2 className="text-2xl sm:text-3xl text-[#1F1F1F] mb-4 uppercase" style={serif}>
        {title}
      </h2>
      <div className="space-y-4 text-[15px] sm:text-base leading-relaxed text-[#2C2C2C]" style={sans}>
        {children}
      </div>
    </section>
  );
}

export default function NoirOpPage() {
  const { member } = useMemberAuth();

  const referralLink =
    member?.referral_code && typeof window !== 'undefined'
      ? `${window.location.origin}/refer/${member.referral_code}`
      : null;

  const shareText = referralLink
    ? `I'd like you to see Noir. This is my personal invitation: ${referralLink}`
    : '';

  return (
    <MemberLayout>
      <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="relative w-full h-48 sm:h-64 rounded-2xl overflow-hidden">
          <Image
            src="/images/LPR67899.JPG"
            alt="Noir lounge"
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
          <div className="absolute inset-0 bg-[#23201C]/50" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <p className="text-xs uppercase tracking-[0.25em] text-[#BCA892] mb-2" style={sans}>
              For members
            </p>
            <h1 className="text-3xl sm:text-4xl text-[#ECEDE8] uppercase" style={serif}>
              Inside Noir
            </h1>
            {member?.first_name && (
              <p className="mt-2 text-sm text-[#ECEDE8]" style={sans}>
                Welcome back, {member.first_name}.
              </p>
            )}
          </div>
        </div>

        {/* Section 1: Noir KC */}
        <Section eyebrow="Where it started" title="Noir KC">
          <p>
            Noir sits on the ground floor of The Mark at 106 W 11th Street, in downtown Kansas
            City. It was built as one room for people who care about a good drink and a good
            conversation, and want somewhere to have both without the noise of a crowded bar.
          </p>
          <p>
            Our rule for the room has always been the same: elegant to impress, comfortable to
            stay. The cocktails change with the seasons and we have fun with them. The point is
            the room and the people in it.
          </p>
          <p>
            Noir became members only so the room could stay that way. Membership is by
            invitation, from people who know the room and who would be right in it.
          </p>
          {/* PLACEHOLDER: Tim and Louise's own two or three lines on why they started Noir. */}
          <p className="text-sm italic text-[#8C7C6D]">
            [Placeholder: a few lines from Tim and Louise on why they started Noir.]
          </p>
        </Section>

        {/* Section 2: Noir OP */}
        <Section eyebrow="What's next" title="Noir OP">
          <p>
            Noir&apos;s second room is coming to Corbin Park, on 135th Street in Overland Park.
            It is not a copy of Noir KC. It is a deeper version of it: a main lounge with a long
            bar, three smaller rooms each with its own character, and a heated patio.
          </p>
          <p>
            Your membership carries over. Noir KC members will have Noir OP the same way they
            have Noir KC today.
          </p>
          <p>
            Charter members are helping fund the build and shape the room. We will share how it
            comes together here, week by week, so you can watch it happen.
          </p>

          <div className="mt-2 rounded-xl bg-[#F6F5F2] border border-[#ECEAE5] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#A59480] mb-3" style={sans}>
              Where we are
            </p>
            <ul className="space-y-3">
              {OP_UPDATES.map((u) => (
                <li key={u.date}>
                  <p className="text-xs font-semibold text-[#8C7C6D]">{u.date}</p>
                  <p className="text-[15px] text-[#2C2C2C]">{u.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* Share */}
        <Section eyebrow="Bring someone in" title="Know someone who belongs here?">
          <p>
            Noir grows one invitation at a time. If someone in your life would be right for the
            room, send them your personal invitation.
          </p>
          {referralLink ? (
            <a
              href={`sms:?&body=${encodeURIComponent(shareText)}`}
              className="block w-full text-center px-6 py-4 rounded-full bg-[#23201C] text-[#ECEDE8] text-base font-semibold active:scale-95 transition-all"
              style={{ ...sans, letterSpacing: '0.05em', touchAction: 'manipulation' }}
            >
              Send my invitation
            </a>
          ) : (
            <p className="text-sm text-[#8C7C6D]">Your invitation link will appear here soon.</p>
          )}
        </Section>

        {/* Questions */}
        <Section eyebrow="Questions" title="Ask us anything">
          <p>Have a question about Noir OP, or an idea for the room? Text us. We read every one.</p>
          <a
            href={`sms:${NOIR_TEXT_LINE}?body=${encodeURIComponent('Noir OP question: ')}`}
            className="block w-full text-center px-6 py-4 rounded-full border border-[#A59480] text-[#A59480] text-base font-semibold active:scale-95 transition-all"
            style={{ ...sans, letterSpacing: '0.05em', touchAction: 'manipulation' }}
          >
            Text a question
          </a>
        </Section>
      </div>
    </MemberLayout>
  );
}
