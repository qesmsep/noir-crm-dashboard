import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, ArrowLeft, Search } from 'lucide-react';
import type { UILocationSlug } from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';
import t from '../../styles/ToastInventory.module.css';
import { getAuthHeaders } from '../../lib/client-auth';

// ---------------------------------------------------------------------------
// Types (mirror /api/inventory/counts)
// ---------------------------------------------------------------------------

type CountStatus = 'in_progress' | 'completed' | 'cancelled';

interface CountSummary {
  counted_lines: number;
  uncounted_lines: number;
  variance_value: number;
  poured_variance_value: number;
  since: string | null;
  window_from?: string | null;
  window_to?: string;
  pending_days?: number;
  poured_sales_value: number;
  allowance_pct: number;
  measured_loss_pct: number | null;
}

interface CountRow {
  id: string;
  location_id: string;
  status: CountStatus;
  started_at: string;
  started_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  summary: CountSummary | null;
  locations: { name: string; slug: string } | null;
}

interface CountLine {
  item_id: string;
  system_qty_at_start: number;
  system_qty_at_close: number | null;
  counted_qty: number | null;
  cost_per_unit: number;
  inventory_items: { name: string; brand: string; category: string; subcategory: string; unit: string; volume_ml: number; par_level: number } | null;
}

interface Props {
  locations: Array<{ id: string; slug: string; name: string }>;
  currentLocation: UILocationSlug;
  onCompleted: () => void;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`) as Error & { body?: unknown };
    err.body = body;
    throw err;
  }
  return body as T;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
}

function fmtQty(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return (Math.round(Number(n) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function fmtMoney(n: number): string {
  const sign = n < 0 ? '−' : n > 0 ? '+' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS: Record<CountStatus, { label: string; cls: string }> = {
  in_progress: { label: 'In progress', cls: styles.statusPending },
  completed: { label: 'Completed', cls: styles.statusProcessed },
  cancelled: { label: 'Cancelled', cls: styles.statusError },
};

// ---------------------------------------------------------------------------
// Count sheet (open count) and results (closed count)
// ---------------------------------------------------------------------------

function CountDetail({ countId, onBack, onCompleted }: { countId: string; onBack: () => void; onCompleted: () => void }) {
  const [count, setCount] = useState<CountRow | null>(null);
  const [lines, setLines] = useState<CountLine[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [allowanceSaved, setAllowanceSaved] = useState(false);
  const saved = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const r = await api<{ data: { count: CountRow; lines: CountLine[] } }>(`/api/inventory/counts/${countId}`);
      setCount(r.data.count);
      setLines(r.data.lines);
      const d: Record<string, string> = {};
      for (const l of r.data.lines) d[l.item_id] = l.counted_qty === null ? '' : String(Number(l.counted_qty));
      saved.current = { ...d };
      setDrafts(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load count');
    }
  }, [countId]);

  useEffect(() => {
    load();
  }, [load]);

  const open = count?.status === 'in_progress';

  const saveLine = async (itemId: string) => {
    const raw = (drafts[itemId] ?? '').trim();
    if (raw === (saved.current[itemId] ?? '')) return;
    const value = raw === '' ? null : Number(raw);
    if (value !== null && !(value >= 0)) {
      setError('Counts must be zero or more');
      return;
    }
    setSavingIds(s => new Set(s).add(itemId));
    try {
      await api(`/api/inventory/counts/${countId}`, { method: 'PUT', body: JSON.stringify({ lines: [{ item_id: itemId, counted_qty: value }] }) });
      saved.current[itemId] = raw;
      setLines(ls => ls.map(l => (l.item_id === itemId ? { ...l, counted_qty: value } : l)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingIds(s => {
        const n = new Set(s);
        n.delete(itemId);
        return n;
      });
    }
  };

  const counted = lines.filter(l => l.counted_qty !== null).length;

  const complete = async () => {
    const uncounted = lines.length - counted;
    const msg =
      `Close this count and set ${counted} item(s) to what you counted?` +
      (uncounted ? `\n\n${uncounted} item(s) weren’t counted and will stay as they are.` : '');
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await api(`/api/inventory/counts/${countId}`, { method: 'POST', body: JSON.stringify({ action: 'complete' }) });
      onCompleted();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete the count');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm('Cancel this count? Nothing you entered will change inventory.')) return;
    setBusy(true);
    try {
      await api(`/api/inventory/counts/${countId}`, { method: 'POST', body: JSON.stringify({ action: 'cancel' }) });
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel');
      setBusy(false);
    }
  };

  const adoptMeasured = async (pct: number) => {
    if (!window.confirm(`Set the pour loss allowance to ${pct}%? Future Toast sales will add ${pct}% to every poured drink.`)) return;
    try {
      const current = await api<{ data: { packaged_pct: number } }>('/api/inventory/loss-allowance');
      await api('/api/inventory/loss-allowance', {
        method: 'PUT',
        body: JSON.stringify({
          poured_pct: Math.max(0, Math.min(50, pct)),
          packaged_pct: current.data.packaged_pct,
          reason: `Measured by count ${countId.slice(0, 8)} (${count?.locations?.name || ''})`,
        }),
      });
      setAllowanceSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the allowance');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? lines.filter(l => `${l.inventory_items?.brand || ''} ${l.inventory_items?.name || ''}`.toLowerCase().includes(q)) : lines;
  }, [lines, search]);

  const grouped = useMemo(() => {
    const g = new Map<string, CountLine[]>();
    for (const l of filtered) {
      const k = l.inventory_items?.category || 'other';
      g.set(k, [...(g.get(k) || []), l]);
    }
    return Array.from(g.entries());
  }, [filtered]);

  const variances = useMemo(
    () =>
      lines
        .filter(l => l.counted_qty !== null && l.system_qty_at_close !== null)
        .map(l => {
          const diff = Number(l.counted_qty) - Number(l.system_qty_at_close);
          return { l, diff, value: diff * Number(l.cost_per_unit || 0) };
        })
        .filter(v => Math.abs(v.diff) > 0.005)
        .sort((a, b) => a.value - b.value),
    [lines]
  );

  if (!count) {
    return (
      <div className={t.panel}>
        <button className={styles.btnTertiary} onClick={onBack} style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={16} /> All counts
        </button>
        {error ? <div className={`${t.notice} ${t.noticeError}`}>{error}</div> : <p className={t.muted}>Loading…</p>}
      </div>
    );
  }

  const s = count.summary;

  return (
    <div className={t.panel}>
      <button className={styles.btnTertiary} onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={16} /> All counts
      </button>

      <div className={t.syncBar}>
        <div>
          <p className={t.syncTitle}>
            {count.locations?.name || 'Count'} <span className={`${styles.statusBadge} ${STATUS[count.status].cls}`}>{STATUS[count.status].label}</span>
          </p>
          <p className={t.syncMeta}>
            Started {fmtWhen(count.started_at)}
            {count.started_by ? ` by ${count.started_by}` : ''}
            {count.completed_at ? ` · closed ${fmtWhen(count.completed_at)}` : ''}
          </p>
        </div>
        {open && (
          <div className={t.syncActions}>
            <span className={t.muted}>
              {counted} of {lines.length} counted
            </span>
            <button className={styles.btnSecondary} onClick={cancel} disabled={busy}>
              Cancel count
            </button>
            <button className={styles.btnPrimary} onClick={complete} disabled={busy || counted === 0}>
              <ClipboardCheck size={16} /> Complete count
            </button>
          </div>
        )}
      </div>

      {error && <div className={`${t.notice} ${t.noticeError}`}>{error}</div>}

      {/* Results */}
      {count.status === 'completed' && s && (
        <>
          <div className={t.stats}>
            <div className={t.stat}>
              <div className={t.statValue}>{fmtMoney(s.variance_value)}</div>
              <div className={t.statLabel}>Shelf vs app, at cost</div>
            </div>
            <div className={t.stat}>
              <div className={t.statValue}>{fmtMoney(s.poured_variance_value)}</div>
              <div className={t.statLabel}>Poured stock</div>
            </div>
            <div className={t.stat}>
              <div className={t.statValue}>{s.measured_loss_pct === null ? '—' : `${s.measured_loss_pct}%`}</div>
              <div className={t.statLabel}>Measured pour loss</div>
            </div>
            <div className={t.stat}>
              <div className={t.statValue}>{s.counted_lines}</div>
              <div className={t.statLabel}>Items counted</div>
            </div>
          </div>

          <div className={t.notice} style={{ background: '#F7F6F2', color: '#1F1F1F' }}>
            {s.measured_loss_pct === null ? (
              s.pending_days ? (
                <>
                  {s.pending_days} day(s) of Toast sales between the last count and this one are still waiting for approval, so pour loss
                  can’t be measured yet. Approve them on the Sales tab, then reopen this count.
                </>
              ) : s.since ? (
                <>No Toast sales of the counted poured items since the last count, so there’s nothing to measure loss against yet.</>
              ) : (
                <>This is the first completed count here, so it sets the baseline. The next count will measure your real pour loss against the {s.allowance_pct}% allowance.</>
              )
            ) : (
              <>
                For sales from {s.window_from || fmtWhen(s.since)} up to {s.window_to || 'this count'}, Toast sales took ${s.poured_sales_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of poured stock at cost,
                including the {s.allowance_pct}% allowance. The shelf shows the real loss rate was <strong>{s.measured_loss_pct}%</strong>.{' '}
                {allowanceSaved ? (
                  <strong>Allowance updated.</strong>
                ) : Math.abs(s.measured_loss_pct - s.allowance_pct) >= 0.5 && s.measured_loss_pct >= 0 ? (
                  <button className={`${styles.btnPrimary} ${styles.btnSmall}`} onClick={() => adoptMeasured(Math.round(s.measured_loss_pct! * 2) / 2)}>
                    Set allowance to {Math.round(s.measured_loss_pct * 2) / 2}%
                  </button>
                ) : (
                  <>That’s in line with the current allowance.</>
                )}
              </>
            )}
          </div>

          <h3 className={t.sectionTitle}>Differences (biggest losses first)</h3>
          {variances.length === 0 ? (
            <p className={t.muted}>Every counted item matched the app.</p>
          ) : (
            <div className={t.rowList}>
              {variances.map(({ l, diff, value }) => (
                <div key={l.item_id} className={t.row}>
                  <div className={t.rowMain}>
                    <div className={t.rowTitle}>
                      {l.inventory_items?.brand ? `${l.inventory_items.brand} ` : ''}
                      {l.inventory_items?.name || 'Deleted item'}
                    </div>
                    <div className={t.rowSub}>
                      App {fmtQty(l.system_qty_at_close)} · shelf {fmtQty(l.counted_qty)} {l.inventory_items?.unit}
                    </div>
                  </div>
                  <div className={t.num}>
                    <div className={diff < 0 ? t.negative : undefined}>
                      {diff > 0 ? '+' : ''}
                      {fmtQty(diff)}
                    </div>
                    <div className={t.muted}>{fmtMoney(value)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Count sheet */}
      {open && (
        <>
          <div className={styles.searchWrapper} style={{ maxWidth: 420 }}>
            <Search size={16} className={styles.searchIcon} />
            <input className={styles.searchInput} placeholder="Find an item…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <p className={t.muted} style={{ margin: 0 }}>
            Enter what’s on the shelf in the item’s own unit — partial bottles as tenths (e.g. 3.4). Each count saves when you leave the box. Leave blank to skip an item.
          </p>
          <div className={t.rowList}>
            {grouped.map(([cat, rows]) => (
              <React.Fragment key={cat}>
                <div className={t.groupHeader}>{cat}</div>
                {rows.map(l => {
                  const done = l.counted_qty !== null;
                  return (
                    <div key={l.item_id} className={t.row}>
                      <div className={t.rowMain}>
                        <div className={t.rowTitle}>
                          {l.inventory_items?.brand ? `${l.inventory_items.brand} ` : ''}
                          {l.inventory_items?.name}
                        </div>
                        <div className={t.rowSub}>
                          App shows {fmtQty(l.system_qty_at_start)} {l.inventory_items?.unit}
                          {l.inventory_items?.volume_ml && ['bottle', 'can', 'keg'].includes(l.inventory_items.unit) ? ` · ${l.inventory_items.volume_ml} ml` : ''}
                          {savingIds.has(l.item_id) ? ' · saving…' : ''}
                        </div>
                      </div>
                      <input
                        className={`${t.countInput} ${done ? t.countInputDone : ''}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.1"
                        aria-label={`Count for ${l.inventory_items?.name}`}
                        value={drafts[l.item_id] ?? ''}
                        onChange={e => setDrafts(d => ({ ...d, [l.item_id]: e.target.value }))}
                        onBlur={() => saveLine(l.item_id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Counts list
// ---------------------------------------------------------------------------

export default function InventoryCounts({ locations, currentLocation, onCompleted }: Props) {
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [startLocation, setStartLocation] = useState<string>(currentLocation !== 'all' ? currentLocation : '');
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ data: CountRow[] }>(`/api/inventory/counts${currentLocation !== 'all' ? `?location_slug=${currentLocation}` : ''}`);
      setCounts(r.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load counts');
    } finally {
      setLoading(false);
    }
  }, [currentLocation]);

  useEffect(() => {
    load();
    if (currentLocation !== 'all') setStartLocation(currentLocation);
  }, [load, currentLocation]);

  const start = async () => {
    if (!startLocation) return setError('Pick a location to count');
    setStarting(true);
    try {
      const r = await api<{ id: string }>('/api/inventory/counts', { method: 'POST', body: JSON.stringify({ location_slug: startLocation }) });
      setOpenId(r.id);
    } catch (e) {
      const existing = (e as Error & { body?: { id?: string } }).body?.id;
      if (existing) setOpenId(existing);
      else setError(e instanceof Error ? e.message : 'Could not start a count');
    } finally {
      setStarting(false);
    }
  };

  if (openId) {
    return (
      <CountDetail
        countId={openId}
        onBack={() => {
          setOpenId(null);
          load();
        }}
        onCompleted={onCompleted}
      />
    );
  }

  return (
    <div className={t.panel}>
      <div className={t.syncBar}>
        <div>
          <p className={t.syncTitle}>Take inventory</p>
          <p className={t.syncMeta}>Count what’s on the shelf at one location. Closing a count resets the app to your numbers and measures real loss since the last count.</p>
        </div>
        <div className={t.syncActions}>
          <select className={styles.formSelect} style={{ width: 'auto', minHeight: 40 }} value={startLocation} onChange={e => setStartLocation(e.target.value)} aria-label="Location to count">
            <option value="">Location…</option>
            {locations.map(l => (
              <option key={l.slug} value={l.slug}>
                {l.name}
              </option>
            ))}
          </select>
          <button className={styles.btnPrimary} onClick={start} disabled={starting || !startLocation}>
            <ClipboardCheck size={16} /> {starting ? 'Starting…' : 'Take Inventory'}
          </button>
        </div>
      </div>

      {error && <div className={`${t.notice} ${t.noticeError}`}>{error}</div>}

      <h3 className={t.sectionTitle}>Counts</h3>
      <div className={t.rowList}>
        {loading && (
          <div className={t.row}>
            <span className={t.muted}>Loading…</span>
          </div>
        )}
        {!loading && counts.length === 0 && (
          <div className={t.row}>
            <span className={t.muted}>No counts yet. Monthly to start; the first one sets the baseline.</span>
          </div>
        )}
        {counts.map(c => (
          <div key={c.id} className={t.row}>
            <div className={t.rowMain}>
              <div className={t.rowTitle}>
                {c.locations?.name || 'Location'} · {fmtWhen(c.completed_at || c.started_at)}{' '}
                <span className={`${styles.statusBadge} ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
              </div>
              <div className={t.rowSub}>
                {c.summary
                  ? `${c.summary.counted_lines} items · ${fmtMoney(c.summary.variance_value)} vs app` +
                    (c.summary.measured_loss_pct !== null ? ` · pour loss ${c.summary.measured_loss_pct}%` : '')
                  : c.started_by
                  ? `Started by ${c.started_by}`
                  : ''}
              </div>
            </div>
            {c.status !== 'cancelled' && (
              <button className={`${c.status === 'in_progress' ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSmall}`} onClick={() => setOpenId(c.id)} style={{ minHeight: 40 }}>
                {c.status === 'in_progress' ? 'Continue' : 'View'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
