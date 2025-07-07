-- Create storage bucket for ledger PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ledger-pdfs',
  'ledger-pdfs',
  true,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the ledger-pdfs bucket
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'ledger-pdfs');

CREATE POLICY "Authenticated users can upload ledger PDFs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'ledger-pdfs' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can update ledger PDFs" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'ledger-pdfs' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can delete ledger PDFs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ledger-pdfs' 
    AND auth.role() = 'authenticated'
  ); 