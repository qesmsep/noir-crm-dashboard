/**
 * Client helpers for showing reservation guests' first names on door views.
 */
import { adminRequestHeaders } from '@/lib/adminRequestHeaders';

export async function fetchGuestNames(reservationIds: string[]): Promise<Record<string, string[]>> {
  const ids = [...new Set(reservationIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const out: Record<string, string[]> = {};
  try {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const response = await fetch(`/api/admin/reservation-guests/names?ids=${chunk.join(',')}`, { headers: await adminRequestHeaders() });
      if (!response.ok) continue;
      const data = await response.json();
      Object.assign(out, data.names || {});
    }
  } catch {
    // Door views work without guest names.
  }
  return out;
}

/** "Ava, Bo" — or "Ava, Bo, Cy +2" when there are more than `max`. */
export function guestNamesLabel(names: string[] | undefined, max = 3): string {
  if (!names || names.length === 0) return '';
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max}`;
}
