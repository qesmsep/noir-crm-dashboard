/**
 * Ledger PDF Generator
 * Generates PDF reports for member ledgers with transactions and account information
 */

import PDFDocument from 'pdfkit';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../lib/logger';

// Types
export interface Member {
  member_id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  membership?: string;
  member_type?: string;
  join_date?: string;
}

export interface LedgerTransaction {
  id: string;
  account_id: string;
  date: string;
  amount: number;
  type: 'payment' | 'purchase' | string;
  note?: string;
}

export interface TransactionAttachment {
  id: string;
  ledger_id: string;
  file_url: string;
  uploaded_at: string;
}

export interface TransactionSummary {
  totalPayments: number;
  totalPurchases: number;
  netBalance: number;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export class LedgerPdfGenerator {
  private doc: typeof PDFDocument.prototype;

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

  async generateLedgerPdf(
    memberId: string,
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<Buffer> {
    try {
      Logger.info('Generating ledger PDF', { memberId, accountId, startDate, endDate });

      // Get member information
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('member_id', memberId)
        .single();

      if (memberError || !member) {
        Logger.error('Member not found', memberError, { memberId });
        throw new Error('Member not found');
      }

      // Get all members in the account
      const { data: accountMembers, error: accountError } = await supabase
        .from('members')
        .select('*')
        .eq('account_id', accountId)
        .order('member_type', { ascending: true });

      if (accountError) {
        Logger.error('Failed to fetch account members', accountError, { accountId });
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
        Logger.error('Failed to fetch ledger transactions', ledgerError, { accountId });
        throw new Error('Failed to fetch ledger transactions');
      }

      // Get transaction attachments for the period
      let transactionAttachments: TransactionAttachment[] = [];
      if (transactions && transactions.length > 0) {
        const ledgerIds = transactions.map((tx: LedgerTransaction) => tx.id);
        const { data: attachments, error: attachmentsError } = await supabase
          .from('transaction_attachments')
          .select('*')
          .in('ledger_id', ledgerIds)
          .order('uploaded_at', { ascending: true });

        if (attachmentsError) {
          Logger.error('Error fetching attachments', attachmentsError, { ledgerIds });
          // Don't fail the PDF generation if attachments can't be fetched
        } else {
          transactionAttachments = attachments || [];
        }
      }

      // Calculate prior balance (sum of all entries before startDate)
      Logger.debug('Calculating prior balance', { startDate, accountId });

      const { data: priorEntries } = await supabase
        .from('ledger')
        .select('amount')
        .eq('account_id', accountId)
        .lt('date', startDate);
      const priorBalance = priorEntries ? priorEntries.reduce((sum: number, e: { amount: number }) => sum + (e.amount || 0), 0) : 0;

      Logger.debug('Prior balance calculated', {
        priorEntriesCount: priorEntries?.length || 0,
        priorBalance,
        startDate
      });

      // Calculate previous membership period based on member join date
      let lastRenewalDate: string | null = null;
      let nextRenewalDate: string | null = null;
      let previousPeriodEntries: LedgerTransaction[] = [];

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
      const pdfBuffer = await this.createPdfBuffer(
        member as Member,
        (accountMembers || []) as Member[],
        (transactions || []) as LedgerTransaction[],
        transactionAttachments,
        startDate,
        endDate,
        priorBalance,
        previousPeriodEntries,
        lastRenewalDate,
        nextRenewalDate
      );

      Logger.info('Ledger PDF generated successfully', { memberId, accountId });
      return pdfBuffer;
    } catch (error) {
      Logger.error('Error generating ledger PDF', error, { memberId, accountId });
      throw error;
    }
  }

  async createPdfBuffer(
    member: Member,
    accountMembers: Member[],
    transactions: LedgerTransaction[],
    transactionAttachments: TransactionAttachment[],
    startDate: string,
    endDate: string,
    priorBalance: number,
    previousPeriodEntries: LedgerTransaction[],
    lastRenewalDate: string | null,
    nextRenewalDate: string | null
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);
      this.generatePdfContent(
        member,
        accountMembers,
        transactions,
        transactionAttachments,
        startDate,
        endDate,
        priorBalance,
        previousPeriodEntries,
        lastRenewalDate,
        nextRenewalDate
      );
      this.doc.end();
    });
  }

  private generatePdfContent(
    member: Member,
    accountMembers: Member[],
    transactions: LedgerTransaction[],
    transactionAttachments: TransactionAttachment[],
    startDate: string,
    endDate: string,
    priorBalance: number,
    previousPeriodEntries: LedgerTransaction[],
    lastRenewalDate: string | null,
    nextRenewalDate: string | null
  ): void {
    // Header with Noir logo
    this.doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('NOIR', { align: 'center' })
      .moveDown(0.3);
    this.doc
      .fontSize(16)
      .font('Helvetica')
      .text('Member Ledger', { align: 'center' })
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
      accountMembers.forEach((accMember: Member) => {
        this.doc
          .fontSize(10)
          .font('Helvetica')
          .text(`• ${accMember.first_name} ${accMember.last_name} (${accMember.member_type || 'member'})`);
      });
      this.doc.moveDown(1);
    }

    // Summary Section
    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Summary')
      .moveDown(0.3);

    const summary = this.calculateSummary(transactions);

    this.doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Starting Balance: $${priorBalance.toFixed(2)}`)
      .text(`Period Payments: $${summary.totalPayments.toFixed(2)}`)
      .text(`Period Purchases: $${summary.totalPurchases.toFixed(2)}`)
      .text(`Period Net: $${summary.netBalance.toFixed(2)}`)
      .moveDown(0.3);

    const finalBalance = priorBalance + summary.netBalance;
    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(`Final Balance: $${finalBalance.toFixed(2)}`)
      .moveDown(1);

    // Transactions Table
    if (transactions.length > 0) {
      this.doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Transaction Details');
      const tableTop = this.doc.y;
      const tableLeft = 50;
      const colWidth = 70; // Column width for most columns
      const descColWidth = 150; // Wider description column
      const filesColWidth = 50; // Narrow files column (about 10% of total width)
      const rowHeight = 25; // Increased row height for better readability
      this.doc.fontSize(9).font('Helvetica-Bold')
        .text('Date', tableLeft, tableTop)
        .text('Description', tableLeft + colWidth, tableTop)
        .text('Type', tableLeft + colWidth + descColWidth, tableTop)
        .text('Amount', tableLeft + colWidth + descColWidth + colWidth, tableTop)
        .text('Balance', tableLeft + colWidth + descColWidth + colWidth * 2, tableTop)
        .text('Files', tableLeft + colWidth + descColWidth + colWidth * 3, tableTop);
      this.doc.moveTo(tableLeft, tableTop + 15).lineTo(tableLeft + colWidth + descColWidth + colWidth * 3 + filesColWidth, tableTop + 15).stroke();
      // Create a map of attachments by ledger_id for quick lookup
      const attachmentsByLedgerId: Record<string, TransactionAttachment[]> = {};
      transactionAttachments.forEach((attachment: TransactionAttachment) => {
        if (!attachmentsByLedgerId[attachment.ledger_id]) {
          attachmentsByLedgerId[attachment.ledger_id] = [];
        }
        attachmentsByLedgerId[attachment.ledger_id].push(attachment);
      });

      let currentY = tableTop + 20;
      let runningBalance = priorBalance; // Start with the prior balance

      // Add starting balance as first row
      this.doc.fontSize(8).font('Helvetica')
        .text('Starting Balance', tableLeft, currentY)
        .text('', tableLeft + colWidth, currentY) // Empty description
        .text('', tableLeft + colWidth + descColWidth, currentY) // Empty type
        .text('', tableLeft + colWidth + descColWidth + colWidth, currentY) // Empty amount
        .text(`$${runningBalance.toFixed(2)}`, tableLeft + colWidth + descColWidth + colWidth * 2, currentY);

      currentY += rowHeight;

      transactions.forEach((entry: LedgerTransaction) => {
        const attachments = attachmentsByLedgerId[entry.id] || [];
        // Check if we need a new page
        if (currentY > 700) { // If we're getting close to the bottom
          this.doc.addPage();
          currentY = 50; // Reset to top of new page
        }

        // Update running balance before displaying the transaction
        runningBalance += entry.amount;

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

        currentY += rowHeight;
      });
      // Draw bottom line after table
      this.doc.moveTo(tableLeft, currentY - 5).lineTo(tableLeft + colWidth + descColWidth + colWidth * 3 + filesColWidth, currentY - 5).stroke();
      // Add space before footer
      this.doc.moveDown(2);
    } else {
      this.doc
        .fontSize(12)
        .font('Helvetica')
        .text('No transactions found for this period.')
        .moveDown(1);
    }

    // Footer - Full width at bottom of page
    const pageHeight = this.doc.page.height;
    const footerHeight = 60; // Height for footer content
    const footerY = pageHeight - footerHeight - 50; // 50px margin from bottom

    // Draw footer background
    this.doc
      .rect(0, footerY, this.doc.page.width, footerHeight)
      .fill('#f5f5f5'); // Light gray background

    // Add footer content
    this.doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666666') // Dark gray text
      .text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 50, footerY + 10)
      .text(`Noir CRM System`, 50, footerY + 25)
      .text(`Account ID: ${member.account_id}`, 50, footerY + 40)
      .fillColor('black'); // Reset text color
  }

  private calculateSummary(transactions: LedgerTransaction[]): TransactionSummary {
    let totalPayments = 0;
    let totalPurchases = 0;
    transactions.forEach((transaction: LedgerTransaction) => {
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
