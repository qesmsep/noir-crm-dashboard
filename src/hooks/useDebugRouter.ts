'use client';

import { useRouter as useNextRouter } from 'next/navigation';

/**
 * Wrapper around Next.js useRouter that adds debugging
 * to help track down router.push undefined errors
 */
export function useDebugRouter() {
  const router = useNextRouter();

  if (!router) {
    console.error('🔴 [useDebugRouter] Router is undefined!');
    throw new Error('Router is undefined');
  }

  const originalPush = router.push.bind(router);
  const originalReplace = router.replace.bind(router);

  return {
    ...router,
    push: (href: string, options?: any) => {
      console.log('[Router] push called with:', { href, options, type: typeof href });

      if (typeof href !== 'string') {
        console.error('🔴 [Router] Invalid href type:', typeof href, href);
        throw new Error(`Router.push received invalid href type: ${typeof href}`);
      }

      if (!href) {
        console.error('🔴 [Router] Empty or undefined href');
        throw new Error('Router.push received empty or undefined href');
      }

      return originalPush(href, options);
    },
    replace: (href: string, options?: any) => {
      console.log('[Router] replace called with:', { href, options, type: typeof href });

      if (typeof href !== 'string') {
        console.error('🔴 [Router] Invalid href type:', typeof href, href);
        throw new Error(`Router.replace received invalid href type: ${typeof href}`);
      }

      if (!href) {
        console.error('🔴 [Router] Empty or undefined href');
        throw new Error('Router.replace received empty or undefined href');
      }

      return originalReplace(href, options);
    },
  };
}
