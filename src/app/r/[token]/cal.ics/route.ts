/**
 * GET /r/<join token>/cal.ics: the reservation's add-to-calendar file. Opening
 * it on a phone offers to add the event to the phone's own calendar. Same
 * token and checks as the guest self-register link; 404 once the reservation
 * is cancelled or over.
 */
import { lookupCalendar } from '@/lib/guestLink';
import { reservationIcs } from '@/lib/reservationIcs';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await lookupCalendar(token);
  if (!found.ok) {
    return new Response('This calendar link is no longer available.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  }
  return new Response(reservationIcs(found.details), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="reservation.ics"',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  });
}
