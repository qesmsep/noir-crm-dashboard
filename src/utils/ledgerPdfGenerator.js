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

      // Generate PDF
      const pdfBuffer = await this.createPdfBuffer(member, accountMembers, transactions, startDate, endDate);
      
      return pdfBuffer;
    } catch (error) {
      console.error('Error generating ledger PDF:', error);
      throw error;
    }
  }

  async createPdfBuffer(member, accountMembers, transactions, startDate, endDate) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      this.doc.on('data', chunk => chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);

      this.generatePdfContent(member, accountMembers, transactions, startDate, endDate);
      this.doc.end();
    });
  }

  generatePdfContent(member, accountMembers, transactions, startDate, endDate) {
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
        .text('Transaction Details')
        .moveDown(0.3);

      // Table header
      const tableTop = this.doc.y;
      const tableLeft = 50;
      const colWidths = [80, 200, 100, 100]; // Date, Description, Type, Amount
      
      this.doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Date', tableLeft, tableTop)
        .text('Description', tableLeft + colWidths[0], tableTop)
        .text('Type', tableLeft + colWidths[0] + colWidths[1], tableTop)
        .text('Amount', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);

      // Draw header line
      this.doc
        .moveTo(tableLeft, tableTop + 15)
        .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
        .stroke();

      let currentY = tableTop + 20;

      // Table rows
      transactions.forEach((transaction, index) => {
        // Check if we need a new page
        if (currentY > 700) {
          this.doc.addPage();
          currentY = 50;
        }

        const member = accountMembers.find(m => m.member_id === transaction.member_id);
        const memberName = member ? `${member.first_name} ${member.last_name}` : 'Unknown';

        this.doc
          .fontSize(9)
          .font('Helvetica')
          .text(new Date(transaction.date).toLocaleDateString(), tableLeft, currentY)
          .text(`${transaction.note} (${memberName})`, tableLeft + colWidths[0], currentY)
          .text(transaction.type, tableLeft + colWidths[0] + colWidths[1], currentY)
          .text(`$${Number(transaction.amount).toFixed(2)}`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2], currentY);

        currentY += 15;

        // Add separator line every 10 rows
        if ((index + 1) % 10 === 0) {
          this.doc
            .moveTo(tableLeft, currentY - 5)
            .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), currentY - 5)
            .stroke();
        }
      });

      // Draw bottom line
      this.doc
        .moveTo(tableLeft, currentY - 5)
        .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), currentY - 5)
        .stroke();
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
      .text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, { align: 'center' })
      .text('Noir CRM System', { align: 'center' });
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