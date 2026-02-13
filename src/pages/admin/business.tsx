import { useEffect, useState, useCallback, useMemo } from 'react';
import { Spinner } from '@chakra-ui/react';
import AdminLayout from '../../components/layouts/AdminLayout';
import styles from '../../styles/BusinessDashboard.module.css';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Types (mirror server types for client-side display)
// ---------------------------------------------------------------------------

interface MrrBridge {
  startingMrr: number;
  endingMrr: number;
  newMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  pausedMrr: number;
  netNewMrr: number;
}

interface MemberCounts {
  activeMembers: number;
  newMembers: number;
  churnedMembers: number;
  pausedMembers: number;
}

interface RetentionRates {
  nrr: number;
  grr: number;
  logoChurnRate: number;
  revenueChurnRate: number;
}

interface AttachMetrics {
  attachRevenue: number;
  attachRate: number;
  allInArpm: number;
  membersWithAttach: number;
}

interface AlertStatus {
  alert_key: string;
  label: string;
  description: string | null;
  threshold_value: number;
  threshold_type: string;
  is_triggered: boolean;
  last_evaluated_at: string | null;
  current_value: number | null;
}

interface BusinessSummary {
  month: string;
  priorMonth: string;
  mrr: number;
  priorMrr: number;
  arr: number;
  mrrBridge: MrrBridge;
  memberCounts: MemberCounts;
  priorMemberCounts: MemberCounts;
  rates: RetentionRates;
  attach: AttachMetrics;
  priorAttach: AttachMetrics;
  failedPayments30d: number;
  alerts: AlertStatus[];
}

interface SeriesPoint {
  month: string;
  mrr: number;
  activeMembers: number;
  attachRevenue: number;
  newMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  pausedMrr: number;
  netNewMrr: number;
}

interface CohortRow {
  cohortMonth: string;
  cohortSize: number;
  retentionByMonth: { month: string; retained: number; rate: number }[];
}

interface DrillChurn {
  member_id: string;
  first_name: string;
  last_name: string;
  tenure_months: number;
  plan_name: string | null;
  prior_mrr: number;
  churn_type: string;
}

interface DrillExpansion {
  member_id: string;
  first_name: string;
  last_name: string;
  prior_mrr: number;
  current_mrr: number;
  delta: number;
  type: 'expansion' | 'contraction';
}

interface DrillAttach {
  member_id: string;
  first_name: string;
  last_name: string;
  attach_revenue: number;
  transaction_count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCurrency(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtCurrencyDec(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function fmtMonthLabel(monthStr: string): string {
  const d = new Date(monthStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function deltaStr(current: number, prior: number, format: 'currency' | 'pct' | 'number' = 'currency'): { text: string; cls: string } {
  if (prior === 0 && current === 0) return { text: '--', cls: styles.deltaNeutral };
  const diff = current - prior;
  const sign = diff >= 0 ? '+' : '';
  let text = '';
  if (format === 'currency') text = sign + fmtCurrency(diff);
  else if (format === 'pct') text = sign + (diff * 100).toFixed(1) + 'pp';
  else text = sign + diff.toLocaleString();
  return { text, cls: diff > 0 ? styles.deltaPositive : diff < 0 ? styles.deltaNegative : styles.deltaNeutral };
}

/** Inverse delta: for churn-like metrics where lower = better */
function inverseDeltaStr(current: number, prior: number, format: 'pct' | 'number' = 'pct'): { text: string; cls: string } {
  const d = deltaStr(current, prior, format);
  // Flip colors: increase in churn is negative
  if (d.cls === styles.deltaPositive) d.cls = styles.deltaNegative;
  else if (d.cls === styles.deltaNegative) d.cls = styles.deltaPositive;
  return d;
}

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

function generateMonthOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    options.push(`${y}-${m}-01`);
  }
  return options;
}

// ---------------------------------------------------------------------------
// Simple SVG Chart Components
// ---------------------------------------------------------------------------

function BarChart({ data, dataKey, color, height = 160 }: {
  data: SeriesPoint[];
  dataKey: keyof SeriesPoint;
  color: string;
  height?: number;
}) {
  if (!data || data.length === 0) return <div className={styles.emptyState}>No data</div>;

  const values = data.map(d => Number(d[dataKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const barWidth = Math.min(40, Math.floor(600 / data.length) - 8);
  const chartWidth = data.length * (barWidth + 8);

  return (
    <div className={styles.chartContainer}>
      <svg width={chartWidth} height={height + 30} viewBox={`0 0 ${chartWidth} ${height + 30}`}>
        {data.map((d, i) => {
          const val = Number(d[dataKey]) || 0;
          const barH = (val / maxVal) * height;
          const x = i * (barWidth + 8) + 4;
          const y = height - barH;
          return (
            <g key={d.month}>
              <rect x={x} y={y} width={barWidth} height={barH} rx={4} fill={color} opacity={0.85} />
              <text x={x + barWidth / 2} y={height + 14} textAnchor="middle" fontSize="9" fill="#86868b">
                {fmtMonthLabel(d.month)}
              </text>
              <title>{fmtMonthLabel(d.month)}: {fmtCurrency(val)}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StackedBarChart({ data, keys, colors, height = 160 }: {
  data: SeriesPoint[];
  keys: (keyof SeriesPoint)[];
  colors: string[];
  height?: number;
}) {
  if (!data || data.length === 0) return <div className={styles.emptyState}>No data</div>;

  const totals = data.map(d => keys.reduce((sum, k) => sum + (Number(d[k]) || 0), 0));
  const maxVal = Math.max(...totals, 1);
  const barWidth = Math.min(40, Math.floor(600 / data.length) - 8);
  const chartWidth = data.length * (barWidth + 8);

  return (
    <div className={styles.chartContainer}>
      <svg width={chartWidth} height={height + 30} viewBox={`0 0 ${chartWidth} ${height + 30}`}>
        {data.map((d, i) => {
          const x = i * (barWidth + 8) + 4;
          let cumY = height;
          return (
            <g key={d.month}>
              {keys.map((k, ki) => {
                const val = Number(d[k]) || 0;
                const barH = (val / maxVal) * height;
                cumY -= barH;
                return (
                  <rect key={String(k)} x={x} y={cumY} width={barWidth} height={barH} rx={2} fill={colors[ki]} opacity={0.85}>
                    <title>{String(k)}: {fmtCurrency(val)}</title>
                  </rect>
                );
              })}
              <text x={x + barWidth / 2} y={height + 14} textAnchor="middle" fontSize="9" fill="#86868b">
                {fmtMonthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        {keys.map((k, i) => (
          <div key={String(k)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: '#6e6e73' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i], display: 'inline-block' }} />
            {String(k).replace(/([A-Z])/g, ' $1').replace('mrr', 'MRR').trim()}
          </div>
        ))}
      </div>
    </div>
  );
}

function BridgeChart({ bridge, height = 180 }: { bridge: MrrBridge; height?: number }) {
  const items = [
    { label: 'Starting', value: bridge.startingMrr, color: '#86868b' },
    { label: 'New', value: bridge.newMrr, color: '#34c759' },
    { label: 'Expansion', value: bridge.expansionMrr, color: '#30d158' },
    { label: 'Contraction', value: -bridge.contractionMrr, color: '#ff9500' },
    { label: 'Churned', value: -bridge.churnedMrr, color: '#ff3b30' },
    { label: 'Paused', value: -bridge.pausedMrr, color: '#af52de' },
    { label: 'Ending', value: bridge.endingMrr, color: '#bca892' },
  ];

  const maxAbs = Math.max(...items.map(i => Math.abs(i.value)), 1);
  const barWidth = 60;
  const gap = 16;
  const chartWidth = items.length * (barWidth + gap);
  const midY = height / 2;

  return (
    <div className={styles.chartContainer}>
      <svg width={chartWidth} height={height + 40} viewBox={`0 0 ${chartWidth} ${height + 40}`}>
        {/* Zero line */}
        <line x1={0} y1={midY} x2={chartWidth} y2={midY} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
        {items.map((item, i) => {
          const x = i * (barWidth + gap) + gap / 2;
          const normalizedH = (Math.abs(item.value) / maxAbs) * (height / 2 - 10);
          const y = item.value >= 0 ? midY - normalizedH : midY;
          return (
            <g key={item.label}>
              <rect x={x} y={y} width={barWidth} height={normalizedH} rx={4} fill={item.color} opacity={0.85}>
                <title>{item.label}: {fmtCurrency(item.value)}</title>
              </rect>
              <text x={x + barWidth / 2} y={height + 10} textAnchor="middle" fontSize="9" fontWeight="600" fill="#6e6e73">
                {item.label}
              </text>
              <text x={x + barWidth / 2} y={item.value >= 0 ? y - 4 : y + normalizedH + 12} textAnchor="middle" fontSize="9" fill="#1d1d1f">
                {fmtCurrency(item.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Cohort heatmap color
function cohortColor(rate: number): string {
  if (rate >= 0.9) return 'rgba(52, 199, 89, 0.25)';
  if (rate >= 0.7) return 'rgba(52, 199, 89, 0.15)';
  if (rate >= 0.5) return 'rgba(255, 149, 0, 0.15)';
  if (rate >= 0.3) return 'rgba(255, 59, 48, 0.1)';
  return 'rgba(255, 59, 48, 0.2)';
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function BusinessDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [drillChurn, setDrillChurn] = useState<DrillChurn[]>([]);
  const [drillExpansion, setDrillExpansion] = useState<DrillExpansion[]>([]);
  const [drillAttach, setDrillAttach] = useState<DrillAttach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const fetchAll = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const safeFetch = async (url: string) => {
        const res = await fetch(url, { headers });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${url}: ${res.status} ${text}`);
        }
        return res.json();
      };

      const [summaryRes, seriesRes, cohortsRes, churnRes, expRes, attachRes] = await Promise.all([
        safeFetch(`/api/admin/business-summary?month=${month}`),
        safeFetch(`/api/admin/business-series?month=${month}&months=12`),
        safeFetch(`/api/admin/business-cohorts?month=${month}&months=12`),
        safeFetch(`/api/admin/business-drilldown?type=churned&month=${month}`),
        safeFetch(`/api/admin/business-drilldown?type=expansion&month=${month}`),
        safeFetch(`/api/admin/business-drilldown?type=attach&month=${month}`),
      ]);

      setSummary(summaryRes.data);
      setSeries(seriesRes.data || []);
      setCohorts(cohortsRes.data || []);
      setDrillChurn(churnRes.data || []);
      setDrillExpansion(expRes.data || []);
      setDrillAttach(attachRes.data || []);
    } catch (err: any) {
      console.error('Business dashboard fetch error:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(selectedMonth);
  }, [selectedMonth, fetchAll]);

  const handleGenerateSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(`/api/admin/business-snapshot?month=${selectedMonth}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Snapshot generation failed');
      // Refresh data after snapshot
      await fetchAll(selectedMonth);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSnapshotLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.root}>
          <div className={styles.loading}><Spinner size="lg" /></div>
        </div>
      </AdminLayout>
    );
  }

  const s = summary;

  return (
    <AdminLayout>
      <div className={styles.root}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Business Dashboard</h1>
          <div className={styles.monthSelector}>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>{fmtMonthLabel(m)}</option>
              ))}
            </select>
            <button
              className={styles.snapshotBtn}
              onClick={handleGenerateSnapshot}
              disabled={snapshotLoading}
            >
              {snapshotLoading ? 'Generating...' : 'Refresh Snapshot'}
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {s && (
          <>
            {/* KPI Tiles */}
            <h2 className={styles.sectionTitle}>Revenue Health</h2>
            <div className={styles.kpiGrid}>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtCurrency(s.mrr)}</div>
                <div className={styles.kpiLabel}>MRR</div>
                <div className={`${styles.kpiDelta} ${deltaStr(s.mrr, s.priorMrr).cls}`}>
                  {deltaStr(s.mrr, s.priorMrr).text}
                </div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtCurrency(s.mrrBridge.netNewMrr)}</div>
                <div className={styles.kpiLabel}>Net New MRR</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtCurrency(s.arr)}</div>
                <div className={styles.kpiLabel}>ARR</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtPct(s.rates.nrr)}</div>
                <div className={styles.kpiLabel}>NRR</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtPct(s.rates.grr)}</div>
                <div className={styles.kpiLabel}>GRR</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtPct(s.rates.revenueChurnRate)}</div>
                <div className={styles.kpiLabel}>Rev Churn %</div>
              </div>
            </div>

            <h2 className={styles.sectionTitle}>Member Health</h2>
            <div className={styles.kpiGrid}>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{s.memberCounts.activeMembers}</div>
                <div className={styles.kpiLabel}>Active Members</div>
                <div className={`${styles.kpiDelta} ${deltaStr(s.memberCounts.activeMembers, s.priorMemberCounts.activeMembers, 'number').cls}`}>
                  {deltaStr(s.memberCounts.activeMembers, s.priorMemberCounts.activeMembers, 'number').text}
                </div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{s.memberCounts.newMembers}</div>
                <div className={styles.kpiLabel}>New Members</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtPct(s.rates.logoChurnRate)}</div>
                <div className={styles.kpiLabel}>Logo Churn %</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{s.memberCounts.pausedMembers}</div>
                <div className={styles.kpiLabel}>Paused</div>
              </div>
            </div>

            <h2 className={styles.sectionTitle}>Unit Economics &amp; Attach</h2>
            <div className={styles.kpiGrid}>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtCurrency(s.attach.attachRevenue)}</div>
                <div className={styles.kpiLabel}>Attach Revenue</div>
                <div className={`${styles.kpiDelta} ${deltaStr(s.attach.attachRevenue, s.priorAttach.attachRevenue).cls}`}>
                  {deltaStr(s.attach.attachRevenue, s.priorAttach.attachRevenue).text}
                </div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtPct(s.attach.attachRate)}</div>
                <div className={styles.kpiLabel}>Attach Rate</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtCurrencyDec(s.attach.allInArpm)}</div>
                <div className={styles.kpiLabel}>All-in ARPM</div>
                <div className={`${styles.kpiDelta} ${deltaStr(s.attach.allInArpm, s.priorAttach.allInArpm).cls}`}>
                  {deltaStr(s.attach.allInArpm, s.priorAttach.allInArpm).text}
                </div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{s.failedPayments30d}</div>
                <div className={styles.kpiLabel}>Failed Payments (30d)</div>
              </div>
            </div>

            {/* Charts */}
            <h2 className={styles.sectionTitle}>Trends</h2>
            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>MRR Trend (Last 12 Months)</div>
                <BarChart data={series} dataKey="mrr" color="#bca892" />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>MRR Bridge — {fmtMonthLabel(selectedMonth)}</div>
                <BridgeChart bridge={s.mrrBridge} />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Revenue Mix: MRR vs Attach (Last 12 Months)</div>
                <StackedBarChart
                  data={series}
                  keys={['mrr', 'attachRevenue']}
                  colors={['#bca892', '#007aff']}
                />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Active Members Trend (Last 12 Months)</div>
                <BarChart data={series} dataKey="activeMembers" color="#007aff" />
              </div>
            </div>

            {/* Cohort Retention */}
            <h2 className={styles.sectionTitle}>Cohort Retention</h2>
            <div className={styles.cohortContainer}>
              <div className={styles.cohortCard}>
                {cohorts.length === 0 ? (
                  <div className={styles.emptyState}>No cohort data available. Generate snapshots for multiple months to see retention.</div>
                ) : (
                  <table className={styles.cohortTable}>
                    <thead>
                      <tr>
                        <th>Cohort</th>
                        <th>Size</th>
                        {cohorts[0]?.retentionByMonth.map(r => (
                          <th key={r.month}>{fmtMonthLabel(r.month)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts.map(c => (
                        <tr key={c.cohortMonth}>
                          <td>{fmtMonthLabel(c.cohortMonth)}</td>
                          <td>{c.cohortSize}</td>
                          {c.retentionByMonth.map(r => (
                            <td key={r.month}>
                              <div
                                className={styles.cohortCell}
                                style={{ background: cohortColor(r.rate) }}
                              >
                                {fmtPct(r.rate)}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Drill-down Tables */}
            <h2 className={styles.sectionTitle}>Drilldowns — {fmtMonthLabel(selectedMonth)}</h2>
            <div className={styles.tablesGrid}>
              {/* Churned Members */}
              <div className={styles.tableCard}>
                <div className={styles.tableTitle}>Churned Members</div>
                {drillChurn.length === 0 ? (
                  <div className={styles.emptyState}>No churned members this month</div>
                ) : (
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Tenure</th>
                        <th>Prior MRR</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillChurn.map(r => (
                        <tr key={r.member_id}>
                          <td>{r.first_name} {r.last_name}</td>
                          <td>{r.tenure_months}mo</td>
                          <td>{fmtCurrencyDec(r.prior_mrr)}</td>
                          <td>{r.churn_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Expansion / Contraction */}
              <div className={styles.tableCard}>
                <div className={styles.tableTitle}>Expansion &amp; Contraction</div>
                {drillExpansion.length === 0 ? (
                  <div className={styles.emptyState}>No changes this month</div>
                ) : (
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Prior</th>
                        <th>Current</th>
                        <th>Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillExpansion.map(r => (
                        <tr key={r.member_id}>
                          <td>{r.first_name} {r.last_name}</td>
                          <td>{fmtCurrencyDec(r.prior_mrr)}</td>
                          <td>{fmtCurrencyDec(r.current_mrr)}</td>
                          <td style={{ color: r.delta > 0 ? '#34c759' : '#ff3b30' }}>
                            {r.delta > 0 ? '+' : ''}{fmtCurrencyDec(r.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top Attach Members */}
              <div className={styles.tableCard}>
                <div className={styles.tableTitle}>Top Attach Members</div>
                {drillAttach.length === 0 ? (
                  <div className={styles.emptyState}>No attach revenue this month</div>
                ) : (
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Revenue</th>
                        <th>Checks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillAttach.map(r => (
                        <tr key={r.member_id}>
                          <td>{r.first_name} {r.last_name}</td>
                          <td>{fmtCurrencyDec(r.attach_revenue)}</td>
                          <td>{r.transaction_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Alerts Panel */}
            <h2 className={styles.sectionTitle}>Alerts</h2>
            <div className={styles.alertsContainer}>
              <div className={styles.alertsCard}>
                {(!s.alerts || s.alerts.length === 0) ? (
                  <div className={styles.emptyState}>No alerts configured</div>
                ) : (
                  s.alerts.map(a => (
                    <div key={a.alert_key} className={styles.alertItem}>
                      <div className={`${styles.alertDot} ${a.is_triggered ? styles.alertTriggered : styles.alertOk}`} />
                      <div className={styles.alertInfo}>
                        <div className={styles.alertLabel}>{a.label}</div>
                        <div className={styles.alertMeta}>
                          {a.current_value !== null && (
                            <>Current: {a.threshold_type === 'below' || a.alert_key.includes('churn') || a.alert_key.includes('nrr')
                              ? fmtPct(a.current_value)
                              : a.current_value.toFixed(1)
                            }{' | '}</>
                          )}
                          Threshold: {a.threshold_type === 'below' || a.alert_key.includes('churn') || a.alert_key.includes('nrr') || a.alert_key.includes('drop')
                            ? fmtPct(a.threshold_value)
                            : a.threshold_value.toFixed(0)
                          }
                          {a.last_evaluated_at && (
                            <> | Checked: {new Date(a.last_evaluated_at).toLocaleDateString()}</>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
