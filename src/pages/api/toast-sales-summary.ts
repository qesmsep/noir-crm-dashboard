import { NextApiRequest, NextApiResponse } from 'next';

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

    // Fetch sales from Toast Partner API
    const toastResponse = await fetch(`https://ws-api.toasttab.com/restaurants/v1/sales?locationGuid=aa7a6cb5-92c3-4259-834c-2ab696f706c9&startDate=${startDate}&endDate=${endDate}`, {
      headers: {
        Authorization: `Bearer ${process.env.TOAST_API_KEY}`
      }
    });

    if (!toastResponse.ok) {
      const errorText = await toastResponse.text();
      console.error('Toast Partner API error:', toastResponse.status, errorText);
      return res.status(toastResponse.status).json({
        error: 'Failed to fetch Toast sales',
        message: errorText
      });
    }

    const salesData = await toastResponse.json();
    console.log('Toast Partner API response:', salesData);

    return res.status(200).json({
      success: true,
      data: salesData
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