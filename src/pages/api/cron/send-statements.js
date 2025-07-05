import { createClient } from '@supabase/supabase-js';
import htmlPdf from 'html-pdf-node';
import sgMail from '@sendgrid/mail';
import { format, subMonths, startOfMonth, endOfMonth, addDays } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// HTML template for the monthly statement
const generateStatementHTML = (member, ledgerData, statementMonth, companyInfo) => {
  const totalCharges = ledgerData
    .filter(item => item.type === 'purchase')
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  
  const totalPayments = ledgerData
    .filter(item => item.type === 'payment')
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  
  const balance = totalCharges - totalPayments;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #333; }
        .company-info { text-align: right; font-size: 12px; }
        .statement-title { text-align: center; font-size: 20px; font-weight: bold; margin: 20px 0; }
        .member-info { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .member-info h3 { margin: 0 0 10px 0; }
        .ledger-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .ledger-table th, .ledger-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .ledger-table th { background-color: #f2f2f2; font-weight: bold; }
        .ledger-table tr:nth-child(even) { background-color: #f9f9f9; }
        .amount { text-align: right; }
        .payment { color: #28a745; }
        .purchase { color: #dc3545; }
        .summary { background: #e9ecef; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .summary-row { display: flex; justify-content: space-between; margin: 5px 0; }
        .total { font-weight: bold; font-size: 16px; border-top: 2px solid #333; padding-top: 10px; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
        .due-notice { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">${companyInfo.name || 'Noir Club'}</div>
        <div class="company-info">
          <div>${companyInfo.address || '123 Main St'}</div>
          <div>${companyInfo.city || 'City'}, ${companyInfo.state || 'State'} ${companyInfo.zip || '12345'}</div>
          <div>${companyInfo.phone || '(555) 123-4567'}</div>
          <div>${companyInfo.email || 'info@noirclub.com'}</div>
        </div>
      </div>
      
      <div class="statement-title">Monthly Statement - ${statementMonth}</div>
      
      <div class="member-info">
        <h3>Member Information</h3>
        <div><strong>Name:</strong> ${member.first_name} ${member.last_name}</div>
        <div><strong>Email:</strong> ${member.email}</div>
        <div><strong>Phone:</strong> ${member.phone}</div>
        <div><strong>Membership:</strong> ${member.membership}</div>
        <div><strong>Member ID:</strong> ${member.member_id}</div>
      </div>
      
      <h3>Transaction History</h3>
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${ledgerData.map(item => `
            <tr>
              <td>${format(new Date(item.date), 'MMM dd, yyyy')}</td>
              <td>${item.note || 'No description'}</td>
              <td>${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</td>
              <td class="amount ${item.type}">
                ${item.type === 'payment' ? '+' : '-'}$${Math.abs(item.amount).toFixed(2)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="summary">
        <div class="summary-row">
          <span>Total Charges:</span>
          <span>$${totalCharges.toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span>Total Payments:</span>
          <span>$${totalPayments.toFixed(2)}</span>
        </div>
        <div class="summary-row total">
          <span>Balance:</span>
          <span>$${balance.toFixed(2)}</span>
        </div>
      </div>
      
      ${balance > 0 ? `
        <div class="due-notice">
          <strong>Payment Due Notice:</strong> You have an outstanding balance of $${balance.toFixed(2)}. 
          Please ensure payment is made before your next renewal date to avoid service interruption.
        </div>
      ` : ''}
      
      <div class="footer">
        <p>This statement was generated on ${format(new Date(), 'MMMM dd, yyyy')}.</p>
        <p>For questions about your account, please contact us at ${companyInfo.email || 'info@noirclub.com'}</p>
      </div>
    </body>
    </html>
  `;
};

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

// Function to send statement email
const sendStatementEmail = async (member, pdfBuffer, statementMonth, companyInfo) => {
  const subject = `Monthly Statement - ${statementMonth}`;
  const fileName = `statement-${member.member_id}-${statementMonth.replace(' ', '-')}.pdf`;
  
  const renewalDate = calculateNextRenewalDate(member.join_date);
  const renewalDateStr = renewalDate ? format(renewalDate, 'MMMM dd, yyyy') : 'N/A';
  
  const msg = {
    to: member.email,
    from: {
      email: companyInfo.email || 'statements@noirclub.com',
      name: companyInfo.name || 'Noir Club'
    },
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Monthly Statement - ${statementMonth}</h2>
        <p>Dear ${member.first_name},</p>
        <p>Please find attached your monthly statement for ${statementMonth}.</p>
        
        <div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #007bff;">
          <h3 style="margin: 0 0 10px 0; color: #007bff;">Important: Renewal Reminder</h3>
          <p style="margin: 0;"><strong>Your membership renewal date is: ${renewalDateStr}</strong></p>
          <p style="margin: 5px 0 0 0;">Please review your statement and ensure any outstanding balance is paid before your renewal date to avoid service interruption.</p>
        </div>
        
        <p>If you have any questions about your statement or account, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br>
        ${companyInfo.name || 'Noir Club'} Team</p>
        
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          ${companyInfo.name || 'Noir Club'}<br>
          ${companyInfo.address || '123 Main St'}<br>
          ${companyInfo.phone || '(555) 123-4567'}<br>
          ${companyInfo.email || 'info@noirclub.com'}
        </p>
      </div>
    `,
    attachments: [
      {
        content: pdfBuffer.toString('base64'),
        filename: fileName,
        type: 'application/pdf',
        disposition: 'attachment'
      }
    ]
  };

  return sgMail.send(msg);
};

// Function to log the statement sending activity
const logStatementActivity = async (results) => {
  const logData = {
    date: new Date().toISOString(),
    total_processed: results.length,
    successful_sends: results.filter(r => r.success).length,
    failed_sends: results.filter(r => !r.success).length,
    results: results
  };

  try {
    await supabase
      .from('statement_logs')
      .insert([logData]);
  } catch (error) {
    console.error('Error logging statement activity:', error);
  }
};

export default async function handler(req, res) {
  // Verify this is a cron job request (you may want to add authentication)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Starting daily statement sending job...');

  try {
    // Get company information from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .single();

    const companyInfo = {
      name: settings?.business_name || 'Noir Club',
      address: settings?.address || '123 Main St',
      city: 'City',
      state: 'State', 
      zip: '12345',
      phone: settings?.business_phone || '(555) 123-4567',
      email: settings?.business_email || 'info@noirclub.com'
    };

    // Get previous month for statement period
    const targetDate = subMonths(new Date(), 1);
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    const statementMonth = format(targetDate, 'MMMM yyyy');

    // Get all active members whose renewal date is tomorrow
    const tomorrow = addDays(new Date(), 1);
    
    const { data: allMembers, error: membersError } = await supabase
      .from('members')
      .select('*')
      .eq('deactivated', false)
      .not('join_date', 'is', null)
      .not('email', 'is', null);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return res.status(500).json({ error: 'Failed to fetch members' });
    }

    // Filter members whose renewal date is tomorrow
    const membersToProcess = allMembers.filter(member => {
      const renewalDate = calculateNextRenewalDate(member.join_date);
      if (!renewalDate) return false;
      
      // Check if renewal date is tomorrow
      const isTomorrow = renewalDate.toDateString() === tomorrow.toDateString();
      
      if (isTomorrow) {
        console.log(`Member ${member.member_id} (${member.email}) has renewal date tomorrow: ${renewalDate.toDateString()}`);
      }
      
      return isTomorrow;
    });

    console.log(`Found ${membersToProcess.length} members with renewal date tomorrow`);

    if (membersToProcess.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No members have renewal date tomorrow',
        members_processed: 0
      });
    }

    const results = [];

    // Process each member
    for (const member of membersToProcess) {
      try {
        console.log(`Processing member ${member.member_id} (${member.email})`);

        // Get ledger data for the previous month
        const { data: ledgerData, error: ledgerError } = await supabase
          .from('ledger')
          .select('*')
          .eq('account_id', member.account_id)
          .gte('date', monthStart.toISOString().split('T')[0])
          .lte('date', monthEnd.toISOString().split('T')[0])
          .order('date', { ascending: true });

        if (ledgerError) {
          console.error(`Error fetching ledger for member ${member.member_id}:`, ledgerError);
          results.push({
            member_id: member.member_id,
            email: member.email,
            success: false,
            error: 'Failed to fetch ledger data'
          });
          continue;
        }

        // Generate HTML content
        const htmlContent = generateStatementHTML(member, ledgerData, statementMonth, companyInfo);

        // Generate PDF
        const pdfOptions = {
          format: 'A4',
          margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
          printBackground: true
        };

        const pdfBuffer = await htmlPdf.generatePdf({ content: htmlContent }, pdfOptions);

        // Send email
        await sendStatementEmail(member, pdfBuffer, statementMonth, companyInfo);

        results.push({
          member_id: member.member_id,
          email: member.email,
          success: true,
          renewal_date: calculateNextRenewalDate(member.join_date)
        });

        console.log(`Statement sent successfully to ${member.email}`);

      } catch (error) {
        console.error(`Error processing member ${member.member_id}:`, error);
        results.push({
          member_id: member.member_id,
          email: member.email,
          success: false,
          error: error.message
        });
      }
    }

    // Log the activity
    await logStatementActivity(results);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Statement job completed: ${successCount} successful, ${failureCount} failed`);

    return res.status(200).json({
      success: true,
      message: `Daily statement job completed`,
      members_processed: results.length,
      successful_sends: successCount,
      failed_sends: failureCount,
      statement_month: statementMonth,
      results: results
    });

  } catch (error) {
    console.error('Error in daily statement job:', error);
    return res.status(500).json({ error: 'Failed to process daily statements' });
  }
}