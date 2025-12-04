/**
 * Mobile Utility Functions
 * Helper functions for mobile-specific functionality
 */

/**
 * Detect if user is on a mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Detect if user is on iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;

  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Detect if user is on Android
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;

  return /Android/i.test(navigator.userAgent);
}

/**
 * Get safe viewport height (accounts for iOS Safari address bar)
 */
export function getSafeViewportHeight(): number {
  if (typeof window === 'undefined') return 0;

  // Use visualViewport if available (more accurate on mobile)
  if (window.visualViewport) {
    return window.visualViewport.height;
  }

  return window.innerHeight;
}

/**
 * Get device pixel ratio
 */
export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;

  return window.devicePixelRatio || 1;
}

/**
 * Check if device has touch capability
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}

/**
 * Get current viewport width category
 */
export function getViewportCategory(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;

  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Check if viewport is in portrait orientation
 */
export function isPortrait(): boolean {
  if (typeof window === 'undefined') return true;

  return window.innerHeight > window.innerWidth;
}

/**
 * Get safe area insets (for notched devices like iPhone X+)
 */
export function getSafeAreaInsets() {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const computed = getComputedStyle(document.documentElement);

  return {
    top: parseInt(computed.getPropertyValue('--sat') || '0') || 0,
    right: parseInt(computed.getPropertyValue('--sar') || '0') || 0,
    bottom: parseInt(computed.getPropertyValue('--sab') || '0') || 0,
    left: parseInt(computed.getPropertyValue('--sal') || '0') || 0,
  };
}

/**
 * Prevent body scroll (useful for modals on mobile)
 */
export function preventBodyScroll(prevent: boolean = true): void {
  if (typeof document === 'undefined') return;

  if (prevent) {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  } else {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }
}

/**
 * Vibrate device (if supported)
 */
export function vibrate(pattern: number | number[] = 200): boolean {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return false;

  return navigator.vibrate(pattern);
}

/**
 * Check if running as PWA
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Get connection quality
 */
export function getConnectionQuality(): 'slow' | 'good' | 'fast' | 'unknown' {
  if (typeof navigator === 'undefined' || !(navigator as any).connection) {
    return 'unknown';
  }

  const connection = (navigator as any).connection;
  const effectiveType = connection.effectiveType;

  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
  if (effectiveType === '3g') return 'good';
  if (effectiveType === '4g') return 'fast';

  return 'unknown';
}

/**
 * Format bytes for mobile display
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Detect if keyboard is visible (approximate)
 * Note: This is not 100% reliable across all devices
 */
export function isKeyboardVisible(): boolean {
  if (typeof window === 'undefined') return false;

  // On mobile, if viewport height is significantly smaller than window height,
  // keyboard is likely visible
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const windowHeight = window.innerHeight;

  // If viewport is more than 25% smaller, assume keyboard is up
  return viewportHeight < windowHeight * 0.75;
}

/**
 * Smooth scroll to element (mobile-safe)
 */
export function scrollToElement(
  element: HTMLElement | string,
  options?: ScrollIntoViewOptions
): void {
  if (typeof document === 'undefined') return;

  const target = typeof element === 'string'
    ? document.querySelector(element) as HTMLElement
    : element;

  if (!target) return;

  const defaultOptions: ScrollIntoViewOptions = {
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  };

  target.scrollIntoView({ ...defaultOptions, ...options });
}

/**
 * Add viewport height CSS variable (for 100vh mobile fix)
 */
export function setViewportHeightVariable(): void {
  if (typeof window === 'undefined') return;

  const setHeight = () => {
    const vh = getSafeViewportHeight() * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  setHeight();

  window.addEventListener('resize', setHeight);
  window.addEventListener('orientationchange', setHeight);

  // For iOS Safari address bar
  if (isIOS()) {
    window.addEventListener('scroll', setHeight, { passive: true });
  }
}

/**
 * Debounce function for resize/scroll events on mobile
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 150
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for frequent events on mobile
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number = 150
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Haptic feedback for mobile interactions
 */
export const haptic = {
  light: () => vibrate(10),
  medium: () => vibrate(20),
  heavy: () => vibrate(30),
  success: () => vibrate([10, 50, 10]),
  error: () => vibrate([20, 50, 20]),
  warning: () => vibrate([10, 30, 10, 30, 10]),
};

/**
 * Mobile-optimized image loading
 */
export function getOptimizedImageSrc(
  baseSrc: string,
  options?: {
    width?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  }
): string {
  // This is a placeholder - implement based on your image optimization service
  // (e.g., Cloudinary, Imgix, Next.js Image Optimization)

  const { width, quality = 80, format = 'webp' } = options || {};

  // Example: If using a CDN with query parameters
  const params = new URLSearchParams();
  if (width) params.append('w', width.toString());
  params.append('q', quality.toString());
  params.append('f', format);

  return `${baseSrc}?${params.toString()}`;
}

/**
 * Check if user prefers reduced motion (accessibility)
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get user's preferred color scheme
 */
export function getPreferredColorScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
