import { supabaseAdmin } from './supabase';

/**
 * Lightweight monitoring/telemetry helper.
 *
 * Writes events and errors to the `monitoring_events` and `monitoring_errors`
 * tables (see migrations/20260607_add_monitoring_tables_IMPROVED.sql). All
 * writes use the service-role client and are best-effort: failures are logged
 * but never thrown, so monitoring can never break the calling request.
 */
class Monitoring {
  /**
   * Record an application event.
   *
   * @param eventType A short identifier, e.g. 'inventory_transfer_completed'.
   * @param eventData Arbitrary JSON-serializable metadata about the event.
   */
  async trackEvent(
    eventType: string,
    eventData: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('monitoring_events')
        .insert({ event_type: eventType, event_data: eventData });

      if (error) {
        console.error('Failed to record monitoring event:', error.message);
      }
    } catch (err) {
      // Never let monitoring failures surface to the caller.
      console.error('Unexpected error recording monitoring event:', err);
    }
  }

  /**
   * Record an error with optional context.
   *
   * @param error The error to record.
   * @param context Additional JSON-serializable context (avoid raw user input).
   */
  async trackError(
    error: Error,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      // Truncate stack trace to first 5 lines to avoid storing full file paths
      // and internal server structure details
      const truncatedStack = error.stack
        ? error.stack.split('\n').slice(0, 5).join('\n')
        : null;

      const { error: insertError } = await supabaseAdmin
        .from('monitoring_errors')
        .insert({
          error_type: error.name || 'Error',
          error_message: error.message,
          error_stack: truncatedStack,
          context_data: context,
        });

      if (insertError) {
        console.error('Failed to record monitoring error:', insertError.message);
      }
    } catch (err) {
      console.error('Unexpected error recording monitoring error:', err);
    }
  }
}

export const monitoring = new Monitoring();
