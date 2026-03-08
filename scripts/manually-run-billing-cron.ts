import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function manuallyRunBillingCron() {
  console.log('\n🔧 Manually running billing cron job...\n');

  const cronSecret = process.env.CRON_SECRET;
  const headers: any = {
    'Content-Type': 'application/json',
  };

  if (cronSecret) {
    headers['Authorization'] = `Bearer ${cronSecret}`;
    console.log('🔑 Using CRON_SECRET for authentication');
  } else {
    console.log('⚠️  No CRON_SECRET found - running without auth (local only)');
  }
  console.log('');

  try {
    // Call the cron endpoint directly
    const response = await fetch('http://localhost:3000/api/cron/monthly-billing', {
      method: 'POST',
      headers,
    });

    const data = await response.json();

    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Body:', JSON.stringify(data, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ Cron job completed successfully');
      if (data.results) {
        console.log(`   Total: ${data.results.total}`);
        console.log(`   Succeeded: ${data.results.succeeded}`);
        console.log(`   Failed: ${data.results.failed}`);
        console.log(`   Skipped: ${data.results.skipped}`);

        if (data.results.errors && data.results.errors.length > 0) {
          console.log('\n   Errors:');
          data.results.errors.forEach((err: any) => {
            console.log(`      - ${err.account_id}: ${err.error}`);
          });
        }
      }
    } else {
      console.error('❌ Cron job failed');
    }
    console.log('');

  } catch (error: any) {
    console.error('❌ Error calling cron endpoint:', error.message);
  }
}

console.log('\n⚠️  Make sure the Next.js dev server is running (npm run dev)\n');
manuallyRunBillingCron().then(() => process.exit(0));
