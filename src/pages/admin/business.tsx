import { useEffect, useState, useCallback } from 'react';
import { Spinner } from '@/components/ui/spinner';
import AdminLayout from '../../components/layouts/AdminLayout';
import styles from '../../styles/BusinessDashboard.module.css';

// ---------------------------------------------------------------------------
// Types (mirror /api/admin/business-metrics response)
// ---------------------------------------------------------------------------

interface LocationSummary {
  key: string;
  label: string;
  revenue: number;
  visits: number;
  uniqueAccounts: number;
  avgCheck: number;
}

interface TrendPoint {
  month: string; // YYYY-MM
  noir: number;
  rooftop: number;
  other: number;
}

interface AtRiskRow {
  account_id: string;
  member_id: string | null;
  name: string;
  lastVisit: string | null;
  monthlyDues: number;
}

interface WeeklyPoint {
  weekStart: string; // YYYY-MM-DD (Monday)
  gained: number;
  lost: number;
  net: number;
}

interface Metrics {
  generatedAt: string;
  today: string;
  month: string;
  lastMonth: string;
  membership: {
    accounts: { total: number; noir: number; skyline: number; other: number };
    totalMembers: number;
    newAccountsThisMonth: number;
    canceledLast30: number;
    weekly: WeeklyPoint[];
  };
  mrr: {
    total: number;
    monthlyPlans: number;
    annualNormalized: number;
    payingAccounts: number;
    annualAccounts: number;
    avgDuesPerAccount: number;
  };
  revenue: {
    duesCashMTD: number;
    duesCashLastMonth: number;
    beverageMTD: number;
    beverageLastMonth: number;
    eventsOtherMTD: number;
    eventsOtherLastMonth: number;
    totalMemberSpendMTD: number;
  };
  memberSpend: {
    month: string;
    avgSpendPerAccount: number;
    avgDuesPerAccount: number;
    accountsOverDues: number;
    payingAccounts: number;
    pctOverDues: number;
    totalBeverage: number;
  };
  cashflow: {
    asOf: string;
    windows: { days: number; amount: number; accounts: number }[];
    overdueBilling: { accounts: number; amount: number };
  };
  locations: {
    current: LocationSummary[];
    lastMonth: LocationSummary[];
    trend: TrendPoint[];
  };
  balances: {
    outstandingOwed: number;
    accountsOwing: number;
    houseCreditLiability: number;
    accountsInCredit: number;
  };
  engagement: {
    visitingAccountsMTD: number;
    payingAccounts: number;
    visitRateMTD: number;
    atRiskCount: number;
    atRisk: AtRiskRow[];
  };
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

function fmtMonth(monthStr: string): string {
  const d = new Date(monthStr + '-01T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function fmtMonthShort(monthStr: string): string {
  const d = new Date(monthStr + '-01T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

// Validated categorical palette (fixed order: Noir, RooftopKC, Events & Other).
// Passes CVD-separation, chroma and contrast checks on a light surface.
const SERIES = [
  { key: 'noir' as const, label: 'Noir', color: '#b06a1f' },
  { key: 'rooftop' as const, label: 'RooftopKC', color: '#0a6fce' },
  { key: 'other' as const, label: 'Events & Other', color: '#b0508c' },
];

// Gain/loss polarity colors (status semantics: gained = good, lost = bad)
const GAINED_COLOR = '#1e7e45';
const LOST_COLOR = '#c93a34';

function fmtWeek(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ---------------------------------------------------------------------------
// Members gained vs lost — diverging weekly bars (gained up, lost down)
// ---------------------------------------------------------------------------

function WeeklyGainLossChart({ data, currentWeekStart }: { data: WeeklyPoint[]; currentWeekStart: string }) {
  if (!data || data.length === 0) return <div className={styles.emptyState}>No data</div>;

  const halfHeight = 80;
  const yAxisWidth = 30;
  const barWidth = 30;
  const gap = 18;
  const chartWidth = yAxisWidth + data.length * (barWidth + gap) + gap;
  const maxVal = Math.max(...data.map(d => Math.max(d.gained, d.lost)), 1);
  const midY = halfHeight + 14;
  const hFor = (v: number) => (v / maxVal) * halfHeight;

  return (
    <div className={styles.chartContainer}>
      <svg
        width="100%"
        height={halfHeight * 2 + 48}
        viewBox={`0 0 ${chartWidth} ${halfHeight * 2 + 48}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Membership accounts gained and lost per week"
      >
        <line x1={yAxisWidth} y1={midY} x2={chartWidth} y2={midY} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
        {data.map((d, i) => {
          const x = yAxisWidth + gap + i * (barWidth + gap);
          const gainedH = hFor(d.gained);
          const lostH = hFor(d.lost);
          const isCurrent = d.weekStart === currentWeekStart;
          return (
            <g key={d.weekStart} opacity={isCurrent ? 0.6 : 1}>
              {d.gained > 0 && (
                <rect x={x} y={midY - gainedH} width={barWidth} height={gainedH} rx={2} fill={GAINED_COLOR} opacity={0.9}>
                  <title>{`Week of ${fmtWeek(d.weekStart)}: +${d.gained} gained`}</title>
                </rect>
              )}
              {d.lost > 0 && (
                <rect x={x} y={midY + 1} width={barWidth} height={lostH} rx={2} fill={LOST_COLOR} opacity={0.9}>
                  <title>{`Week of ${fmtWeek(d.weekStart)}: −${d.lost} lost`}</title>
                </rect>
              )}
              {d.gained > 0 && (
                <text x={x + barWidth / 2} y={midY - gainedH - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill="#1d1d1f">
                  +{d.gained}
                </text>
              )}
              {d.lost > 0 && (
                <text x={x + barWidth / 2} y={midY + lostH + 11} textAnchor="middle" fontSize="9" fontWeight="600" fill="#1d1d1f">
                  −{d.lost}
                </text>
              )}
              <text x={x + barWidth / 2} y={halfHeight * 2 + 42} textAnchor="middle" fontSize="9" fill="#86868b">
                {fmtWeek(d.weekStart)}{isCurrent ? '*' : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', color: '#6e6e73' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: GAINED_COLOR, display: 'inline-block' }} />
          Accounts gained
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', color: '#6e6e73' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: LOST_COLOR, display: 'inline-block' }} />
          Accounts lost
        </div>
        <span style={{ fontSize: '0.6875rem', color: '#86868b' }}>* current week in progress</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Location revenue trend — stacked bars, one per month
// ---------------------------------------------------------------------------

function LocationTrendChart({ data, currentMonth }: { data: TrendPoint[]; currentMonth: string }) {
  if (!data || data.length === 0) return <div className={styles.emptyState}>No data</div>;

  const height = 200;
  const yAxisWidth = 52;
  const barWidth = 44;
  const gap = 28;
  const chartWidth = yAxisWidth + data.length * (barWidth + gap) + gap;

  const totals = data.map(d => d.noir + d.rooftop + d.other);
  const maxTotal = Math.max(...totals, 1);
  // Nice tick increment: 1/2/5 × 10^k so ~4 gridlines
  const rawStep = maxTotal / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 5, 10].map(m => m * pow).find(s => s >= rawStep) || rawStep;
  const maxVal = Math.ceil(maxTotal / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= maxVal; t += step) ticks.push(t);

  const yFor = (v: number) => height - (v / maxVal) * height;

  return (
    <div className={styles.chartContainer}>
      <svg
        width="100%"
        height={height + 34}
        viewBox={`0 0 ${chartWidth} ${height + 34}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Member spend by location, last 6 months"
      >
        {ticks.map(t => (
          <g key={t}>
            <line x1={yAxisWidth} y1={yFor(t)} x2={chartWidth} y2={yFor(t)} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
            <text x={yAxisWidth - 6} y={yFor(t) + 3} textAnchor="end" fontSize="10" fill="#86868b">
              {t >= 1000 ? `$${t / 1000}k` : `$${t}`}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = yAxisWidth + gap + i * (barWidth + gap);
          let cumY = height;
          const isMTD = d.month === currentMonth;
          return (
            <g key={d.month}>
              {SERIES.map(s => {
                const val = d[s.key];
                const barH = (val / maxVal) * height;
                cumY -= barH;
                const y = cumY;
                return barH > 0 ? (
                  <rect
                    key={s.key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barH - 2, 1)}
                    rx={2}
                    fill={s.color}
                    opacity={isMTD ? 0.55 : 0.9}
                  >
                    <title>{`${fmtMonthShort(d.month)} · ${s.label}: ${fmtCurrency(val)}`}</title>
                  </rect>
                ) : null;
              })}
              <text
                x={x + barWidth / 2}
                y={cumY - 5}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill="#6e6e73"
              >
                {fmtCurrency(d.noir + d.rooftop + d.other)}
              </text>
              <text x={x + barWidth / 2} y={height + 14} textAnchor="middle" fontSize="10" fill="#86868b">
                {fmtMonthShort(d.month)}{isMTD ? '*' : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {SERIES.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', color: '#6e6e73' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block' }} />
            {s.label}
          </div>
        ))}
        <span style={{ fontSize: '0.6875rem', color: '#86868b' }}>* current month is month-to-date</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function BusinessDashboard() {
  const [m, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAtRisk, setShowAtRisk] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/business-metrics');
      if (!res.ok) throw new Error(`business-metrics: ${res.status} ${await res.text()}`);
      setMetrics(await res.json());
    } catch (err: any) {
      console.error('Business dashboard fetch error:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.root}>
          <div className={styles.loading}><Spinner size="lg" /></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.root}>
        <div className={styles.header}>
          <h1 className={styles.title}>Business Dashboard</h1>
          {m && (
            <div style={{ fontSize: '0.8125rem', color: '#86868b' }}>
              {fmtMonth(m.month)} · data through {m.today}
            </div>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {m && (
          <>
            {/* ------------------------------------------------------- */}
            <h2 className={styles.sectionTitle}>Membership</h2>
            <div className={styles.kpiGrid}>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{m.membership.accounts.total}</div>
                <div className={styles.kpiLabel}>Active Membership Accounts</div>
                <div className={styles.kpiHint}>
                  Accounts with an active subscription: <strong>{m.membership.accounts.noir}</strong> Noir ·{' '}
                  <strong>{m.membership.accounts.skyline}</strong> Skyline ·{' '}
                  <strong>{m.membership.accounts.other}</strong> Other (host, legacy, TCC).
                </div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{m.membership.totalMembers}</div>
                <div className={styles.kpiLabel}>Total Members</div>
                <div className={styles.kpiHint}>All people with active access to Noir, including partner members on shared accounts.</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{m.membership.newAccountsThisMonth}</div>
                <div className={styles.kpiLabel}>New Accounts This Month</div>
                <div className={styles.kpiHint}>Accounts whose first member joined in {fmtMonth(m.month)}.</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{m.membership.canceledLast30}</div>
                <div className={styles.kpiLabel}>Cancellations (30d)</div>
                <div className={styles.kpiHint}>Accounts whose subscription was canceled in the last 30 days.</div>
              </div>
              {m.membership.weekly.length >= 2 && (() => {
                const thisWk = m.membership.weekly[m.membership.weekly.length - 1];
                const lastWk = m.membership.weekly[m.membership.weekly.length - 2];
                return (
                  <div className={styles.kpiTile}>
                    <div className={styles.kpiValue}>
                      <span style={{ color: GAINED_COLOR }}>+{thisWk.gained}</span>
                      {' / '}
                      <span style={{ color: LOST_COLOR }}>−{thisWk.lost}</span>
                    </div>
                    <div className={styles.kpiLabel}>Gained / Lost This Week</div>
                    <div className={styles.kpiHint}>
                      Net {thisWk.net >= 0 ? '+' : ''}{thisWk.net} accounts so far this week (Mon–Sun).
                      Last week: +{lastWk.gained} / −{lastWk.lost} (net {lastWk.net >= 0 ? '+' : ''}{lastWk.net}).
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Members Gained vs Lost — Week over Week (Last 12 Weeks)</div>
                <WeeklyGainLossChart
                  data={m.membership.weekly}
                  currentWeekStart={m.membership.weekly[m.membership.weekly.length - 1]?.weekStart || ''}
                />
                <div className={styles.modalHint}>
                  Gained = accounts whose first member joined that week (counted even if they later canceled).
                  Lost = accounts whose subscription was canceled that week. Weeks run Monday–Sunday.
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------- */}
            <h2 className={styles.sectionTitle}>Revenue</h2>
            <div className={styles.kpiGrid}>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtCurrency(m.mrr.total)}</div>
                <div className={styles.kpiLabel}>MRR</div>
                <div className={styles.kpiHint}>
                  Recurring membership dues, counted once per account: {fmtCurrency(m.mrr.monthlyPlans)} from monthly plans
                  + {fmtCurrency(m.mrr.annualNormalized)} from {m.mrr.annualAccounts} annual accounts (÷12).
                  Avg {fmtCurrencyDec(m.mrr.avgDuesPerAccount)} across {m.mrr.payingAccounts} paying accounts.
                </div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtCurrency(m.revenue.duesCashMTD)}</div>
                <div className={styles.kpiLabel}>Dues Collected (MTD)</div>
                <div className={styles.kpiHint}>
                  Membership cash actually collected in {fmtMonth(m.month)} (Stripe + ACH dues, signups).
                  Last month total: {fmtCurrency(m.revenue.duesCashLastMonth)}.
                </div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtCurrency(m.revenue.beverageMTD)}</div>
                <div className={styles.kpiLabel}>Member Beverage Revenue (MTD)</div>
                <div className={styles.kpiHint}>
                  Member spend at Noir + RooftopKC this month. Last month total: {fmtCurrency(m.revenue.beverageLastMonth)}.
                  Events &amp; other member spend adds {fmtCurrency(m.revenue.eventsOtherMTD)} MTD.
                </div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>
                  {fmtCurrencyDec(m.memberSpend.avgSpendPerAccount)}
                  <span style={{ fontSize: '0.9rem', color: '#86868b', fontWeight: 500 }}>
                    {' '}vs {fmtCurrencyDec(m.memberSpend.avgDuesPerAccount)} dues
                  </span>
                </div>
                <div className={styles.kpiLabel}>Avg Member Spend ({fmtMonth(m.memberSpend.month)})</div>
                <div className={styles.kpiHint}>
                  Average beverage spend per paying account in the last full month vs average dues.{' '}
                  <strong>{m.memberSpend.accountsOverDues} of {m.memberSpend.payingAccounts}</strong> accounts
                  ({m.memberSpend.pctOverDues}%) spent more than their dues.
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------- */}
            <h2 className={styles.sectionTitle}>Cash-Flow Projection</h2>
            <div className={styles.kpiGrid}>
              {m.cashflow.windows.map(w => (
                <div key={w.days} className={styles.kpiTile}>
                  <div className={styles.kpiValue}>{fmtCurrency(w.amount)}</div>
                  <div className={styles.kpiLabel}>Next {w.days} Days</div>
                  <div className={styles.kpiHint}>{w.accounts} accounts scheduled to bill by {addDaysLabel(m.cashflow.asOf, w.days)}. Annual renewals count at full value.</div>
                </div>
              ))}
            </div>
            {m.cashflow.overdueBilling.accounts > 0 && (
              <div className={styles.error} style={{ marginTop: '0.5rem' }}>
                ⚠ {m.cashflow.overdueBilling.accounts} active account{m.cashflow.overdueBilling.accounts > 1 ? 's have' : ' has'} a billing
                date in the past ({fmtCurrency(m.cashflow.overdueBilling.amount)} of dues) — billing may be stalled. Check these in Stripe.
              </div>
            )}

            {/* ------------------------------------------------------- */}
            <h2 className={styles.sectionTitle}>Location Performance</h2>
            <div className={styles.kpiGrid}>
              {m.locations.current.map(loc => {
                const prev = m.locations.lastMonth.find(l => l.key === loc.key);
                return (
                  <div key={loc.key} className={styles.kpiTile}>
                    <div className={styles.kpiValue}>{fmtCurrency(loc.revenue)}</div>
                    <div className={styles.kpiLabel}>{loc.label} (MTD)</div>
                    <div className={styles.kpiHint}>
                      {loc.visits} visits · {loc.uniqueAccounts} accounts · avg check {fmtCurrencyDec(loc.avgCheck)}.
                      Last month: {fmtCurrency(prev?.revenue ?? 0)} across {prev?.visits ?? 0} visits
                      (avg check {fmtCurrencyDec(prev?.avgCheck ?? 0)}).
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Member Spend by Location (Last 6 Months)</div>
                <LocationTrendChart data={m.locations.trend} currentMonth={m.month} />
                <table className={styles.dataTable} style={{ marginTop: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className={styles.textRight}>Noir</th>
                      <th className={styles.textRight}>RooftopKC</th>
                      <th className={styles.textRight}>Events &amp; Other</th>
                      <th className={styles.textRight}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.locations.trend.map(t => (
                      <tr key={t.month}>
                        <td>{fmtMonthShort(t.month)}{t.month === m.month ? ' (MTD)' : ''}</td>
                        <td className={styles.textRight}>{fmtCurrency(t.noir)}</td>
                        <td className={styles.textRight}>{fmtCurrency(t.rooftop)}</td>
                        <td className={styles.textRight}>{fmtCurrency(t.other)}</td>
                        <td className={styles.textRight}>{fmtCurrency(t.noir + t.rooftop + t.other)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className={styles.modalHint}>
                  Location is derived from ledger purchase notes (Noir Attendance/Visit, RooftopKC) until purchases carry a
                  location id. RooftopKC totals include the $20 cover (first cocktail included) — Toast imports will let us
                  split cover vs. drink sales.
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------- */}
            <h2 className={styles.sectionTitle}>Engagement &amp; Collections</h2>
            <div className={styles.kpiGrid}>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{m.engagement.visitRateMTD}%</div>
                <div className={styles.kpiLabel}>Visit Rate (MTD)</div>
                <div className={styles.kpiHint}>
                  {m.engagement.visitingAccountsMTD} of {m.engagement.payingAccounts} paying accounts have visited so far in {fmtMonth(m.month)}.
                </div>
              </div>
              <div
                className={styles.kpiTile}
                onClick={() => setShowAtRisk(v => !v)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.kpiValue}>{m.engagement.atRiskCount}</div>
                <div className={styles.kpiLabel}>At-Risk Accounts</div>
                <div className={styles.kpiHint}>Paying accounts with no visit in 60+ days — the top churn predictor. Click to see who.</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtCurrency(m.balances.outstandingOwed)}</div>
                <div className={styles.kpiLabel}>Owed to Us</div>
                <div className={styles.kpiHint}>{m.balances.accountsOwing} accounts carry a negative house balance.</div>
              </div>
              <div className={styles.kpiTile}>
                <div className={styles.kpiValue}>{fmtCurrency(m.balances.houseCreditLiability)}</div>
                <div className={styles.kpiLabel}>House Credit Outstanding</div>
                <div className={styles.kpiHint}>
                  Unspent member credit across {m.balances.accountsInCredit} accounts — value already collected as dues that
                  members can still draw down at the bar.
                </div>
              </div>
            </div>

            {showAtRisk && (
              <div className={styles.tablesGrid}>
                <div className={styles.tableCard}>
                  <div className={styles.tableTitle}>At-Risk Accounts (no visit in 60+ days)</div>
                  {m.engagement.atRisk.length === 0 ? (
                    <div className={styles.emptyState}>Everyone has visited recently 🎉</div>
                  ) : (
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Last Visit</th>
                          <th className={styles.textRight}>Monthly Dues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.engagement.atRisk.map(r => (
                          <tr key={r.account_id}>
                            <td>
                              {r.member_id ? (
                                <a href={`/admin/members/${r.member_id}`} style={{ color: '#A59480', textDecoration: 'none' }}>
                                  {r.name}
                                </a>
                              ) : (
                                r.name
                              )}
                            </td>
                            <td>{r.lastVisit || 'Never'}</td>
                            <td className={styles.textRight}>{fmtCurrencyDec(r.monthlyDues)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {m.engagement.atRiskCount > m.engagement.atRisk.length && (
                    <div className={styles.modalHint}>
                      Showing {m.engagement.atRisk.length} of {m.engagement.atRiskCount} — longest-absent first.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function addDaysLabel(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
