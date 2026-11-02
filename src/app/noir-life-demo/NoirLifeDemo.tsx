"use client";

import React, { useState } from 'react';
import NoirLifeBlocks from '@/components/member/NoirLifeBlocks';
import NoirLifeEventRow from '@/components/member/NoirLifeEventRow';
import { NoirLifeBlock } from '@/lib/noirLife';

const serif = { fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', letterSpacing: '0.04em' };
const sans = { fontFamily: 'Montserrat, sans-serif' };

const SAMPLE_BLOCKS: NoirLifeBlock[] = [
  {
    id: 'a',
    type: 'text',
    text: 'Our fall menu is here. The bar team spent six weeks on it, and we think it is the best list Noir has poured.',
  },
  { id: 'b', type: 'heading', text: 'What to order first' },
  {
    id: 'c',
    type: 'text',
    text: 'Start with the Smoked Pear Old Fashioned. Then ask your bartender about the reserve pour this month.',
  },
  {
    id: 'd',
    type: 'gallery',
    urls: ['/images/LPR66872.JPG', '/images/LPR67899.JPG', '/images/LPR67921.JPG'],
  },
  { id: 'e', type: 'heading', text: 'Taste it with us' },
  {
    id: 'f',
    type: 'text',
    text: 'Members are invited to a tasting night on Thursday, November 12. Space is limited.',
  },
  { id: 'g', type: 'button', label: 'RSVP for the tasting', action: 'rsvp' },
  { id: 'h', type: 'button', label: 'Make a reservation', action: 'reserve' },
];

export default function NoirLifeDemo() {
  const [view, setView] = useState<'card' | 'feed' | 'post'>('post');

  return (
    <div className="min-h-screen bg-[#ECEDE8]">
      <div className="max-w-[430px] mx-auto px-4 py-5 space-y-5">
        <div className="flex gap-2 text-xs" data-demo-tabs>
          {(['card', 'feed', 'post'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} id={`demo-${v}`}
              className={`px-3 py-1 rounded-full border ${view === v ? 'bg-[#23201C] text-white' : 'bg-white'}`}>
              {v}
            </button>
          ))}
        </div>

        {view === 'card' && (
          <>
            <h1 className="text-3xl text-[#1F1F1F] -mb-2" style={{ fontFamily: 'CONEBARS' }}>Welcome back, Tim</h1>
            <div className="w-full flex items-center justify-between rounded-2xl bg-[#23201C] text-[#ECEDE8] shadow-lg px-6 py-6">
              <span className="text-3xl" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', letterSpacing: '0.06em' }}>
                Noir.life
              </span>
              <span className="text-2xl text-[#A59480]">›</span>
            </div>
            <div className="bg-white rounded-2xl border border-[#ECEAE5] shadow-lg p-5">
              <p className="text-xl font-semibold text-[#1F1F1F]">Profile</p>
              <p className="text-sm text-[#5A5A5A] mt-2">Existing cards continue below…</p>
            </div>
          </>
        )}

        {view === 'feed' && (
          <>
            <h1 className="text-3xl text-[#1F1F1F]" style={{ ...serif, letterSpacing: '0.06em' }}>Noir.life</h1>
            <div className="flex gap-2">
              {['All', 'Events', 'Noir', 'Noir OP'].map((f, i) => (
                <span key={f} className={`min-h-[40px] px-4 rounded-full text-sm font-semibold border flex items-center ${
                  i === 0 ? 'bg-[#23201C] text-[#ECEDE8] border-[#23201C]' : 'bg-white text-[#5A5A5A] border-[#ECEAE5]'}`} style={sans}>
                  {f}
                </span>
              ))}
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#A59480]" style={sans}>Upcoming</p>
            <NoirLifeEventRow
              event={{ id: '1', title: 'Fall menu tasting', start_time: '2026-11-13T00:00:00Z', end_time: '2026-11-13T02:00:00Z', rsvp_enabled: true, rsvp_url: 'x' }}
              onRSVP={() => {}} onReserve={() => {}} />
            <article className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm overflow-hidden">
              <img src="/images/002-20250911-noir-fall-25-©LoveProjectPhotography.jpg" alt="" className="w-full aspect-[16/9] object-cover" />
              <div className="p-4">
                <p className="text-xs text-[#8C7C6D]" style={sans}><span className="font-semibold text-[#A59480]">Noir</span> · November 2, 2026</p>
                <h2 className="text-lg font-semibold text-[#1F1F1F] mt-1" style={sans}>The fall menu is here</h2>
                <p className="text-[15px] leading-relaxed text-[#2C2C2C] mt-1" style={sans}>Six weeks of work from the bar team, and a tasting night for members.</p>
              </div>
            </article>
            <article className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm overflow-hidden">
              <div className="p-4">
                <p className="text-xs text-[#8C7C6D]" style={sans}><span className="font-semibold text-[#A59480]">Noir OP</span> · November 2, 2026</p>
                <h2 className="text-lg font-semibold text-[#1F1F1F] mt-1" style={sans}>Noir OP: the lease is in its final round</h2>
                <p className="text-[15px] leading-relaxed text-[#2C2C2C] mt-1" style={sans}>Design starts once the Corbin Park lease is signed.</p>
              </div>
            </article>
          </>
        )}

        {view === 'post' && (
          <article className="space-y-4">
            <p className="text-sm font-medium text-[#A59480]" style={sans}>← Noir.life</p>
            <img src="/images/002-20250911-noir-fall-25-©LoveProjectPhotography.jpg" alt="" className="w-full rounded-2xl aspect-[4/3] object-cover" />
            <div>
              <p className="text-xs text-[#8C7C6D]" style={sans}><span className="font-semibold text-[#A59480]">Noir</span> · November 2, 2026</p>
              <h1 className="text-2xl text-[#1F1F1F] mt-1" style={serif}>The fall menu is here</h1>
            </div>
            <NoirLifeBlocks blocks={SAMPLE_BLOCKS} onRSVP={() => {}} onReserve={() => {}} />
          </article>
        )}
      </div>
    </div>
  );
}
