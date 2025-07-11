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

      // Calculate prior balance (sum of all entries before startDate)
      const { data: priorEntries } = await supabase
        .from('ledger')
        .select('amount')
        .eq('account_id', accountId)
        .lt('date', startDate);
      const priorBalance = priorEntries ? priorEntries.reduce((sum, e) => sum + (e.amount || 0), 0) : 0;

      // Fetch renewal dates (using description contains 'renewal')
      const { data: renewalEntries } = await supabase
        .from('ledger')
        .select('date')
        .eq('account_id', accountId)
        .ilike('description', '%renewal%')
        .order('date', { ascending: false });
      let lastRenewalDate = null;
      let nextRenewalDate = null;
      if (renewalEntries && renewalEntries.length > 0) {
        lastRenewalDate = renewalEntries[0].date;
        if (renewalEntries.length > 1) {
          nextRenewalDate = renewalEntries[1].date;
        }
      }
      // Fetch previous membership period entries if renewal dates found
      let previousPeriodEntries = [];
      if (lastRenewalDate && nextRenewalDate) {
        const { data: prevPeriod } = await supabase
          .from('ledger')
          .select('*')
          .eq('account_id', accountId)
          .gte('date', nextRenewalDate)
          .lt('date', lastRenewalDate);
        previousPeriodEntries = prevPeriod || [];
      }

      // Generate PDF
      const pdfBuffer = await this.createPdfBuffer(member, accountMembers, transactions, startDate, endDate, priorBalance, previousPeriodEntries, lastRenewalDate, nextRenewalDate);
      return pdfBuffer;
    } catch (error) {
      console.error('Error generating ledger PDF:', error);
      throw error;
    }
  }

  async createPdfBuffer(member, accountMembers, transactions, startDate, endDate, priorBalance, previousPeriodEntries, lastRenewalDate, nextRenewalDate) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      this.doc.on('data', chunk => chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);
      this.generatePdfContent(member, accountMembers, transactions, startDate, endDate, priorBalance, previousPeriodEntries, lastRenewalDate, nextRenewalDate);
      this.doc.end();
    });
  }

  generatePdfContent(member, accountMembers, transactions, startDate, endDate, priorBalance, previousPeriodEntries, lastRenewalDate, nextRenewalDate) {
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
      .text(`Account ID: ${member.account_id}`)
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
    // Previous Membership Period Section
    if (lastRenewalDate && nextRenewalDate && previousPeriodEntries.length > 0) {
      this.doc.fontSize(14).font('Helvetica-Bold').text('Previous Membership Period', { underline: true });
      this.doc.fontSize(10).font('Helvetica').text(`From: ${new Date(nextRenewalDate).toLocaleDateString()} To: ${new Date(new Date(lastRenewalDate).getTime() - 86400000).toLocaleDateString()}`);
      this.doc.moveDown(0.5);
      // Table header
      const prevTableTop = this.doc.y;
      const tableLeft = 50;
      const colWidth = 120;
      const rowHeight = 20;
      this.doc.fontSize(10).font('Helvetica-Bold')
        .text('Date', tableLeft, prevTableTop)
        .text('Description', tableLeft + colWidth, prevTableTop)
        .text('Amount', tableLeft + colWidth * 2, prevTableTop);
      this.doc.moveTo(tableLeft, prevTableTop + 15).lineTo(tableLeft + colWidth * 3, prevTableTop + 15).stroke();
      let prevY = prevTableTop + 20;
      previousPeriodEntries.forEach((entry) => {
        this.doc.fontSize(9).font('Helvetica')
          .text(new Date(entry.date).toLocaleDateString(), tableLeft, prevY)
          .text(entry.description || 'No description', tableLeft + colWidth, prevY)
          .text(`$${entry.amount.toFixed(2)}`, tableLeft + colWidth * 2, prevY);
        prevY += rowHeight;
      });
      this.doc.moveDown(1);
    }
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
      const colWidth = 120;
      const rowHeight = 20;
      this.doc.fontSize(10).font('Helvetica-Bold')
        .text('Date', tableLeft, tableTop)
        .text('Description', tableLeft + colWidth, tableTop)
        .text('Type', tableLeft + colWidth * 2, tableTop)
        .text('Amount', tableLeft + colWidth * 3, tableTop)
        .text('Balance', tableLeft + colWidth * 4, tableTop);
      this.doc.moveTo(tableLeft, tableTop + 15).lineTo(tableLeft + colWidth * 5, tableTop + 15).stroke();
      let currentY = tableTop + 20;
      let runningBalance = priorBalance;
      transactions.forEach((entry) => {
        this.doc.fontSize(9).font('Helvetica')
          .text(new Date(entry.date).toLocaleDateString(), tableLeft, currentY)
          .text(entry.description || 'No description', tableLeft + colWidth, currentY)
          .text(entry.type || '', tableLeft + colWidth * 2, currentY)
          .text(`$${entry.amount.toFixed(2)}`, tableLeft + colWidth * 3, currentY)
          .text(`$${runningBalance.toFixed(2)}`, tableLeft + colWidth * 4, currentY);
        runningBalance += entry.amount;
        currentY += rowHeight;
      });
      // Draw bottom line after table
      this.doc.moveTo(tableLeft, currentY - 5).lineTo(tableLeft + colWidth * 5, currentY - 5).stroke();
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
      .text(`Generated on ${new Date().toLocaleDateString()}\nat ${new Date().toLocaleTimeString()}\nNoir CRM System`, { align: 'right' });
  }

  calculateSummary(transactions) {
    let totalPayments = 0;
    let totalPurchases = 0;
    transactions.forEach(transaction => {
      const amount = Number(transaction.amount);
      if (transaction.type === 'payment') {
        totalPayments += amount;
      } else if (transaction.type === 'purchase') {
        totalPurchases += amount;
      }
    });
    return {
      totalPayments,
      totalPurchases,
      netBalance: totalPayments - totalPurchases
    };
  }
}

export default LedgerPdfGenerator; 