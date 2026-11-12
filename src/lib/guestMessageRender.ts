/**
 * Render a reservation-guest text. Pure (luxon only) so the Campaigns preview
 * in the browser uses exactly what the sender uses.
 */
import { DateTime } from 'luxon';

export const DEFAULT_TIMEZONE = 'America/Chicago';
export const DEFAULT_ARRIVAL_INSTRUCTIONS = "Give your name at the door and we'll take it from there.";

export interface RenderContext {
  guestFirstName: string;
  hostFirstName: string;
  locationName: string;
  start: string;
  timezone?: string | null;
  arrivalInstructions?: string | null;
}

export function renderGuestMessage(body: string, ctx: RenderContext): string {
  const tz = ctx.timezone || DEFAULT_TIMEZONE;
  const start = DateTime.fromISO(ctx.start, { zone: 'utc' }).setZone(tz);
  const arrival = (ctx.arrivalInstructions || '').trim() || DEFAULT_ARRIVAL_INSTRUCTIONS;
  return body
    .replace(/\{\{guest_first_name\}\}/g, ctx.guestFirstName)
    .replace(/\{\{host_first_name\}\}/g, ctx.hostFirstName)
    .replace(/\{\{location_name\}\}/g, ctx.locationName)
    .replace(/\{\{date\}\}/g, start.isValid ? start.toFormat('cccc, LLLL d') : '')
    .replace(/\{\{time\}\}/g, start.isValid ? start.toFormat('h:mm a') : '')
    .replace(/\{\{arrival_instructions\}\}/g, arrival)
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

