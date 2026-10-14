import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { InventoryItem } from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';
import t from '../../styles/ToastInventory.module.css';
import { getAuthHeaders } from '../../lib/client-auth';
import { findSimilarItems, itemLabel } from '../../lib/inventory/itemNames';

/** Mirrors IngredientGap in lib/toastSalesCore. */
export interface IngredientGapView {
  recipe_id: string;
  recipe_name: string;
  ingredient_index: number;
  ingredient_name: string;
  inventory_item_id: string;
  location_id: string;
  location_name: string;
  kind: 'missing' | 'ambiguous';
  candidate_ids: string[];
  stale_pick?: boolean;
}

type Choice = 'pick' | 'add' | 'untracked';

async function send(url: string, method: string, body: unknown) {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
  const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

/**
 * One recipe ingredient with no bottle at the bar a drink was sold at. Three
 * ways out: point it at a bottle that bar does stock, add the bottle to that
 * bar's inventory, or say that bar doesn't track it. Saved on the recipe, so
 * it holds for every future sale there.
 */
export default function IngredientGapFixer({
  gap,
  inventory,
  onClose,
  onSaved,
}: {
  gap: IngredientGapView;
  inventory: InventoryItem[]; // all locations
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const base = inventory.find(i => i.id === gap.inventory_item_id);
  const here = useMemo(() => inventory.filter(i => i.location_id === gap.location_id), [inventory, gap.location_id]);

  // Best guesses first: the bottles the plan said could be it, then look-alikes, then everything else.
  const choices = useMemo(() => {
    const first = gap.candidate_ids.map(id => here.find(i => i.id === id)).filter((i): i is InventoryItem => !!i);
    const alike = base ? findSimilarItems(base, here, { limit: 5 }).map(m => m.item) : [];
    const seen = new Set<string>();
    const ordered: InventoryItem[] = [];
    for (const i of [...first, ...alike, ...[...here].sort((a, b) => itemLabel(a).localeCompare(itemLabel(b)))]) {
      if (!seen.has(i.id)) {
        seen.add(i.id);
        ordered.push(i);
      }
    }
    return { ordered, suggested: first.length + alike.filter(i => !first.includes(i)).length };
  }, [here, base, gap.candidate_ids]);

  const [choice, setChoice] = useState<Choice>(gap.kind === 'ambiguous' || choices.suggested > 0 ? 'pick' : 'add');
  const [itemId, setItemId] = useState<string>(choices.suggested > 0 ? choices.ordered[0].id : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = base ? itemLabel(base) : gap.ingredient_name;

  const pick = (value: string | null | 'auto') =>
    send('/api/inventory/recipe-location-pick', 'PUT', {
      recipe_id: gap.recipe_id,
      ingredient_index: gap.ingredient_index,
      inventory_item_id: gap.inventory_item_id,
      location_id: gap.location_id,
      pick: value,
    });

  const save = async () => {
    setError(null);
    if (choice === 'pick' && !itemId) return setError(`Pick a bottle stocked at ${gap.location_name}`);
    if (choice === 'add' && !base) return setError('The recipe’s bottle no longer exists — pick one instead');
    setSaving(true);
    try {
      if (choice === 'pick') {
        await pick(itemId);
        const picked = here.find(i => i.id === itemId);
        onSaved(`${gap.recipe_name} now pours ${picked ? itemLabel(picked) : 'that bottle'} at ${gap.location_name}.`);
      } else if (choice === 'untracked') {
        await pick(null);
        onSaved(`${label} isn’t tracked at ${gap.location_name} for ${gap.recipe_name}; the rest of the drink still comes out of stock.`);
      } else if (base) {
        // Same name and brand as the recipe's bottle, so the recipe finds it on its own.
        await send('/api/inventory', 'POST', {
          name: base.name,
          brand: base.brand || '',
          category: base.category,
          subcategory: base.subcategory || '',
          unit: base.unit,
          volume_ml: base.volume_ml,
          cost_per_unit: base.cost_per_unit || 0,
          price_per_serving: base.price_per_serving || 0,
          quantity: 0,
          par_level: 0,
          notes: `Added from the Sales review for ${gap.recipe_name}`,
          location_id: gap.location_id,
          confirm_new: true,
        });
        // A stale pick would still win over the new bottle; go back to finding it automatically.
        if (gap.stale_pick) await pick('auto');
        onSaved(`Added ${label} to ${gap.location_name} with 0 on hand. Count it in or scan the next receipt to set the quantity.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const options: Array<[Choice, string]> = [
    ['pick', 'Use a bottle here'],
    ['add', `Add to ${gap.location_name}`],
    ['untracked', 'Not tracked here'],
  ];

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="gap-fix-title">
        <div className={styles.modalHeader}>
          <h2 id="gap-fix-title" className={styles.modalTitle}>
            {label} at {gap.location_name}
          </h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p className={t.muted} style={{ marginTop: 0 }}>
            {gap.kind === 'ambiguous'
              ? `In ${gap.recipe_name}. More than one bottle at ${gap.location_name} could be it — say which.`
              : `In ${gap.recipe_name}. ${gap.location_name} has no ${label} in inventory.`}{' '}
            This is saved on the recipe; other bars and the amounts don’t change.
          </p>

          <div className={t.segmented} role="tablist" style={{ marginBottom: '1rem' }}>
            {options
              .filter(([k]) => k !== 'add' || gap.kind === 'missing')
              .map(([k, text]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={choice === k}
                  className={`${t.segment} ${choice === k ? t.segmentActive : ''}`}
                  onClick={() => setChoice(k)}
                >
                  {text}
                </button>
              ))}
          </div>

          {choice === 'pick' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Bottle at {gap.location_name}</label>
              <select className={styles.formSelect} value={itemId} onChange={e => setItemId(e.target.value)}>
                <option value="">Select a bottle…</option>
                {choices.ordered.map((i, n) => (
                  <option key={i.id} value={i.id}>
                    {n < choices.suggested ? '★ ' : ''}
                    {itemLabel(i)}
                    {i.volume_ml ? ` · ${i.volume_ml} ml` : ''}
                  </option>
                ))}
              </select>
              {choices.suggested > 0 && <p className={styles.formHint}>★ closest matches.</p>}
            </div>
          )}
          {choice === 'add' && (
            <p className={styles.formHint}>
              Creates {label}
              {base?.volume_ml ? ` (${base.volume_ml} ml)` : ''} in {gap.location_name}’s inventory with 0 on hand, under the same name, so this recipe and every
              other one finds it there.
            </p>
          )}
          {choice === 'untracked' && (
            <p className={styles.formHint}>
              {gap.recipe_name} sold at {gap.location_name} won’t take {label} out of stock. Everything else in the drink still does.
            </p>
          )}

          {error && <div className={`${t.notice} ${t.noticeError}`}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.btnPrimary} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}
