"use client";

import { useEffect } from 'react';

export default function ViewportHeightProvider() {
  useEffect(() => {
    function setVH() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    setVH();

    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', () => setTimeout(setVH, 100));
    if ('visualViewport' in window) {
      // @ts-ignore
      window.visualViewport.addEventListener('resize', setVH);
    }

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', () => setTimeout(setVH, 100));
      if ('visualViewport' in window) {
        // @ts-ignore
        window.visualViewport.removeEventListener('resize', setVH);
      }
    };
  }, []);

  return null;
}


