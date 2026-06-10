/**
 * Centralized error handling utility
 * Provides consistent error logging and user feedback
 */

export function handleError(err: unknown, userMessage: string): void {
  console.error(userMessage, err);
  const errorDetail = err instanceof Error ? err.message : 'Unknown error';

  if (process.env.NODE_ENV !== 'production') {
    alert(`${userMessage}\n\nDetails: ${errorDetail}`);
  } else {
    alert(userMessage);
  }
}

export function logError(err: unknown, context: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${context}]`, err);
  }
}
