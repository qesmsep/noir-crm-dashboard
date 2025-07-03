import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

const defaultSettings = {
  business_name: '',
  business_email: '',
  business_phone: '',
  address: '',
  timezone: 'America/Chicago',
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
  hold_fee_enabled: true,
  hold_fee_amount: 25.00,
  admin_notification_phone: '',
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (error) {
      // If no settings record exists, create one with defaults
      if (error.code === 'PGRST116') {
        const { data: newSettings, error: insertError } = await supabase
          .from('settings')
          .insert([defaultSettings])
          .select()
          .single();
        if (insertError) {
          return NextResponse.json(defaultSettings, { status: 200 });
        }
        return NextResponse.json(newSettings, { status: 200 });
      }
      return NextResponse.json(defaultSettings, { status: 200 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(defaultSettings, { status: 200 });
  }
} 