import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('=== DEBUGGING CAMPAIGN_MESSAGES TABLE ===');
    
    // 1. Check if table exists
    console.log('1. Checking if campaign_messages table exists...');
    const { data: tableExists, error: tableError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'campaign_messages')
      .single();

    if (tableError || !tableExists) {
      console.log('❌ Table does not exist:', tableError);
      return res.status(500).json({ 
        error: 'campaign_messages table does not exist',
        tableError: tableError?.message 
      });
    }
    console.log('✅ Table exists');

    // 2. Check table structure
    console.log('2. Checking table structure...');
    const { data: columns, error: columnError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'campaign_messages')
      .order('ordinal_position');

    if (columnError) {
      console.log('❌ Error getting columns:', columnError);
      return res.status(500).json({ 
        error: 'Failed to get column info',
        columnError: columnError.message 
      });
    }
    console.log('✅ Table columns:', columns);

    // 3. Check RLS policies
    console.log('3. Checking RLS policies...');
    const { data: policies, error: policyError } = await supabaseAdmin
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'campaign_messages');

    if (policyError) {
      console.log('❌ Error getting policies:', policyError);
    } else {
      console.log('✅ RLS policies:', policies);
    }

    // 4. Check if we can read from the table
    console.log('4. Testing SELECT operation...');
    const { data: selectData, error: selectError } = await supabaseAdmin
      .from('campaign_messages')
      .select('*')
      .limit(1);

    if (selectError) {
      console.log('❌ SELECT error:', selectError);
      return res.status(500).json({ 
        error: 'SELECT operation failed',
        selectError: selectError.message,
        code: selectError.code,
        details: selectError.details
      });
    }
    console.log('✅ SELECT works, found', selectData?.length || 0, 'records');

    // 5. Test INSERT with minimal data
    console.log('5. Testing INSERT operation...');
    const testMessage = {
      campaign_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      name: 'Debug Test Message',
      content: 'Test content for debugging',
      recipient_type: 'member',
      timing_type: 'specific_time',
      specific_time: '10:00',
      is_active: true
    };

    console.log('Attempting to insert:', testMessage);
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('campaign_messages')
      .insert([testMessage])
      .select()
      .single();

    if (insertError) {
      console.log('❌ INSERT error:', insertError);
      return res.status(500).json({ 
        error: 'INSERT operation failed',
        insertError: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint
      });
    }

    console.log('✅ INSERT successful:', insertData);

    // 6. Clean up test record
    console.log('6. Cleaning up test record...');
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_messages')
      .delete()
      .eq('id', insertData.id);

    if (deleteError) {
      console.log('⚠️ Cleanup error (non-critical):', deleteError);
    } else {
      console.log('✅ Cleanup successful');
    }

    console.log('=== ALL TESTS PASSED ===');
    res.status(200).json({ 
      message: 'All operations working correctly',
      columns: columns,
      policies: policies,
      testInsert: insertData
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ 
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 