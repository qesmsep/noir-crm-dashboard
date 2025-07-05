import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import PDFDocument from 'pdfkit';

// Initialise SendGrid
if (!process.env.SENDGRID_API_KEY) {
  throw new Error('Missing SENDGRID_API_KEY environment variable');
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Supabase (service-role) client so we can read all tables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Utility – build a statement PDF and return it as a Buffer
async function buildStatementPDF({
  memberName,
  statementPeriod,
  ledger
}: {
  memberName: string;
  statementPeriod: string;
  ledger: any[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      try {
        resolve(Buffer.concat(chunks));
      } catch (err) {
        reject(err);
      }
    });

    // Header
    doc
      .fontSize(18)
      .text('Monthly Statement', { align: 'center' })
      .moveDown();

    doc.fontSize(12).text(`Member: ${memberName}`);
    doc.text(`Period: ${statementPeriod}`);
    doc.moveDown();

    // Table header
    doc.font('Helvetica-Bold');
    doc.text('Date', 50, doc.y, { continued: true });
    doc.text('Type', 150, doc.y, { continued: true });
    doc.text('Note', 250, doc.y, { continued: true });
    doc.text('Amount', 500, doc.y, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica');

    let totalCharges = 0;
    let totalCredits = 0;

    ledger.forEach((tx) => {
      const date = tx.date ? new Date(tx.date).toLocaleDateString() : '';
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'purchase') totalCharges += amount;
      if (tx.type === 'payment') totalCredits += amount;

      doc.text(date, 50, doc.y, { continued: true });
      doc.text(tx.type, 150, doc.y, { continued: true });
      doc.text(tx.note || '', 250, doc.y, { continued: true, width: 230 });
      doc.text(`$${amount.toFixed(2)}`, 500, doc.y, { align: 'right' });
    });

    doc.moveDown();
    doc.font('Helvetica-Bold');
    doc.text(`Total Charges: $${totalCharges.toFixed(2)}`);
    doc.text(`Total Payments: $${totalCredits.toFixed(2)}`);
    doc.text(`Balance: $${(totalCharges - totalCredits).toFixed(2)}`);

    doc.end();
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Cron should POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Verify request is coming from Vercel Cron or authorised token (follows existing pattern)
  const isVercelCron =
    req.headers['x-vercel-cron'] === '1' ||
    req.headers['user-agent']?.toString().includes('Vercel') ||
    req.headers['x-vercel-deployment-url'];

  if (!isVercelCron) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized – Only Vercel cron jobs or authorized tokens allowed' });
    }
    const token = authHeader.substring(7);
    if (token !== 'cron-secret-token-2024') {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowDay = tomorrow.getDate();

    // Fetch all members (we will filter in JS)
    const { data: members, error: memErr } = await supabase
      .from('members')
      .select(
        'member_id,account_id,first_name,last_name,email,join_date,deactivated'
      );

    if (memErr) throw memErr;

    if (!members) {
      return res.status(200).json({ message: 'No members found' });
    }

    // Determine previous calendar month date range (1st .. last)
    const prevMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    const prevMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const rangeStart = new Date(prevMonthYear, prevMonth, 1);
    const rangeEnd = new Date(prevMonthYear, prevMonth + 1, 0); // 0 gives last day of prevMonth

    const startStr = rangeStart.toISOString().split('T')[0];
    const endStr = rangeEnd.toISOString().split('T')[0];
    const statementPeriodLabel = `${rangeStart.toLocaleDateString()} – ${rangeEnd.toLocaleDateString()}`;

    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const m of members) {
      try {
        if (m.deactivated) {
          results.skipped++;
          continue;
        }
        if (!m.join_date) {
          results.skipped++;
          continue;
        }
        const joinDate = new Date(m.join_date);
        if (isNaN(joinDate.getTime())) {
          results.skipped++;
          continue;
        }
        if (joinDate.getDate() !== tomorrowDay) {
          results.skipped++;
          continue;
        }
        if (!m.email) {
          results.skipped++;
          continue;
        }

        // Fetch ledger for previous month
        const { data: ledger, error: ledErr } = await supabase
          .from('ledger')
          .select('*')
          .eq('account_id', m.account_id)
          .gte('date', startStr)
          .lte('date', endStr)
          .order('date', { ascending: true });

        if (ledErr) throw ledErr;

        const pdfBuffer = await buildStatementPDF({
          memberName: `${m.first_name} ${m.last_name}`.trim(),
          statementPeriod: statementPeriodLabel,
          ledger: ledger || []
        });

        const filename = `Monthly_Statement_${startStr}_${endStr}.pdf`;

        const msg = {
          to: m.email,
          from: process.env.SENDGRID_FROM_EMAIL || 'no-reply@example.com',
          subject: 'Your Monthly Membership Statement',
          text: `Please find attached your statement for ${statementPeriodLabel}.`,
          html: `<p>Hello ${m.first_name},</p><p>Please find attached your statement for ${statementPeriodLabel}.</p><p>Thank you for being a member!</p>`,
          attachments: [
            {
              content: pdfBuffer.toString('base64'),
              filename,
              type: 'application/pdf',
              disposition: 'attachment'
            }
          ]
        } as any;

        await sgMail.send(msg);
        console.log(`✅ Sent statement to ${m.email}`);
        results.sent++;
      } catch (err) {
        console.error(`❌ Failed to send statement to member ${m.member_id}:`, err);
        results.errors.push(`Member ${m.member_id}: ${err instanceof Error ? err.message : 'unknown error'}`);
      } finally {
        results.processed++;
      }
    }

    res.status(200).json({
      message: `Processed ${results.processed} members – sent: ${results.sent}, skipped: ${results.skipped}`,
      ...results
    });
  } catch (error) {
    console.error('Error generating monthly statements:', error);
    res.status(500).json({ error: 'Failed to generate monthly statements' });
  }
}