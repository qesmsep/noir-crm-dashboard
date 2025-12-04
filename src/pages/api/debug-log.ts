import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Server-side debug logging endpoint
 * Receives logs from client-side code and outputs them to terminal
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { level, message, data, component } = req.body;

    // Format timestamp
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${component || 'UNKNOWN'}]`;

    // Format data for better readability
    const formattedData = data && typeof data === 'object' 
      ? JSON.stringify(data, null, 2) 
      : data || '';

    // Output to terminal with appropriate formatting
    switch (level) {
      case 'error':
        console.error(`🔴 ${prefix} ${message}`, formattedData);
        break;
      case 'warn':
        console.warn(`⚠️  ${prefix} ${message}`, formattedData);
        break;
      case 'info':
        console.log(`🟢 ${prefix} ${message}`, formattedData);
        break;
      case 'nav':
        console.log(`🔵 ${prefix} ${message}`, formattedData);
        break;
      case 'setup':
        console.log(`🟡 ${prefix} ${message}`, formattedData);
        break;
      default:
        console.log(`${prefix} ${message}`, formattedData);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in debug-log endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

