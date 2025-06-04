import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.openphone.co/v1/phone_numbers', {
      headers: {
        'Authorization': process.env.OPENPHONE_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    const text = await response.text();
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    res.status(200).json({
      status: response.status,
      statusText: response.statusText,
      headers,
      body: text,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
} 