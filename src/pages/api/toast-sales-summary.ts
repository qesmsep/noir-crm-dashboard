import { NextApiRequest, NextApiResponse } from 'next';
import { ToastAPI } from '../../lib/toast-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { startDate, endDate } = req.query;
    
    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters: startDate and endDate' 
      });
    }

    // Initialize Toast API client
    const toastAPI = new ToastAPI({
      apiKey: process.env.TOAST_API_KEY || '',
      baseUrl: process.env.TOAST_BASE_URL || 'https://api.toasttab.com/v1',
      locationId: process.env.TOAST_LOCATION_ID || ''
    });

    // Fetch sales summary from Toast API
    const salesSummary = await toastAPI.getSalesSummary(
      startDate as string, 
      endDate as string
    );

    return res.status(200).json({
      success: true,
      data: salesSummary
    });

  } catch (error) {
    console.error('Error in toast-sales-summary API:', error);
    
    // Return a more detailed error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ 
      error: 'Failed to fetch Toast sales summary',
      message: errorMessage
    });
  }
} 