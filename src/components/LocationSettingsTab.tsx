import React from 'react';
import CalendarAvailabilityControl from './CalendarAvailabilityControl';
import styles from '../styles/Settings.module.css';

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
  return (
    <div className={styles.sections}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{locationName} - Location Settings</h2>
        <p className={styles.cardDescription}>
          Configure location-specific settings for {locationName} including booking windows, hours, and cover charges.
        </p>
      </div>

      {/* Hours & Booking Configuration */}
      <div className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className={styles.cardTitle} style={{ marginBottom: '0.5rem' }}>Hours & Booking Configuration</h2>
            <p className={styles.inputHint} style={{ margin: 0 }}>
              Configure reservation availability, operating hours, and booking window for {locationName}.
            </p>
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className={`${styles.saveButton} ${saving ? styles.saving : ''}`}
            style={{ width: 'auto', minWidth: '200px' }}
          >
            {saving ? 'Saving...' : `Save ${locationName} Settings`}
          </button>
        </div>
        {message && (
          <div className={`${styles.message} ${styles[message.type]}`} style={{ marginBottom: '1.5rem' }}>
            {message.text}
          </div>
        )}

        {/* Booking Window and Default Reservation Duration */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {/* Booking Window */}
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h3 className={styles.subsectionTitle} style={{ marginBottom: '0.5rem' }}>Booking Window</h3>
            <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Reservations can be made within this date range.
            </p>
            <CalendarAvailabilityControl section="booking_window" locationSlug={locationSlug} />
          </div>

          {/* Default Reservation Duration */}
          <div style={{ flex: '0 1 300px' }}>
            <h3 className={styles.subsectionTitle} style={{ marginBottom: '0.5rem' }}>Default Reservation Duration</h3>
            <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Default length of time for reservations.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.label}>Duration (hours)</label>
              <div className={styles.numberInput}>
                <button
                  type="button"
                  onClick={() => setDuration(Math.max(0.5, duration - 0.5))}
                  className={styles.numberButton}
                >
                  −
                </button>
                <input
                  type="number"
                  className={styles.numberInputField}
                  value={duration}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 2.0;
                    setDuration(Math.max(0.5, Math.min(8, value)));
                  }}
                  min="0.5"
                  max="8"
                  step="0.5"
                />
                <button
                  type="button"
                  onClick={() => setDuration(Math.min(8, duration + 0.5))}
                  className={styles.numberButton}
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
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Base Hours */}
          <div style={{ flex: '1', minWidth: '350px' }}>
            <h3 className={styles.subsectionTitle} style={{ marginBottom: '0.5rem' }}>Base Hours</h3>
            <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Standard operating hours for {locationName} reservations.
            </p>
            <CalendarAvailabilityControl section="base" locationSlug={locationSlug} />
          </div>

          {/* Weekly Hours */}
          <div style={{ flex: '1', minWidth: '350px' }}>
            <h3 className={styles.subsectionTitle} style={{ marginBottom: '0.5rem' }}>Weekly Hours</h3>
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

        {message && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem' }}>
          {/* Left Column */}
          <div>
            {/* Cover Charge */}
            <div className={styles.formGroup}>
              <div className={styles.switchRow}>
                <label className={styles.switchLabel}>
                  Cover Charge Enabled
                </label>
                <button
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
                <label className={styles.label}>Cover Charge Amount ($)</label>
                <div className={styles.numberInput}>
                  <button
                    type="button"
                    onClick={() => setCoverPrice(Math.max(0, coverPrice - 1))}
                    className={styles.numberButton}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className={styles.numberInputField}
                    value={coverPrice}
                    onChange={(e) => setCoverPrice(parseFloat(e.target.value) || 0)}
                    min="0"
                    max="100"
                    step="1"
                  />
                  <button
                    type="button"
                    onClick={() => setCoverPrice(Math.min(100, coverPrice + 1))}
                    className={styles.numberButton}
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
              <label className={styles.label}>Admin Notification Phone</label>
              <input
                type="tel"
                className={styles.input}
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="9137774488"
              />
              <p className={styles.inputHint}>
                SMS notifications for reservations (auto-adds +1 prefix)
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div>
            {/* Minaka Calendar */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Minaka Calendar iCal URL</label>
              <input
                type="text"
                className={styles.input}
                value={minakaUrl}
                onChange={(e) => setMinakaUrl(e.target.value)}
                placeholder="https://www.minaka.app/api/user/calendar/feed.ics?token=..."
              />
              <p className={styles.inputHint}>
                iCal feed URL from Minaka to sync events
              </p>
            </div>

            {/* Timezone */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Timezone</label>
              <input
                type="text"
                className={styles.input}
                value="America/Chicago"
                readOnly
                placeholder="America/Chicago"
              />
              <p className={styles.inputHint}>
                {locationName} timezone (currently read-only)
              </p>
            </div>
          </div>
        </div>

        <div className={styles.formActions} style={{ marginTop: '1.5rem' }}>
          <button
            onClick={onSave}
            disabled={saving}
            className={`${styles.saveButton} ${saving ? styles.saving : ''}`}
          >
            {saving ? 'Saving...' : `Save ${locationName} Settings`}
          </button>
        </div>
      </div>

      {/* Priority Order Reference */}
      <div className={styles.card}>
        <p className={styles.cardDescription} style={{ fontSize: '0.875rem', color: '#6e6e73', fontStyle: 'italic', margin: 0 }}>
          <strong>Priority Order:</strong> Private Events → Custom Open Days → Booking Window → Custom Closed Days → Weekly Hours → Base Hours
        </p>
      </div>
    </div>
  );
};

export default LocationSettingsTab;
