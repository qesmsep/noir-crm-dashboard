const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testStripeCLIWebhook() {
  console.log('🔍 Testing Stripe Webhook with Stripe CLI...\n');

  try {
    // Check if Stripe CLI is installed
    console.log('1️⃣ Checking if Stripe CLI is installed...');
    try {
      const { stdout } = await execAsync('stripe --version');
      console.log('✅ Stripe CLI found:', stdout.trim());
    } catch (error) {
      console.log('❌ Stripe CLI not found. Please install it:');
      console.log('   https://stripe.com/docs/stripe-cli');
      return;
    }

    // Check if logged in
    console.log('\n2️⃣ Checking Stripe CLI login status...');
    try {
      const { stdout } = await execAsync('stripe config --list');
      console.log('✅ Stripe CLI configuration:');
      console.log(stdout);
    } catch (error) {
      console.log('❌ Stripe CLI not configured. Please run:');
      console.log('   stripe login');
      return;
    }

    // Test webhook forwarding
    console.log('\n3️⃣ Testing webhook forwarding...');
    console.log('   This will forward webhook events to your local server.');
    console.log('   Make sure your Next.js server is running (npm run dev)');
    console.log('   Press Ctrl+C to stop the webhook forwarding\n');

    // Start webhook forwarding
    const webhookCommand = 'stripe listen --forward-to localhost:3000/api/stripeWebhook';
    console.log('Running:', webhookCommand);
    
    const stripeProcess = exec(webhookCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error running Stripe CLI:', error);
        return;
      }
      console.log('Stripe CLI output:', stdout);
      if (stderr) console.error('Stripe CLI error:', stderr);
    });

    stripeProcess.stdout.on('data', (data) => {
      console.log('📡 Stripe CLI:', data.toString());
    });

    stripeProcess.stderr.on('data', (data) => {
      console.log('⚠️  Stripe CLI Error:', data.toString());
    });

    // Keep the process running
    stripeProcess.on('close', (code) => {
      console.log(`Stripe CLI process exited with code ${code}`);
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testStripeCLIWebhook(); 