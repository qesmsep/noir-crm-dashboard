import { createClient } from '@supabase/supabase-js';
import { format, addDays } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Function to calculate next renewal date based on join date
const calculateNextRenewalDate = (joinDate) => {
  if (!joinDate) return null;
  
  const join = new Date(joinDate);
  const today = new Date();
  
  // Calculate renewal date for current year
  let renewalDate = new Date(today.getFullYear(), join.getMonth(), join.getDate());
  
  // If renewal date has passed this year, use next year's date
  if (renewalDate <= today) {
    renewalDate = new Date(today.getFullYear() + 1, join.getMonth(), join.getDate());
  }
  
  return renewalDate;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const testResults = {
      timestamp: new Date().toISOString(),
      system_status: 'OK',
      checks: []
    };

    // Test 1: Database connection
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('business_name, business_email')
        .single();

      if (settingsError) {
        testResults.checks.push({
          name: 'Database Connection',
          status: 'FAIL',
          error: settingsError.message
        });
      } else {
        testResults.checks.push({
          name: 'Database Connection',
          status: 'PASS',
          details: { business_name: settings.business_name }
        });
      }
    } catch (error) {
      testResults.checks.push({
        name: 'Database Connection',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 2: Members table access
    try {
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('member_id, first_name, last_name, email, join_date, deactivated')
        .limit(5);

      if (membersError) {
        testResults.checks.push({
          name: 'Members Table Access',
          status: 'FAIL',
          error: membersError.message
        });
      } else {
        testResults.checks.push({
          name: 'Members Table Access',
          status: 'PASS',
          details: { 
            sample_count: members.length,
            active_members: members.filter(m => !m.deactivated).length
          }
        });
      }
    } catch (error) {
      testResults.checks.push({
        name: 'Members Table Access',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 3: Ledger table access
    try {
      const { data: ledger, error: ledgerError } = await supabase
        .from('ledger')
        .select('id, type, amount, date')
        .limit(3);

      if (ledgerError) {
        testResults.checks.push({
          name: 'Ledger Table Access',
          status: 'FAIL',
          error: ledgerError.message
        });
      } else {
        testResults.checks.push({
          name: 'Ledger Table Access',
          status: 'PASS',
          details: { 
            sample_count: ledger.length 
          }
        });
      }
    } catch (error) {
      testResults.checks.push({
        name: 'Ledger Table Access',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 4: Statement logs table access
    try {
      const { data: logs, error: logsError } = await supabase
        .from('statement_logs')
        .select('id, date, total_processed')
        .limit(1);

      if (logsError) {
        testResults.checks.push({
          name: 'Statement Logs Table Access',
          status: 'FAIL',
          error: logsError.message
        });
      } else {
        testResults.checks.push({
          name: 'Statement Logs Table Access',
          status: 'PASS',
          details: { 
            table_exists: true,
            recent_logs: logs.length
          }
        });
      }
    } catch (error) {
      testResults.checks.push({
        name: 'Statement Logs Table Access',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 5: Environment variables
    const envChecks = {
      sendgrid_api_key: !!process.env.SENDGRID_API_KEY,
      site_url: !!process.env.NEXT_PUBLIC_SITE_URL,
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    };

    const missingEnvVars = Object.entries(envChecks)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    testResults.checks.push({
      name: 'Environment Variables',
      status: missingEnvVars.length === 0 ? 'PASS' : 'FAIL',
      details: envChecks,
      missing: missingEnvVars
    });

    // Test 6: Renewal date calculation
    try {
      const { data: sampleMembers, error: sampleError } = await supabase
        .from('members')
        .select('member_id, first_name, last_name, join_date')
        .not('join_date', 'is', null)
        .limit(3);

      if (sampleError) {
        testResults.checks.push({
          name: 'Renewal Date Calculation',
          status: 'FAIL',
          error: sampleError.message
        });
      } else {
        const renewalSamples = sampleMembers.map(member => {
          const renewalDate = calculateNextRenewalDate(member.join_date);
          return {
            member_id: member.member_id,
            name: `${member.first_name} ${member.last_name}`,
            join_date: member.join_date,
            next_renewal: renewalDate ? format(renewalDate, 'yyyy-MM-dd') : null
          };
        });

        testResults.checks.push({
          name: 'Renewal Date Calculation',
          status: 'PASS',
          details: { samples: renewalSamples }
        });
      }
    } catch (error) {
      testResults.checks.push({
        name: 'Renewal Date Calculation',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 7: Check for members with tomorrow's renewal date
    try {
      const tomorrow = addDays(new Date(), 1);
      
      const { data: allMembers, error: allMembersError } = await supabase
        .from('members')
        .select('member_id, first_name, last_name, email, join_date')
        .eq('deactivated', false)
        .not('join_date', 'is', null)
        .not('email', 'is', null);

      if (allMembersError) {
        testResults.checks.push({
          name: 'Tomorrow Renewal Check',
          status: 'FAIL',
          error: allMembersError.message
        });
      } else {
        const tomorrowRenewals = allMembers.filter(member => {
          const renewalDate = calculateNextRenewalDate(member.join_date);
          return renewalDate && renewalDate.toDateString() === tomorrow.toDateString();
        });

        testResults.checks.push({
          name: 'Tomorrow Renewal Check',
          status: 'PASS',
          details: { 
            tomorrow_date: format(tomorrow, 'yyyy-MM-dd'),
            members_with_tomorrow_renewal: tomorrowRenewals.length,
            members: tomorrowRenewals.map(m => ({
              member_id: m.member_id,
              name: `${m.first_name} ${m.last_name}`,
              email: m.email
            }))
          }
        });
      }
    } catch (error) {
      testResults.checks.push({
        name: 'Tomorrow Renewal Check',
        status: 'FAIL',
        error: error.message
      });
    }

    // Overall system status
    const failedChecks = testResults.checks.filter(check => check.status === 'FAIL');
    if (failedChecks.length > 0) {
      testResults.system_status = 'DEGRADED';
      testResults.failed_checks = failedChecks.length;
    }

    return res.status(200).json(testResults);

  } catch (error) {
    console.error('Error in test-statement-system:', error);
    return res.status(500).json({ 
      error: 'Test failed', 
      details: error.message,
      system_status: 'ERROR'
    });
  }
}