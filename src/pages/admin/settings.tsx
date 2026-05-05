import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { supabaseAdmin } from '../../lib/supabase';
import styles from '../../styles/Settings.module.css';
import CalendarAvailabilityControl from '../../components/CalendarAvailabilityControl';
import { Spinner } from '@/components/ui/spinner';
import { useSettings } from '../../context/SettingsContext';
import LedgerNotificationSettingsCard from '../../components/LedgerNotificationSettingsCard';

interface Settings {
  id: string;
  business_name: string;
  business_email: string;
  business_phone: string;
  address: string;
  timezone: string;
  operating_hours: {
    [key: string]: { open: string; close: string };
  };
  reservation_settings: {
    max_guests: number;
    min_notice_hours: number;
    max_advance_days: number;
  };
  notification_settings: {
    email_notifications: boolean;
    sms_notifications: boolean;
    notification_email: string;
  };
  hold_fee_enabled: boolean;
  hold_fee_amount: number;
  admin_notification_phone: string;
  credit_card_fee_percentage?: number;
}

const defaultSettings: Settings = {
  id: '',
  business_name: '',
  business_email: '',
  business_phone: '',
  address: '',
  timezone: 'UTC',
  operating_hours: {
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { open: '09:00', close: '17:00' },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '17:00' },
    saturday: { open: '10:00', close: '15:00' },
    sunday: { open: '10:00', close: '15:00' },
  },
  reservation_settings: {
    max_guests: 10,
    min_notice_hours: 24,
    max_advance_days: 30,
  },
  notification_settings: {
    email_notifications: true,
    sms_notifications: false,
    notification_email: '',
  },
  hold_fee_enabled: false,
  hold_fee_amount: 0,
  admin_notification_phone: '',
  credit_card_fee_percentage: 4.0,
};

export default function Settings() {
  const { settings: contextSettings, refreshSettings, refreshHoldFeeSettings } = useSettings();
  const [settings, setSettings] = useState<Settings>(contextSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [holdFeeSaving, setHoldFeeSaving] = useState(false);
  const [holdFeeMessage, setHoldFeeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'noirkc' | 'rooftopkc'>('noirkc');

  // Noir KC location settings
  const [noirKCCoverEnabled, setNoirKCCoverEnabled] = useState(false);
  const [noirKCCoverPrice, setNoirKCCoverPrice] = useState(0);
  const [noirKCMinakaUrl, setNoirKCMinakaUrl] = useState('');
  const [noirKCDuration, setNoirKCDuration] = useState(2.0);
  const [noirKCAdminPhone, setNoirKCAdminPhone] = useState('');
  const [noirKCSaving, setNoirKCSaving] = useState(false);
  const [noirKCMessage, setNoirKCMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // RooftopKC location settings
  const [rooftopKCCoverEnabled, setRooftopKCCoverEnabled] = useState(false);
  const [rooftopKCCoverPrice, setRooftopKCCoverPrice] = useState(0);
  const [rooftopKCMinakaUrl, setRooftopKCMinakaUrl] = useState('');
  const [rooftopKCDuration, setRooftopKCDuration] = useState(2.0);
  const [rooftopKCAdminPhone, setRooftopKCAdminPhone] = useState('');
  const [rooftopKCSaving, setRooftopKCSaving] = useState(false);
  const [rooftopKCMessage, setRooftopKCMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSettings(contextSettings);
  }, [contextSettings]);

  // Fetch Noir KC location settings
  useEffect(() => {
    async function fetchNoirKCSettings() {
      try {
        const { data, error } = await supabaseAdmin
          .from('locations')
          .select('cover_enabled, cover_price, minaka_ical_url, default_reservation_duration_hours, admin_notification_phone')
          .eq('slug', 'noirkc')
          .single();

        if (!error && data) {
          setNoirKCCoverEnabled(data.cover_enabled || false);
          setNoirKCCoverPrice(data.cover_price || 0);
          setNoirKCMinakaUrl(data.minaka_ical_url || '');
          setNoirKCDuration(data.default_reservation_duration_hours || 2.0);
          setNoirKCAdminPhone(data.admin_notification_phone || '');
        }
      } catch (error) {
        console.error('Error fetching Noir KC settings:', error);
      }
    }
    fetchNoirKCSettings();
  }, []);

  // Fetch RooftopKC location settings
  useEffect(() => {
    async function fetchRooftopKCSettings() {
      try {
        const { data, error } = await supabaseAdmin
          .from('locations')
          .select('cover_enabled, cover_price, minaka_ical_url, default_reservation_duration_hours, admin_notification_phone')
          .eq('slug', 'rooftopkc')
          .single();

        if (!error && data) {
          setRooftopKCCoverEnabled(data.cover_enabled || false);
          setRooftopKCCoverPrice(data.cover_price || 0);
          setRooftopKCMinakaUrl(data.minaka_ical_url || '');
          setRooftopKCDuration(data.default_reservation_duration_hours || 2.0);
          setRooftopKCAdminPhone(data.admin_notification_phone || '');
        }
      } catch (error) {
        console.error('Error fetching RooftopKC settings:', error);
      }
    }
    fetchRooftopKCSettings();
  }, []);

  async function handleNoirKCSave() {
    setNoirKCSaving(true);
    setNoirKCMessage(null);

    try {
      const { error } = await supabaseAdmin
        .from('locations')
        .update({
          cover_enabled: noirKCCoverEnabled,
          cover_price: noirKCCoverPrice,
          minaka_ical_url: noirKCMinakaUrl,
          default_reservation_duration_hours: noirKCDuration,
          admin_notification_phone: noirKCAdminPhone,
        })
        .eq('slug', 'noirkc');

      if (error) throw error;

      setNoirKCMessage({ type: 'success', text: 'Noir KC settings saved successfully' });
    } catch (error: any) {
      console.error('Error saving Noir KC settings:', error);
      setNoirKCMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setNoirKCSaving(false);
    }
  }

  async function handleRooftopKCSave() {
    setRooftopKCSaving(true);
    setRooftopKCMessage(null);

    try {
      const { error } = await supabaseAdmin
        .from('locations')
        .update({
          cover_enabled: rooftopKCCoverEnabled,
          cover_price: rooftopKCCoverPrice,
          minaka_ical_url: rooftopKCMinakaUrl,
          default_reservation_duration_hours: rooftopKCDuration,
          admin_notification_phone: rooftopKCAdminPhone,
        })
        .eq('slug', 'rooftopkc');

      if (error) throw error;

      setRooftopKCMessage({ type: 'success', text: 'RooftopKC settings saved successfully' });
    } catch (error: any) {
      console.error('❌ Error saving RooftopKC settings:', error);
      setRooftopKCMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setRooftopKCSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      if (settings.id) {
        const { error } = await supabaseAdmin
          .from('settings')
          .upsert(settings, { onConflict: 'id' });
        if (error) throw error;
      } else {
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create initial settings');
        }
        const newSettings = await response.json();
        setSettings(prev => ({ ...prev, id: newSettings.id }));
      }
      await refreshSettings();
      setMessage({
        type: 'success',
        text: 'Settings saved successfully.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save settings.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleHoldFeeSave() {
    setHoldFeeSaving(true);
    setHoldFeeMessage(null);
    try {
      if (settings.id) {
        const { error } = await supabaseAdmin
          .from('settings')
          .upsert({
            ...settings,
            hold_fee_enabled: settings.hold_fee_enabled,
            hold_fee_amount: settings.hold_fee_amount,
            credit_card_fee_percentage: settings.credit_card_fee_percentage
          }, { onConflict: 'id' });
        if (error) throw error;
      } else {
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...settings,
            hold_fee_enabled: settings.hold_fee_enabled,
            hold_fee_amount: settings.hold_fee_amount,
            credit_card_fee_percentage: settings.credit_card_fee_percentage
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create initial settings');
        }
        const newSettings = await response.json();
        setSettings(prev => ({ ...prev, id: newSettings.id }));
      }
      await Promise.all([refreshSettings(), refreshHoldFeeSettings()]);
      setHoldFeeMessage({ type: 'success', text: 'Hold fee settings saved successfully.' });
    } catch (error) {
      console.error('Error saving hold fee settings:', error);
      setHoldFeeMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save hold fee settings.'
      });
    } finally {
      setHoldFeeSaving(false);
    }
  }

  async function handlePhoneSave() {
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabaseAdmin
        .from('settings')
        .upsert({ id: settings.id, admin_notification_phone: settings.admin_notification_phone }, { onConflict: 'id' });
      if (error) throw error;
      await refreshSettings();
      setMessage({ type: 'success', text: 'Admin notification phone saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save admin notification phone.' });
    } finally {
      setSaving(false);
    }
  }

  const handleInputChange = (
    section: keyof Settings,
    field: string,
    value: any
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]:
        typeof prev[section] === 'object'
          ? { ...prev[section], [field]: value }
          : value,
    }));
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <Spinner size="xl" />
            <p>Loading settings...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Settings</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${styles.saveButton} ${saving ? styles.saving : ''}`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {message && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'noirkc' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('noirkc')}
          >
            Noir KC
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'rooftopkc' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('rooftopkc')}
          >
            RooftopKC
          </button>
        </div>

        {/* Noir KC Location Settings Tab */}
        {activeTab === 'noirkc' && (
          <div className={styles.sections}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Noir KC - Location Settings</h2>
              <p className={styles.cardDescription}>
                Configure location-specific settings for Noir KC including booking windows, hours, and cover charges.
              </p>
            </div>

            {/* Hours & Booking Configuration */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Hours & Booking Configuration</h2>
              <p className={styles.inputHint} style={{ marginBottom: '1.5rem' }}>
                Configure reservation availability, operating hours, and booking window for Noir KC.
              </p>

              {/* Booking Window and Default Reservation Duration */}
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {/* Booking Window */}
                <div style={{ flex: '1', minWidth: '300px' }}>
                  <h3 className={styles.subsectionTitle} style={{ marginBottom: '0.5rem' }}>Booking Window</h3>
                  <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Reservations can be made within this date range.
                  </p>
                  <CalendarAvailabilityControl section="booking_window" locationSlug="noirkc" />
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
                        onClick={() => setNoirKCDuration(Math.max(0.5, noirKCDuration - 0.5))}
                        className={styles.numberButton}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className={styles.numberInputField}
                        value={noirKCDuration}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 2.0;
                          setNoirKCDuration(Math.max(0.5, Math.min(8, value)));
                        }}
                        min="0.5"
                        max="8"
                        step="0.5"
                      />
                      <button
                        type="button"
                        onClick={() => setNoirKCDuration(Math.min(8, noirKCDuration + 0.5))}
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
                    Standard operating hours for Noir KC reservations.
                  </p>
                  <CalendarAvailabilityControl section="base" locationSlug="noirkc" />
                </div>

                {/* Weekly Hours */}
                <div style={{ flex: '1', minWidth: '350px' }}>
                  <h3 className={styles.subsectionTitle} style={{ marginBottom: '0.5rem' }}>Weekly Hours</h3>
                  <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Set hours for the current week. These override base hours and allow week-by-week schedule changes.
                  </p>
                  <CalendarAvailabilityControl section="weekly" locationSlug="noirkc" />
                </div>
              </div>

              {/* Save Button for Hours & Booking Configuration */}
              <div className={styles.formActions} style={{ marginTop: '1.5rem' }}>
                {noirKCMessage && (
                  <div className={`${styles.message} ${styles[noirKCMessage.type]}`}>
                    {noirKCMessage.text}
                  </div>
                )}
                <button
                  onClick={handleNoirKCSave}
                  disabled={noirKCSaving}
                  className={`${styles.saveButton} ${noirKCSaving ? styles.saving : ''}`}
                >
                  {noirKCSaving ? 'Saving...' : 'Save Noir KC Settings'}
                </button>
              </div>
            </div>

            {/* Custom Open/Closed Days */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Custom Open/Closed Days</h2>
              <div className={styles.subsection}>
                <h3 className={styles.subsectionTitle}>Custom Open Days</h3>
                <CalendarAvailabilityControl section="custom_open" locationSlug="noirkc" />
              </div>
              <div className={styles.subsection}>
                <h3 className={styles.subsectionTitle}>Custom Closed Days</h3>
                <CalendarAvailabilityControl section="custom_closed" locationSlug="noirkc" />
              </div>
            </div>

            {/* General Configuration */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>General Configuration</h2>

              {noirKCMessage && (
                <div className={`${styles.message} ${styles[noirKCMessage.type]}`}>
                  {noirKCMessage.text}
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
                        aria-checked={noirKCCoverEnabled}
                        onClick={() => setNoirKCCoverEnabled(!noirKCCoverEnabled)}
                        className={`${styles.switch} ${noirKCCoverEnabled ? styles.switchOn : ''}`}
                      >
                        <span className={styles.switchThumb}></span>
                      </button>
                    </div>
                    <p className={styles.inputHint}>
                      Cover charge for non-members (members always free)
                    </p>
                  </div>

                  {noirKCCoverEnabled && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Cover Charge Amount ($)</label>
                      <div className={styles.numberInput}>
                        <button
                          type="button"
                          onClick={() => setNoirKCCoverPrice(Math.max(0, noirKCCoverPrice - 1))}
                          className={styles.numberButton}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className={styles.numberInputField}
                          value={noirKCCoverPrice}
                          onChange={(e) => setNoirKCCoverPrice(parseFloat(e.target.value) || 0)}
                          min="0"
                          max="100"
                          step="1"
                        />
                        <button
                          type="button"
                          onClick={() => setNoirKCCoverPrice(Math.min(100, noirKCCoverPrice + 1))}
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
                      value={noirKCAdminPhone}
                      onChange={(e) => setNoirKCAdminPhone(e.target.value)}
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
                      value={noirKCMinakaUrl}
                      onChange={(e) => setNoirKCMinakaUrl(e.target.value)}
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
                      Noir KC timezone (currently read-only)
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.formActions} style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={handleNoirKCSave}
                  disabled={noirKCSaving}
                  className={`${styles.saveButton} ${noirKCSaving ? styles.saving : ''}`}
                >
                  {noirKCSaving ? 'Saving...' : 'Save Noir KC Settings'}
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
        )}

        {/* RooftopKC Location Settings Tab */}
        {activeTab === 'rooftopkc' && (
          <div className={styles.sections}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>RooftopKC - Location Settings</h2>
              <p className={styles.cardDescription}>
                Configure location-specific settings for RooftopKC including booking windows, hours, and cover charges.
              </p>
            </div>

            {/* Hours & Booking Configuration */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Hours & Booking Configuration</h2>
              <p className={styles.inputHint} style={{ marginBottom: '1.5rem' }}>
                Configure reservation availability, operating hours, and booking window for RooftopKC.
              </p>

              {/* Booking Window and Default Reservation Duration */}
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {/* Booking Window */}
                <div style={{ flex: '1', minWidth: '300px' }}>
                  <h3 className={styles.subsectionTitle} style={{ marginBottom: '0.5rem' }}>Booking Window</h3>
                  <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Reservations can be made within this date range.
                  </p>
                  <CalendarAvailabilityControl section="booking_window" locationSlug="rooftopkc" />
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
                        onClick={() => setRooftopKCDuration(Math.max(0.5, rooftopKCDuration - 0.5))}
                        className={styles.numberButton}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className={styles.numberInputField}
                        value={rooftopKCDuration}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 2.0;
                          setRooftopKCDuration(Math.max(0.5, Math.min(8, value)));
                        }}
                        min="0.5"
                        max="8"
                        step="0.5"
                      />
                      <button
                        type="button"
                        onClick={() => setRooftopKCDuration(Math.min(8, rooftopKCDuration + 0.5))}
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
                    Standard operating hours for RooftopKC reservations.
                  </p>
                  <CalendarAvailabilityControl section="base" locationSlug="rooftopkc" />
                </div>

                {/* Weekly Hours */}
                <div style={{ flex: '1', minWidth: '350px' }}>
                  <h3 className={styles.subsectionTitle} style={{ marginBottom: '0.5rem' }}>Weekly Hours</h3>
                  <p className={styles.inputHint} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Set hours for the current week. These override base hours and allow week-by-week schedule changes.
                  </p>
                  <CalendarAvailabilityControl section="weekly" locationSlug="rooftopkc" />
                </div>
              </div>

              {/* Save Button for Hours & Booking Configuration */}
              <div className={styles.formActions} style={{ marginTop: '1.5rem' }}>
                {rooftopKCMessage && (
                  <div className={`${styles.message} ${styles[rooftopKCMessage.type]}`}>
                    {rooftopKCMessage.text}
                  </div>
                )}
                <button
                  onClick={handleRooftopKCSave}
                  disabled={rooftopKCSaving}
                  className={`${styles.saveButton} ${rooftopKCSaving ? styles.saving : ''}`}
                >
                  {rooftopKCSaving ? 'Saving...' : 'Save RooftopKC Settings'}
                </button>
              </div>
            </div>

            {/* Custom Open/Closed Days */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Custom Open/Closed Days</h2>
              <div className={styles.subsection}>
                <h3 className={styles.subsectionTitle}>Custom Open Days</h3>
                <CalendarAvailabilityControl section="custom_open" locationSlug="rooftopkc" />
              </div>
              <div className={styles.subsection}>
                <h3 className={styles.subsectionTitle}>Custom Closed Days</h3>
                <CalendarAvailabilityControl section="custom_closed" locationSlug="rooftopkc" />
              </div>
            </div>

            {/* General Configuration */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>General Configuration</h2>

              {rooftopKCMessage && (
                <div className={`${styles.message} ${styles[rooftopKCMessage.type]}`}>
                  {rooftopKCMessage.text}
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
                        aria-checked={rooftopKCCoverEnabled}
                        onClick={() => setRooftopKCCoverEnabled(!rooftopKCCoverEnabled)}
                        className={`${styles.switch} ${rooftopKCCoverEnabled ? styles.switchOn : ''}`}
                      >
                        <span className={styles.switchThumb}></span>
                      </button>
                    </div>
                    <p className={styles.inputHint}>
                      Cover charge for non-members (members always free)
                    </p>
                  </div>

                  {rooftopKCCoverEnabled && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Cover Charge Amount ($)</label>
                      <div className={styles.numberInput}>
                        <button
                          type="button"
                          onClick={() => setRooftopKCCoverPrice(Math.max(0, rooftopKCCoverPrice - 1))}
                          className={styles.numberButton}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className={styles.numberInputField}
                          value={rooftopKCCoverPrice}
                          onChange={(e) => setRooftopKCCoverPrice(parseFloat(e.target.value) || 0)}
                          min="0"
                          max="100"
                          step="1"
                        />
                        <button
                          type="button"
                          onClick={() => setRooftopKCCoverPrice(Math.min(100, rooftopKCCoverPrice + 1))}
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
                      value={rooftopKCAdminPhone}
                      onChange={(e) => setRooftopKCAdminPhone(e.target.value)}
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
                      value={rooftopKCMinakaUrl}
                      onChange={(e) => setRooftopKCMinakaUrl(e.target.value)}
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
                      RooftopKC timezone (currently read-only)
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.formActions} style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={handleRooftopKCSave}
                  disabled={rooftopKCSaving}
                  className={`${styles.saveButton} ${rooftopKCSaving ? styles.saving : ''}`}
                >
                  {rooftopKCSaving ? 'Saving...' : 'Save RooftopKC Settings'}
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
        )}
      </div>
    </AdminLayout>
  );
}
