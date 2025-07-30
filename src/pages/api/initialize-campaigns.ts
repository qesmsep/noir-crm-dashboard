import { NextApiRequest, NextApiResponse } from 'next';
import { initializeCommonCampaigns } from '../../lib/campaign-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    console.log('Initializing common campaigns...');
    
    await initializeCommonCampaigns();
    
    console.log('Common campaigns initialized successfully');
    
    res.status(200).json({ 
      success: true, 
      message: 'Common campaigns initialized successfully' 
    });
  } catch (error) {
    console.error('Error initializing campaigns:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initialize campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 