import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import React, { useState, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import Slider from 'react-slick';

function Arrow({ direction, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`z-50 absolute top-1/2 ${direction === 'left' ? 'left-[15px]' : 'right-[15px]'}  border-2  text-[#ECEDE8] w-14 h-14 rounded-full flex items-center justify-center focus:outline-none`}
      style={{ border: '0px solid #ECEDE8', boxShadow: 'none', transform: 'translateY(-50%)', transition: 'none' }}
      aria-label={direction === 'left' ? 'Previous menu page' : 'Next menu page'}
    >
      {direction === 'left' ? (
        <svg width="36" height="36" fill="none" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke="#ECEDE8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
      ) : (
        <svg width="36" height="36" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="#ECEDE8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
      )}
    </button>
  );
}

const MenuViewer: React.FC = () => {
  const [menuImages, setMenuImages] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<boolean[]>([]);
  const sliderRef = useRef<Slider>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    // Fetch all images from the menu directory
    const fetchMenuImages = async () => {
      try {
        const response = await fetch('/api/menu-images');
        if (response.ok) {
          const images = await response.json();
          setMenuImages(images);
          setLoaded(Array(images.length).fill(false));
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
          setLoaded(Array(fallbackImages.length).fill(false));
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
        setLoaded(Array(fallbackImages.length).fill(false));
      }
    };

    fetchMenuImages();
  }, []);

  const settings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: false,
    swipe: true,
    adaptiveHeight: true,
    beforeChange: (oldIndex, newIndex) => setCurrent(newIndex),
    customPaging: i => <button className="w-2 h-2 rounded-full bg-[#ECEDE8] opacity-60 mx-1" />,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          arrows: false,
        },
      },
    ],
  };

  // Show loading state while fetching images
  if (menuImages.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center relative">
        <div className="text-[#ECEDE8] text-lg">Loading menu...</div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center relative">
      <Slider ref={sliderRef} {...settings} className="w-full max-w-2xl mx-auto">
        {menuImages.map((src, idx) => (
          <div key={src} className="flex items-center justify-center w-full relative">
            <img
              src={src}
              alt={`Noir Menu Page ${idx + 1}`}
              onLoad={() => setLoaded(l => { const arr = [...l]; arr[idx] = true; return arr; })}
              className={`w-full h-auto max-h-[80vh] object-contain rounded-lg shadow-lg mx-auto transition-opacity duration-700 ease-in-out ${loaded[idx] ? 'opacity-100' : 'opacity-0'}`}
              style={{ background: '#23201C', minHeight: 80 }}
            />
          </div>
        ))}
      </Slider>
      {current > 0 && (
        <Arrow direction="left" onClick={() => sliderRef.current?.slickPrev()} />
      )}
      {current < menuImages.length - 1 && (
        <Arrow direction="right" onClick={() => sliderRef.current?.slickNext()} />
      )}
    </div>
  );
};

export default MenuViewer; 