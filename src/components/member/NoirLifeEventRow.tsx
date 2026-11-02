"use client";

import React from 'react';
import { formatEventWhen, NoirLifeEvent } from '@/lib/noirLife';

const sans = { fontFamily: 'Montserrat, sans-serif' };

interface Props {
  event: Pick<NoirLifeEvent, 'id' | 'title' | 'start_time' | 'end_time' | 'rsvp_enabled' | 'rsvp_url'> & {
    event_description?: string | null;
  };
  onRSVP: (rsvpUrl: string) => void;
  onReserve: () => void;
}

// One upcoming member event with its RSVP (when the event has one) or a reservation button.
export default function NoirLifeEventRow({ event, onRSVP, onReserve }: Props) {
  const canRSVP = !!(event.rsvp_enabled && event.rsvp_url);
  return (
    <div className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#A59480]" style={sans}>
          {formatEventWhen(event.start_time, event.end_time)}
        </p>
        <p className="text-[15px] font-semibold text-[#1F1F1F] mt-0.5 truncate" style={sans}>
          {event.title}
        </p>
        {event.event_description && (
          <p className="text-sm text-[#5A5A5A] mt-0.5 line-clamp-2" style={sans}>
            {event.event_description}
          </p>
        )}
      </div>
      <button
        onClick={() => (canRSVP ? onRSVP(event.rsvp_url as string) : onReserve())}
        className="shrink-0 min-h-[44px] px-4 rounded-full bg-[#23201C] text-[#ECEDE8] text-sm font-semibold active:scale-95 transition-all"
        style={{ ...sans, touchAction: 'manipulation' }}
      >
        {canRSVP ? 'RSVP' : 'Reserve'}
      </button>
    </div>
  );
}
