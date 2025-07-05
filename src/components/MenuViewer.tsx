import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import React, { useState } from 'react';
import Slider from 'react-slick';

const menuImages = [
  '/menu/Noir Menu - 01.png',
  '/menu/Noir Menu - 02.png',
  '/menu/Noir Menu - 03.png',
  '/menu/Noir Menu - 04.png',
  '/menu/Noir Menu - 05.png',
  '/menu/Noir Menu - 06.png',
];

const MenuViewer: React.FC = () => {
  const [loaded, setLoaded] = useState(Array(menuImages.length).fill(false));

  const settings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: true,
    swipe: true,
    adaptiveHeight: true,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          arrows: false,
        },
      },
    ],
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <Slider {...settings} className="w-full max-w-2xl mx-auto">
        {menuImages.map((src, idx) => (
          <div key={src} className="flex items-center justify-center w-full">
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
    </div>
  );
};

export default MenuViewer; 