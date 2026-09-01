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

interface LocationConfig {
  id: string;
  name: string;
  slug: string;
}

interface LocationSettingsState {
  coverEnabled: boolean;
  coverPrice: number;
  minakaUrl: string;
  duration: number;
  adminPhone: string;
  maxGuests: number | null;
}

type LocationMessage = { type: 'success' | 'error'; text: string } | null;

const DEFAULT_LOCATION_SETTINGS: LocationSettingsState = {
  coverEnabled: false,
  coverPrice: 0,
  minakaUrl: '',
  duration: 2.0,
  adminPhone: '',
  maxGuests: null,
};

function isMissingCapacityColumn(error: any): boolean {
  const message = `${error?.message || ''} ${error?.details || ''}`;
  return error?.code === '42703' || error?.code === 'PGRST204' || message.includes('max_concurrent_guests');
}

export default function Settings() {
  const { settings: contextSettings, refreshSettings, refreshHoldFeeSettings } = useSettings();
  const [settings, setSettings] = useState<Settings>(contextSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [holdFeeSaving, setHoldFeeSaving] = useState(false);
  const [holdFeeMessage, setHoldFeeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');

  // Per-location settings, keyed by location slug. Locations are loaded from
  // the database so a newly added venue gets its own tab automatically.
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [locationSettings, setLocationSettings] = useState<Record<string, LocationSettingsState>>({});
  const [locationSaving, setLocationSaving] = useState<Record<string, boolean>>({});
  const [locationMessage, setLocationMessage] = useState<Record<string, LocationMessage>>({});
  // True when the capacity-limits migration has not been applied to this database yet
  const [capacityColumnMissing, setCapacityColumnMissing] = useState(false);

  useEffect(() => {
    setSettings(contextSettings);
  }, [contextSettings]);

  // Load active locations and their settings
  useEffect(() => {
    async function fetchLocations() {
      const BASE_COLUMNS =
        'id, name, slug, cover_enabled, cover_price, minaka_ical_url, default_reservation_duration_hours, admin_notification_phone';

      try {
        // max_concurrent_guests is added by the capacity-limits migration. If
        // the code is deployed before that migration runs, fall back to the
        // base columns so the location tabs still render.
        const withCapacity = await supabaseAdmin
          .from('locations')
          .select(`${BASE_COLUMNS}, max_concurrent_guests`)
          .eq('status', 'active')
          .order('name', { ascending: true });

        let data: any[] | null = withCapacity.data;
        let error: any = withCapacity.error;

        if (error && isMissingCapacityColumn(error)) {
          console.warn('max_concurrent_guests column not found - capacity limits migration has not been applied yet');
          setCapacityColumnMissing(true);
          const withoutCapacity = await supabaseAdmin
            .from('locations')
            .select(BASE_COLUMNS)
            .eq('status', 'active')
            .order('name', { ascending: true });
          data = withoutCapacity.data;
          error = withoutCapacity.error;
        }

        if (error || !data) {
          console.error('Error fetching locations:', error);
          return;
        }

        setLocations(data.map((l: any) => ({ id: l.id, name: l.name, slug: l.slug })));

        const settingsBySlug: Record<string, LocationSettingsState> = {};
        data.forEach((l: any) => {
          settingsBySlug[l.slug] = {
            coverEnabled: l.cover_enabled || false,
            coverPrice: l.cover_price || 0,
            minakaUrl: l.minaka_ical_url || '',
            duration: l.default_reservation_duration_hours || 2.0,
            adminPhone: l.admin_notification_phone || '',
            maxGuests: l.max_concurrent_guests ?? null,
          };
        });
        setLocationSettings(settingsBySlug);
        setActiveTab((prev) => prev || data[0]?.slug || '');
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    }
    fetchLocations();
  }, []);

  // Patch a single field for one location's settings
  const updateLocationSetting = (
    slug: string,
    patch: Partial<LocationSettingsState>
  ) => {
    setLocationSettings((prev) => ({
      ...prev,
      [slug]: { ...(prev[slug] || DEFAULT_LOCATION_SETTINGS), ...patch },
    }));
  };

  async function handleLocationSave(slug: string) {
    const locationName = locations.find((l) => l.slug === slug)?.name || slug;
    const current = locationSettings[slug];
    if (!current) return;

    setLocationSaving((prev) => ({ ...prev, [slug]: true }));
    setLocationMessage((prev) => ({ ...prev, [slug]: null }));

    try {
      const { error } = await supabaseAdmin
        .from('locations')
        .update({
          cover_enabled: current.coverEnabled,
          cover_price: current.coverPrice,
          minaka_ical_url: current.minakaUrl,
          default_reservation_duration_hours: current.duration,
          admin_notification_phone: current.adminPhone,
          ...(capacityColumnMissing ? {} : { max_concurrent_guests: current.maxGuests }),
        })
        .eq('slug', slug);

      if (error) throw error;

      setLocationMessage((prev) => ({
        ...prev,
        [slug]: {
          type: 'success',
          text: capacityColumnMissing
            ? `${locationName} settings saved. Note: the guest limit was not saved because the capacity-limits migration has not been applied yet.`
            : `${locationName} settings saved successfully`,
        },
      }));
    } catch (error: any) {
      console.error(`Error saving ${locationName} settings:`, error);
      setLocationMessage((prev) => ({
        ...prev,
        [slug]: { type: 'error', text: error.message || 'Failed to save settings' },
      }));
    } finally {
      setLocationSaving((prev) => ({ ...prev, [slug]: false }));
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
        </div>

        {message && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}

        {/* Tabs - one per active location, driven by the database */}
        <div className={styles.tabs}>
          {locations.map((location) => (
            <button
              key={location.slug}
              className={`${styles.tab} ${activeTab === location.slug ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(location.slug)}
            >
              {location.name}
            </button>
          ))}
        </div>

        {/* Location Settings Tab for the active location */}
        {locations.map((location) => {
          if (activeTab !== location.slug) return null;
          const current = locationSettings[location.slug] || DEFAULT_LOCATION_SETTINGS;
          return (
            <LocationSettingsTab
              key={location.slug}
              locationSlug={location.slug}
              locationName={location.name}
              coverEnabled={current.coverEnabled}
              setCoverEnabled={(coverEnabled) => updateLocationSetting(location.slug, { coverEnabled })}
              coverPrice={current.coverPrice}
              setCoverPrice={(coverPrice) => updateLocationSetting(location.slug, { coverPrice })}
              minakaUrl={current.minakaUrl}
              setMinakaUrl={(minakaUrl) => updateLocationSetting(location.slug, { minakaUrl })}
              duration={current.duration}
              setDuration={(duration) => updateLocationSetting(location.slug, { duration })}
              adminPhone={current.adminPhone}
              setAdminPhone={(adminPhone) => updateLocationSetting(location.slug, { adminPhone })}
              maxGuests={current.maxGuests}
              setMaxGuests={(maxGuests) => updateLocationSetting(location.slug, { maxGuests })}
              saving={!!locationSaving[location.slug]}
              message={locationMessage[location.slug] || null}
              onSave={() => handleLocationSave(location.slug)}
            />
          );
        })}
      </div>
    </AdminLayout>
  );
}
