"use client";

import { useEffect } from 'react';

export default function ViewportHeightProvider() {
  useEffect(() => {
    function setVH() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    const handleOrientationChange = () => setTimeout(setVH, 100);

    setVH();

    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', handleOrientationChange);
    if ('visualViewport' in window) {
      // @ts-ignore
      window.visualViewport.addEventListener('resize', setVH);
    }

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if ('visualViewport' in window) {
        // @ts-ignore
        window.visualViewport.removeEventListener('resize', setVH);
      }
    };
  }, []);

  return null;
}


