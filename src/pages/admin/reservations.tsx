import React, { useState, useEffect } from "react";
import { useRouter } from 'next/router';
import AdminLayout from '../../components/layouts/AdminLayout';
import ReservationsTimeline from '../../components/ReservationsTimeline';
import ReservationEditModal from '../../components/ReservationEditModal';
import ReservationModalFixed from '../../components/ReservationModalFixed';
import { useSettings } from '../../context/SettingsContext';
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
  const [reloadKey, setReloadKey] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isFullScreen, setIsFullScreen] = useState(false);

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
      />

      {/* Modal for creating new reservations - Custom portal to document.body */}
      <ReservationModalFixed
        isOpen={isModalOpen}
        onClose={handleModalClose}
        initialDate={selectedSlot?.date}
        initialTableId={selectedSlot?.resourceId}
        onReservationCreated={handleReservationCreated}
      />

      <div className={`${styles.container} ${isFullScreen ? styles.fullScreen : ''}`}>
        <main className={styles.content}>
          <div className={styles.timelineContainer}>
            <ReservationsTimeline
              reloadKey={reloadKey}
              currentDate={currentDate}
              onDateChange={handleDateChange}
              onReservationClick={handleReservationClick}
              onSlotClick={handleSlotClick}
            />
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}
