import { useEffect, useRef, DependencyList } from 'react';

/**
 * Custom hook for handling async operations in useEffect with proper cleanup.
 * Prevents state updates on unmounted components and handles race conditions.
 *
 * @param effect - Async function to run
 * @param deps - Dependency array for useEffect
 *
 * @example
 * ```typescript
 * useAsyncEffect(async (isActive) => {
 *   const data = await fetchData();
 *   if (isActive()) {
 *     setData(data);
 *   }
 * }, [dependency]);
 * ```
 */
export function useAsyncEffect(
  effect: (isActive: () => boolean) => Promise<void>,
  deps: DependencyList
): void {
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController>();

  useEffect(() => {
    isMountedRef.current = true;
    abortControllerRef.current = new AbortController();

    const isActive = () => isMountedRef.current && !abortControllerRef.current?.signal.aborted;

    // Run the async effect
    const runEffect = async () => {
      try {
        await effect(isActive);
      } catch (error) {
        // Only log errors if component is still mounted
        if (isActive() && error !== 'AbortError') {
          console.error('Async effect error:', error);
        }
      }
    };

    runEffect();

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, deps);
}

/**
 * Returns an AbortSignal for the current effect lifecycle.
 * Useful for passing to fetch requests or other async operations.
 */
export function useAbortSignal(): AbortSignal | undefined {
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    controllerRef.current = new AbortController();
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return controllerRef.current?.signal;
}