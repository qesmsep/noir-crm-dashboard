import React, { useState, useEffect } from "react";
import { useRouter } from 'next/router';
import AdminLayout from '../../components/layouts/AdminLayout';
import ReservationsTimeline from '../../components/ReservationsTimeline';
import ReservationEditModal from '../../components/ReservationEditModal';
import ReservationModalFixed from '../../components/ReservationModalFixed';
import SimpleReservationRequestModal from '../../components/member/SimpleReservationRequestModal';
import PrivateEventRSVPModal from '../../components/PrivateEventRSVPModal';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '@/hooks/useToast';
import { debugLog } from '../../utils/debugLogger';
import styles from '../../styles/Reservations.module.css';

/**
 * New Reservations Page
 * 
 * Built from the ground up with proper architecture to avoid
 * z-index, portal, and stacking context issues.
 * 
 * Features:
 * - Timeline view showing reservations across tables
 * - Customizable reservation information display
 * - Real-time updates via Supabase subscriptions
 * - Drag/drop functionality
 * - Touch/mobile optimizations
 * - Proper modal portal handling
 */

export default function Reservations() {
  const router = useRouter();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeLocation, setActiveLocation] = useState<string>(() => {
    // Load from localStorage or default to 'noirkc'
    if (typeof window !== 'undefined') {
      return localStorage.getItem('reservations-location') || 'noirkc';
    }
    return 'noirkc';
  });

  // Member lookup modal state
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Simple reservation modal state (for member reservations)
  const [isSimpleReservationModalOpen, setIsSimpleReservationModalOpen] = useState(false);
  const [memberData, setMemberData] = useState<{
    memberName: string;
    memberPhone: string;
    memberId?: string;
    accountId?: string;
  } | null>(null);

  // Private Event RSVP modal state
  const [isPrivateEventRSVPModalOpen, setIsPrivateEventRSVPModalOpen] = useState(false);
  const [hasPrivateEventsOnDate, setHasPrivateEventsOnDate] = useState(false);

  // Debug: Log component mount and router state
  useEffect(() => {
    debugLog.setup('RESERVATIONS PAGE', 'Component mounted');
    debugLog.setup('RESERVATIONS PAGE', 'Router pathname', { pathname: router.pathname });
    debugLog.setup('RESERVATIONS PAGE', 'Router isReady', { isReady: router.isReady });
    debugLog.setup('RESERVATIONS PAGE', 'Router query', { query: router.query });
    debugLog.setup('RESERVATIONS PAGE', 'Body overflow on mount', { 
      overflow: typeof document !== 'undefined' ? document.body.style.overflow : 'N/A' 
    });
    
    // Check for blocking overlays on mount
    if (typeof document !== 'undefined') {
      const modalPortals = document.querySelectorAll('[data-chakra-modal], [role="dialog"], body > div[id*="portal"], [data-overlay]');
      debugLog.setup('RESERVATIONS PAGE', 'Modal portals on mount', { count: modalPortals.length });
      
      // Check for high z-index overlays
      const allDivs = document.querySelectorAll('body > div');
      const highZIndexDivs = Array.from(allDivs).filter(div => {
        const zIndex = window.getComputedStyle(div).zIndex;
        return zIndex && parseInt(zIndex) > 9999;
      });
      debugLog.setup('RESERVATIONS PAGE', 'High z-index divs on mount', { count: highZIndexDivs.length });
      
      // Check for fixed position elements that might block
      const fixedElements = document.querySelectorAll('[style*="position: fixed"]');
      debugLog.setup('RESERVATIONS PAGE', 'Fixed position elements on mount', { count: fixedElements.length });
    }
    
    return () => {
      debugLog.setup('RESERVATIONS PAGE', 'Component unmounting', {
        pathname: router.pathname,
        timestamp: new Date().toISOString()
      });
    };
  }, []);

  // Edit modal state (for existing reservations)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  // New reservation modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; resourceId: string } | null>(null);

  // Save location preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('reservations-location', activeLocation);
    }
  }, [activeLocation]);

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
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedReservationId(null);
  };

  const handleReservationUpdated = () => {
    setReloadKey(prev => prev + 1);
  };

  const handleSlotClick = (slotInfo: { date: Date; resourceId: string }) => {
    setSelectedSlot(slotInfo);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSlot(null);
  };

  const handleReservationCreated = () => {
    // Modal is already closed, just trigger reload
    setReloadKey(prev => prev + 1);
  };

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleLookupMember = async () => {
    if (!lookupPhone.trim()) {
      toast({
        title: 'Phone Required',
        description: 'Please enter a phone number',
        variant: 'error',
      });
      return;
    }

    setIsLookingUp(true);

    try {
      const response = await fetch(`/api/members?phone=${encodeURIComponent(lookupPhone)}`);
      const data = await response.json();

      if (response.ok && data.members && data.members.length > 0) {
        // Member found
        const member = data.members[0];
        setMemberData({
          memberName: `${member.first_name} ${member.last_name}`,
          memberPhone: member.phone,
          memberId: member.member_id,
          accountId: member.account_id,
        });
        setIsLookupModalOpen(false);
        setIsSimpleReservationModalOpen(true);
        setLookupPhone('');
      } else {
        // Member not found - open with just the phone number
        setMemberData({
          memberName: '',
          memberPhone: lookupPhone,
        });
        setIsLookupModalOpen(false);
        setIsSimpleReservationModalOpen(true);
        setLookupPhone('');
      }
    } catch (error) {
      console.error('Error looking up member:', error);
      toast({
        title: 'Error',
        description: 'Failed to lookup member',
        variant: 'error',
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  // Cleanup: Ensure body scroll is unlocked when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup on unmount - ensure body scroll is unlocked
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, []);

  // Close modals and unlock body scroll when router changes
  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      debugLog.nav('RESERVATIONS PAGE', 'Navigation starting', { url, pathname: router.pathname, query: router.query });
      
      // Close modals FIRST to prevent blocking - this ensures they close before navigation
      debugLog.nav('RESERVATIONS PAGE', 'Closing modals', { editModal: isEditModalOpen, newModal: isModalOpen });
      setIsEditModalOpen(false);
      setIsModalOpen(false);
      setSelectedReservationId(null);
      setSelectedSlot(null);
      
      // Then unlock body scroll - don't manipulate DOM elements during navigation
      if (typeof document !== 'undefined') {
        debugLog.nav('RESERVATIONS PAGE', 'Unlocking body scroll');
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
      }
    };

    const handleRouteChangeComplete = (url: string) => {
      debugLog.info('RESERVATIONS PAGE', 'Navigation completed', { 
        url, 
        currentPath: router.pathname,
        isReady: router.isReady,
        timestamp: new Date().toISOString()
      });
      // Ensure body scroll is unlocked after navigation completes
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        debugLog.info('RESERVATIONS PAGE', 'Body scroll unlocked after navigation', {
          overflow: document.body.style.overflow
        });
      }
    };

    const handleRouteChangeError = (err: Error, url: string) => {
      debugLog.error('RESERVATIONS PAGE', 'Navigation error', err, { url });
      // Ensure body scroll is unlocked even if navigation fails
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        debugLog.error('RESERVATIONS PAGE', 'Body scroll unlocked after error');
      }
    };

    if (router?.events) {
      debugLog.setup('RESERVATIONS PAGE', 'Setting up router event listeners');
      router.events.on('routeChangeStart', handleRouteChangeStart);
      router.events.on('routeChangeComplete', handleRouteChangeComplete);
      router.events.on('routeChangeError', handleRouteChangeError);

      return () => {
        debugLog.setup('RESERVATIONS PAGE', 'Cleaning up router event listeners', {
          pathname: router.pathname,
          timestamp: new Date().toISOString()
        });
        router.events?.off('routeChangeStart', handleRouteChangeStart);
        router.events?.off('routeChangeComplete', handleRouteChangeComplete);
        router.events?.off('routeChangeError', handleRouteChangeError);
        // Final cleanup
        if (typeof document !== 'undefined') {
          document.body.style.overflow = '';
          debugLog.setup('RESERVATIONS PAGE', 'Final cleanup - body scroll unlocked', {
            overflow: document.body.style.overflow
          });
        }
      };
    } else {
      debugLog.warn('RESERVATIONS PAGE', 'Router events not available');
    }
  }, [router, isEditModalOpen, isModalOpen]);

  return (
    <AdminLayout isFullScreen={isFullScreen}>
      {/* Modal for editing existing reservations */}
      <ReservationEditModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        reservationId={selectedReservationId}
        onReservationUpdated={handleReservationUpdated}
        locationSlug={activeLocation}
      />

      {/* Modal for creating new reservations - Custom portal to document.body */}
      <ReservationModalFixed
        isOpen={isModalOpen}
        onClose={handleModalClose}
        initialDate={selectedSlot?.date}
        initialTableId={selectedSlot?.resourceId}
        onReservationCreated={handleReservationCreated}
        locationSlug={activeLocation}
      />

      {/* Private Event RSVP Modal */}
      <PrivateEventRSVPModal
        isOpen={isPrivateEventRSVPModalOpen}
        onClose={() => setIsPrivateEventRSVPModalOpen(false)}
        currentDate={currentDate}
        locationSlug={activeLocation}
        onAssignmentComplete={() => setReloadKey(prev => prev + 1)}
      />

      <div className={`${styles.container} ${isFullScreen ? styles.fullScreen : ''}`}>
        <main className={styles.content}>
          <div className={styles.timelineContainer}>
            {/* Location Switcher */}
            <div className={styles.locationTabs}>
              <button
                className={`${styles.locationTab} ${activeLocation === 'noirkc' ? styles.active : ''}`}
                onClick={() => setActiveLocation('noirkc')}
              >
                Noir KC
              </button>
              <button
                className={`${styles.locationTab} ${activeLocation === 'rooftopkc' ? styles.active : ''}`}
                onClick={() => setActiveLocation('rooftopkc')}
              >
                RooftopKC
              </button>
            </div>

            <ReservationsTimeline
              reloadKey={reloadKey}
              currentDate={currentDate}
              onDateChange={handleDateChange}
              onReservationClick={handleReservationClick}
              onSlotClick={handleSlotClick}
              onMakeReservationClick={() => setIsLookupModalOpen(true)}
              onPrivateEventRSVPClick={hasPrivateEventsOnDate ? () => setIsPrivateEventRSVPModalOpen(true) : undefined}
              onPrivateEventsCheck={(hasEvents) => setHasPrivateEventsOnDate(hasEvents)}
              locationSlug={activeLocation}
            />
          </div>
        </main>
      </div>

      {/* Member Lookup Modal */}
      {isLookupModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => {
            setIsLookupModalOpen(false);
            setLookupPhone('');
          }}
        >
          <div
            style={{
              backgroundColor: '#ECEDE8',
              borderRadius: '16px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
              maxWidth: '400px',
              width: '100%',
              padding: '2rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1F1F1F', marginBottom: '1.5rem' }}>
              Member Lookup
            </h2>
            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type="tel"
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleLookupMember();
                  }
                }}
                placeholder="Phone Number*"
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 1rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  backgroundColor: 'white',
                  outline: 'none',
                }}
              />
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6B7280' }}>
                We'll look up the member and pre-fill their information
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setIsLookupModalOpen(false);
                  setLookupPhone('');
                }}
                style={{
                  flex: 1,
                  height: '44px',
                  backgroundColor: '#ffffff',
                  color: '#1F1F1F',
                  border: '1px solid #D1D5DB',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLookupMember}
                disabled={isLookingUp}
                style={{
                  flex: 1,
                  height: '44px',
                  backgroundColor: isLookingUp ? '#D1D5DB' : '#A59480',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: isLookingUp ? 'not-allowed' : 'pointer',
                }}
              >
                {isLookingUp ? 'Looking up...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simple Reservation Modal */}
      <SimpleReservationRequestModal
        isOpen={isSimpleReservationModalOpen}
        onClose={() => {
          setIsSimpleReservationModalOpen(false);
          setMemberData(null);
        }}
        memberName={memberData?.memberName || ''}
        memberPhone={memberData?.memberPhone || ''}
        memberId={memberData?.memberId}
        accountId={memberData?.accountId}
        adminOverride={true}
        onReservationCreated={() => {
          setIsSimpleReservationModalOpen(false);
          setMemberData(null);
          handleReservationCreated();
        }}
        locationSlug={activeLocation}
      />
    </AdminLayout>
  );
}
