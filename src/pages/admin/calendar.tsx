import React, { useState, useEffect } from "react";
import { useRouter } from 'next/router';
import FullCalendarTimeline from "../../components/FullCalendarTimeline";
import ReservationEditDrawer from "../../components/ReservationEditDrawer";
import NewReservationModal from "../../components/NewReservationModal";
import AdminLayout from '../../components/layouts/AdminLayout';
import { useSettings } from '../../context/SettingsContext';
import { fromUTC, isSameDay } from '../../utils/dateUtils';
import { supabase } from '../../lib/supabase';
import styles from '../../styles/Calendar.module.css';

type ViewType = 'day' | 'month' | 'all';

export default function Calendar() {
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const [currentView, setCurrentView] = useState<ViewType>('day');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookingStartDate, setBookingStartDate] = useState<Date>(new Date());
  const [bookingEndDate, setBookingEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [isNewReservationModalOpen, setIsNewReservationModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; resourceId: string } | null>(null);

  useEffect(() => {
    if (router.isReady && router.query.date) {
      const dateParam = router.query.date as string;
      const parsedDate = new Date(dateParam);
      if (!isNaN(parsedDate.getTime())) {
        setCurrentDate(parsedDate);
      }
    }
  }, [router.isReady, router.query.date]);

  const handleReservationClick = (reservationId: string) => {
    setSelectedReservationId(reservationId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedReservationId(null);
  };

  const handleReservationUpdated = () => {
    setReloadKey(prev => prev + 1);
  };

  const handleSlotClick = (slotInfo: { date: Date; resourceId: string }) => {
    setSelectedSlot(slotInfo);
    setIsNewReservationModalOpen(true);
  };

  const handleNewReservationClose = () => {
    setIsNewReservationModalOpen(false);
    setSelectedSlot(null);
  };

  const handleNewReservationCreated = () => {
    setReloadKey(prev => prev + 1);
    handleNewReservationClose();
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
    if (currentView !== 'day') {
      setCurrentView('day');
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (currentView === 'month') {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
      setCurrentDate(newDate);
    }
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'month':
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'all':
        return 'All Reservations';
      default:
        return '';
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'day':
        return (
          <FullCalendarTimeline
            reloadKey={reloadKey}
            bookingStartDate={bookingStartDate}
            bookingEndDate={bookingEndDate}
            viewOnly={false}
            onReservationClick={handleReservationClick}
            currentDate={currentDate}
            onDateChange={handleDateChange}
            onSlotClick={handleSlotClick}
          />
        );
      case 'month':
        return <MonthView currentDate={currentDate} onDateChange={handleDateChange} onReservationClick={handleReservationClick} />;
      case 'all':
        return <AllReservationsView onReservationClick={handleReservationClick} />;
      default:
        return null;
    }
  };

  return (
    <AdminLayout isFullScreen={isFullScreen}>
      <ReservationEditDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        reservationId={selectedReservationId}
        onReservationUpdated={handleReservationUpdated}
      />

      <NewReservationModal
        isOpen={isNewReservationModalOpen}
        onClose={handleNewReservationClose}
        initialDate={selectedSlot?.date}
        initialTableId={selectedSlot?.resourceId}
        onReservationCreated={handleNewReservationCreated}
      />

      <div className={`${styles.container} ${isFullScreen ? styles.fullScreen : ''}`}>
        <header className={styles.header}>
          <nav className={styles.nav}>
            <div className={styles.viewButtons}>
              <button
                className={`${styles.viewButton} ${currentView === 'day' ? styles.active : ''}`}
                onClick={() => handleViewChange('day')}
              >
                📅 Day Timeline
              </button>
              <button
                className={`${styles.viewButton} ${currentView === 'month' ? styles.active : ''}`}
                onClick={() => handleViewChange('month')}
              >
                📆 Month Covers
              </button>
              <button
                className={`${styles.viewButton} ${currentView === 'all' ? styles.active : ''}`}
                onClick={() => handleViewChange('all')}
              >
                📋 All Reservations
              </button>
              <button
                className={styles.iconButton}
                onClick={toggleFullScreen}
                aria-label={isFullScreen ? "Exit full screen" : "Enter full screen"}
              >
                {isFullScreen ? '✕' : '⛶'}
              </button>
            </div>

            {currentView === 'month' && (
              <div className={styles.navControls}>
                <button
                  className={styles.navButton}
                  onClick={() => navigateDate('prev')}
                  aria-label="Previous Month"
                >
                  ‹
                </button>
                <div className={styles.navTitle}>{getViewTitle()}</div>
                <button
                  className={styles.navButton}
                  onClick={() => navigateDate('next')}
                  aria-label="Next Month"
                >
                  ›
                </button>
              </div>
            )}

            {currentView === 'all' && (
              <div className={styles.navTitle} style={{ textAlign: 'center' }}>{getViewTitle()}</div>
            )}
          </nav>
        </header>

        <main className={styles.content}>
          {renderView()}
        </main>
      </div>
    </AdminLayout>
  );
}

// Helper function to check if a day is open
function isDayOpenOptimized(date: Date, baseHours: any[], exceptionalClosures: any[], privateEvents: any[]): boolean {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    const exceptionalClosure = exceptionalClosures.find(closure => closure.date === dateStr);
    if (exceptionalClosure && (exceptionalClosure.full_day || !exceptionalClosure.time_ranges)) {
      return false;
    }

    const dayPrivateEvents = privateEvents.filter(ev => {
      const eventDate = ev.start_time.split('T')[0];
      return eventDate === dateStr && ev.full_day;
    });

    if (dayPrivateEvents.length > 0) return false;

    const baseHoursForDay = baseHours.filter(h => h.day_of_week === dayOfWeek);
    const exceptionalOpen = exceptionalClosures.find(open => open.date === dateStr && open.type === 'exceptional_open');

    if (baseHoursForDay.length === 0 && !exceptionalOpen) return false;

    return true;
  } catch (error) {
    console.error('Error checking if day is open:', error);
    return false;
  }
}

// Month View Component
function MonthView({ currentDate, onDateChange, onReservationClick }: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onReservationClick: (reservationId: string) => void;
}) {
  const { settings } = useSettings();
  const [monthData, setMonthData] = useState<Array<{
    date: Date;
    reservations: any[];
    privateEvents: any[];
    regularReservations: any[];
    totalGuests: number;
    isCurrentMonth: boolean;
    isOpen: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonthData();
  }, [currentDate]);

  const fetchMonthData = async () => {
    setLoading(true);
    try {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const calendarStart = new Date(monthStart);
      calendarStart.setDate(monthStart.getDate() - monthStart.getDay());

      const calendarEnd = new Date(monthEnd);
      calendarEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

      const [reservationsResponse, privateEventsResponse] = await Promise.all([
        fetch(`/api/reservations?startDate=${calendarStart.toISOString()}&endDate=${calendarEnd.toISOString()}`),
        fetch(`/api/private-events?startDate=${calendarStart.toISOString()}&endDate=${calendarEnd.toISOString()}`)
      ]);

      const reservationsData = await reservationsResponse.json();
      const privateEventsData = await privateEventsResponse.json();

      const { data: venueHoursData } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'base');

      const { data: exceptionalClosuresData } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'exceptional_closure')
        .gte('date', calendarStart.toISOString().split('T')[0])
        .lte('date', calendarEnd.toISOString().split('T')[0]);

      const { data: exceptionalOpenData } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'exceptional_open')
        .gte('date', calendarStart.toISOString().split('T')[0])
        .lte('date', calendarEnd.toISOString().split('T')[0]);

      const calendarData: Array<{
        date: Date;
        reservations: any[];
        privateEvents: any[];
        regularReservations: any[];
        totalGuests: number;
        isCurrentMonth: boolean;
        isOpen: boolean;
      }> = [];
      const current = new Date(calendarStart);

      while (current <= calendarEnd) {
        const dayReservations = reservationsData.data?.filter((r: any) => {
          const resDate = fromUTC(r.start_time, settings.timezone);
          return isSameDay(resDate, current, settings.timezone);
        }) || [];

        const dayPrivateEvents = privateEventsData.data?.filter((pe: any) => {
          const eventDate = fromUTC(pe.start_time, settings.timezone);
          return isSameDay(eventDate, current, settings.timezone);
        }) || [];

        const privateEvents = dayReservations.filter((r: any) => r.private_event_id);
        const regularReservations = dayReservations.filter((r: any) => !r.private_event_id);
        const totalGuests = regularReservations.reduce((sum: number, r: any) => sum + (r.party_size || 0), 0);
        const isOpen = isDayOpenOptimized(current, venueHoursData || [], [...(exceptionalClosuresData || []), ...(exceptionalOpenData || [])], privateEventsData.data || []);

        calendarData.push({
          date: new Date(current),
          reservations: dayReservations,
          privateEvents: dayPrivateEvents,
          regularReservations,
          totalGuests,
          isCurrentMonth: current.getMonth() === currentDate.getMonth(),
          isOpen
        });

        current.setDate(current.getDate() + 1);
      }

      setMonthData(calendarData);
    } catch (error) {
      console.error('Error fetching month data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayClick = (date: Date) => {
    onDateChange(date);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.monthGrid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className={styles.dayHeader}>{day}</div>
        ))}
      </div>

      <div className={styles.monthGrid}>
        {monthData.map((day, index) => (
          <div
            key={index}
            className={`${styles.dayCell} ${!day.isCurrentMonth ? styles.otherMonth : ''} ${!day.isOpen ? styles.closed : ''}`}
            onClick={() => day.isOpen && handleDayClick(day.date)}
          >
            <div className={styles.dayNumber}>{day.date.getDate()}</div>

            {day.privateEvents.length > 0 ? (
              <div className={styles.dayContent}>
                {day.privateEvents.map((event, eventIndex) => (
                  <div key={eventIndex}>
                    <div className={styles.privateEventLabel}>Private Event</div>
                    <div className={styles.privateEventTitle}>{event.title}</div>
                  </div>
                ))}
              </div>
            ) : (
              day.isOpen && (
                <div className={styles.dayContent}>
                  <div className={styles.guestCount}>{day.totalGuests}</div>
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// All Reservations View Component
function AllReservationsView({ onReservationClick }: {
  onReservationClick: (reservationId: string) => void;
}) {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'table'>('date');
  const [filterType, setFilterType] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    fetchAllReservations();
  }, []);

  const fetchAllReservations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reservations');
      const data = await response.json();
      setReservations(data.data || []);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    const icons: Record<string, string> = {
      birthday: '🎂', engagement: '💍', anniversary: '🥂', party: '🎉',
      graduation: '🎓', corporate: '🧑‍💼', holiday: '❄️', networking: '🤝',
      fundraiser: '🎗️', bachelor: '🥳', bachelorette: '🥳', private_event: '🔒',
      fun: '🍸', date: '💕',
    };
    return icons[eventType] || '📅';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const formatDateLong = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const getReservationStatus = (startTime: string) => {
    const now = new Date();
    const reservationDate = new Date(startTime);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reservationDay = new Date(reservationDate.getFullYear(), reservationDate.getMonth(), reservationDate.getDate());

    if (reservationDay.getTime() === today.getTime()) return 'today';
    else if (reservationDate > now) return 'upcoming';
    else return 'past';
  };

  const filteredAndSortedReservations = reservations
    .filter((reservation) => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (
          !reservation.first_name?.toLowerCase().includes(searchLower) &&
          !reservation.last_name?.toLowerCase().includes(searchLower) &&
          !reservation.tables?.table_number?.toString().includes(searchLower) &&
          !reservation.event_type?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      if (filterType !== 'all') {
        const status = getReservationStatus(reservation.start_time);
        if (status !== filterType) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        case 'name':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case 'table':
          return (a.tables?.table_number || 0) - (b.tables?.table_number || 0);
        default:
          return 0;
      }
    });

  const stats = {
    total: reservations.length,
    today: reservations.filter(r => getReservationStatus(r.start_time) === 'today').length,
    upcoming: reservations.filter(r => getReservationStatus(r.start_time) === 'upcoming').length,
    past: reservations.filter(r => getReservationStatus(r.start_time) === 'past').length,
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.allReservations}>
      <div className={styles.statsContainer}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{stats.total}</div>
          <div className={styles.statLabel}>Total</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{stats.today}</div>
          <div className={styles.statLabel}>Today</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{stats.upcoming}</div>
          <div className={styles.statLabel}>Upcoming</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{stats.past}</div>
          <div className={styles.statLabel}>Past</div>
        </div>
      </div>

      <div className={styles.filtersContainer}>
        <div className={styles.searchContainer}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by name, table, or event type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterRow}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className={styles.select}
          >
            <option value="all">All Reservations</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.select}
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="table">Sort by Table</option>
          </select>
        </div>

        <button onClick={fetchAllReservations} className={styles.refreshButton}>
          Refresh
        </button>
      </div>

      <div className={styles.filterChips}>
        <div
          className={`${styles.filterChip} ${filterType === 'all' ? styles.active : ''}`}
          onClick={() => setFilterType('all')}
        >
          All ({stats.total})
        </div>
        <div
          className={`${styles.filterChip} ${filterType === 'today' ? styles.active : ''}`}
          onClick={() => setFilterType('today')}
        >
          Today ({stats.today})
        </div>
        <div
          className={`${styles.filterChip} ${filterType === 'upcoming' ? styles.active : ''}`}
          onClick={() => setFilterType('upcoming')}
        >
          Upcoming ({stats.upcoming})
        </div>
        <div
          className={`${styles.filterChip} ${filterType === 'past' ? styles.active : ''}`}
          onClick={() => setFilterType('past')}
        >
          Past ({stats.past})
        </div>
      </div>

      {filteredAndSortedReservations.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📅</div>
          <div className={styles.emptyText}>No reservations found</div>
        </div>
      ) : (
        <div>
          {filteredAndSortedReservations.map((reservation) => {
            const status = getReservationStatus(reservation.start_time);
            return (
              <div
                key={reservation.id}
                className={styles.reservationCard}
                onClick={() => onReservationClick(reservation.id)}
              >
                <div className={styles.reservationHeader}>
                  <div className={`${styles.statusBadge} ${styles[status]}`}>
                    {status}
                  </div>

                  <div className={styles.reservationName}>
                    {reservation.first_name} {reservation.last_name}
                  </div>
                  <div className={styles.reservationDateTime}>
                    <div className={styles.reservationDate}>
                      {formatDateLong(reservation.start_time)}
                    </div>
                    <div className={styles.reservationTime}>
                      {formatTime(reservation.start_time)}
                    </div>
                  </div>
                </div>

                <div className={styles.reservationInfo}>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoIcon}>🪑</span>
                      <span>Table {reservation.tables?.table_number || 'TBD'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoIcon}>👥</span>
                      <span>{reservation.party_size} {reservation.party_size === 1 ? 'Guest' : 'Guests'}</span>
                    </div>

                    <div className={styles.eventTypeContainer}>
                      <span className={styles.eventIcon}>
                        {getEventTypeIcon(reservation.event_type || 'default')}
                      </span>
                      <span className={styles.eventType}>
                        {reservation.event_type?.replace('_', ' ') || 'Standard Reservation'}
                      </span>
                    </div>
                  </div>

                  {reservation.source && reservation.source !== '' && (
                    <div className={styles.sourceBadge}>
                      {reservation.source}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
