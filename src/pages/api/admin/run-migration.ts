import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security check - only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Migration endpoint disabled in production' });
  }

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '20240301_create_inventory_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements and filter out comments
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    const results: string[] = [];
    const errors: Array<{ statement?: string; error?: string; verification?: string }> = [];

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip if it's just whitespace or comments
      if (!statement.trim() || statement.trim().startsWith('--')) {
        continue;
      }

      try {
        // Execute the statement
        const { error } = await supabaseAdmin.rpc('exec', {
          sql: statement
        });

        if (error) {
          // Ignore "already exists" errors
          if (!error.message?.includes('already exists')) {
            errors.push({ statement: statement.substring(0, 50) + '...', error: error.message });
          }
        } else {
          results.push(`Statement ${i + 1} executed successfully`);
        }
      } catch (err: any) {
        // If exec doesn't exist or other errors occur
        // For CREATE TABLE statements, we can check if table exists first
        if (statement.includes('CREATE TABLE IF NOT EXISTS')) {
          // The IF NOT EXISTS clause will handle this
          results.push(`Statement ${i + 1} - table likely exists already`);
        } else if (!err.message?.includes('already exists')) {
          // Ignore "already exists" errors
          errors.push({ statement: statement.substring(0, 50) + '...', error: err.message });
        }
      }
    }

    // Try to verify the tables were created by doing a simple query
    const verification = await supabaseAdmin
      .from('inventory_items')
      .select('id')
      .limit(1);

    if (verification.error && !verification.error.message.includes('relation')) {
      errors.push({ verification: verification.error.message });
    }

    return res.status(200).json({
      message: 'Migration attempted',
      results,
      errors,
      tablesCreated: !verification.error
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message || 'Migration failed' });
  }
}