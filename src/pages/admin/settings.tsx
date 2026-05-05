import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { supabaseAdmin } from '../../lib/supabase';
import styles from '../../styles/Settings.module.css';
import CalendarAvailabilityControl from '../../components/CalendarAvailabilityControl';
import { Spinner } from '@/components/ui/spinner';
import { useSettings } from '../../context/SettingsContext';
import LedgerNotificationSettingsCard from '../../components/LedgerNotificationSettingsCard';
import LocationSettingsTab from '../../components/LocationSettingsTab';

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
          <LocationSettingsTab
            locationSlug="noirkc"
            locationName="Noir KC"
            coverEnabled={noirKCCoverEnabled}
            setCoverEnabled={setNoirKCCoverEnabled}
            coverPrice={noirKCCoverPrice}
            setCoverPrice={setNoirKCCoverPrice}
            minakaUrl={noirKCMinakaUrl}
            setMinakaUrl={setNoirKCMinakaUrl}
            duration={noirKCDuration}
            setDuration={setNoirKCDuration}
            adminPhone={noirKCAdminPhone}
            setAdminPhone={setNoirKCAdminPhone}
            saving={noirKCSaving}
            message={noirKCMessage}
            onSave={handleNoirKCSave}
          />
        )}

        {/* RooftopKC Location Settings Tab */}
        {activeTab === 'rooftopkc' && (
          <LocationSettingsTab
            locationSlug="rooftopkc"
            locationName="RooftopKC"
            coverEnabled={rooftopKCCoverEnabled}
            setCoverEnabled={setRooftopKCCoverEnabled}
            coverPrice={rooftopKCCoverPrice}
            setCoverPrice={setRooftopKCCoverPrice}
            minakaUrl={rooftopKCMinakaUrl}
            setMinakaUrl={setRooftopKCMinakaUrl}
            duration={rooftopKCDuration}
            setDuration={setRooftopKCDuration}
            adminPhone={rooftopKCAdminPhone}
            setAdminPhone={setRooftopKCAdminPhone}
            saving={rooftopKCSaving}
            message={rooftopKCMessage}
            onSave={handleRooftopKCSave}
          />
        )}
      </div>
    </AdminLayout>
  );
}
