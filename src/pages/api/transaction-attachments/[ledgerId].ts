import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ledgerId } = req.query;

  if (!ledgerId || typeof ledgerId !== 'string') {
    return res.status(400).json({ error: 'Invalid ledger ID' });
  }

  try {
    if (req.method === 'GET') {
      // Fetch attachments for the ledger entry
      const { data: attachments, error } = await supabase
        .from('transaction_attachments')
        .select('*')
        .eq('ledger_id', ledgerId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error fetching attachments:', error);
        return res.status(500).json({ error: 'Failed to fetch attachments' });
      }

      // Also fetch the Stripe invoice PDF URL from the ledger entry
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from('ledger')
        .select('stripe_invoice_pdf_url')
        .eq('id', ledgerId)
        .single();

      const allAttachments = [...(attachments || [])];

      // If there's a Stripe invoice PDF, add it as a virtual attachment
      if (!ledgerError && ledgerEntry?.stripe_invoice_pdf_url) {
        allAttachments.unshift({
          id: `stripe-pdf-${ledgerId}`,
          ledger_id: ledgerId,
          file_name: 'Stripe Invoice.pdf',
          file_url: ledgerEntry.stripe_invoice_pdf_url,
          file_size: 0, // Unknown size
          uploaded_at: new Date().toISOString(),
          is_stripe_invoice: true, // Flag to prevent deletion
        });
      }

      return res.status(200).json({ data: allAttachments });
    }

    if (req.method === 'DELETE') {
      const { attachmentId } = req.body;

      if (!attachmentId) {
        return res.status(400).json({ error: 'Attachment ID is required' });
      }

      // Get attachment details first
      const { data: attachment, error: fetchError } = await supabase
        .from('transaction_attachments')
        .select('file_url')
        .eq('id', attachmentId)
        .single();

      if (fetchError || !attachment) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      // Extract file path from URL
      const urlParts = attachment.file_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${ledgerId}/${fileName}`;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('transaction-attachments')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('transaction_attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        return res.status(500).json({ error: 'Failed to delete attachment' });
      }

      return res.status(200).json({ message: 'Attachment deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 