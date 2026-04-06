import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('🚀 Applying SMS Intake Campaigns Migration...');
  console.log('');

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment');
    console.error('');
    console.error('To run migrations automatically, add DATABASE_URL to .env.local');
    console.error('Get it from: Supabase Dashboard → Settings → Database → Connection String (Direct)');
    console.error('');
    console.error('Alternatively, run migration manually in Supabase SQL Editor:');
    console.error('  supabase/migrations/20260406_create_sms_intake_campaigns_system.sql');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    console.log('');

    const migrationFile = '20260406_create_sms_intake_campaigns_system.sql';
    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations', migrationFile);

    console.log(`📝 Applying ${migrationFile}...`);
    console.log('');

    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
      await client.query(sql);
      console.log(`✅ Successfully applied ${migrationFile}`);
      console.log('');
    } catch (error: any) {
      console.error(`❌ Error applying ${migrationFile}:`);
      console.error(error.message);
      console.error('');
      throw error;
    }

    console.log('🔍 Running verification checks...');
    console.log('');

    // Verify tables created
    const tablesCheck = await client.query(`
      SELECT
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_name IN (
        'sms_intake_campaigns',
        'sms_intake_campaign_messages',
        'sms_intake_enrollments',
        'sms_intake_scheduled_messages'
      )
      ORDER BY table_name
    `);
    console.log('✅ Tables created:');
    tablesCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name} (${row.column_count} columns)`);
    });
    console.log('');

    // Verify RLS enabled
    const rlsCheck = await client.query(`
      SELECT
        relname as table_name,
        relrowsecurity as rls_enabled
      FROM pg_class
      WHERE relname IN (
        'sms_intake_campaigns',
        'sms_intake_campaign_messages',
        'sms_intake_enrollments',
        'sms_intake_scheduled_messages'
      )
      ORDER BY relname
    `);
    const allRlsEnabled = rlsCheck.rows.every(row => row.rls_enabled);
    if (allRlsEnabled) {
      console.log('✅ RLS enabled on all tables');
    } else {
      console.warn('⚠️  RLS not enabled on some tables!');
    }
    console.log('');

    // Verify policies created
    const policiesCheck = await client.query(`
      SELECT COUNT(*) as policy_count
      FROM pg_policies
      WHERE tablename IN (
        'sms_intake_campaigns',
        'sms_intake_campaign_messages',
        'sms_intake_enrollments',
        'sms_intake_scheduled_messages'
      )
    `);
    console.log(`✅ RLS policies created: ${policiesCheck.rows[0].policy_count}`);
    console.log('');

    // Verify campaign seeded
    const campaignCheck = await client.query(`
      SELECT
        name,
        trigger_word,
        status,
        cancel_on_signup,
        (SELECT COUNT(*) FROM sms_intake_campaign_messages WHERE campaign_id = sms_intake_campaigns.id) as message_count
      FROM sms_intake_campaigns
      WHERE LOWER(trigger_word) = 'membership'
    `);

    if (campaignCheck.rows.length > 0) {
      const campaign = campaignCheck.rows[0];
      console.log('✅ Membership Nurture Flow campaign seeded:');
      console.log(`   - Name: ${campaign.name}`);
      console.log(`   - Trigger: ${campaign.trigger_word}`);
      console.log(`   - Status: ${campaign.status}`);
      console.log(`   - Cancel on Signup: ${campaign.cancel_on_signup}`);
      console.log(`   - Messages: ${campaign.message_count}`);
      console.log('');
    } else {
      console.error('❌ Campaign not seeded!');
    }

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('🎉 SMS Membership Nurture Flow is now active!');
    console.log('');
    console.log('📱 Test it by texting "MEMBERSHIP" to your OpenPhone number');
    console.log('');

    // Check OpenPhone credentials
    const hasOpenPhoneKey = !!process.env.OPENPHONE_API_KEY;
    const hasPhoneNumberId = !!process.env.OPENPHONE_PHONE_NUMBER_ID;

    if (!hasOpenPhoneKey || !hasPhoneNumberId) {
      console.log('⚠️  OpenPhone credentials not configured:');
      if (!hasOpenPhoneKey) console.log('   - Missing OPENPHONE_API_KEY');
      if (!hasPhoneNumberId) console.log('   - Missing OPENPHONE_PHONE_NUMBER_ID');
      console.log('');
      console.log('   SMS messages will not be sent until these are configured in .env.local');
      console.log('');
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
