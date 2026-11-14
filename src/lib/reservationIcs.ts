/**
 * The add-to-calendar file for a reservation (RFC 5545). One event with the
 * location, start and end time, party size and the host's first name. No
 * phones, emails or other member or guest data.
 */
import { DateTime } from 'luxon';
import type { CalendarDetails } from '@/lib/guestLink';

/** Escape TEXT values: backslash, semicolon, comma and newlines. */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (continuation lines start with a space). */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, 'utf8');
    const limit = parts.length === 0 ? 75 : 74;
    if (size + n > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function utc(iso: string): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
}

export function reservationIcs(d: CalendarDetails, now: DateTime = DateTime.utc()): string {
  const where = [d.location.name, d.location.address].filter(Boolean).join(', ');
  const description = [
    `Party of ${d.partySize}${d.hostFirstName ? `, hosted by ${d.hostFirstName}` : ''}.`,
    d.location.parkingInstructions ? `Parking: ${d.location.parkingInstructions}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Noir//Reservations//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${d.reservationId}@noirkc.com`,
    `DTSTAMP:${utc(now.toISO()!)}`,
    `DTSTART:${utc(d.start)}`,
    `DTEND:${utc(d.end)}`,
    `SUMMARY:${esc(`${d.location.name} reservation`)}`,
    `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc(description)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
