import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Initialize Supabase with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const config = {
  api: {
    bodyParser: false,
  },
};

// Define allowed MIME types
const allowedMimeTypes = [
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
];

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Please upload PDF, Word, Excel, PowerPoint, text, image, or archive files.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Upload request received');

  try {
    console.log('Parsing form data...');
    
    // Use multer to parse the form data
    const uploadMiddleware = upload.single('file');
    
    const parseForm = () => {
      return new Promise((resolve, reject) => {
        console.log('Request headers:', req.headers);
        console.log('Request method:', req.method);
        console.log('Content-Type:', req.headers['content-type']);
        
        uploadMiddleware(req as any, res as any, (err) => {
          if (err) {
            console.error('Multer error:', err);
            reject(err);
          } else {
            console.log('Form parsed successfully');
            console.log('File:', (req as any).file);
            console.log('Body:', (req as any).body);
            resolve({ file: (req as any).file, body: (req as any).body });
          }
        });
      });
    };

    const { file, body } = await parseForm() as any;

    if (!file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { ledgerId, memberId, accountId } = body;

    console.log('Extracted data:', {
      file: { name: file.originalname, size: file.size, mimetype: file.mimetype },
      ledgerId,
      memberId,
      accountId
    });

    if (!ledgerId || !memberId || !accountId) {
      console.error('Missing required fields:', { ledgerId, memberId, accountId });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate file type
    if (!file.mimetype || !allowedMimeTypes.includes(file.mimetype)) {
      console.error('Invalid file type:', file.mimetype);
      return res.status(400).json({ error: 'File type not allowed. Please upload PDF, Word, Excel, PowerPoint, text, image, or archive files.' });
    }

    console.log('Reading file buffer...');
    // Use the buffer directly from multer memory storage
    const fileBuffer = file.buffer;
    
    // Sanitize the filename to remove special characters and spaces
    const sanitizeFilename = (filename: string) => {
      return filename
        .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special characters with underscores
        .replace(/_+/g, '_') // Replace multiple underscores with single underscore
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    };
    
    const sanitizedOriginalName = sanitizeFilename(file.originalname);
    const fileName = `${memberId}/${Date.now()}_${sanitizedOriginalName}`;
    
    console.log('File details:', {
      fileName,
      fileSize: fileBuffer.length,
      originalName: file.originalname,
      sanitizedOriginalName
    });

    console.log('Uploading to Supabase Storage...');
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('transaction-attachments')
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file: ' + uploadError.message });
    }

    console.log('File uploaded to storage successfully');

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('transaction-attachments')
      .getPublicUrl(fileName);

    console.log('Public URL generated:', publicUrl);

    console.log('Saving to database...');
    // Save attachment record to database
    const { data: attachmentData, error: dbError } = await supabase
      .from('transaction_attachments')
      .insert({
        ledger_id: ledgerId,
        member_id: memberId,
        account_id: accountId,
        file_name: file.originalname,
        file_url: publicUrl,
        file_size: file.size,
        uploaded_by: req.headers['x-user-id'] as string || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to delete the uploaded file if database insert fails
      console.log('Attempting to delete uploaded file due to database error...');
      await supabase.storage
        .from('transaction-attachments')
        .remove([fileName]);
      return res.status(500).json({ error: 'Failed to save attachment record: ' + dbError.message });
    }

    console.log('Database record saved successfully');

    console.log('Upload completed successfully');
    res.status(200).json({
      success: true,
      data: attachmentData,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error: ' + (error as Error).message });
  }
} 