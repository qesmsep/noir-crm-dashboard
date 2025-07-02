import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('hold_fee_enabled, hold_fee_amount')
      .single();

    if (error) {
      console.error('Error fetching hold fee config:', error);
      
      // If no settings record exists, create one with defaults
      if (error.code === 'PGRST116') {
        console.log('No settings record found, creating default...');
        const defaultSettings = {
          hold_fee_enabled: true,
          hold_fee_amount: 25.00,
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
          }
        };
        
        const { data: newSettings, error: insertError } = await supabase
          .from('settings')
          .insert([defaultSettings])
          .select('hold_fee_enabled, hold_fee_amount')
          .single();
        
        if (insertError) {
          console.error('Error creating default settings:', insertError);
          return NextResponse.json(
            { 
              hold_fee_enabled: true, 
              hold_fee_amount: 25.00 
            },
            { status: 200 }
          );
        }
        
        return NextResponse.json({
          hold_fee_enabled: newSettings.hold_fee_enabled ?? true,
          hold_fee_amount: newSettings.hold_fee_amount ?? 25.00
        });
      }
      
      return NextResponse.json(
        { 
          hold_fee_enabled: true, 
          hold_fee_amount: 25.00 
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      hold_fee_enabled: data.hold_fee_enabled ?? true,
      hold_fee_amount: data.hold_fee_amount ?? 25.00
    });
  } catch (error) {
    console.error('Error in hold-fee-config API:', error);
    return NextResponse.json(
      { 
        hold_fee_enabled: true, 
        hold_fee_amount: 25.00 
      },
      { status: 200 }
    );
  }
} 