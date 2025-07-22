import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings found, return defaults
        console.log('No settings record found, returning defaults');
        return NextResponse.json({
          id: '',
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
          hold_fee_enabled: false,
          hold_fee_amount: 0,
          admin_notification_phone: '',
        });
      }
      throw error;
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings = await request.json();
    
    const { data, error } = await supabaseAdmin
      .from('settings')
      .insert([settings])
      .select()
      .single();

    if (error) {
      console.error('Error creating settings:', error);
      return NextResponse.json(
        { error: 'Failed to create settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating settings:', error);
    return NextResponse.json(
      { error: 'Failed to create settings' },
      { status: 500 }
    );
  }
} 