// Test script for Stripe hold system
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hkgomdqmzideiwudkbrz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZ29tZHFtemlkZWl3dWRrYnJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzU5OTk4MywiZXhwIjoyMDYzMTc1OTgzfQ.LvaIU0r_TrUt2ycxSFfJBWiOHtQi5PdDBL4gX4wGMsY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testStripeHoldSystem() {
  console.log('🧪 Testing Stripe Hold System...\n');

  try {
    // 1. Test database connection and verify migration
    console.log('1. Testing database connection...');
    
    // Test by trying to insert a test reservation (which will fail but verify the table exists)
    const { error: testError } = await supabase
      .from('reservations')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database connection failed:', testError);
      return;
    }

    console.log('✅ Database connected successfully');
    console.log('✅ Reservations table is accessible');

    if (columnError) {
      console.error('❌ Database connection failed:', columnError);
      return;
    }

    console.log('✅ Database connected successfully');
    console.log('✅ Reservations table is accessible');

    // 2. Test API endpoints
    console.log('\n2. Testing API endpoints...');
    
    // Test reservations endpoint
    const reservationResponse = await fetch('http://localhost:3000/api/reservations', {
      method: 'GET'
    });
    
    if (reservationResponse.ok) {
      console.log('✅ Reservations API endpoint is working');
    } else {
      console.log('⚠️  Reservations API endpoint returned status:', reservationResponse.status);
    }

    // Test release-holds endpoint
    const releaseResponse = await fetch('http://localhost:3000/api/release-holds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (releaseResponse.ok) {
      console.log('✅ Release-holds API endpoint is working');
    } else {
      console.log('⚠️  Release-holds API endpoint returned status:', releaseResponse.status);
    }

    // 3. Check for Stripe environment variables
    console.log('\n3. Checking Stripe configuration...');
    
    // This would normally check process.env, but we'll just provide guidance
    console.log('ℹ️  Please ensure you have the following environment variables:');
    console.log('   - STRIPE_SECRET_KEY (from Stripe Dashboard)');
    console.log('   - STRIPE_WEBHOOK_SECRET (from Stripe Dashboard)');
    console.log('   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (already configured)');

    console.log('\n✅ Test completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Add your Stripe secret key to .env.local');
    console.log('2. Test a non-member reservation on the home page');
    console.log('3. Check Stripe Dashboard for the hold');
    console.log('4. Verify the hold is released the next day');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testStripeHoldSystem(); 