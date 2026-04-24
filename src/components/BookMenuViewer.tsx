'use client';

import React, { useState, useRef, useEffect } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './BookMenuViewer.module.css';

interface BookMenuViewerProps {
  className?: string;
  locationSlug?: string;
}

const BookMenuViewer: React.FC<BookMenuViewerProps> = ({ className = '', locationSlug }) => {
  const [menuImages, setMenuImages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const bookRef = useRef<any>(null);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Fetch all images from the menu directory
    const fetchMenuImages = async () => {
      try {
        const locationParam = locationSlug ? `?location=${locationSlug}` : '';
        const response = await fetch(`/api/admin/menu-files${locationParam}`);
        if (response.ok) {
          const files = await response.json();
          const imagePaths = files.map((file: any) => file.path);
          setMenuImages(imagePaths);
        } else {
          // Fallback to hardcoded list if API fails
          const fallbackImages = locationSlug === 'rooftopkc'
            ? [
                '/menu/rooftopkc/RooftopKC Menu - 01.png',
                '/menu/rooftopkc/RooftopKC Menu - 02.png',
                '/menu/rooftopkc/RooftopKC Menu - 03.png',
              ]
            : [
                '/menu/Noir Menu - 01.png',
                '/menu/Noir Menu - 02.png',
                '/menu/Noir Menu - 03.png',
                '/menu/Noir Menu - 04.png',
                '/menu/Noir Menu - 05.png',
                '/menu/Noir Menu - 06.png',
              ];
          setMenuImages(fallbackImages);
        }
      } catch (error) {
        console.error('Error fetching menu images:', error);
        // Fallback to hardcoded list
        const fallbackImages = locationSlug === 'rooftopkc'
          ? [
              '/menu/rooftopkc/RooftopKC Menu - 01.png',
              '/menu/rooftopkc/RooftopKC Menu - 02.png',
              '/menu/rooftopkc/RooftopKC Menu - 03.png',
            ]
          : [
              '/menu/Noir Menu - 01.png',
              '/menu/Noir Menu - 02.png',
              '/menu/Noir Menu - 03.png',
              '/menu/Noir Menu - 04.png',
              '/menu/Noir Menu - 05.png',
              '/menu/Noir Menu - 06.png',
            ];
        setMenuImages(fallbackImages);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMenuImages();
  }, [locationSlug]);

  const nextPage = () => {
    if (bookRef.current) {
      // Mobile: skip page 2 (index 1)
      if (isMobile && currentPage === 0) {
        bookRef.current.pageFlip().flip(2); // Jump to page 3 (index 2)
      } else if (!isMobile && currentPage === 0) {
        // Desktop: On cover page, shift to 0 first, then flip
        setCurrentPage(0.5); // Trigger shift animation to 0
        setTimeout(() => {
          bookRef.current.pageFlip().flipNext();
        }, 700); // Wait for 700ms shift transition, then flip
      } else {
        bookRef.current.pageFlip().flipNext();
      }
    }
  };

  const prevPage = () => {
    if (bookRef.current) {
      // Mobile: skip page 2 (index 1) when going back
      if (isMobile && currentPage === 2) {
        bookRef.current.pageFlip().flip(0); // Jump to page 1 (index 0)
      } else {
        bookRef.current.pageFlip().flipPrev();
      }
    }
  };

  const onFlip = (e: any) => {
    setCurrentPage(e.data);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        nextPage();
      } else if (e.key === 'ArrowLeft') {
        prevPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, isMobile]);

  if (isLoading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-[#23201C] rounded-2xl">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[#BCA892] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[#ECEDE8] text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Loading menu...
          </p>
        </div>
      </div>
    );
  }

  if (menuImages.length === 0) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-[#23201C] rounded-2xl">
        <p className="text-[#ECEDE8] text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          No menu pages available
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full flex flex-col items-center justify-center ${className}`}>
      {/* Book Container with Spotlight Effect */}
      <div className="relative w-full max-w-6xl mx-auto flex items-center justify-center">
        {/* Spotlight gradient background */}
        <div
          className="absolute inset-0 rounded-3xl"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(165, 148, 128, 0.08) 0%, rgba(26, 26, 26, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Navigation Button - Left */}
        {currentPage > 0 && (
          <button
            onClick={prevPage}
            className="absolute left-0 sm:left-4 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#353535] hover:bg-[#BCA892] border-2 border-[#BCA892] text-[#ECEDE8] hover:text-[#23201C] transition-all duration-300 flex items-center justify-center shadow-xl"
            style={{
              boxShadow: '0 4px 14px 0 rgba(165, 148, 128, 0.2), 0 2px 8px 0 rgba(0, 0, 0, 0.4)',
            }}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}

        {/* The Book */}
        <div
          className={isMobile ? "relative w-full flex justify-center" : "relative transition-all duration-700 ease-out"}
          style={{
            // Mobile: Always centered
            // Desktop: Cover page (0) shift left -200px, then shifts to 0 before flip
            transform: isMobile ? 'translateX(0)' : (currentPage === 0 ? 'translateX(-200px)' : 'translateX(0)'),
          }}
        >
          <HTMLFlipBook
            ref={bookRef}
            width={825}
            height={1275}
            size="stretch"
            minWidth={412}
            maxWidth={1650}
            minHeight={637}
            maxHeight={2550}
            drawShadow={true}
            flippingTime={800}
            usePortrait={isMobile}
            startZIndex={0}
            autoSize={true}
            maxShadowOpacity={0.5}
            showCover={true}
            mobileScrollSupport={true}
            onFlip={onFlip}
            className={styles.bookContainer}
            style={{}}
            startPage={0}
            clickEventForward={true}
            useMouseEvents={true}
            swipeDistance={30}
            showPageCorners={true}
            disableFlipByClick={false}
          >
            {menuImages.map((src, idx) => (
              <div key={idx} className={styles.page} data-density="hard">
                <div className={`${styles.pageContent} bg-[#ECEDE8] overflow-hidden`}>
                  <img
                    src={src}
                    alt={`Menu page ${idx + 1}`}
                    className="w-full h-full object-cover"
                    style={{
                      boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
              </div>
            ))}
          </HTMLFlipBook>
        </div>

        {/* Navigation Button - Right */}
        {currentPage < menuImages.length - 1 && (
          <button
            onClick={nextPage}
            className="absolute right-0 sm:right-4 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#353535] hover:bg-[#BCA892] border-2 border-[#BCA892] text-[#ECEDE8] hover:text-[#23201C] transition-all duration-300 flex items-center justify-center shadow-xl"
            style={{
              boxShadow: '0 4px 14px 0 rgba(165, 148, 128, 0.2), 0 2px 8px 0 rgba(0, 0, 0, 0.4)',
            }}
            aria-label="Next page"
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}
      </div>

      {/* Controls Footer */}
      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 w-full max-w-4xl">
        {/* Page Counter */}
        <div
          className="text-[#ECEDE8] text-base sm:text-lg text-center"
          style={{
            fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif',
            letterSpacing: '0.08em',
          }}
        >
          Page <span className="text-[#BCA892] font-semibold">{currentPage + 1}</span> of{' '}
          <span className="text-[#BCA892] font-semibold">{menuImages.length}</span>
        </div>

        {/* Page Dots */}
        <div className="hidden sm:flex gap-2">
          {menuImages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => bookRef.current?.pageFlip().flip(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === currentPage
                  ? 'bg-[#BCA892] w-8'
                  : 'bg-[#ECEDE8] opacity-40 hover:opacity-60'
              }`}
              aria-label={`Go to page ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Helpful Instructions */}
      <div
        className="mt-4 text-[#BCA892] text-xs sm:text-sm text-center opacity-60"
        style={{ fontFamily: 'Montserrat, sans-serif' }}
      >
        <span className="hidden sm:inline">Click edges or use arrow keys to turn pages • </span>
        Swipe on mobile • Click page dots to jump
      </div>
    </div>
  );
};

export default BookMenuViewer;
