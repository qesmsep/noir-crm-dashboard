import PDFDocument from 'pdfkit';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export class LedgerPdfGenerator {
  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: 'Noir Member Ledger',
        Author: 'Noir CRM System',
        Subject: 'Monthly Member Ledger',
        Keywords: 'ledger, member, noir',
        CreationDate: new Date()
      }
    });
  }

  async generateLedgerPdf(memberId, accountId, startDate, endDate) {
    try {
      // Get member information
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('member_id', memberId)
        .single();

      if (memberError || !member) {
        throw new Error('Member not found');
      }

      // Get all members in the account
      const { data: accountMembers, error: accountError } = await supabase
        .from('members')
        .select('*')
        .eq('account_id', accountId)
        .order('member_type', { ascending: true });

      if (accountError) {
        throw new Error('Failed to fetch account members');
      }

      // Get ledger transactions for the account within the date range
      const { data: transactions, error: ledgerError } = await supabase
        .from('ledger')
        .select('*')
        .eq('account_id', accountId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (ledgerError) {
        throw new Error('Failed to fetch ledger transactions');
      }

      // Get transaction attachments for the period
      let transactionAttachments = [];
      if (transactions && transactions.length > 0) {
        const ledgerIds = transactions.map(tx => tx.id);
        const { data: attachments, error: attachmentsError } = await supabase
          .from('transaction_attachments')
          .select('*')
          .in('ledger_id', ledgerIds)
          .order('uploaded_at', { ascending: true });

        if (attachmentsError) {
          console.error('Error fetching attachments:', attachmentsError);
          // Don't fail the PDF generation if attachments can't be fetched
        } else {
          transactionAttachments = attachments || [];
        }
      }

      // Calculate prior balance (sum of all entries before startDate)
      const { data: priorEntries } = await supabase
        .from('ledger')
        .select('amount')
        .eq('account_id', accountId)
        .lt('date', startDate);
      const priorBalance = priorEntries ? priorEntries.reduce((sum, e) => sum + (e.amount || 0), 0) : 0;

      // Calculate previous membership period based on member join date
      let lastRenewalDate = null;
      let nextRenewalDate = null;
      let previousPeriodEntries = [];
      
      if (member.join_date) {
        const today = new Date();
        const joinDate = new Date(member.join_date);
        
        // Calculate how many months have passed since join date
        const monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                               (today.getMonth() - joinDate.getMonth());
        
        if (monthsSinceJoin >= 1) {
          // Calculate the end of the previous membership period
          const previousPeriodEnd = new Date(joinDate);
          previousPeriodEnd.setMonth(joinDate.getMonth() + monthsSinceJoin);
          previousPeriodEnd.setDate(joinDate.getDate() - 1); // Day before current period
          
          // Calculate the start of the previous membership period
          const previousPeriodStart = new Date(joinDate);
          previousPeriodStart.setMonth(joinDate.getMonth() + monthsSinceJoin - 1);
          previousPeriodStart.setDate(joinDate.getDate());
          
          lastRenewalDate = previousPeriodEnd.toISOString().split('T')[0];
          nextRenewalDate = previousPeriodStart.toISOString().split('T')[0];
          
          // Fetch previous membership period entries
          const { data: prevPeriod } = await supabase
            .from('ledger')
            .select('*')
            .eq('account_id', accountId)
            .gte('date', nextRenewalDate)
            .lte('date', lastRenewalDate);
          previousPeriodEntries = prevPeriod || [];
        }
      }

      // Generate PDF
      const pdfBuffer = await this.createPdfBuffer(member, accountMembers, transactions, transactionAttachments, startDate, endDate, priorBalance, previousPeriodEntries, lastRenewalDate, nextRenewalDate);
      return pdfBuffer;
    } catch (error) {
      console.error('Error generating ledger PDF:', error);
      throw error;
    }
  }

  async createPdfBuffer(member, accountMembers, transactions, transactionAttachments, startDate, endDate, priorBalance, previousPeriodEntries, lastRenewalDate, nextRenewalDate) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      this.doc.on('data', chunk => chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);
      this.generatePdfContent(member, accountMembers, transactions, transactionAttachments, startDate, endDate, priorBalance, previousPeriodEntries, lastRenewalDate, nextRenewalDate);
      this.doc.end();
    });
  }

  generatePdfContent(member, accountMembers, transactions, transactionAttachments, startDate, endDate, priorBalance, previousPeriodEntries, lastRenewalDate, nextRenewalDate) {
    // Header
    this.doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('NOIR MEMBER LEDGER', { align: 'center' })
      .moveDown(0.5);
    // Member Information
    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Member Information')
      .moveDown(0.3);
    this.doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Name: ${member.first_name} ${member.last_name}`)
      .text(`Membership: ${member.membership || 'N/A'}`)
      .text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`)
      .moveDown(1);
    // Account Members (if multiple)
    if (accountMembers.length > 1) {
      this.doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Account Members')
        .moveDown(0.3);
      accountMembers.forEach(accMember => {
        this.doc
          .fontSize(10)
          .font('Helvetica')
          .text(`• ${accMember.first_name} ${accMember.last_name} (${accMember.member_type || 'member'})`);
      });
      this.doc.moveDown(1);
    }
    // Previous Membership Period Section - REMOVED
    // We only want to show the main transaction details for the selected period
    // Summary
    const summary = this.calculateSummary(transactions);
    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Summary')
      .moveDown(0.3);
    this.doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Total Payments: $${summary.totalPayments.toFixed(2)}`)
      .text(`Total Purchases: $${summary.totalPurchases.toFixed(2)}`)
      .text(`Net Balance: $${summary.netBalance.toFixed(2)}`)
      .moveDown(1);
    // Transactions Table
    if (transactions.length > 0) {
      this.doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Transaction Details');
      const tableTop = this.doc.y;
      const tableLeft = 50;
      const colWidth = 80; // Column width for most columns
      const descColWidth = 120; // Wider column for description
      const rowHeight = 25; // Increased row height for better readability
      this.doc.fontSize(9).font('Helvetica-Bold')
        .text('Date', tableLeft, tableTop)
        .text('Description', tableLeft + colWidth, tableTop)
        .text('Type', tableLeft + colWidth + descColWidth, tableTop)
        .text('Amount', tableLeft + colWidth + descColWidth + colWidth, tableTop)
        .text('Balance', tableLeft + colWidth + descColWidth + colWidth * 2, tableTop)
        .text('Files', tableLeft + colWidth + descColWidth + colWidth * 3, tableTop);
      this.doc.moveTo(tableLeft, tableTop + 15).lineTo(tableLeft + colWidth + descColWidth + colWidth * 4, tableTop + 15).stroke();
      // Create a map of attachments by ledger_id for quick lookup
      const attachmentsByLedgerId = {};
      transactionAttachments.forEach(attachment => {
        if (!attachmentsByLedgerId[attachment.ledger_id]) {
          attachmentsByLedgerId[attachment.ledger_id] = [];
        }
        attachmentsByLedgerId[attachment.ledger_id].push(attachment);
      });
      
      let currentY = tableTop + 20;
      let runningBalance = priorBalance;
      
      transactions.forEach((entry) => {
        const attachments = attachmentsByLedgerId[entry.id] || [];
        // Check if we need a new page
        if (currentY > 700) { // If we're getting close to the bottom
          this.doc.addPage();
          currentY = 50; // Reset to top of new page
        }
        
        this.doc.fontSize(8).font('Helvetica')
          .text(new Date(entry.date).toLocaleDateString(), tableLeft, currentY)
          .text(entry.note || 'No description', tableLeft + colWidth, currentY, { width: descColWidth - 5 })
          .text(entry.type || '', tableLeft + colWidth + descColWidth, currentY)
          .text(`$${entry.amount.toFixed(2)}`, tableLeft + colWidth + descColWidth + colWidth, currentY)
          .text(`$${runningBalance.toFixed(2)}`, tableLeft + colWidth + descColWidth + colWidth * 2, currentY);
        
        // Add Files column with clickable link if attachments exist
        if (attachments.length > 0) {
          // Use the first attachment's URL for the link
          const attachmentUrl = attachments[0].file_url;
          this.doc
            .fillColor('blue')
            .text('link', tableLeft + colWidth + descColWidth + colWidth * 3, currentY, { 
              underline: true, 
              link: attachmentUrl
            })
            .fillColor('black');
        }
        
        runningBalance += entry.amount;
        currentY += rowHeight;
      });
      // Draw bottom line after table
      this.doc.moveTo(tableLeft, currentY - 5).lineTo(tableLeft + colWidth + descColWidth + colWidth * 4, currentY - 5).stroke();
      // Add space before footer
      this.doc.moveDown(2);
    } else {
      this.doc
        .fontSize(12)
        .font('Helvetica')
        .text('No transactions found for this period.')
        .moveDown(1);
    }
    
    // Footer
    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Generated on ${new Date().toLocaleDateString()}\nat ${new Date().toLocaleTimeString()}\nNoir CRM System\nAccount ID: ${member.account_id}`, { align: 'right' });
    
    // Add note about opening links in new tabs
    this.doc
      .fontSize(8)
      .font('Helvetica')
      .text('Note: To open attachment links in a new tab, right-click the link and select "Open in new tab" or hold Ctrl/Cmd while clicking.', { align: 'center' });
  }

  calculateSummary(transactions) {
    let totalPayments = 0;
    let totalPurchases = 0;
    transactions.forEach(transaction => {
      const amount = Number(transaction.amount);
      if (transaction.type === 'payment') {
        totalPayments += amount;
      } else if (transaction.type === 'purchase') {
        // Purchases are already negative amounts, so we add them (which subtracts)
        totalPurchases += amount;
      }
    });
    
    // Net balance is payments + purchases (since purchases are negative)
    const netBalance = totalPayments + totalPurchases;
    
    return {
      totalPayments,
      totalPurchases,
      netBalance
    };
  }
}

export default LedgerPdfGenerator; 