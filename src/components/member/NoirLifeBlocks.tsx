"use client";

import React from 'react';
import { NoirLifeBlock, videoEmbedUrl } from '@/lib/noirLife';

// Renders a Noir.life post's blocks, single column and phone-first.
// Used in the member portal and in the admin editor's live preview.

const serif = { fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', letterSpacing: '0.04em' };
const sans = { fontFamily: 'Montserrat, sans-serif' };

interface Props {
  blocks: NoirLifeBlock[];
  /** Called for an RSVP button. Omit to hide RSVP buttons (no event linked). */
  onRSVP?: () => void;
  onReserve?: () => void;
}

export default function NoirLifeBlocks({ blocks, onRSVP, onReserve }: Props) {
  return (
    <div className="space-y-5">
      {blocks.map((b) => {
        switch (b.type) {
          case 'heading':
            return b.text ? (
              <h2 key={b.id} className="text-2xl text-[#1F1F1F] pt-1" style={serif}>
                {b.text}
              </h2>
            ) : null;

          case 'text':
            return b.text ? (
              <p
                key={b.id}
                className="text-[16px] leading-relaxed text-[#2C2C2C] whitespace-pre-line break-words"
                style={sans}
              >
                {b.text}
              </p>
            ) : null;

          case 'image':
            return b.url ? (
              <figure key={b.id} className="-mx-4 sm:mx-0">
                <img src={b.url} alt={b.caption || ''} className="w-full sm:rounded-2xl object-cover" loading="lazy" />
                {b.caption && (
                  <figcaption className="text-xs text-[#8C7C6D] mt-2 px-4 sm:px-0" style={sans}>
                    {b.caption}
                  </figcaption>
                )}
              </figure>
            ) : null;

          case 'gallery':
            return b.urls.length ? (
              <div
                key={b.id}
                className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {b.urls.map((u, i) => (
                  <img
                    key={u + i}
                    src={u}
                    alt=""
                    loading="lazy"
                    className={`snap-center shrink-0 rounded-2xl object-cover aspect-[4/5] ${
                      b.urls.length === 1 ? 'w-full' : 'w-[78%] sm:w-[48%]'
                    }`}
                  />
                ))}
              </div>
            ) : null;

          case 'video': {
            if (!b.url) return null;
            const embed = videoEmbedUrl(b.url);
            return (
              <div key={b.id} className="-mx-4 sm:mx-0">
                {embed ? (
                  <div className="relative w-full aspect-video sm:rounded-2xl overflow-hidden bg-black">
                    <iframe
                      src={embed}
                      className="absolute inset-0 w-full h-full"
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                      title="Video"
                    />
                  </div>
                ) : (
                  <video
                    src={b.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full sm:rounded-2xl bg-black"
                  />
                )}
              </div>
            );
          }

          case 'button': {
            const handler =
              b.action === 'rsvp' ? onRSVP : b.action === 'reserve' ? onReserve : undefined;
            if (b.action === 'rsvp' && !onRSVP) return null;
            const cls =
              'block w-full text-center min-h-[52px] px-6 py-4 rounded-full bg-[#23201C] text-[#ECEDE8] text-base font-semibold active:scale-95 transition-all';
            const style = { ...sans, letterSpacing: '0.05em', touchAction: 'manipulation' as const };
            return b.action === 'link' && b.url ? (
              <a key={b.id} href={b.url} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
                {b.label}
              </a>
            ) : (
              <button key={b.id} type="button" onClick={handler} className={cls} style={style}>
                {b.label}
              </button>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
