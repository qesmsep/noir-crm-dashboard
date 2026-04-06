import * as dotenv from 'dotenv';
import * as path from 'path';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-12-18.acacia',
});

async function checkInvoices() {
  const customerId = 'cus_TWiVUNiJUXYwVA';

  console.log('🔍 Checking Stripe invoices for customer:', customerId);
  console.log('');

  // Get recent invoices
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit: 10,
  });

  console.log('📄 Recent invoices:');
  invoices.data.forEach(invoice => {
    const date = new Date(invoice.created * 1000).toISOString().split('T')[0];
    const paidDate = invoice.status_transitions.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString().split('T')[0]
      : 'N/A';
    console.log('');
    console.log('   Invoice:', invoice.id);
    console.log('   Created:', date);
    console.log('   Paid:', paidDate);
    console.log('   Amount:', '$' + (invoice.amount_paid / 100).toFixed(2));
    console.log('   Status:', invoice.status);
    console.log('   Subscription:', invoice.subscription);
  });

  // Check for yesterday's invoice specifically
  console.log('\n\n💳 Checking for yesterday\'s charge...');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const yesterdayInvoices = invoices.data.filter(inv => {
    const createdDate = new Date(inv.created * 1000);
    return createdDate >= yesterday && createdDate <= yesterdayEnd;
  });

  if (yesterdayInvoices.length > 0) {
    console.log(`✅ Found ${yesterdayInvoices.length} invoice(s) from yesterday:`);
    yesterdayInvoices.forEach(invoice => {
      console.log('   Invoice:', invoice.id);
      console.log('   Amount:', '$' + (invoice.amount_paid / 100).toFixed(2));
      console.log('   Status:', invoice.status);
      console.log('   Charge:', invoice.charge);
    });
  } else {
    console.log('❌ No invoices found from yesterday');
  }
}

checkInvoices();
