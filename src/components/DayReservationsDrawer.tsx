import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { ChevronRight } from 'lucide-react';
import { formatDateTime } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import styles from '../styles/ReservationsMobile.module.css';

interface DayReservationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onReservationClick: (reservationId: string) => void;
  onDateChange?: (date: Date) => void;
}

const eventTypeEmojis: Record<string, string> = {
  birthday: '🎂',
  engagement: '💍',
  anniversary: '🥂',
  party: '🎉',
  graduation: '🎓',
  corporate: '🧑‍💼',
  holiday: '❄️',
  networking: '🤝',
  fundraiser: '🎗️',
  bachelor: '🥳',
  bachelorette: '🥳',
  private_event: '🔒',
  fun: '🍸',
  date: '💕',
};

const DayReservationsDrawer: React.FC<DayReservationsDrawerProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onReservationClick,
  onDateChange,
}) => {
  const [reservations, setReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && selectedDate) {
      fetchDayReservations();
    }
  }, [isOpen, selectedDate]);

  const fetchDayReservations = async () => {
    if (!selectedDate) return;
    
    setIsLoading(true);
    try {
      // Create start and end of day in CST
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          tables (
            id,
            table_number,
            seats
          )
        `)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        throw error;
      }

      setReservations(data || []);
    } catch (error) {
      console.error('Error fetching day reservations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reservations for this day',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return formatDateTime(date, undefined, { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return formatDateTime(date, undefined, { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getEventTypeEmoji = (eventType: string) => {
    return eventTypeEmojis[eventType?.toLowerCase()] || '';
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    if (!selectedDate || !onDateChange) return;
    
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setDate(selectedDate.getDate() - 1);
    } else {
      newDate.setDate(selectedDate.getDate() + 1);
    }
    
    onDateChange(newDate);
  };

  const getEventTypeIcon = (eventType: string) => {
    const icons: Record<string, string> = {
      birthday: '🎂',
      engagement: '💍',
      anniversary: '🥂',
      party: '🎉',
      graduation: '🎓',
      corporate: '🧑‍💼',
      holiday: '❄️',
      networking: '🤝',
      fundraiser: '🎗️',
      bachelor: '🥳',
      bachelorette: '🥳',
      private_event: '🔒',
      fun: '🍸',
      date: '💕',
    };
    return icons[eventType] || '📅';
  };

  const formatDateLong = (date: Date) => {
    return formatDateTime(date, undefined, { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Check if it's mobile (screen width < 768px)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobile view
  if (isMobile) {
    return (
      <>
        {/* Mobile overlay */}
        {isOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1999,
            }}
            onClick={onClose}
          />
        )}
        
        {/* Mobile content */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#f8f9fa',
            zIndex: 2000,
            transform: `translateX(${isOpen ? '0' : '100%'})`,
            transition: 'transform 0.3s ease-in-out',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div 
            className={styles.mobileContainer}
            style={{
              flex: 1,
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div className={styles.mobileHeader}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h1 className={styles.mobileTitle}>
                  Day Reservations
                </h1>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '8px',
                  }}
                >
                  ✕
                </button>
              </div>
              
              {/* Date Navigation */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '16px',
                padding: '12px 16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <button
                  onClick={() => navigateDay('prev')}
                  style={{
                    background: '#a59480',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'Montserrat, sans-serif',
                  }}
                >
                  ← Previous
                </button>
                
                <div style={{ textAlign: 'center', flex: 1, margin: '0 16px' }}>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    color: '#353535',
                    fontFamily: 'Montserrat, sans-serif'
                  }}>
                    {selectedDate ? formatDateLong(selectedDate) : 'Select a Date'}
                  </div>
                </div>
                
                <button
                  onClick={() => navigateDay('next')}
                  style={{
                    background: '#a59480',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'Montserrat, sans-serif',
                  }}
                >
                  Next →
                </button>
              </div>
              
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div className={styles.mobileStatCard} style={{ display: 'inline-block', minWidth: '120px' }}>
                  <div className={styles.mobileStatNumber}>{reservations.length}</div>
                  <div className={styles.mobileStatLabel}>
                    Reservation{reservations.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.mobileReservationsContainer}>
              {isLoading ? (
                <div className={styles.mobileLoading}>
                  <div className={styles.mobileLoadingSpinner}></div>
                </div>
              ) : reservations.length === 0 ? (
                <div className={styles.mobileEmpty}>
                  <div className={styles.mobileEmptyIcon}>📅</div>
                  No reservations for this day
                  <div style={{ fontSize: '14px', color: '#9ca3af', marginTop: '8px' }}>
                    Select a different date or create a new reservation
                  </div>
                </div>
              ) : (
                reservations.map((reservation) => {
                  const emoji = getEventTypeIcon(reservation.event_type);
                  const tableNumber = reservation.tables?.table_number || 'TBD';
                  
                  return (
                    <div 
                      key={reservation.id} 
                      className={styles.mobileReservationCard}
                      onClick={() => onReservationClick(reservation.id)}
                    >
                      <div className={styles.mobileReservationHeader}>
                        <div className={styles.mobileReservationName}>
                          {reservation.first_name} {reservation.last_name}
                          {reservation.membership_type === 'member' && ' 🖤'}
                        </div>
                        <div className={styles.mobileReservationHeaderInfo}>
                          <div className={styles.mobileReservationTime}>
                            {formatTime(reservation.start_time)}
                          </div>
                        </div>
                      </div>

                      <div className={styles.mobileReservationInfo}>
                        <div className={styles.mobileInfoGrid}>
                          <div className={styles.mobileInfoItem}>
                            <span className={styles.mobileInfoIcon}>🪑</span>
                            <span className={styles.mobileInfoText}>
                              Table {tableNumber}
                            </span>
                          </div>
                          <div className={styles.mobileInfoItem}>
                            <span className={styles.mobileInfoIcon}>👥</span>
                            <span className={styles.mobileInfoText}>
                              {reservation.party_size} {reservation.party_size === 1 ? 'Guest' : 'Guests'}
                            </span>
                          </div>
                          
                          <div className={styles.mobileEventTypeContainer}>
                            <span className={styles.mobileEventIcon}>
                              {emoji}
                            </span>
                            <span className={styles.mobileEventType}>
                              {reservation.event_type?.replace('_', ' ') || 'Standard Reservation'}
                            </span>
                          </div>
                        </div>
                        
                        {reservation.source && reservation.source !== '' && (
                          <div className={styles.mobileSourceBadge}>
                            {reservation.source}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Desktop view (original)
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="left"
        className="w-[350px] max-w-[50vw] bg-[#ecede8] border-2 border-[#353535] rounded-[10px] shadow-xl mt-20 mb-6 px-10 py-0 font-montserrat z-[2000]"
      >
        <SheetHeader className="border-b border-[#A59480] pb-4 pt-0">
          <SheetTitle className="text-left">
            <div className="flex flex-col gap-0">
              <div className="text-lg font-ivyjournal text-[#353535]">
                {selectedDate ? formatDate(selectedDate) : 'Select a Date'}
              </div>
              <div className="text-[18px] text-[#A59480] font-montserrat font-normal">
                {reservations.length} reservation{reservations.length !== 1 ? 's' : ''}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 overflow-y-auto drawer-body-content flex-1">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Spinner className="w-12 h-12 text-[#353535]" />
            </div>
          ) : reservations.length === 0 ? (
            <div className="flex flex-col justify-center items-center w-full h-[200px] text-center p-6">
              <p className="text-lg text-[#353535] font-montserrat">
                No reservations for this day
              </p>
              <p className="text-sm text-[#666] mt-2 font-montserrat">
                Select a different date or create a new reservation
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {reservations.map((reservation, index) => {
                const heart = reservation.membership_type === 'member' ? '🖤 ' : '';
                const emoji = getEventTypeEmoji(reservation.event_type);
                const tableNumber = reservation.tables?.table_number || 'N/A';

                return (
                  <div key={reservation.id}>
                    <button
                      className="w-full p-4 bg-transparent hover:bg-[rgba(165,148,128,0.1)] active:bg-[rgba(165,148,128,0.2)] rounded-none border-b border-[rgba(165,148,128,0.2)] flex flex-col items-stretch text-left font-montserrat transition-colors"
                      onClick={() => onReservationClick(reservation.id)}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className="flex flex-col items-start gap-1 flex-1">
                          <div className="flex items-center gap-2 m-0 flex-wrap">
                            <span className="text-sm font-bold text-[#353535] font-montserrat">
                              {formatTime(reservation.start_time)}
                            </span>
                            <Badge
                              variant={reservation.membership_type === 'member' ? 'default' : 'secondary'}
                              className="text-xs font-montserrat"
                            >
                              {reservation.membership_type === 'member' ? '🖤' : 'Guest'}
                            </Badge>
                            <span className="text-base font-semibold text-[#353535] font-montserrat leading-tight">
                              {reservation.first_name} {reservation.last_name}
                            </span>
                            <span className="text-sm text-[#666] font-montserrat">
                              Party of {reservation.party_size}
                            </span>
                            <Badge variant="outline" className="text-xs font-montserrat">
                              {(reservation.source && reservation.source !== '') ? reservation.source : 'unknown'}
                            </Badge>
                            <span className="text-sm text-[#666] font-montserrat">
                              Table {tableNumber}
                            </span>
                            {emoji && (
                              <span className="text-sm">{emoji}</span>
                            )}
                          </div>

                          {reservation.event_type && (
                            <p className="text-xs text-[#A59480] font-montserrat capitalize">
                              {reservation.event_type.replace('_', ' ')}
                            </p>
                          )}
                        </div>

                        <ChevronRight className="text-[#A59480]" size={20} />
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-[#A59480] justify-center drawer-footer-content pt-4">
          <Button
            onClick={onClose}
            variant="outline"
            size="default"
            className="font-montserrat font-semibold text-[#353535] border-[#353535] hover:bg-[rgba(53,53,53,0.1)]"
          >
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default DayReservationsDrawer; 