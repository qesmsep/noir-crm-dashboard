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

    // Fetch ledger entries for the date range
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

    // Generate PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="ledger-preview.pdf"');

    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('NOIR', { align: 'center' })
       .moveDown(0.5);

    doc.fontSize(16)
       .font('Helvetica')
       .text('Ledger Statement', { align: 'center' })
       .moveDown(1);

    // Member info
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(`Member: ${member.first_name} ${member.last_name}`)
       .font('Helvetica')
       .text(`Account ID: ${member.account_id}`)
       .text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`)
       .moveDown(1);

    // Table header
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidth = 120;
    const rowHeight = 25;

    // Draw table header
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Date', tableLeft, tableTop)
       .text('Description', tableLeft + colWidth, tableTop)
       .text('Amount', tableLeft + colWidth * 2, tableTop)
       .text('Balance', tableLeft + colWidth * 3, tableTop);

    // Draw header lines
    doc.moveTo(tableLeft, tableTop + 15)
       .lineTo(tableLeft + colWidth * 4, tableTop + 15)
       .stroke();

    // Add ledger entries
    let currentY = tableTop + 20;
    let runningBalance = 0;

    ledgerEntries?.forEach((entry) => {
      runningBalance += entry.amount;

      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.fontSize(9)
         .font('Helvetica')
         .text(new Date(entry.date).toLocaleDateString(), tableLeft, currentY)
         .text(entry.description || 'No description', tableLeft + colWidth, currentY)
         .text(`$${entry.amount.toFixed(2)}`, tableLeft + colWidth * 2, currentY)
         .text(`$${runningBalance.toFixed(2)}`, tableLeft + colWidth * 3, currentY);

      currentY += rowHeight;
    });

    // Add summary
    doc.moveDown(2);
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(`Total Balance: $${runningBalance.toFixed(2)}`, { align: 'right' });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF preview:', error);
    res.status(500).json({ error: 'Failed to generate PDF preview' });
  }
} 