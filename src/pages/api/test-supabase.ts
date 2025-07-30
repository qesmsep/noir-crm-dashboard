import { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('Testing Supabase connection...');
    
    // Check environment variables
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    
    console.log('Environment variables check:', envCheck);
    
    // Test regular client
    const { data: regularData, error: regularError } = await supabase
      .from('campaigns')
      .select('count')
      .limit(1);
    
    console.log('Regular client test:', { data: regularData, error: regularError });
    
    // Test admin client
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('campaigns')
      .select('count')
      .limit(1);
    
    console.log('Admin client test:', { data: adminData, error: adminError });
    
    res.status(200).json({
      envCheck,
      regularClient: { success: !regularError, error: regularError },
      adminClient: { success: !adminError, error: adminError }
    });
    
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ error: 'Test failed', details: error });
  }
} 