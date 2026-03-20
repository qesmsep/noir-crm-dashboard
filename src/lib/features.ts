/**
 * Feature flags for the application
 * Set to false to disable features
 */

export const FEATURES = {
  /**
   * Biometric authentication (Face ID, Touch ID, Windows Hello)
   * Disabled until production issues are resolved
   */
  BIOMETRIC_AUTH: false,
} as const;
