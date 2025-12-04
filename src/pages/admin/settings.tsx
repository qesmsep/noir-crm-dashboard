import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { supabaseAdmin } from '../../lib/supabase';
import styles from '../../styles/Settings.module.css';
import CalendarAvailabilityControl from '../../components/CalendarAvailabilityControl';
import { Spinner } from "@chakra-ui/react";
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
};

export default function Settings() {
  const { settings: contextSettings, refreshSettings, refreshHoldFeeSettings } = useSettings();
  const [settings, setSettings] = useState<Settings>(contextSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [holdFeeSaving, setHoldFeeSaving] = useState(false);
  const [holdFeeMessage, setHoldFeeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSettings(contextSettings);
  }, [contextSettings]);

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
            hold_fee_amount: settings.hold_fee_amount
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
            hold_fee_amount: settings.hold_fee_amount
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
            <Spinner size="xl" color="#007aff" />
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

        <div className={styles.sections}>
          {/* Booking Window */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Booking Window</h2>
            <CalendarAvailabilityControl section="booking_window" />
          </div>

          {/* Ledger Notification Settings */}
          <LedgerNotificationSettingsCard />

          {/* Base Hours */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Base Hours</h2>
            <CalendarAvailabilityControl section="base" />
          </div>

          {/* Custom Open/Closed Days */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Custom Open/Closed Days</h2>
            <div className={styles.subsection}>
              <h3 className={styles.subsectionTitle}>Custom Open Days</h3>
              <CalendarAvailabilityControl section="custom_open" />
            </div>
            <div className={styles.subsection}>
              <h3 className={styles.subsectionTitle}>Custom Closed Days</h3>
              <CalendarAvailabilityControl section="custom_closed" />
            </div>
          </div>

          {/* Timezone */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Timezone</h2>
            <div className={styles.formGroup}>
              <input
                type="text"
                className={styles.input}
                value={settings.timezone}
                onChange={(e) => handleInputChange('timezone', '', e.target.value)}
                placeholder="e.g., America/Chicago"
              />
              <p className={styles.inputHint}>
                Enter IANA timezone, e.g., America/Chicago, America/New_York, Europe/London
              </p>
            </div>
          </div>

          {/* Admin Notifications */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Admin Notifications</h2>
            <div className={styles.formGroup}>
              <label className={styles.label}>Admin Notification Phone Number</label>
              <input
                type="tel"
                className={styles.input}
                value={typeof settings.admin_notification_phone === 'string' ? settings.admin_notification_phone : ''}
                onChange={(e) => handleInputChange('admin_notification_phone', '', e.target.value)}
                placeholder="9137774488"
              />
              <p className={styles.inputHint}>
                Phone number for SMS notifications when reservations are created or modified.
                The system will automatically add +1 prefix.
              </p>
              <p className={styles.currentValue}>
                <strong>Current notification phone on file:</strong>{' '}
                {typeof contextSettings.admin_notification_phone === 'string' && contextSettings.admin_notification_phone
                  ? `+1${contextSettings.admin_notification_phone.replace(/^\+?1?/, '')}`
                  : <span className={styles.notSet}>Not set</span>}
              </p>
              <div className={styles.formActions}>
                <button
                  className={styles.secondaryButton}
                  onClick={handlePhoneSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Phone'}
                </button>
              </div>
            </div>
          </div>

          {/* Hold Fee Settings */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Reservation Hold Fee</h2>

            {holdFeeMessage && (
              <div className={`${styles.message} ${styles[holdFeeMessage.type]}`}>
                {holdFeeMessage.text}
              </div>
            )}

            <div className={styles.formGroup}>
              <div className={styles.switchRow}>
                <label className={styles.switchLabel}>
                  {settings.hold_fee_enabled ? 'Disable Hold Fee' : 'Enable Hold Fee'}
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.hold_fee_enabled}
                  onClick={() => handleInputChange('hold_fee_enabled', '', !settings.hold_fee_enabled)}
                  className={`${styles.switch} ${settings.hold_fee_enabled ? styles.switchOn : ''}`}
                >
                  <span className={styles.switchThumb}></span>
                </button>
              </div>
            </div>

            {settings.hold_fee_enabled && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Hold Fee Amount ($)</label>
                <div className={styles.numberInput}>
                  <button
                    type="button"
                    onClick={() => handleInputChange('hold_fee_amount', '', Math.max(0, settings.hold_fee_amount - 1))}
                    className={styles.numberButton}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className={styles.numberInputField}
                    value={settings.hold_fee_amount}
                    onChange={(e) => handleInputChange('hold_fee_amount', '', parseFloat(e.target.value) || 0)}
                    min="0"
                    max="1000"
                    step="0.01"
                  />
                  <button
                    type="button"
                    onClick={() => handleInputChange('hold_fee_amount', '', Math.min(1000, settings.hold_fee_amount + 1))}
                    className={styles.numberButton}
                  >
                    +
                  </button>
                </div>
                <p className={styles.inputHint}>
                  Amount to hold on credit cards for non-member reservations
                </p>
              </div>
            )}

            <div className={styles.formActions}>
              <button
                onClick={handleHoldFeeSave}
                disabled={holdFeeSaving}
                className={`${styles.saveButton} ${holdFeeSaving ? styles.saving : ''}`}
              >
                {holdFeeSaving ? 'Saving...' : 'Save Hold Fee Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
