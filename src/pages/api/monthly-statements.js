import { createClient } from '@supabase/supabase-js';
import htmlPdf from 'html-pdf-node';
import { format, subMonths, startOfMonth, endOfMonth, addDays, isBefore } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { member_id, account_id, month, year } = req.body;

    if (!member_id && !account_id) {
      return res.status(400).json({ error: 'Either member_id or account_id is required' });
    }

    // Default to previous month if not specified
    const targetDate = month && year ? 
      new Date(year, month - 1, 1) : 
      subMonths(new Date(), 1);
    
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    const statementMonth = format(targetDate, 'MMMM yyyy');

    // Get member information
    let memberQuery = supabase.from('members').select('*');
    if (member_id) {
      memberQuery = memberQuery.eq('member_id', member_id);
    } else {
      memberQuery = memberQuery.eq('account_id', account_id);
    }

    const { data: memberData, error: memberError } = await memberQuery.single();

    if (memberError || !memberData) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get ledger data for the specified month
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('ledger')
      .select('*')
      .eq('account_id', memberData.account_id)
      .gte('date', monthStart.toISOString().split('T')[0])
      .lte('date', monthEnd.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (ledgerError) {
      return res.status(500).json({ error: 'Failed to fetch ledger data' });
    }

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

    // Generate HTML content
    const htmlContent = generateStatementHTML(memberData, ledgerData, statementMonth, companyInfo);

    // Generate PDF
    const pdfOptions = {
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      printBackground: true
    };

    const pdfBuffer = await htmlPdf.generatePdf({ content: htmlContent }, pdfOptions);

    // Return PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${memberData.member_id}-${statementMonth.replace(' ', '-')}.pdf"`);
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating monthly statement:', error);
    return res.status(500).json({ error: 'Failed to generate statement' });
  }
}