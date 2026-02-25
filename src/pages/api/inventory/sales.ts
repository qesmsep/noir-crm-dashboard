import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import formidable from 'formidable';
import fs from 'fs';
import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseJsonBody(req: NextApiRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Sales API
 * GET: Fetch sales history
 * POST: Upload and process a sales file (PDF/CSV) using AI
 * PUT: Confirm processed sales and deduct from inventory (expects JSON body)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = supabaseAdmin || supabase;

  if (req.method === 'GET') {
    try {
      const { data, error } = await client
        .from('inventory_sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sales:', error);
        return res.status(500).json({ error: 'Failed to fetch sales' });
      }

      const parsed = (data || []).map((record: any) => ({
        ...record,
        items:
          typeof record.items === 'string'
            ? JSON.parse(record.items)
            : record.items || [],
      }));

      return res.status(200).json({ data: parsed });
    } catch (err) {
      console.error('Unhandled error fetching sales:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
      const [fields, files] = await form.parse(req);

      const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!uploadedFile) {
        return res.status(400).json({ error: 'No file provided' });
      }

      let recipesContext: any[] = [];
      let inventoryContext: any[] = [];
      try {
        const rawRecipes = Array.isArray(fields.recipes) ? fields.recipes[0] : fields.recipes;
        if (rawRecipes) recipesContext = JSON.parse(rawRecipes);
      } catch {}
      try {
        const rawInventory = Array.isArray(fields.inventory) ? fields.inventory[0] : fields.inventory;
        if (rawInventory) inventoryContext = JSON.parse(rawInventory);
      } catch {}

      // Read file content
      const fileBuffer = fs.readFileSync(uploadedFile.filepath);
      const fileName = uploadedFile.originalFilename || 'upload';
      const mimeType = uploadedFile.mimetype || '';
      const isPdf = mimeType.includes('pdf') || fileName.endsWith('.pdf');
      const isCsv = mimeType.includes('csv') || fileName.endsWith('.csv');

      let fileContent: string;
      let aiMessages: any[];

      if (isPdf) {
        // For PDFs, send as base64 to GPT-4o Vision
        const base64 = fileBuffer.toString('base64');
        aiMessages = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this sales report and extract all items sold with quantities and revenue.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`,
                },
              },
            ],
          },
        ];
      } else {
        // For CSV/text files, read as text
        fileContent = fileBuffer.toString('utf-8');
        aiMessages = [
          {
            role: 'user',
            content: `Please analyze this sales data and extract all items sold with quantities and revenue:\n\n${fileContent}`,
          },
        ];
      }

      // Build context about existing recipes and inventory
      const contextInfo: string[] = [];
      if (recipesContext.length > 0) {
        contextInfo.push(
          `Known recipes: ${recipesContext.map((r) => r.name).join(', ')}`
        );
      }
      if (inventoryContext.length > 0) {
        contextInfo.push(
          `Known inventory items: ${inventoryContext.map((i) => `${i.brand ? i.brand + ' ' : ''}${i.name}`).join(', ')}`
        );
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a bar sales data analyst. Parse sales reports (PDFs, CSVs, POS exports) and extract structured sales data.

${contextInfo.length > 0 ? contextInfo.join('\n') : ''}

Return your response as a JSON object with this structure:
{
  "period_start": "YYYY-MM-DD or empty string if not found",
  "period_end": "YYYY-MM-DD or empty string if not found",
  "items": [
    {
      "name": "drink or item name",
      "quantity_sold": number,
      "revenue": number (total revenue for this item),
      "matched_recipe_id": "recipe ID if it matches a known recipe, empty string otherwise"
    }
  ],
  "total_revenue": number,
  "total_cost": 0
}

Try to match item names to the known recipes if possible. Return ONLY valid JSON, no markdown or explanation.`,
          },
          ...aiMessages,
        ],
        max_tokens: 4096,
      });

      const responseText = completion.choices[0]?.message?.content || '{}';

      let parsed;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        console.error('Failed to parse AI sales response:', responseText);
        parsed = {};
      }

      // Clean up temp file
      try {
        fs.unlinkSync(uploadedFile.filepath);
      } catch {}

      return res.status(200).json({
        id: crypto.randomUUID(),
        period_start: parsed.period_start || '',
        period_end: parsed.period_end || '',
        items: parsed.items || [],
        total_revenue: parsed.total_revenue || 0,
        total_cost: parsed.total_cost || 0,
      });
    } catch (err: any) {
      console.error('Sales upload error:', err);
      return res.status(500).json({ error: err.message || 'Failed to process sales file' });
    }
  }

  if (req.method === 'PUT') {
    // Confirm sales and deduct from inventory
    try {
      const body = await parseJsonBody(req);
      const { id, items, total_revenue, total_cost, source_filename, period_start, period_end } = body;

      // Deduct inventory for each sold item
      // Try to match sold items to recipes and deduct ingredients
      const { data: allRecipes } = await client
        .from('inventory_recipes')
        .select('*');
      const { data: allInventory } = await client
        .from('inventory_items')
        .select('*');

      const recipesMap = new Map<string, any>(
        (allRecipes || []).map((r: any) => [
          r.id,
          {
            ...r,
            ingredients:
              typeof r.ingredients === 'string'
                ? JSON.parse(r.ingredients)
                : r.ingredients || [],
          },
        ])
      );

      for (const item of items || []) {
        if (item.matched_recipe_id && recipesMap.has(item.matched_recipe_id)) {
          // Deduct ingredients based on recipe
          const recipe = recipesMap.get(item.matched_recipe_id)!;
          for (const ing of recipe.ingredients) {
            const invItem = (allInventory || []).find(
              (i: any) => i.id === ing.inventory_item_id
            );
            if (invItem) {
              // Rough deduction: reduce quantity proportionally
              // Each "serving" might use a fraction of a bottle
              const servingsPerBottle = invItem.volume_ml
                ? invItem.volume_ml / (ing.unit === 'oz' ? ing.quantity * 29.5735 : ing.quantity || 1)
                : 20;
              const bottlesUsed = item.quantity_sold / servingsPerBottle;
              const newQuantity = Math.max(0, invItem.quantity - bottlesUsed);

              await client
                .from('inventory_items')
                .update({
                  quantity: Math.round(newQuantity * 100) / 100,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', invItem.id);
            }
          }
        }
      }

      // Save sales record
      const now = new Date().toISOString();
      const { data, error } = await client
        .from('inventory_sales')
        .insert({
          id: id || crypto.randomUUID(),
          upload_date: now,
          period_start: period_start || '',
          period_end: period_end || '',
          source_filename: source_filename || 'upload',
          items: JSON.stringify(items || []),
          total_revenue: total_revenue || 0,
          total_cost: total_cost || 0,
          status: 'processed',
          created_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving sales record:', error);
        return res.status(500).json({ error: 'Failed to save sales record' });
      }

      return res.status(200).json({
        data: {
          ...data,
          items:
            typeof data.items === 'string'
              ? JSON.parse(data.items)
              : data.items,
        },
      });
    } catch (err: any) {
      console.error('Sales confirm error:', err);
      return res.status(500).json({ error: err.message || 'Failed to process sales' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
