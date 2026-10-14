import React, { useMemo } from 'react';
import type { InventoryItem, RecipeIngredient } from '../../types/inventory';
import { findSimilarItems, itemLabel } from '../../lib/inventory/itemNames';
import { findAtLocation, StockIndex } from '../../lib/toastSalesCore';

/**
 * Under one recipe ingredient: which bottle it comes out of at each bar the
 * recipe is served at. Each bar finds the same product on its own; a bar can
 * be pointed at a different bottle, or marked as not tracking it.
 */
export default function IngredientBarPicks({
  ingredient,
  locations,
  inventory,
  stock,
  onChange,
}: {
  ingredient: RecipeIngredient;
  locations: Array<{ id: string; name: string }>; // the bars the recipe is served at
  inventory: InventoryItem[]; // all bars
  stock: StockIndex;
  onChange: (locationId: string, value: string | null | 'auto') => void;
}) {
  const base = stock.items.get(ingredient.inventory_item_id);
  const locationItems = ingredient.location_items;

  const rows = useMemo(
    () =>
      locations.map(loc => {
        const picks = locationItems || {};
        const here = inventory.filter(i => i.location_id === loc.id);
        const hasPick = Object.prototype.hasOwnProperty.call(picks, loc.id);
        const picked = hasPick ? picks[loc.id] : undefined;
        const auto = base ? findAtLocation(base, loc.id, stock) : null;
        const autoText = !auto
          ? 'no bottle'
          : 'item' in auto
          ? itemLabel(auto.item)
          : 'ambiguous' in auto
          ? 'more than one match — choose'
          : 'not stocked here — choose';
        const problem = !hasPick && (!auto || !('item' in auto));
        const alike = base ? new Set(findSimilarItems(base, here, { limit: 5 }).map(m => m.item.id)) : new Set<string>();
        const options = [...here].sort(
          (a, b) => Number(alike.has(b.id)) - Number(alike.has(a.id)) || itemLabel(a).localeCompare(itemLabel(b))
        );
        return { loc, hasPick, picked, autoText, problem, options, alike };
      }),
    [locations, inventory, locationItems, base, stock]
  );

  if (!base) return null;
  // Nothing to say when the recipe is only served where its bottle lives and nothing was changed.
  if (rows.every(r => !r.hasPick && r.loc.id === base.location_id)) return null;

  return (
    <div style={{ flexBasis: '100%', padding: '0.25rem 0 0.25rem 0.25rem', display: 'grid', gap: '0.375rem' }}>
      {rows.map(r => (
        <label
          key={r.loc.id}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: r.problem ? '#991B1B' : '#6B6760' }}
        >
          <span style={{ minWidth: 84, fontWeight: 500 }}>{r.loc.name}</span>
          <select
            aria-label={`Bottle at ${r.loc.name}`}
            style={{ flex: 1, minHeight: 36, minWidth: 0, fontSize: '0.8125rem', borderRadius: 8, border: `1px solid ${r.problem ? '#FCA5A5' : '#E5E2DC'}`, padding: '0 0.5rem', background: 'white' }}
            value={!r.hasPick ? 'auto' : r.picked === null ? 'none' : r.picked}
            onChange={e => onChange(r.loc.id, e.target.value === 'auto' ? 'auto' : e.target.value === 'none' ? null : e.target.value)}
          >
            <option value="auto">Automatic: {r.autoText}</option>
            <option value="none">Not tracked here</option>
            {r.hasPick && r.picked && !r.options.some(i => i.id === r.picked) && <option value={r.picked}>Picked bottle no longer exists</option>}
            {r.options.map(i => (
              <option key={i.id} value={i.id}>
                {r.alike.has(i.id) ? '★ ' : ''}
                {itemLabel(i)}
                {i.volume_ml ? ` · ${i.volume_ml} ml` : ''}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
