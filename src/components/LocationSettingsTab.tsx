import React from 'react';
import CalendarAvailabilityControl from './CalendarAvailabilityControl';
import styles from '../styles/Settings.module.css';

// Constants
const DURATION_MIN = 0.5;
const DURATION_MAX = 8;
const DURATION_STEP = 0.5;
const DURATION_DEFAULT = 2.0;
const COVER_PRICE_MIN = 0;
const COVER_PRICE_MAX = 100;
const TIMEZONE = 'America/Chicago';

interface LocationSettingsTabProps {
  locationSlug: 'noirkc' | 'rooftopkc';
  locationName: string;
  coverEnabled: boolean;
  setCoverEnabled: (enabled: boolean) => void;
  coverPrice: number;
  setCoverPrice: (price: number) => void;
  minakaUrl: string;
  setMinakaUrl: (url: string) => void;
  duration: number;
  setDuration: (duration: number) => void;
  adminPhone: string;
  setAdminPhone: (phone: string) => void;
  saving: boolean;
  message: { type: 'success' | 'error'; text: string } | null;
  onSave: () => void;
}

const LocationSettingsTab: React.FC<LocationSettingsTabProps> = ({
  locationSlug,
  locationName,
  coverEnabled,
  setCoverEnabled,
  coverPrice,
  setCoverPrice,
  minakaUrl,
  setMinakaUrl,
  duration,
  setDuration,
  adminPhone,
  setAdminPhone,
  saving,
  message,
  onSave,
}) => {
  // Validation helpers
  const isValidUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  };

  const isValidPhone = (phone: string): boolean => {
    if (!phone) return true; // Empty is valid
    // Basic validation: 10 digits
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  return (
    <div className={styles.sections}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{locationName} - Location Settings</h2>
        <p className={styles.cardDescription}>
          Configure location-specific settings for {locationName} including booking windows, hours, and cover charges.
        </p>

        {/* Single message display at top */}
        {message && (
          <div className={`${styles.message} ${styles[message.type]}`} style={{ marginTop: '1rem' }}>
            {message.text}
          </div>
        )}
      </div>

      {/* Hours & Booking Configuration */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Hours & Booking Configuration</h2>
        <p className={styles.inputHint} style={{ marginBottom: '1.5rem' }}>
          Configure reservation availability, operating hours, and booking window for {locationName}.
        </p>

        {/* Booking Window and Default Reservation Duration */}
        <div className={styles.locationSettingsRow}>
          {/* Booking Window */}
          <div className={styles.locationSettingsColumn}>
            <h3 className={styles.subsectionTitle}>Booking Window</h3>
            <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Reservations can be made within this date range.
            </p>
            <CalendarAvailabilityControl section="booking_window" locationSlug={locationSlug} />
          </div>

          {/* Default Reservation Duration */}
          <div className={styles.locationSettingsDurationColumn}>
            <h3 className={styles.subsectionTitle}>Default Reservation Duration</h3>
            <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Default length of time for reservations.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor={`duration-${locationSlug}`}>
                Duration (hours)
              </label>
              <div className={styles.numberInput}>
                <button
                  type="button"
                  onClick={() => setDuration(Math.max(DURATION_MIN, duration - DURATION_STEP))}
                  className={styles.numberButton}
                  aria-label="Decrease duration"
                >
                  −
                </button>
                <input
                  id={`duration-${locationSlug}`}
                  type="number"
                  className={styles.numberInputField}
                  value={duration}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || DURATION_DEFAULT;
                    setDuration(Math.max(DURATION_MIN, Math.min(DURATION_MAX, value)));
                  }}
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  step={DURATION_STEP}
                  aria-valuemin={DURATION_MIN}
                  aria-valuemax={DURATION_MAX}
                />
                <button
                  type="button"
                  onClick={() => setDuration(Math.min(DURATION_MAX, duration + DURATION_STEP))}
                  className={styles.numberButton}
                  aria-label="Increase duration"
                >
                  +
                </button>
              </div>
              <p className={styles.inputHint}>
                E.g., 1.5, 2.0, 2.5 hours
              </p>
            </div>
          </div>
        </div>

        {/* Base Hours and Weekly Hours */}
        <div className={styles.locationSettingsRow}>
          {/* Base Hours */}
          <div className={styles.locationSettingsColumn}>
            <h3 className={styles.subsectionTitle}>Base Hours</h3>
            <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Standard operating hours for {locationName} reservations.
            </p>
            <CalendarAvailabilityControl section="base" locationSlug={locationSlug} />
          </div>

          {/* Weekly Hours */}
          <div className={styles.locationSettingsColumn}>
            <h3 className={styles.subsectionTitle}>Weekly Hours</h3>
            <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Set hours for the current week. These override base hours and allow week-by-week schedule changes.
            </p>
            <CalendarAvailabilityControl section="weekly" locationSlug={locationSlug} />
          </div>
        </div>
      </div>

      {/* Custom Open/Closed Days */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Custom Open/Closed Days</h2>
        <div className={styles.subsection}>
          <h3 className={styles.subsectionTitle}>Custom Open Days</h3>
          <CalendarAvailabilityControl section="custom_open" locationSlug={locationSlug} />
        </div>
        <div className={styles.subsection}>
          <h3 className={styles.subsectionTitle}>Custom Closed Days</h3>
          <CalendarAvailabilityControl section="custom_closed" locationSlug={locationSlug} />
        </div>
      </div>

      {/* General Configuration */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>General Configuration</h2>

        <div className={styles.locationSettingsGrid}>
          {/* Left Column */}
          <div>
            {/* Cover Charge */}
            <div className={styles.formGroup}>
              <div className={styles.switchRow}>
                <label className={styles.switchLabel} htmlFor={`cover-enabled-${locationSlug}`}>
                  Cover Charge Enabled
                </label>
                <button
                  id={`cover-enabled-${locationSlug}`}
                  type="button"
                  role="switch"
                  aria-checked={coverEnabled}
                  onClick={() => setCoverEnabled(!coverEnabled)}
                  className={`${styles.switch} ${coverEnabled ? styles.switchOn : ''}`}
                >
                  <span className={styles.switchThumb}></span>
                </button>
              </div>
              <p className={styles.inputHint}>
                Cover charge for non-members (members always free)
              </p>
            </div>

            {coverEnabled && (
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor={`cover-price-${locationSlug}`}>
                  Cover Charge Amount ($)
                </label>
                <div className={styles.numberInput}>
                  <button
                    type="button"
                    onClick={() => setCoverPrice(Math.max(COVER_PRICE_MIN, coverPrice - 1))}
                    className={styles.numberButton}
                    aria-label="Decrease cover price"
                  >
                    −
                  </button>
                  <input
                    id={`cover-price-${locationSlug}`}
                    type="number"
                    className={styles.numberInputField}
                    value={coverPrice}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      setCoverPrice(Math.max(COVER_PRICE_MIN, Math.min(COVER_PRICE_MAX, value)));
                    }}
                    min={COVER_PRICE_MIN}
                    max={COVER_PRICE_MAX}
                    step="1"
                    aria-valuemin={COVER_PRICE_MIN}
                    aria-valuemax={COVER_PRICE_MAX}
                  />
                  <button
                    type="button"
                    onClick={() => setCoverPrice(Math.min(COVER_PRICE_MAX, coverPrice + 1))}
                    className={styles.numberButton}
                    aria-label="Increase cover price"
                  >
                    +
                  </button>
                </div>
                <p className={styles.inputHint}>
                  Amount charged to non-members for entry
                </p>
              </div>
            )}

            {/* Admin Notification Phone */}
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor={`admin-phone-${locationSlug}`}>
                Admin Notification Phone
              </label>
              <input
                id={`admin-phone-${locationSlug}`}
                type="tel"
                className={`${styles.input} ${adminPhone && !isValidPhone(adminPhone) ? styles.inputError : ''}`}
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="9137774488"
                inputMode="tel"
                pattern="[0-9]{10}"
              />
              <p className={styles.inputHint}>
                SMS notifications for reservations (10 digits, auto-adds +1 prefix)
              </p>
              {adminPhone && !isValidPhone(adminPhone) && (
                <p className={styles.errorText}>Please enter a valid 10-digit phone number</p>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div>
            {/* Minaka Calendar */}
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor={`minaka-url-${locationSlug}`}>
                Minaka Calendar iCal URL
              </label>
              <input
                id={`minaka-url-${locationSlug}`}
                type="url"
                className={`${styles.input} ${minakaUrl && !isValidUrl(minakaUrl) ? styles.inputError : ''}`}
                value={minakaUrl}
                onChange={(e) => setMinakaUrl(e.target.value)}
                placeholder="https://www.minaka.app/api/user/calendar/feed.ics?token=..."
              />
              <p className={styles.inputHint}>
                iCal feed URL from Minaka to sync events
              </p>
              {minakaUrl && !isValidUrl(minakaUrl) && (
                <p className={styles.errorText}>Please enter a valid URL starting with http:// or https://</p>
              )}
            </div>

            {/* Timezone */}
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor={`timezone-${locationSlug}`}>
                Timezone
              </label>
              <input
                id={`timezone-${locationSlug}`}
                type="text"
                className={styles.input}
                value={TIMEZONE}
                readOnly
                placeholder={TIMEZONE}
              />
              <p className={styles.inputHint}>
                {locationName} timezone (currently read-only)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Order Reference */}
      <div className={styles.card}>
        <p className={styles.cardDescription} style={{ fontSize: '0.875rem', color: '#6e6e73', fontStyle: 'italic', margin: 0 }}>
          <strong>Priority Order:</strong> Private Events → Custom Open Days → Booking Window → Custom Closed Days → Weekly Hours → Base Hours
        </p>
      </div>

      {/* Single Save Button at Bottom */}
      <div className={styles.card}>
        <div className={styles.formActions}>
          <button
            onClick={onSave}
            disabled={saving || (adminPhone && !isValidPhone(adminPhone)) || (minakaUrl && !isValidUrl(minakaUrl))}
            className={`${styles.saveButton} ${saving ? styles.saving : ''}`}
          >
            {saving ? 'Saving...' : `Save ${locationName} Settings`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationSettingsTab;
