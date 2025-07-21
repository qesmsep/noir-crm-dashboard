-- Migration to add transaction attachment functionality
-- This allows admins to attach PDF files to ledger transactions

-- Create transaction_attachments table
CREATE TABLE IF NOT EXISTS public.transaction_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL REFERENCES ledger(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(member_id),
    account_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add file_url column to ledger table for backward compatibility
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_attachments_ledger_id ON transaction_attachments(ledger_id);
CREATE INDEX IF NOT EXISTS idx_transaction_attachments_member_id ON transaction_attachments(member_id);
CREATE INDEX IF NOT EXISTS idx_transaction_attachments_account_id ON transaction_attachments(account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_attachments_uploaded_at ON transaction_attachments(uploaded_at);

-- Enable RLS
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage transaction attachments"
ON public.transaction_attachments
FOR ALL
USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_transaction_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transaction_attachments_updated_at
    BEFORE UPDATE ON public.transaction_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_attachments_updated_at();

-- Create storage bucket for transaction attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transaction-attachments',
  'transaction-attachments',
  true,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/rtf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/zip',
    'application/x-rar-compressed'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the transaction-attachments bucket
-- Only create specific policies for our bucket, avoiding conflicts with existing ones
DO $$
BEGIN
    -- Create INSERT policy for authenticated users (transaction attachments only)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated users can upload transaction attachments'
    ) THEN
        CREATE POLICY "Authenticated users can upload transaction attachments" ON storage.objects
          FOR INSERT WITH CHECK (
            bucket_id = 'transaction-attachments' 
            AND auth.role() = 'authenticated'
          );
    END IF;

    -- Create UPDATE policy for authenticated users (transaction attachments only)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated users can update transaction attachments'
    ) THEN
        CREATE POLICY "Authenticated users can update transaction attachments" ON storage.objects
          FOR UPDATE USING (
            bucket_id = 'transaction-attachments' 
            AND auth.role() = 'authenticated'
          );
    END IF;

    -- Create DELETE policy for authenticated users (transaction attachments only)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated users can delete transaction attachments'
    ) THEN
        CREATE POLICY "Authenticated users can delete transaction attachments" ON storage.objects
          FOR DELETE USING (
            bucket_id = 'transaction-attachments' 
            AND auth.role() = 'authenticated'
          );
    END IF;
END $$; 