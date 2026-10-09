import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, X, Link2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { InventoryItem, Recipe } from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';
import t from '../../styles/ToastInventory.module.css';
import { getAuthHeaders } from '../../lib/client-auth';
import ManualSalesUpload from './ManualSalesUpload';

// ---------------------------------------------------------------------------
// Types (mirror /api/inventory/toast/*)
// ---------------------------------------------------------------------------

type DayStatus = 'pending' | 'partial' | 'applied';

interface DaySummary {
  business_date: string;
  status: DayStatus;
  source: 'sftp' | 'manual_items' | 'manual_pmix';
  period_start: string | null;
  line_count: number;
  imported_at: string;
  last_applied_at: string | null;
  last_applied_by: string | null;
  pending_drinks: number;
  ready_drinks: number;
  needs_attention: number;
}

interface SyncRun {
  trigger: string;
  status: 'running' | 'success' | 'error';
  days_imported: number;
  lines_imported: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

interface Allowance {
  poured_pct: number;
  packaged_pct: number;
}

interface PreviewRow {
  item_id: string;
  name: string;
  brand: string;
  location: string;
  unit: string;
  before: number;
  change: number;
  after: number;
}

interface NeedsAttention {
  toast_item_id: string;
  menu_item: string;
  menu_group: string;
  menu: string;
  qty: number;
  reasons: string[];
}

interface DayDetail {
  day: DaySummary;
  pending_drinks: number;
  ready_drinks: number;
  ignored_lines: number;
  deductions: PreviewRow[];
  needs_attention: NeedsAttention[];
}

type LinkType = 'recipe' | 'item' | 'ignore';
type AmountUnit = 'oz' | 'ml' | 'unit';

interface ToastLink {
  toast_item_id: string;
  link_type: LinkType;
  recipe_id: string | null;
  inventory_item_id: string | null;
  amount: number | null;
  amount_unit: AmountUnit | null;
}

interface ToastItemRow {
  toast_item_id: string;
  menu_item: string;
  menu_group: string;
  menu: string;
  qty: number;
  last_sold: string;
  location_slug: string;
  link: ToastLink | null;
  suggestion: Partial<ToastLink> | null;
}

interface Props {
  inventory: InventoryItem[]; // all locations
  locations: Array<{ id: string; slug: string; name: string }>;
  onApplied: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

function fmtDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
}

function fmtQty(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const STATUS_LABEL: Record<DayStatus, string> = { pending: 'Waiting', partial: 'Partly applied', applied: 'Applied' };
// 'empty' days never reach the panel: the API hides them.
const STATUS_CLASS: Record<DayStatus, string> = { pending: styles.statusPending, partial: styles.statusReviewing, applied: styles.statusProcessed };

// ---------------------------------------------------------------------------
// Link editor
// ---------------------------------------------------------------------------

function LinkEditor({
  target,
  recipes,
  inventory,
  locations,
  onClose,
  onSaved,
}: {
  target: { toast_item_id: string; menu_item: string; menu_group: string; menu: string; location_slug: string; link: ToastLink | null; suggestion: Partial<ToastLink> | null };
  recipes: Recipe[];
  inventory: InventoryItem[];
  locations: Array<{ id: string; slug: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const start = target.link || target.suggestion || {};
  const [type, setType] = useState<LinkType>((start.link_type as LinkType) || 'recipe');
  const [recipeId, setRecipeId] = useState<string>(start.recipe_id || '');
  const [itemId, setItemId] = useState<string>(start.inventory_item_id || '');
  const [amount, setAmount] = useState<string>(start.amount ? String(start.amount) : '1.5');
  const [unit, setUnit] = useState<AmountUnit>((start.amount_unit as AmountUnit) || 'oz');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saleLocation = locations.find(l => l.slug === target.location_slug);
  const itemChoices = useMemo(
    () =>
      [...inventory].sort(
        (a, b) =>
          Number(b.location_id === saleLocation?.id) - Number(a.location_id === saleLocation?.id) ||
          a.name.localeCompare(b.name)
      ),
    [inventory, saleLocation?.id]
  );
  const locName = (id: string) => locations.find(l => l.id === id)?.name || '';

  const save = async () => {
    setError(null);
    const body =
      type === 'recipe'
        ? { toast_item_id: target.toast_item_id, link_type: 'recipe', recipe_id: recipeId }
        : type === 'item'
        ? { toast_item_id: target.toast_item_id, link_type: 'item', inventory_item_id: itemId, amount: Number(amount), amount_unit: unit }
        : { toast_item_id: target.toast_item_id, link_type: 'ignore' };
    if (type === 'recipe' && !recipeId) return setError('Pick a recipe');
    if (type === 'item' && (!itemId || !(Number(amount) > 0))) return setError('Pick a bottle and a pour amount');
    setSaving(true);
    try {
      await api('/api/inventory/toast/links', { method: 'PUT', body: JSON.stringify(body) });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="toast-link-title">
        <div className={styles.modalHeader}>
          <h2 id="toast-link-title" className={styles.modalTitle}>
            Link “{target.menu_item}”
          </h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p className={t.muted} style={{ marginTop: 0 }}>
            Toast: {target.menu} › {target.menu_group} · sold at {saleLocation?.name || target.location_slug}
            {target.suggestion && !target.link ? ' · suggestion filled in below' : ''}
          </p>

          <div className={t.segmented} role="tablist" style={{ marginBottom: '1rem' }}>
            {(['recipe', 'item', 'ignore'] as LinkType[]).map(k => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={type === k}
                className={`${t.segment} ${type === k ? t.segmentActive : ''}`}
                onClick={() => setType(k)}
              >
                {k === 'recipe' ? 'Recipe' : k === 'item' ? 'Bottle / can' : 'Don’t track'}
              </button>
            ))}
          </div>

          {type === 'recipe' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Recipe</label>
              <select className={styles.formSelect} value={recipeId} onChange={e => setRecipeId(e.target.value)}>
                <option value="">Select a recipe…</option>
                {[...recipes].sort((a, b) => a.name.localeCompare(b.name)).map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.ingredients?.length ? '' : ' (no ingredients yet)'}
                  </option>
                ))}
              </select>
              <p className={styles.formHint}>Each ingredient comes out of the bottle stocked where the drink was sold.</p>
            </div>
          )}

          {type === 'item' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Bottle / can</label>
                <select className={styles.formSelect} value={itemId} onChange={e => setItemId(e.target.value)}>
                  <option value="">Select an item…</option>
                  {itemChoices.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.brand ? `${i.brand} ` : ''}
                      {i.name} — {locName(i.location_id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Per drink sold</label>
                  <input className={styles.formInput} type="number" inputMode="decimal" min="0" step="0.25" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Unit</label>
                  <select className={styles.formSelect} value={unit} onChange={e => setUnit(e.target.value as AmountUnit)}>
                    <option value="oz">oz poured</option>
                    <option value="ml">ml poured</option>
                    <option value="unit">whole cans / bottles</option>
                  </select>
                </div>
              </div>
              <p className={styles.formHint}>Shot 1.5 oz · double 3 oz · wine 5 oz · can 1 · THC can ½ (0.5).</p>
            </>
          )}

          {type === 'ignore' && <p className={styles.formHint}>Sales of this item won’t change inventory (food, tests, open items).</p>}

          {error && <div className={`${t.notice} ${t.noticeError}`}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.btnPrimary} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save link'}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function ToastSalesPanel({ inventory, locations, onApplied }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]); // every location's recipes, for linking
  const [days, setDays] = useState<DaySummary[]>([]);
  const [emptyDays, setEmptyDays] = useState(0);
  const [lastRun, setLastRun] = useState<SyncRun | null>(null);
  const [configured, setConfigured] = useState(true);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [toastItems, setToastItems] = useState<ToastItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [openDate, setOpenDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const [linking, setLinking] = useState<ToastItemRow | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState(false);
  const [pouredDraft, setPouredDraft] = useState('');
  const [packagedDraft, setPackagedDraft] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, l, r] = await Promise.all([
        api<{ configured: boolean; allowance: Allowance; last_run: SyncRun | null; days: DaySummary[]; empty_days: number }>('/api/inventory/toast/days'),
        api<{ data: ToastItemRow[] }>('/api/inventory/toast/links'),
        api<{ data: Recipe[] }>('/api/inventory/recipes'),
      ]);
      setRecipes(r.data || []);
      setDays(d.days);
      setEmptyDays(d.empty_days || 0);
      setLastRun(d.last_run);
      setConfigured(d.configured);
      setAllowance(d.allowance);
      setToastItems(l.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Toast sales');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDay = useCallback(async (date: string) => {
    setDetailLoading(true);
    try {
      setDetail(await api<DayDetail>(`/api/inventory/toast/day?date=${date}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load day');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openDate) loadDay(openDate);
    else setDetail(null);
  }, [openDate, loadDay]);

  const syncNow = async () => {
    setSyncing(true);
    setNotice(null);
    setError(null);
    try {
      const r = await api<{ days_imported: number; lines_imported: number; days_closed_no_sales: number; skipped_manual: string[] }>('/api/inventory/toast/sync', { method: 'POST' });
      setNotice(
        (r.days_imported ? `Imported ${r.days_imported} day(s), ${r.lines_imported} items sold.` : 'Up to date — no new days on the Toast server.') +
          (r.days_closed_no_sales ? ` ${r.days_closed_no_sales} day(s) had nothing to take out of stock and were closed automatically.` : '') +
          (r.skipped_manual?.length ? ` Skipped ${r.skipped_manual.join(', ')} — already imported from a hand-uploaded report.` : '')
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const applyDay = async () => {
    if (!detail) return;
    const negatives = detail.deductions.filter(d => d.after < 0).length;
    const msg =
      `Take ${fmtQty(detail.ready_drinks)} drinks from ${fmtDate(detail.day.business_date)} out of inventory?` +
      (detail.needs_attention.length ? `\n\n${detail.needs_attention.length} item(s) still need linking and will stay pending.` : '') +
      (negatives ? `\n\n${negatives} item(s) will go below zero — usually a missed receipt or miscount.` : '');
    if (!window.confirm(msg)) return;
    setApplying(true);
    setError(null);
    try {
      const r = await api<{ applied_lines: number; items_updated: number; went_negative: string[]; still_pending: number }>(
        '/api/inventory/toast/apply',
        { method: 'POST', body: JSON.stringify({ business_date: detail.day.business_date }) }
      );
      setNotice(
        `Applied ${fmtDate(detail.day.business_date)}: ${r.items_updated} items updated` +
          (r.went_negative.length ? `, ${r.went_negative.length} now below zero` : '') +
          (r.still_pending ? `, ${r.still_pending} still need linking` : '') +
          '.'
      );
      onApplied();
      await load();
      if (r.still_pending) await loadDay(detail.day.business_date);
      else setOpenDate(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const saveAllowance = async () => {
    const poured = Number(pouredDraft);
    const packaged = Number(packagedDraft);
    if (!(poured >= 0 && poured <= 50 && packaged >= 0 && packaged <= 50)) return setError('Allowance must be between 0% and 50%');
    try {
      await api('/api/inventory/loss-allowance', {
        method: 'PUT',
        body: JSON.stringify({ poured_pct: poured, packaged_pct: packaged, reason: 'Set by hand on the Sales tab' }),
      });
      setEditingAllowance(false);
      await load();
      if (openDate) await loadDay(openDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const onLinkSaved = async () => {
    setLinking(null);
    await load();
    if (openDate) await loadDay(openDate);
  };

  const openLinkFor = (n: NeedsAttention) => {
    const row = toastItems.find(i => i.toast_item_id === n.toast_item_id);
    setLinking(
      row || {
        toast_item_id: n.toast_item_id,
        menu_item: n.menu_item,
        menu_group: n.menu_group,
        menu: n.menu,
        qty: n.qty,
        last_sold: '',
        location_slug: n.menu.toLowerCase() === 'rooftopkc' ? 'rooftopkc' : 'noirkc',
        link: null,
        suggestion: null,
      }
    );
  };

  const unlinked = toastItems.filter(i => !i.link);
  const visibleItems = showAllItems ? toastItems : unlinked;
  const recipeName = (id: string | null) => recipes.find(r => r.id === id)?.name || 'missing recipe';
  const itemName = (id: string | null) => {
    const i = inventory.find(x => x.id === id);
    return i ? `${i.brand ? `${i.brand} ` : ''}${i.name}` : 'missing item';
  };
  const linkLabel = (l: ToastLink) =>
    l.link_type === 'ignore'
      ? 'Not tracked'
      : l.link_type === 'recipe'
      ? `Recipe: ${recipeName(l.recipe_id)}`
      : `${itemName(l.inventory_item_id)} · ${l.amount} ${l.amount_unit === 'unit' ? 'unit' : l.amount_unit}`;

  const byLocation = useMemo(() => {
    const groups = new Map<string, PreviewRow[]>();
    for (const r of detail?.deductions || []) groups.set(r.location, [...(groups.get(r.location) || []), r]);
    return Array.from(groups.entries());
  }, [detail]);

  if (loading) {
    return (
      <div className={t.panel}>
        <div className={t.syncBar}>
          <p className={t.syncMeta}>Loading Toast sales…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={t.panel}>
      {/* Sync status */}
      <div className={t.syncBar}>
        <div>
          <p className={t.syncTitle}>Toast sales — synced each morning</p>
          <p className={t.syncMeta}>
            Last sync: {lastRun ? `${fmtWhen(lastRun.started_at)} · ${lastRun.status === 'error' ? 'failed' : lastRun.status}` : 'never'}
            {allowance && !editingAllowance && (
              <>
                {' · '}Loss allowance +{allowance.poured_pct}% on pours, +{allowance.packaged_pct}% on cans{' '}
                <button
                  type="button"
                  className={styles.btnTertiary}
                  style={{ padding: '0 0.25rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    setPouredDraft(String(allowance.poured_pct));
                    setPackagedDraft(String(allowance.packaged_pct));
                    setEditingAllowance(true);
                  }}
                >
                  Edit
                </button>
              </>
            )}
          </p>
          {editingAllowance && (
            <div className={t.inlineForm} style={{ marginTop: '0.5rem' }}>
              <label className={t.muted}>
                Pours +<input className={t.pctInput} type="number" inputMode="decimal" min="0" max="50" step="0.5" value={pouredDraft} onChange={e => setPouredDraft(e.target.value)} />%
              </label>
              <label className={t.muted}>
                Cans +<input className={t.pctInput} type="number" inputMode="decimal" min="0" max="50" step="0.5" value={packagedDraft} onChange={e => setPackagedDraft(e.target.value)} />%
              </label>
              <button className={`${styles.btnPrimary} ${styles.btnSmall}`} onClick={saveAllowance}>
                Save
              </button>
              <button className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => setEditingAllowance(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className={t.syncActions}>
          <button className={styles.btnSecondary} onClick={syncNow} disabled={syncing || !configured}>
            <RefreshCw size={16} /> {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      {!configured && <div className={t.notice}>Toast SFTP isn’t set up on this deployment yet (TOAST_SFTP_HOST / USER / PRIVATE_KEY).</div>}
      {lastRun?.status === 'error' && lastRun.error && <div className={`${t.notice} ${t.noticeError}`}>Last sync failed: {lastRun.error}</div>}
      {error && <div className={`${t.notice} ${t.noticeError}`}>{error}</div>}
      {notice && <div className={t.notice} style={{ background: '#D1FAE5', color: '#065F46' }}>{notice}</div>}

      {/* Days */}
      <h3 className={t.sectionTitle}>Days waiting for approval</h3>
      {days.length === 0 ? (
        <div className={t.rowList}>
          <div className={t.row}>
            <span className={t.muted}>No Toast days imported yet. They arrive each morning after the nightly export, or use Sync now.</span>
          </div>
        </div>
      ) : (
        <div className={t.rowList}>
          {days.map(d => (
            <div key={d.business_date} className={t.row}>
              <div className={t.rowMain}>
                <div className={t.rowTitle}>
                  {d.period_start && d.period_start !== d.business_date ? `${fmtDate(d.period_start)} – ${fmtDate(d.business_date)}` : fmtDate(d.business_date)}{' '}
                  <span className={`${styles.statusBadge} ${STATUS_CLASS[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                  {d.source !== 'sftp' && <span className={t.muted}> · uploaded by hand</span>}
                </div>
                <div className={t.rowSub}>
                  {d.status === 'applied'
                    ? `Applied ${fmtWhen(d.last_applied_at)}${d.last_applied_by ? ` by ${d.last_applied_by}` : ''}`
                    : `${fmtQty(d.ready_drinks)} of ${fmtQty(d.pending_drinks)} drinks ready` +
                      (d.needs_attention ? ` · ${d.needs_attention} item(s) need linking` : '')}
                </div>
              </div>
              <button className={`${d.status === 'applied' ? styles.btnSecondary : styles.btnPrimary} ${styles.btnSmall}`} onClick={() => setOpenDate(d.business_date)} style={{ minHeight: 40 }}>
                {d.status === 'applied' ? 'View' : 'Review'}
              </button>
            </div>
          ))}
        </div>
      )}

      {emptyDays > 0 && (
        <p className={t.muted} style={{ margin: 0 }}>
          {emptyDays} day(s) with nothing to take out of stock (closed nights, voids or untracked items only) were closed automatically.
        </p>
      )}
      <ManualSalesUpload
        onImported={async message => {
          setNotice(message);
          await load();
        }}
      />

      {/* Toast items */}
      <h3 className={t.sectionTitle}>
        Toast items {unlinked.length > 0 ? `· ${unlinked.length} need linking` : '· all linked'}
      </h3>
      <div className={t.rowList}>
        {visibleItems.length === 0 && (
          <div className={t.row}>
            <span className={t.muted}>{toastItems.length ? 'Every Toast item sold in the last 60 days is linked.' : 'No Toast items yet.'}</span>
          </div>
        )}
        {visibleItems.map(i => (
          <div key={i.toast_item_id} className={t.row}>
            <div className={t.rowMain}>
              <div className={t.rowTitle}>{i.menu_item}</div>
              <div className={t.rowSub}>
                {i.menu} › {i.menu_group} · {fmtQty(i.qty)} sold (60 days)
              </div>
              <div className={t.rowSub}>{i.link ? linkLabel(i.link) : i.suggestion ? 'Suggestion ready' : 'Not linked'}</div>
            </div>
            <button className={`${i.link ? styles.btnSecondary : styles.btnPrimary} ${styles.btnSmall}`} onClick={() => setLinking(i)} style={{ minHeight: 40 }}>
              <Link2 size={14} /> {i.link ? 'Edit' : 'Link'}
            </button>
          </div>
        ))}
      </div>
      {toastItems.length > unlinked.length && (
        <button className={styles.btnTertiary} onClick={() => setShowAllItems(v => !v)} style={{ alignSelf: 'flex-start' }}>
          {showAllItems ? 'Show only items that need linking' : `Show all ${toastItems.length} items`}
        </button>
      )}

      {/* Day drawer */}
      {openDate && <div className={`${styles.drawerOverlay} ${styles.drawerOverlayVisible}`} onClick={() => setOpenDate(null)} />}
      <div className={`${styles.drawer} ${openDate ? styles.drawerVisible : ''}`} role="dialog" aria-modal="true" aria-label="Toast sales day">
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>{openDate ? fmtDate(openDate) : ''}</h2>
          <button className={styles.drawerClose} onClick={() => setOpenDate(null)} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className={styles.drawerBody}>
          {detailLoading && !detail && <p className={t.muted}>Loading…</p>}
          {detail && (
            <>
              <div className={t.stats} style={{ marginBottom: '1rem' }}>
                <div className={t.stat}>
                  <div className={t.statValue}>{fmtQty(detail.ready_drinks)}</div>
                  <div className={t.statLabel}>Drinks ready</div>
                </div>
                <div className={t.stat}>
                  <div className={t.statValue}>{detail.needs_attention.length}</div>
                  <div className={t.statLabel}>Need linking</div>
                </div>
                <div className={t.stat}>
                  <div className={t.statValue}>{detail.deductions.filter(d => d.after < 0).length}</div>
                  <div className={t.statLabel}>Go below zero</div>
                </div>
              </div>

              {detail.needs_attention.length > 0 && (
                <>
                  <h3 className={t.sectionTitle}>
                    <AlertTriangle size={12} style={{ verticalAlign: '-1px' }} /> Needs attention — stays pending
                  </h3>
                  <div className={t.rowList} style={{ marginBottom: '1rem' }}>
                    {detail.needs_attention.map(n => (
                      <div key={`${n.toast_item_id}|${n.menu}`} className={t.row}>
                        <div className={t.rowMain}>
                          <div className={t.rowTitle}>
                            {n.menu_item} <span className={t.muted}>× {fmtQty(n.qty)}</span>
                          </div>
                          <div className={t.rowSub}>
                            {n.menu} › {n.menu_group}
                          </div>
                          {n.reasons.map(r => (
                            <div key={r} className={t.reason}>
                              {r}
                            </div>
                          ))}
                        </div>
                        <button className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => openLinkFor(n)} style={{ minHeight: 40 }}>
                          Fix
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <h3 className={t.sectionTitle}>
                Comes out of stock (incl. +{allowance?.poured_pct ?? 0}% on pours)
              </h3>
              {detail.deductions.length === 0 ? (
                <p className={t.muted}>{detail.day.status === 'applied' ? 'Everything on this day has been applied.' : 'Nothing ready yet.'}</p>
              ) : (
                <div className={t.rowList}>
                  {byLocation.map(([loc, rows]) => (
                    <React.Fragment key={loc}>
                      <div className={t.groupHeader}>{loc || 'Unknown location'}</div>
                      {rows.map(r => (
                        <div key={r.item_id} className={t.row}>
                          <div className={t.rowMain}>
                            <div className={t.rowTitle}>
                              {r.brand ? `${r.brand} ` : ''}
                              {r.name}
                            </div>
                            <div className={t.rowSub}>
                              {fmtQty(r.before)} → <span className={r.after < 0 ? t.negative : undefined}>{fmtQty(r.after)}</span> {r.unit}
                            </div>
                          </div>
                          <div className={`${t.num} ${t.negative}`}>{fmtQty(r.change)}</div>
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {detail && detail.day.status !== 'applied' && (
          <div className={styles.drawerFooter}>
            <button className={styles.btnSecondary} onClick={() => setOpenDate(null)}>
              Close
            </button>
            <button className={styles.btnPrimary} onClick={applyDay} disabled={applying || detail.deductions.length === 0 && detail.ignored_lines === 0}>
              <CheckCircle2 size={16} /> {applying ? 'Applying…' : `Apply ${fmtQty(detail.ready_drinks)} drinks`}
            </button>
          </div>
        )}
      </div>

      {linking && (
        <LinkEditor target={linking} recipes={recipes} inventory={inventory} locations={locations} onClose={() => setLinking(null)} onSaved={onLinkSaved} />
      )}
    </div>
  );
}
