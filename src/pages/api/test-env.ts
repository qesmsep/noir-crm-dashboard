import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    console.log('🔍 Testing environment variables...');
    
    const envVars = {
      OPENPHONE_API_KEY: process.env.OPENPHONE_API_KEY ? 'SET' : 'NOT SET',
      OPENPHONE_PHONE_NUMBER_ID: process.env.OPENPHONE_PHONE_NUMBER_ID ? 'SET' : 'NOT SET',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
    };

    console.log('Environment variables:', envVars);

    // Test OpenPhone API key format
    const apiKey = process.env.OPENPHONE_API_KEY;
    const phoneNumberId = process.env.OPENPHONE_PHONE_NUMBER_ID;
    
    const apiKeyInfo = {
      length: apiKey?.length || 0,
      startsWith: apiKey?.substring(0, 10) + '...' || 'N/A',
      phoneNumberId: phoneNumberId || 'NOT SET'
    };

    res.status(200).json({
      message: 'Environment variables test',
      envVars,
      apiKeyInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error in test-env:', error);
    res.status(500).json({ error: 'Failed to test environment variables' });
  }
} 