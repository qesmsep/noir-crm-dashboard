'use client';

import { useState, useCallback } from 'react';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'destructive';
}

// Simple toast hook - for now just using console.log
// Can be enhanced later with a proper toast provider
export function useToast() {
  const toast = useCallback((options: ToastOptions) => {
    console.log('[Toast]', options.title, options.description);

    // For destructive/error, also use console.error
    if (options.variant === 'destructive' || options.variant === 'error') {
      console.error('[Toast Error]', options.title, options.description);
    }
  }, []);

  return { toast };
}
