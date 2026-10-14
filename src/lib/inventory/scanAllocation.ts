import { matchKey } from './itemNames';

interface StockRow {
  id: string;
  name: string;
  brand?: string | null;
  location_id: string;
  volume_ml?: number | null;
}

export type ScanStep<T extends StockRow> =
  | { kind: 'add'; item: T; location_slug: string; quantity: number }
  | { kind: 'create'; from: T; location_id: string; location_slug: string; quantity: number }
  | { kind: 'error'; location_slug: string; quantity: number; reason: string };

/**
 * Where a receipt line matched to an existing item goes, bar by bar. Each
 * bar's share lands on that product's own row at that bar (same label), not
 * on the one row the scan matched; a bar without one gets a copy created.
 */
export function planMatchedAllocation<T extends StockRow>(
  matched: T,
  allocations: Array<[string, number]>,
  allItems: T[],
  locations: Array<{ id: string; slug: string }>
): ScanStep<T>[] {
  const key = matchKey(matched);
  return allocations
    .filter(([, quantity]) => quantity > 0)
    .map(([slug, quantity]): ScanStep<T> => {
      const loc = locations.find(l => l.slug === slug);
      if (!loc) return { kind: 'error', location_slug: slug, quantity, reason: 'unknown location' };
      if (matched.location_id === loc.id) return { kind: 'add', item: matched, location_slug: slug, quantity };
      const here = allItems.filter(i => i.location_id === loc.id && matchKey(i) === key);
      if (here.length === 0) return { kind: 'create', from: matched, location_id: loc.id, location_slug: slug, quantity };
      const item = here.find(i => (i.volume_ml || null) === (matched.volume_ml || null));
      // Bottles of another size aren't the same count; never fold them into a different-size row.
      return item
        ? { kind: 'add', item, location_slug: slug, quantity }
        : { kind: 'error', location_slug: slug, quantity, reason: 'that bar stocks it in a different bottle size — add it there by hand' };
    });
}
