import { useEffect, useState, useCallback } from "react";
import AdminLayout from '../../components/layouts/AdminLayout';
import WaitlistReviewDrawer from '../../components/WaitlistReviewDrawer';
import Link from 'next/link';
import styles from '../../styles/DashboardV2.module.css';
import { UserPlus, PartyPopper, Users, Calendar, CloudSnow, CalendarDays, DollarSign, Loader2, Cake, RefreshCw } from 'lucide-react';

interface LineChartProps {
  datasets: {
    data: number[];
    stroke: string;
    strokeWidth?: number;
    opacity?: number;
  }[];
}

const LineChart = ({ datasets }: LineChartProps) => {
  if (!datasets.length || !datasets[0].data.length) return null;

  // Find global min/max across all datasets
  const allValues = datasets.flatMap(d => d.data);
  const maxValue = Math.max(...allValues, 1);
  const minValue = Math.min(...allValues, 0);
  const normalizedMax = maxValue === minValue ? maxValue + 1 : maxValue;

  const createPoints = (data: number[]) => {
    return data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - minValue) / (normalizedMax - minValue)) * 100;
      return `${x},${y}`;
    }).join(' ');
  };

  return (
    <svg viewBox="0 0 100 100" className={styles.miniChartSvg} preserveAspectRatio="none">
      {datasets.map((dataset, idx) => (
        <polyline
          key={idx}
          fill="none"
          stroke={dataset.stroke}
          strokeWidth={dataset.strokeWidth || 2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={createPoints(dataset.data)}
          opacity={dataset.opacity || 1}
        />
      ))}
    </svg>
  );
};

interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
  dob?: string;
  join_date?: string;
  monthly_dues?: number;
}

interface LedgerEntry {
  type: string;
  date: string;
  amount: number;
}

interface FinancialMetrics {
  monthlyRecurringRevenue: {
    total: number;
    breakdown: any[];
    description: string;
  };
  julyPaymentsReceived: {
    total: number;
    breakdown: any[];
    description: string;
  };
  julyRevenue: {
    total: number;
    breakdown: any[];
    description: string;
  };
  julyAR: {
    total: number;
    description: string;
    breakdown?: any[];
  };
  outstandingBalances: {
    total: number;
    breakdown: any[];
    description: string;
  };
}

interface Stats {
  members: Member[];
  ledger: LedgerEntry[];
  reservations: number;
  outstanding: number;
  loading: boolean;
  waitlistCount: number;
  waitlistEntries: any[];
  invitationRequestsCount: number;
  invitationRequests: any[];
  financialMetrics?: FinancialMetrics;
  privateEvents?: any[];
}

function getNextBirthday(dob?: string) {
  if (!dob) return null;
  const today = new Date();
  const [year, month, day] = dob.split('-').map(Number);
  let next = new Date(today.getFullYear(), month - 1, day);
  
  if (next.getMonth() === today.getMonth() && next.getDate() === today.getDate()) {
    return today;
  }
  
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return next;
}

function getISOWeek(date: Date) {
  const temp = new Date(date.valueOf());
  const dayNum = (date.getDay() + 6) % 7;
  temp.setDate(temp.getDate() - dayNum + 3);
  const firstThursday = temp.valueOf();
  temp.setMonth(0, 1);
  if (temp.getDay() !== 4) {
    temp.setMonth(0, 1 + ((4 - temp.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - temp.valueOf()) / 604800000);
}

function getWeekDates(year: number, week: number) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const monday = new Date(simple);
  if (dow <= 4) {
    monday.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    monday.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return [3, 4, 5].map(offset => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    return d;
  });
}

function getNextWeekdayDate(weekday: number) {
  const today = new Date();
  const result = new Date(today);
  result.setHours(0, 0, 0, 0);
  const diff = (weekday + 7 - today.getDay()) % 7 || 7;
  result.setDate(today.getDate() + diff);
  return result;
}

export default function DashboardV2() {
  const [stats, setStats] = useState<Stats>({
    members: [],
    ledger: [],
    reservations: 0,
    outstanding: 0,
    loading: true,
    waitlistCount: 0,
    waitlistEntries: [],
    invitationRequestsCount: 0,
    invitationRequests: [],
    privateEvents: [],
  });
  const [reservationDetails, setReservationDetails] = useState<any[]>([]);
  const [selectedWaitlistEntry, setSelectedWaitlistEntry] = useState<any>(null);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    setStats(s => ({ ...s, loading: true }));
    
    // Helper function to safely fetch and parse JSON
    const safeFetch = async (url: string, options: RequestInit = {}) => {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || `HTTP ${response.status}` };
          }
          console.error(`API error for ${url}:`, errorData);
          return { error: errorData.error || `Failed to fetch ${url}` };
        }
        return await response.json();
      } catch (error) {
        console.error(`Network error for ${url}:`, error);
        return { error: error instanceof Error ? error.message : 'Network error' };
      }
    };

    try {
      // Fetch all APIs in parallel with individual error handling
      const [
        membersResult,
        ledgerResult,
        reservationsResult,
        outstandingResult,
        financialResult,
        waitlistResult,
        waitlistedResult,
        privateEventsResult
      ] = await Promise.all([
        safeFetch("/api/members"),
        safeFetch("/api/ledger"),
        safeFetch("/api/reservations?upcoming=1"),
        safeFetch("/api/ledger?outstanding=1"),
        safeFetch("/api/financial-metrics"),
        safeFetch("/api/waitlist?status=review&limit=5"),
        safeFetch("/api/waitlist?status=waitlisted&limit=5"),
        (async () => {
          const now = new Date();
          const startDate = now.toISOString();
          const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
          return safeFetch(`/api/private-events?startDate=${startDate}&endDate=${endDate}`);
        })()
      ]);

      // Debug: Log API responses to understand format
      console.log('API Responses:', {
        members: { hasError: !!membersResult.error, hasSuccess: membersResult.success !== undefined, hasData: !!membersResult.data },
        ledger: { hasError: !!ledgerResult.error, hasSuccess: ledgerResult.success !== undefined, hasData: !!ledgerResult.data },
        reservations: { hasError: !!reservationsResult.error, hasSuccess: reservationsResult.success !== undefined, hasData: !!reservationsResult.data }
      });

      // Extract data, using empty defaults if there was an error
      // Handle both ApiResponse format ({ success: true, data }) and direct format ({ data })
      const membersData = membersResult.error || membersResult.success === false
        ? { data: [] }
        : membersResult.success === true
        ? membersResult  // ApiResponse format: { success: true, data: [...] }
        : { data: membersResult.data || membersResult || [] };  // Direct format: { data: [...] } or just array
      
      const ledgerData = ledgerResult.error || ledgerResult.success === false
        ? { data: [] }
        : ledgerResult.success === true
        ? ledgerResult
        : { data: ledgerResult.data || ledgerResult || [] };
      
      const reservationsData = reservationsResult.error || reservationsResult.success === false
        ? { data: [], count: 0 }
        : reservationsResult.success === true
        ? reservationsResult
        : { data: reservationsResult.data || [], count: reservationsResult.count || 0 };
      
      const outstandingData = outstandingResult.error || outstandingResult.success === false
        ? { total: 0 }
        : outstandingResult.success === true
        ? outstandingResult
        : { total: outstandingResult.total || 0 };
      
      const financialData = financialResult.error || financialResult.success === false
        ? {}
        : financialResult.success === true
        ? (financialResult.data || financialResult)
        : financialResult;
      
      const waitlistData = waitlistResult.error || waitlistResult.success === false
        ? { data: [], count: 0 }
        : waitlistResult.success === true
        ? waitlistResult
        : { data: waitlistResult.data || [], count: waitlistResult.count || 0 };
      
      const waitlistedData = waitlistedResult.error || waitlistedResult.success === false
        ? { data: [], count: 0 }
        : waitlistedResult.success === true
        ? waitlistedResult
        : { data: waitlistedResult.data || [], count: waitlistedResult.count || 0 };
      
      const privateEventsData = privateEventsResult.error || privateEventsResult.success === false
        ? { data: [] }
        : privateEventsResult.success === true
        ? privateEventsResult
        : { data: privateEventsResult.data || privateEventsResult || [] };
      
      setStats({
        members: membersData.data || [],
        ledger: ledgerData.data || [],
        reservations: reservationsData.count || 0,
        outstanding: outstandingData.total || 0,
        loading: false,
        waitlistCount: waitlistedData.count || 0,
        waitlistEntries: waitlistedData.data || [],
        invitationRequestsCount: waitlistData.count || 0,
        invitationRequests: waitlistData.data || [],
        financialMetrics: financialData,
        privateEvents: privateEventsData.data || [],
      });
      setReservationDetails(reservationsData.data || []);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setStats({ members: [], ledger: [], reservations: 0, outstanding: 0, loading: false, waitlistCount: 0, waitlistEntries: [], invitationRequestsCount: 0, invitationRequests: [], privateEvents: [] });
      setReservationDetails([]);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, []);

  if (stats.loading) {
    return (
      <AdminLayout>
        <div className={styles.dashboardContainer}>
          <div className={styles.searchActionsRow}>
            <div className={styles.skeletonText} style={{ height: '48px' }}></div>
          </div>
          <div className={styles.primaryHighlights}>
            <div className={styles.skeletonCard}></div>
            <div className={styles.skeletonCard}></div>
            <div className={styles.skeletonCard}></div>
          </div>
          <div className={styles.focusGrid}>
            <div className={styles.skeletonCard} style={{ height: '240px' }}></div>
            <div className={styles.skeletonCard} style={{ height: '240px' }}></div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Calculations (same as original)
  const totalMembers = stats.members.length;
  const totalDues = stats.members.reduce((sum, m) => sum + (m.monthly_dues || 0), 0);
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const isThisMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  };
  const payments = stats.ledger.filter(tx => tx.type === 'payment' && isThisMonth(tx.date)).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const purchases = stats.ledger.filter(tx => tx.type === 'purchase' && isThisMonth(tx.date)).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const ar = Math.abs(purchases) - payments;

  const membersWithBirthday = stats.members.filter(m => m.dob).map(m => ({
    ...m,
    nextBirthday: getNextBirthday(m.dob)
  })).filter(m => m.nextBirthday).sort((a, b) => {
    const aDate = a.nextBirthday as Date;
    const bDate = b.nextBirthday as Date;
    const today = new Date();
    const aIsToday = aDate.getMonth() === today.getMonth() && aDate.getDate() === today.getDate();
    const bIsToday = bDate.getMonth() === today.getMonth() && bDate.getDate() === today.getDate();
    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    return aDate.getTime() - bDate.getTime();
  }).slice(0, 5);

  const getNextRenewal = (member: Member) => {
    if (!member.join_date) return null;
    const jd = new Date(member.join_date);
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    const day = jd.getDate();
    let candidate = new Date(year, month, day);
    if (candidate < today) {
      if (month === 11) { year += 1; month = 0; }
      else { month += 1; }
      candidate = new Date(year, month, day);
    }
    return candidate;
  };
  const membersWithRenewal = stats.members.map(m => ({
    ...m,
    nextRenewal: getNextRenewal(m)
  })).filter(m => m.nextRenewal).sort((a, b) => (a.nextRenewal as Date).getTime() - (b.nextRenewal as Date).getTime()).slice(0, 5);

  const today = new Date();
  let year = today.getFullYear();
  let week = getISOWeek(today);
  if (today.getDay() === 0) {
    week += 1;
    if (week > getISOWeek(new Date(year, 11, 31))) {
      week = 1;
      year += 1;
    }
  }
  const [nextThursday, nextFriday, nextSaturday] = getWeekDates(year, week);

  function isSameDay(date1: Date, date2: Date) {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  }

  const getPrivateEventForDay = (date: Date) => {
    return stats.privateEvents?.find(event => {
      const eventDate = new Date(event.start_time);
      return isSameDay(eventDate, date);
    });
  };

  const thursdayReservations = reservationDetails.filter(r => {
    const d = new Date(r.start_time);
    return isSameDay(d, nextThursday);
  });
  const thursdaySeats = thursdayReservations.reduce((sum, r) => sum + (Number(r.party_size) || 0), 0);
  const thursdayPrivateEvent = getPrivateEventForDay(nextThursday);

  const fridayReservations = reservationDetails.filter(r => {
    const d = new Date(r.start_time);
    return isSameDay(d, nextFriday);
  });
  const fridaySeats = fridayReservations.reduce((sum, r) => sum + (Number(r.party_size) || 0), 0);
  const fridayPrivateEvent = getPrivateEventForDay(nextFriday);

  const saturdayReservations = reservationDetails.filter(r => {
    const d = new Date(r.start_time);
    return isSameDay(d, nextSaturday);
  });
  const saturdaySeats = saturdayReservations.reduce((sum, r) => sum + (Number(r.party_size) || 0), 0);
  const saturdayPrivateEvent = getPrivateEventForDay(nextSaturday);

  const quickActions = [
    { icon: UserPlus, label: 'New Lead', href: '/admin/waitlist' },
    { icon: PartyPopper, label: 'Add Event', href: '/admin/calendar' },
    { icon: Users, label: 'Add Contact', href: '/admin/members' },
    { icon: Calendar, label: 'Add Meeting', href: '/admin/calendar' },
  ];

  const weatherSnapshot = {
    temperature: '26°F',
    condition: 'Snow',
    precipitation: '0.29%',
    humidity: '82%',
    wind: '6 mph',
    sunrise: '6:17 pm',
  };

  const weatherForecast = [
    { label: 'Now', hi: '28°', lo: '22°' },
    { label: 'Tue', hi: '35°', lo: '25°' },
    { label: 'Wed', hi: '40°', lo: '27°' },
    { label: 'Thu', hi: '42°', lo: '29°' },
    { label: 'Fri', hi: '37°', lo: '28°' },
  ];

  const upcomingEventsList = reservationDetails
    .map((reservation: any) => {
      const date = new Date(reservation.start_time);
      return {
        id: reservation.id,
        label: reservation.event_type || reservation.notes || 'Reservation',
        date,
        detail: reservation.party_size ? `${reservation.party_size} guests` : 'No party size',
      };
    })
    .filter(item => item.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  const upcomingPaymentsList = membersWithRenewal.slice(0, 5).map(member => ({
    id: member.member_id,
    label: `${member.first_name} ${member.last_name}`,
    amount: member.monthly_dues || 0,
    date: member.nextRenewal as Date,
  }));

  const upcomingBirthdaysList = membersWithBirthday.slice(0, 5).map(member => ({
    id: member.member_id,
    label: `${member.first_name} ${member.last_name}`,
    date: member.nextBirthday as Date,
  }));

  const upcomingRenewalsList = membersWithRenewal.slice(0, 5).map(member => ({
    id: member.member_id,
    label: `${member.first_name} ${member.last_name}`,
    date: member.nextRenewal as Date,
  }));

  const monthlyRevenueSeries = (() => {
    const totals = Array(12).fill(0);
    const paymentsLedger = stats.ledger.filter(tx => tx.type === 'payment');
    paymentsLedger.forEach(tx => {
      const entryDate = new Date(tx.date);
      const monthsDiff = (now.getFullYear() - entryDate.getFullYear()) * 12 + (now.getMonth() - entryDate.getMonth());
      if (monthsDiff >= 0 && monthsDiff < 12) {
        const index = 11 - monthsDiff;
        totals[index] += Number(tx.amount) || 0;
      }
    });
    if (totals.every(value => value === 0)) {
      return Array.from({ length: 12 }, (_, idx) => 8000 + idx * 450);
    }
    return totals;
  })();

  const membershipSeries = monthlyRevenueSeries.map((value, idx) => {
    const base = Math.max(totalMembers * 30, 1200);
    return Math.max(value * 0.65, base + idx * 40);
  });

  const monthLabels = monthlyRevenueSeries.map((_, idx) => {
    const dateRef = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
    return dateRef.toLocaleString('default', { month: 'short' });
  });

  const ytdRevenue = stats.ledger
    .filter(tx => tx.type === 'payment' && new Date(tx.date).getFullYear() === now.getFullYear())
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const annualRevenueGoal = Math.max(120000, ytdRevenue * 1.2 + 10000);
  const progressPercent = Math.min((ytdRevenue / annualRevenueGoal) * 100, 100);

  return (
    <AdminLayout>
      <div className={styles.dashboardContainer}>
        <div className={styles.searchActionsRow}>
          <div className={styles.searchInputWrapper}>
            <span className={styles.searchIcon}>🔎</span>
            <input
              className={styles.searchInput}
              placeholder="Search events, contacts, vendors, dates..."
            />
          </div>
          <div className={styles.actionButtonsRow}>
            {quickActions.map(action => {
              const IconComponent = action.icon;
              return (
                <Link key={action.label} href={action.href} className={styles.actionButton}>
                  <IconComponent size={16} />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className={styles.primaryHighlights}>
          <div className={styles.weatherCard}>
            <div className={styles.weatherHeader}>
              <div>
                <div className={styles.weatherTemp}>{weatherSnapshot.temperature}</div>
                <div style={{ color: '#6e6e73', fontWeight: 600 }}>{weatherSnapshot.condition}</div>
              </div>
              <CloudSnow size={48} color="#A59480" strokeWidth={1.5} />
            </div>
            <div className={styles.weatherMeta}>
              <span>Precip {weatherSnapshot.precipitation}</span>
              <span>Humidity {weatherSnapshot.humidity}</span>
              <span>Wind {weatherSnapshot.wind}</span>
              <span>Sunset {weatherSnapshot.sunrise}</span>
            </div>
            <div className={styles.forecastRow}>
              {weatherForecast.map((item) => (
                <div key={item.label} className={styles.forecastItem}>
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  <div>{item.hi}</div>
                  <div style={{ color: '#A59480' }}>{item.lo}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span>Revenue Overview</span>
              <div className={styles.toggleGroup}>
                <button className={`${styles.toggleButton} ${styles.toggleButtonActive}`}>Accrual</button>
                <button className={styles.toggleButton}>Cash</button>
              </div>
            </div>
            <div className={styles.metricValueLarge}>
              ${stats.financialMetrics?.monthlyRecurringRevenue?.total?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
            </div>
            <div className={styles.metricSubtitle}>
              ${Math.round(stats.financialMetrics?.monthlyRecurringRevenue?.total ? stats.financialMetrics.monthlyRecurringRevenue.total / (stats.members.length || 1) : totalDues / (stats.members.length || 1)).toLocaleString()} avg / client
            </div>
            <div className={styles.metricStatRow}>
              <span>Open Invoices</span>
              <strong>${stats.financialMetrics?.outstandingBalances?.total?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}</strong>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span>Current Month Revenue</span>
              <div className={styles.toggleGroup}>
                <button className={`${styles.toggleButton} ${styles.toggleButtonActive}`}>Accrual</button>
                <button className={styles.toggleButton}>Cash</button>
              </div>
            </div>
            <div className={styles.metricValueLarge}>
              ${stats.financialMetrics?.julyRevenue?.total?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || Math.abs(purchases).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className={styles.metricStatRow}>
              <span>Events</span>
              <strong>{reservationDetails.length}</strong>
            </div>
            <div className={styles.metricStatRow}>
              <span>Per Event</span>
              <strong>${reservationDetails.length ? Math.round((stats.financialMetrics?.julyRevenue?.total || Math.abs(purchases)) / reservationDetails.length).toLocaleString() : '0'}</strong>
            </div>
          </div>
        </div>

        <div className={styles.focusGrid}>
          <div className={styles.listCard}>
            <h3 className={styles.listCardTitle}>Upcoming Events</h3>
            {upcomingEventsList.length === 0 ? (
              <div className={styles.emptyStateEnhanced}>
                <CalendarDays className={styles.emptyIcon} />
                <h4 className={styles.emptyTitle}>No upcoming events</h4>
                <p className={styles.emptyText}>Your calendar is clear this week</p>
                <Link href="/admin/calendar" className={styles.emptyAction}>
                  <Calendar size={16} />
                  Schedule an Event
                </Link>
              </div>
            ) : (
              <div className={styles.listContent}>
                {upcomingEventsList.map(event => (
                  <Link key={event.id || event.label} href="/admin/calendar" className={styles.listItemLink}>
                    <div className={styles.listItemHeader}>{event.label}</div>
                    <div className={styles.listItemText}>
                      {event.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {event.detail}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className={styles.listCard}>
            <h3 className={styles.listCardTitle}>Upcoming Payments</h3>
            {upcomingPaymentsList.length === 0 ? (
              <div className={styles.emptyStateEnhanced}>
                <DollarSign className={styles.emptyIcon} />
                <h4 className={styles.emptyTitle}>No scheduled payments</h4>
                <p className={styles.emptyText}>All payments are up to date</p>
              </div>
            ) : (
              <div className={styles.listContent}>
                {upcomingPaymentsList.map(payment => (
                  <Link key={payment.id} href={`/admin/members/${payment.id}`} className={styles.listItemLink}>
                    <div className={styles.listItemHeader}>{payment.label}</div>
                    <div className={styles.listItemText}>
                      {payment.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — <span style={{ color: '#8B4A4A', fontWeight: 600 }}>${payment.amount.toFixed(2)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className={styles.listCard}>
            <h3 className={styles.listCardTitle}>Upcoming Birthdays</h3>
            {upcomingBirthdaysList.length === 0 ? (
              <div className={styles.emptyStateEnhanced}>
                <Cake className={styles.emptyIcon} />
                <h4 className={styles.emptyTitle}>No birthdays this month</h4>
                <p className={styles.emptyText}>Check back next month</p>
              </div>
            ) : (
              <div className={styles.listContent}>
                {upcomingBirthdaysList.map(member => (
                  <Link key={member.id} href={`/admin/members/${member.id}`} className={styles.listItemLink}>
                    <div className={styles.listItemHeader}>{member.label}</div>
                    <div className={styles.listItemText}>
                      {member.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className={styles.listCard}>
            <h3 className={styles.listCardTitle}>Upcoming Renewals</h3>
            {upcomingRenewalsList.length === 0 ? (
              <div className={styles.emptyStateEnhanced}>
                <RefreshCw className={styles.emptyIcon} />
                <h4 className={styles.emptyTitle}>No renewals this month</h4>
                <p className={styles.emptyText}>All memberships are current</p>
              </div>
            ) : (
              <div className={styles.listContent}>
                {upcomingRenewalsList.map(renewal => (
                  <Link key={renewal.id} href={`/admin/members/${renewal.id}`} className={styles.listItemLink}>
                    <div className={styles.listItemHeader}>{renewal.label}</div>
                    <div className={styles.listItemText}>
                      {renewal.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.chartGrid}>
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <span>Monthly Revenue by Stream</span>
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', color: '#6e6e73' }}>
                <span>{monthLabels[0]} — {monthLabels[monthLabels.length - 1]}</span>
              </div>
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.chartLegendItem}>
                <span className={styles.legendDot} style={{ background: '#A59480' }}></span> Total Revenue
              </div>
              <div className={styles.chartLegendItem}>
                <span className={styles.legendDot} style={{ background: '#8C7C6D' }}></span> Membership Revenue
              </div>
            </div>
            <div className={styles.chartContainer}>
              <LineChart
                datasets={[
                  { data: monthlyRevenueSeries, stroke: '#A59480', strokeWidth: 2.5, opacity: 1 },
                  { data: membershipSeries, stroke: '#8C7C6D', strokeWidth: 2, opacity: 0.75 }
                ]}
              />
              <div className={styles.chartLabels}>
                {monthLabels.map((label, idx) => (
                  idx % 2 === 0 || monthLabels.length <= 6 ? <span key={idx}>{label}</span> : <span key={idx}></span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <span>Revenue Progress</span>
              <span style={{ fontSize: '0.8rem' }}>{now.getFullYear()}</span>
            </div>
            <div className={styles.metricValueLarge}>
              ${ytdRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className={styles.metricSubtitle}>
              Goal ${annualRevenueGoal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className={styles.barStack}>
              <div className={styles.barRow}>
                <div className={styles.barLabel}>
                  <span>Through {now.toLocaleString('default', { month: 'short' })}</span>
                  <span>{progressPercent.toFixed(0)}%</span>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
              <div className={styles.barRow}>
                <div className={styles.barLabel}>
                  <span>Remaining</span>
                  <span>${Math.max(annualRevenueGoal - ytdRevenue, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${100 - progressPercent}%`, background: '#BCA892' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <WaitlistReviewDrawer
          isOpen={isWaitlistModalOpen}
          onClose={() => setIsWaitlistModalOpen(false)}
          entry={selectedWaitlistEntry}
          onStatusUpdate={fetchStats}
        />
      </div>
    </AdminLayout>
  );
}


