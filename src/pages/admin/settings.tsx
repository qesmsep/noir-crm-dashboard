import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { supabase } from '@/lib/supabase';
import styles from '@/styles/Settings.module.css';

interface Settings {
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
}

const defaultSettings: Settings = {
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
};

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setSettings(data as Settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load settings. Using default values.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('settings')
        .upsert(settings, { onConflict: 'id' });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Settings saved successfully.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({
        type: 'error',
        text: 'Failed to save settings.',
      });
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
        <div className={styles.loading}>Loading settings...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.header}>
        <h1>Settings</h1>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {message && (
        <div
          className={`${styles.message} ${
            message.type === 'success' ? styles.success : styles.error
          }`}
        >
          {message.text}
        </div>
      )}

      <div className={styles.settingsGrid}>
        <div className={styles.section}>
          <h2>Business Information</h2>
          <div className={styles.formGroup}>
            <label htmlFor="business_name">Business Name</label>
            <input
              type="text"
              id="business_name"
              value={settings.business_name}
              onChange={(e) =>
                handleInputChange('business_name', '', e.target.value)
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="business_email">Business Email</label>
            <input
              type="email"
              id="business_email"
              value={settings.business_email}
              onChange={(e) =>
                handleInputChange('business_email', '', e.target.value)
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="business_phone">Business Phone</label>
            <input
              type="tel"
              id="business_phone"
              value={settings.business_phone}
              onChange={(e) =>
                handleInputChange('business_phone', '', e.target.value)
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              value={settings.address}
              onChange={(e) =>
                handleInputChange('address', '', e.target.value)
              }
            />
          </div>
        </div>

        <div className={styles.section}>
          <h2>Operating Hours</h2>
          {Object.entries(settings.operating_hours).map(([day, hours]) => (
            <div key={day} className={styles.formGroup}>
              <label htmlFor={`${day}_hours`}>
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </label>
              <div className={styles.timeInputs}>
                <input
                  type="time"
                  id={`${day}_open`}
                  value={hours.open}
                  onChange={(e) =>
                    handleInputChange('operating_hours', day, {
                      ...hours,
                      open: e.target.value,
                    })
                  }
                />
                <span>to</span>
                <input
                  type="time"
                  id={`${day}_close`}
                  value={hours.close}
                  onChange={(e) =>
                    handleInputChange('operating_hours', day, {
                      ...hours,
                      close: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className={styles.section}>
          <h2>Reservation Settings</h2>
          <div className={styles.formGroup}>
            <label htmlFor="max_guests">Maximum Guests per Reservation</label>
            <input
              type="number"
              id="max_guests"
              value={settings.reservation_settings.max_guests}
              onChange={(e) =>
                handleInputChange('reservation_settings', 'max_guests', parseInt(e.target.value))
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="min_notice">Minimum Notice (hours)</label>
            <input
              type="number"
              id="min_notice"
              value={settings.reservation_settings.min_notice_hours}
              onChange={(e) =>
                handleInputChange('reservation_settings', 'min_notice_hours', parseInt(e.target.value))
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="max_advance">Maximum Advance Booking (days)</label>
            <input
              type="number"
              id="max_advance"
              value={settings.reservation_settings.max_advance_days}
              onChange={(e) =>
                handleInputChange('reservation_settings', 'max_advance_days', parseInt(e.target.value))
              }
            />
          </div>
        </div>

        <div className={styles.section}>
          <h2>Notification Settings</h2>
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.notification_settings.email_notifications}
                onChange={(e) =>
                  handleInputChange('notification_settings', 'email_notifications', e.target.checked)
                }
              />
              Enable Email Notifications
            </label>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.notification_settings.sms_notifications}
                onChange={(e) =>
                  handleInputChange('notification_settings', 'sms_notifications', e.target.checked)
                }
              />
              Enable SMS Notifications
            </label>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="notification_email">Notification Email</label>
            <input
              type="email"
              id="notification_email"
              value={settings.notification_settings.notification_email}
              onChange={(e) =>
                handleInputChange('notification_settings', 'notification_email', e.target.value)
              }
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
} 