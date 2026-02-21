'use client';

import React, { useState, useRef, useEffect } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

interface BookMenuViewerProps {
  className?: string;
}

const BookMenuViewer: React.FC<BookMenuViewerProps> = ({ className = '' }) => {
  const [menuImages, setMenuImages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const bookRef = useRef<any>(null);

  useEffect(() => {
    // Fetch all images from the menu directory
    const fetchMenuImages = async () => {
      try {
        const response = await fetch('/api/admin/menu-files');
        if (response.ok) {
          const files = await response.json();
          const imagePaths = files.map((file: any) => file.path);
          setMenuImages(imagePaths);
        } else {
          // Fallback to hardcoded list if API fails
          const fallbackImages = [
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
        const fallbackImages = [
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
  }, []);

  const nextPage = () => {
    if (bookRef.current) {
      bookRef.current.pageFlip().flipNext();
    }
  };

  const prevPage = () => {
    if (bookRef.current) {
      bookRef.current.pageFlip().flipPrev();
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
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
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

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

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-[9999] bg-[#1A1A1A] flex flex-col items-center justify-center p-4 sm:p-8'
    : `w-full flex flex-col items-center justify-center ${className}`;

  return (
    <div className={containerClass}>
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
        <div className="relative">
          <HTMLFlipBook
            ref={bookRef}
            width={550}
            height={733}
            size="stretch"
            minWidth={315}
            maxWidth={1000}
            minHeight={420}
            maxHeight={1533}
            drawShadow={true}
            flippingTime={800}
            usePortrait={true}
            startZIndex={0}
            autoSize={true}
            maxShadowOpacity={0.5}
            showCover={true}
            mobileScrollSupport={true}
            onFlip={onFlip}
            className="book-container"
            style={{}}
            startPage={0}
            clickEventForward={true}
            useMouseEvents={true}
            swipeDistance={30}
            showPageCorners={true}
            disableFlipByClick={false}
          >
            {menuImages.map((src, idx) => (
              <div key={idx} className="page" data-density="hard">
                <div className="page-content bg-[#ECEDE8] rounded-lg overflow-hidden">
                  <img
                    src={src}
                    alt={`Menu page ${idx + 1}`}
                    className="w-full h-full object-cover"
                    style={{
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(0, 0, 0, 0.1)',
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
      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 w-full max-w-4xl">
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
        <div className="flex gap-2">
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

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#353535] hover:bg-[#BCA892] border border-[#BCA892] text-[#ECEDE8] hover:text-[#23201C] transition-all duration-300 text-sm"
          style={{ fontFamily: 'Montserrat, sans-serif' }}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Exit</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Fullscreen</span>
            </>
          )}
        </button>
      </div>

      {/* Helpful Instructions */}
      <div
        className="mt-4 text-[#BCA892] text-xs sm:text-sm text-center opacity-60"
        style={{ fontFamily: 'Montserrat, sans-serif' }}
      >
        <span className="hidden sm:inline">Click edges or use arrow keys to turn pages • </span>
        Swipe on mobile • Click page dots to jump
      </div>

      {/* Custom Styles */}
      <style jsx global>{`
        .page {
          background: white;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .page-content {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .book-container {
          margin: 0 auto;
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .page {
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
          }
        }

        /* Smooth page flip animations */
        .stf__wrapper {
          transition: transform 0.8s cubic-bezier(0.645, 0.045, 0.355, 1);
        }
      `}</style>
    </div>
  );
};

export default BookMenuViewer;
