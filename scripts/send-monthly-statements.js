#!/usr/bin/env node
/**
 * Monthly Statement Sending Cron Job
 * 
 * This script runs daily and sends monthly statements to members
 * whose renewal date is tomorrow.
 * 
 * Usage: node scripts/send-monthly-statements.js
 * 
 * Set up as a cron job:
 * 0 9 * * * /usr/bin/node /path/to/your/project/scripts/send-monthly-statements.js
 * 
 * This will run daily at 9 AM
 */

const https = require('https');
const http = require('http');
require('dotenv').config();

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const WEBHOOK_ENDPOINT = '/api/cron/send-statements';

// Function to make HTTP request
const makeRequest = (url, options) => {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    
    const req = lib.request(url, options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: response });
        } catch (error) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
};

async function sendStatements() {
  console.log('Starting monthly statement sending job...');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const url = `${BASE_URL}${WEBHOOK_ENDPOINT}`;
    console.log('Calling:', url);
    
    const response = await makeRequest(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Monthly-Statement-Cron/1.0'
      }
    });
    
    console.log('Response Status:', response.statusCode);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.statusCode === 200) {
      console.log('✅ Monthly statement job completed successfully');
      
      if (response.data.members_processed > 0) {
        console.log(`📧 Sent ${response.data.successful_sends} statements successfully`);
        if (response.data.failed_sends > 0) {
          console.log(`❌ Failed to send ${response.data.failed_sends} statements`);
        }
      } else {
        console.log('ℹ️ No members have renewal date tomorrow');
      }
    } else {
      console.error('❌ Failed to execute monthly statement job');
      console.error('Status:', response.statusCode);
      console.error('Error:', response.data);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error executing monthly statement job:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No statements will be sent');
  console.log('This would normally call:', `${BASE_URL}${WEBHOOK_ENDPOINT}`);
  console.log('To run for real, remove the --dry-run flag');
  process.exit(0);
}

if (isVerbose) {
  console.log('🔧 Configuration:');
  console.log('  Base URL:', BASE_URL);
  console.log('  Webhook Endpoint:', WEBHOOK_ENDPOINT);
  console.log('  Full URL:', `${BASE_URL}${WEBHOOK_ENDPOINT}`);
  console.log('');
}

// Run the job
sendStatements();