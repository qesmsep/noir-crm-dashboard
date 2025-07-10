import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('hold_fee_enabled, hold_fee_amount')
      .single();

    if (error) {
      console.error('Error fetching hold fee config:', error);
      
      // If no settings record exists, return defaults instead of trying to create one
      // This avoids RLS policy issues since we're not trying to insert
      if (error.code === 'PGRST116') {
        console.log('No settings record found, returning defaults');
        return NextResponse.json({
          hold_fee_enabled: true,
          hold_fee_amount: 25.00
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

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { hold_fee_enabled, hold_fee_amount } = body;

    // Validate input
    if (typeof hold_fee_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'hold_fee_enabled must be a boolean' },
        { status: 400 }
      );
    }

    if (typeof hold_fee_amount !== 'number' || hold_fee_amount < 0) {
      return NextResponse.json(
        { error: 'hold_fee_amount must be a non-negative number' },
        { status: 400 }
      );
    }

    // Get existing settings to get the ID
    const { data: existingSettings, error: fetchError } = await supabaseAdmin
      .from('settings')
      .select('id')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing settings:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch existing settings' },
        { status: 500 }
      );
    }

    let settingsId: string;
    
    if (fetchError && fetchError.code === 'PGRST116') {
      // No settings record exists, but we can't create one due to RLS
      // Return an error indicating that settings need to be created by an admin
      console.error('No settings record exists and cannot create due to RLS policy');
      return NextResponse.json(
        { 
          error: 'Settings record does not exist. Please create initial settings through the admin interface.',
          hold_fee_enabled: true,
          hold_fee_amount: 25.00
        },
        { status: 404 }
      );
    } else {
      settingsId = existingSettings!.id;
      
      // Update existing settings
      const { error: updateError } = await supabaseAdmin
        .from('settings')
        .update({ hold_fee_enabled, hold_fee_amount })
        .eq('id', settingsId);
      
      if (updateError) {
        console.error('Error updating hold fee settings:', updateError);
        
        // If it's an RLS policy error, provide a helpful message
        if (updateError.code === '42501') {
          return NextResponse.json(
            { 
              error: 'Access denied. Please ensure you have admin privileges to update settings.',
              hold_fee_enabled: true,
              hold_fee_amount: 25.00
            },
            { status: 403 }
          );
        }
        
        return NextResponse.json(
          { error: 'Failed to update hold fee settings' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      hold_fee_enabled,
      hold_fee_amount
    });
  } catch (error) {
    console.error('Error in hold-fee-config PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 