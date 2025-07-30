import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('Testing campaign_messages table...');
    
    // Check if table exists
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'campaign_messages')
      .single();

    if (tableError || !tableInfo) {
      console.log('campaign_messages table does not exist');
      return res.status(500).json({ 
        error: 'campaign_messages table does not exist',
        tableError: tableError?.message 
      });
    }

    console.log('campaign_messages table exists');

    // Check table structure
    const { data: columns, error: columnError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'campaign_messages')
      .order('ordinal_position');

    if (columnError) {
      console.log('Error getting column info:', columnError);
      return res.status(500).json({ 
        error: 'Failed to get column info',
        columnError: columnError.message 
      });
    }

    console.log('Table columns:', columns);

    // Try to insert a test record
    const testMessage = {
      campaign_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      name: 'Test Message',
      content: 'Test content',
      recipient_type: 'member',
      timing_type: 'specific_time',
      specific_time: '10:00',
      is_active: true
    };

    console.log('Attempting to insert test message:', testMessage);

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('campaign_messages')
      .insert([testMessage])
      .select()
      .single();

    if (insertError) {
      console.log('Insert error:', insertError);
      return res.status(500).json({ 
        error: 'Failed to insert test message',
        insertError: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint
      });
    }

    console.log('Test insert successful:', insertData);

    // Clean up test record
    await supabaseAdmin
      .from('campaign_messages')
      .delete()
      .eq('id', insertData.id);

    res.status(200).json({ 
      message: 'campaign_messages table is working correctly',
      columns: columns,
      testInsert: insertData
    });

  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 