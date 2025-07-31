import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

// Type definitions for charge results
interface ChargeResult {
  member_id: string;
  account_id: string;
  status: 'success' | 'failed' | 'no_charge_needed';
  payment_intent_id?: string;
  amount?: number;
  error?: string;
  action?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is a legitimate Vercel cron request or authorized token
  const isVercelCron = req.headers['x-vercel-cron'] === '1' || 
                      req.headers['user-agent']?.includes('Vercel') ||
                      req.headers['x-vercel-deployment-url'];

  if (!isVercelCron) {
    // For manual testing, allow with a secret token
    let token: string | undefined;
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - Only Vercel cron jobs or authorized tokens allowed' });
    }

    // Verify token
    if (token !== process.env.CAMPAIGN_PROCESSING_TOKEN) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  try {
    console.log('🚀 Starting monthly credit processing...');
    console.log('⏰ Processing time:', new Date().toISOString());
    
    // Call the database function to process credits
    const { data: creditResults, error: creditError } = await supabaseAdmin
      .rpc('process_monthly_credits');

    if (creditError) {
      console.error('❌ Error processing monthly credits:', creditError);
      return res.status(500).json({ error: 'Failed to process monthly credits', details: creditError });
    }

    if (!creditResults || creditResults.length === 0) {
      console.log('ℹ️  No Skyline members due for renewal today');
      return res.status(200).json({ 
        message: 'No Skyline members due for renewal today',
        processed: 0,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📊 Processing ${creditResults.length} Skyline members`);

    // Process Stripe charges for members who need to be charged
    const chargeResults: ChargeResult[] = [];
    for (const result of creditResults) {
      if (result.action_taken === 'charge_applied' && result.charge_amount > 0) {
        try {
          // Get the member's Stripe customer ID
          const { data: account, error: accountError } = await supabaseAdmin
            .from('accounts')
            .select('stripe_customer_id')
            .eq('account_id', result.account_id)
            .single();

          if (accountError || !account?.stripe_customer_id) {
            console.warn(`⚠️  No Stripe customer found for account ${result.account_id}`);
            chargeResults.push({
              member_id: result.member_id,
              account_id: result.account_id,
              status: 'failed',
              error: 'No Stripe customer found'
            });
            continue;
          }

          // Create Stripe charge
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(result.charge_amount * 100), // Convert to cents
            currency: 'usd',
            customer: account.stripe_customer_id,
            description: `Monthly Skyline overspend charge - ${result.charge_amount}`,
            automatic_payment_methods: {
              enabled: true,
            },
            confirm: true,
            off_session: true,
          });

          // Update ledger with Stripe payment intent ID
          await supabaseAdmin
            .from('ledger')
            .update({ 
              stripe_payment_intent_id: paymentIntent.id 
            })
            .eq('member_id', result.member_id)
            .eq('type', 'charge')
            .eq('date', new Date().toISOString().split('T')[0]);

          chargeResults.push({
            member_id: result.member_id,
            account_id: result.account_id,
            status: 'success',
            payment_intent_id: paymentIntent.id,
            amount: result.charge_amount
          });

          console.log(`✅ Successfully charged ${result.charge_amount} for member ${result.member_id}`);

        } catch (stripeError: any) {
          console.error(`❌ Stripe charge failed for member ${result.member_id}:`, stripeError);
          chargeResults.push({
            member_id: result.member_id,
            account_id: result.account_id,
            status: 'failed',
            error: stripeError.message
          });
        }
      } else {
        chargeResults.push({
          member_id: result.member_id,
          account_id: result.account_id,
          status: 'no_charge_needed',
          action: result.action_taken
        });
      }
    }

    // Calculate summary statistics
    const successfulCharges = chargeResults.filter(r => r.status === 'success').length;
    const failedCharges = chargeResults.filter(r => r.status === 'failed').length;
    const noChargeNeeded = chargeResults.filter(r => r.status === 'no_charge_needed').length;

    console.log(`🎉 Processing completed: ${successfulCharges} successful charges, ${failedCharges} failed charges, ${noChargeNeeded} no charge needed`);

    return res.status(200).json({
      message: 'Monthly credit processing completed',
      processed: creditResults.length,
      credit_results: creditResults,
      charge_results: chargeResults,
      summary: {
        total_processed: creditResults.length,
        successful_charges: successfulCharges,
        failed_charges: failedCharges,
        no_charge_needed: noChargeNeeded
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error in monthly credit processing:', error);
    return res.status(500).json({ 
      error: 'Monthly credit processing failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 