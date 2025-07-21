import { NextApiRequest, NextApiResponse } from 'next';
import PDFDocument from 'pdfkit';
import { getSupabaseClient } from './supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { memberId, startDate, endDate } = req.body;

    if (!memberId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Fetch member data
    const { data: member, error: memberError } = await getSupabaseClient()
      .from('members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Fetch renewal dates (assuming you have a 'renewals' table or similar)
    // For demo, we'll use ledger entries with note containing 'renewal'
    const { data: renewalEntries } = await getSupabaseClient()
      .from('ledger')
      .select('date')
      .eq('account_id', member.account_id)
      .ilike('note', '%renewal%')
      .order('date', { ascending: false });

    let lastRenewalDate = null;
    let nextRenewalDate = null;
    if (renewalEntries && renewalEntries.length > 0) {
      lastRenewalDate = renewalEntries[0].date;
      if (renewalEntries.length > 1) {
        nextRenewalDate = renewalEntries[1].date;
      }
    }

    // Fetch ledger entries for the period
    const { data: ledgerEntries, error: ledgerError } = await getSupabaseClient()
      .from('ledger')
      .select('*')
      .eq('account_id', member.account_id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (ledgerError) {
      console.error('Error fetching ledger entries:', ledgerError);
      return res.status(500).json({ error: 'Failed to fetch ledger entries' });
    }

    // Calculate prior balance (sum of all entries before startDate)
    const { data: priorEntries } = await getSupabaseClient()
      .from('ledger')
      .select('amount')
      .eq('account_id', member.account_id)
      .lt('date', startDate);
    const priorBalance = priorEntries ? priorEntries.reduce((sum, e) => sum + (e.amount || 0), 0) : 0;

    // Fetch previous membership period entries if renewal dates found
    let previousPeriodEntries: any[] = [];
    if (lastRenewalDate && nextRenewalDate) {
      const { data: prevPeriod } = await getSupabaseClient()
        .from('ledger')
        .select('*')
        .eq('account_id', member.account_id)
        .gte('date', nextRenewalDate)
        .lt('date', lastRenewalDate);
      previousPeriodEntries = prevPeriod || [];
    }

    // Generate PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="ledger-preview.pdf"');
    doc.pipe(res);

    // Header
    doc.fontSize(24)
      .font('Helvetica-Bold')
      .text('NOIR', { align: 'center' })
      .moveDown(0.5);
    doc.fontSize(16)
      .font('Helvetica')
      .text('Ledger Statement', { align: 'center' })
      .moveDown(1);
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text(`Member: ${member.first_name} ${member.last_name}`)
      .font('Helvetica')
      .text(`Account ID: ${member.account_id}`)
      .text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`)
      .moveDown(1);

    // Previous Membership Period Section
    if (lastRenewalDate && nextRenewalDate && previousPeriodEntries.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Previous Membership Period', { underline: true });
      doc.fontSize(10).font('Helvetica').text(`From: ${new Date(nextRenewalDate).toLocaleDateString()} To: ${new Date(new Date(lastRenewalDate).getTime() - 86400000).toLocaleDateString()}`);
      doc.moveDown(0.5);
      // Table header
      const prevTableTop = doc.y;
      const tableLeft = 50;
      const colWidth = 120;
      const rowHeight = 20;
      doc.fontSize(10).font('Helvetica-Bold')
        .text('Date', tableLeft, prevTableTop)
        .text('Description', tableLeft + colWidth, prevTableTop)
        .text('Amount', tableLeft + colWidth * 2, prevTableTop);
      doc.moveTo(tableLeft, prevTableTop + 15).lineTo(tableLeft + colWidth * 3, prevTableTop + 15).stroke();
      let prevY = prevTableTop + 20;
      previousPeriodEntries.forEach((entry) => {
        doc.fontSize(9).font('Helvetica')
          .text(new Date(entry.date).toLocaleDateString(), tableLeft, prevY)
          .text(entry.description || 'No description', tableLeft + colWidth, prevY)
          .text(`$${entry.amount.toFixed(2)}`, tableLeft + colWidth * 2, prevY);
        prevY += rowHeight;
      });
      doc.moveDown(1);
    }

    // Main Transaction Table
    doc.fontSize(14).font('Helvetica-Bold').text('Transaction Details');
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidth = 120;
    const rowHeight = 20;
    doc.fontSize(10).font('Helvetica-Bold')
      .text('Date', tableLeft, tableTop)
      .text('Description', tableLeft + colWidth, tableTop)
      .text('Type', tableLeft + colWidth * 2, tableTop)
      .text('Amount', tableLeft + colWidth * 3, tableTop)
      .text('Balance', tableLeft + colWidth * 4, tableTop);
    doc.moveTo(tableLeft, tableTop + 15).lineTo(tableLeft + colWidth * 5, tableTop + 15).stroke();
    let currentY = tableTop + 20;
    let runningBalance = priorBalance;
    ledgerEntries?.forEach((entry) => {
      doc.fontSize(9).font('Helvetica')
        .text(new Date(entry.date).toLocaleDateString(), tableLeft, currentY)
        .text(entry.description || 'No description', tableLeft + colWidth, currentY)
        .text(entry.type || '', tableLeft + colWidth * 2, currentY)
        .text(`$${entry.amount.toFixed(2)}`, tableLeft + colWidth * 3, currentY)
        .text(`$${runningBalance.toFixed(2)}`, tableLeft + colWidth * 4, currentY);
      runningBalance += entry.amount;
      currentY += rowHeight;
    });
    // Draw bottom line after table
    doc.moveTo(tableLeft, currentY - 5).lineTo(tableLeft + colWidth * 5, currentY - 5).stroke();
    // Add space before footer
    doc.moveDown(2);
    // Summary
    doc.fontSize(12).font('Helvetica-Bold').text(`Total Balance: $${runningBalance.toFixed(2)}`, { align: 'right' });
    doc.moveDown(2);
    // Footer
    doc.fontSize(10).font('Helvetica').text(`Generated on ${new Date().toLocaleDateString()}\nat ${new Date().toLocaleTimeString()}\nNoir CRM System`, { align: 'right' });
    doc.end();
  } catch (error) {
    console.error('Error generating PDF preview:', error);
    res.status(500).json({ error: 'Failed to generate PDF preview' });
  }
} 