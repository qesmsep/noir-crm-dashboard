import { exec } from 'child_process';

export default function handler(req, res) {
  exec(
    `curl -v -H "Authorization: ${process.env.OPENPHONE_API_KEY}" https://api.openphone.com/v1/phone_numbers`,
    (error, stdout, stderr) => {
      res.status(200).json({ error: error ? error.message : null, stdout, stderr });
    }
  );
} 