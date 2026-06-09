import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { monitoring } from '../../../lib/monitoring';
import Papa from 'papaparse';

interface SalesReportRow {
  item?: string;
  product?: string;
  name?: string;
  quantity?: string | number;
  quantity_sold?: string | number;
  units_sold?: string | number;
  revenue?: string | number;
  price?: string | number;
  'Menu Item'?: string;
  'Menu Group'?: string;
  'Menu'?: string;
  'Item Qty'?: string | number;
  'Net Amount'?: string;
}

async function salesReportHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  const client = supabaseAdmin;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting is applied by withRateLimitAndAuth wrapper BEFORE authentication

  try {
    const { csv_content, location_slug, report_date, verify_only = false } = req.body;

    monitoring.trackEvent('sales_report_upload_started', {
      location: location_slug,
      verify_only,
      content_size: csv_content?.length || 0,
      user_id: req.user?.id
    });

    if (!csv_content || !location_slug) {
      return res.status(400).json({ error: 'CSV content and location are required' });
    }

    // Security: Validate file size
    if (csv_content.length > 1024 * 1024) {
      return res.status(400).json({ error: 'CSV file too large (max 1MB)' });
    }

    // Get location
    const { data: locationData, error: locationError } = await client
      .from('locations')
      .select('id, name')
      .eq('slug', location_slug)
      .single();

    if (locationError || !locationData) {
      return res.status(400).json({ error: 'Invalid location' });
    }

    const location_id = locationData.id;

    // Detect delimiter
    const delimiter = csv_content.includes('\t') ? '\t' : ',';

    // Parse CSV/TSV with security settings
    const parseResult = Papa.parse<SalesReportRow>(csv_content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // SECURITY: Disable auto type conversion
      delimiter: delimiter,
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({
        error: 'CSV parsing failed',
        details: parseResult.errors
      });
    }

    // Get inventory and recipes
    const [inventoryResult, recipesResult] = await Promise.all([
      client.from('inventory_items').select('*').eq('location_id', location_id),
      client.from('inventory_recipes').select('*').or(`location_id.eq.${location_id},location_ids.cs.{${location_id}}`),
    ]);

    if (inventoryResult.error || recipesResult.error) {
      return res.status(500).json({ error: 'Failed to fetch inventory data' });
    }

    const inventory = inventoryResult.data || [];
    const recipes = recipesResult.data || [];

    // Create lookup maps
    const inventoryMap = new Map(inventory.map(item => [item.id, item]));
    const inventoryNameMap = new Map(inventory.map(item => [item.name.toLowerCase(), item]));

    // Aggregate items by name
    const aggregatedItems = new Map<string, { quantity: number; revenue: number }>();

    for (const row of parseResult.data) {
      const itemName = row['Menu Item'] || row.item || row.product || row.name || '';
      const quantitySold = Number(row['Item Qty'] || row.quantity || row.quantity_sold || row.units_sold || 0);

      let revenue = 0;
      if (row['Net Amount']) {
        revenue = Number(String(row['Net Amount']).replace('$', '').replace(',', ''));
      } else {
        revenue = Number(row.revenue || row.price || 0);
      }

      if (!itemName || isNaN(quantitySold) || quantitySold <= 0) continue;

      const existing = aggregatedItems.get(itemName);
      if (existing) {
        existing.quantity += quantitySold;
        existing.revenue += revenue;
      } else {
        aggregatedItems.set(itemName, { quantity: quantitySold, revenue });
      }
    }

    // Process each aggregated item
    const processedItems: any[] = [];
    const verification = {
      total_items_processed: 0,
      successful_deductions: 0,
      failed_deductions: 0,
      low_stock_warnings: [] as string[],
      out_of_stock_items: [] as string[],
      unmatched_items: [] as string[],
      total_revenue: 0,
      inventory_value_change: 0,
    };

    for (const [itemName, { quantity: quantitySold, revenue }] of aggregatedItems) {
      verification.total_items_processed++;
      verification.total_revenue += revenue;

      const processedItem: any = {
        item_name: itemName,
        quantity_sold: quantitySold,
        revenue: revenue,
        matched_recipe_id: null,
        matched_items: [],
        warnings: [],
      };

      // Try to match with recipe first
      const matchedRecipe = recipes.find(r => r.name.toLowerCase() === itemName.toLowerCase());

      if (matchedRecipe) {
        processedItem.matched_recipe_id = matchedRecipe.id;

        // Process each ingredient
        for (const ingredient of matchedRecipe.inventory_recipe_ingredients || []) {
          const inventoryItem = inventoryMap.get(ingredient.item_id);
          if (!inventoryItem) continue;

          const quantityToDeduct = ingredient.quantity * quantitySold;
          const newQuantity = inventoryItem.quantity - quantityToDeduct;

          if (newQuantity < 0) {
            verification.out_of_stock_items.push(
              `${inventoryItem.name}: needs ${quantityToDeduct}, only ${inventoryItem.quantity} available`
            );
            verification.failed_deductions++;
            processedItem.warnings.push(`Insufficient stock for ${inventoryItem.name}`);
          } else {
            if (newQuantity <= inventoryItem.par_level && inventoryItem.par_level > 0) {
              verification.low_stock_warnings.push(
                `${inventoryItem.name}: ${newQuantity} remaining (par: ${inventoryItem.par_level})`
              );
            }
            verification.successful_deductions++;
            processedItem.matched_items.push({
              item_id: inventoryItem.id,
              item_name: inventoryItem.name,
              quantity_before: inventoryItem.quantity,
              quantity_after: newQuantity,
              quantity_deducted: quantityToDeduct,
            });
            inventoryItem.quantity = newQuantity;
            verification.inventory_value_change += quantityToDeduct * inventoryItem.cost_per_unit;
          }
        }
      } else {
        // Try direct inventory match
        const matchedItem = inventoryNameMap.get(itemName.toLowerCase());
        if (matchedItem) {
          const newQuantity = matchedItem.quantity - quantitySold;
          if (newQuantity < 0) {
            verification.out_of_stock_items.push(
              `${matchedItem.name}: needs ${quantitySold}, only ${matchedItem.quantity} available`
            );
            verification.failed_deductions++;
          } else {
            if (newQuantity <= matchedItem.par_level && matchedItem.par_level > 0) {
              verification.low_stock_warnings.push(
                `${matchedItem.name}: ${newQuantity} remaining (par: ${matchedItem.par_level})`
              );
            }
            verification.successful_deductions++;
            processedItem.matched_items.push({
              item_id: matchedItem.id,
              item_name: matchedItem.name,
              quantity_before: matchedItem.quantity,
              quantity_after: newQuantity,
              quantity_deducted: quantitySold,
            });
            matchedItem.quantity = newQuantity;
            verification.inventory_value_change += quantitySold * matchedItem.cost_per_unit;
          }
        } else {
          verification.unmatched_items.push(itemName);
          processedItem.warnings.push(`No match found for "${itemName}"`);
        }
      }

      processedItems.push(processedItem);
    }

    // If verify only, return results
    if (verify_only) {
      monitoring.trackEvent('sales_report_verified', {
        location: location_slug,
        items_processed: verification.total_items_processed,
        successful: verification.successful_deductions,
        failed: verification.failed_deductions,
        user_id: req.user?.id
      });
      return res.status(200).json({
        verification,
        processed_items: processedItems,
        message: 'Verification complete (no changes made)',
      });
    }

    // Apply updates using atomic function (DB validates stock atomically - no TOCTOU race)
    const adjustments: any[] = [];
    for (const item of processedItems) {
      for (const matched of item.matched_items) {
        adjustments.push({
          item_id: matched.item_id,
          quantity: matched.quantity_deducted,
          transaction_type: 'sales',
          notes: `Sales: ${item.item_name} (${item.quantity_sold} sold)`
        });
      }
    }

    if (adjustments.length === 0) {
      return res.status(400).json({
        error: 'No items matched',
        message: 'No inventory items could be matched to the sales report'
      });
    }

    const { data: batchResult, error: batchError } = await client.rpc('process_sales_adjustments', {
      p_adjustments: adjustments,
      p_created_by: req.user?.id || 'Unknown'
    });

    if (batchError) {
      return res.status(500).json({ error: 'Failed to apply adjustments', details: batchError });
    }

    // Check if any items failed (partial success)
    const result = batchResult?.[0];
    const itemsProcessed = result?.items_processed || 0;
    const itemsFailed = result?.items_failed || 0;

    monitoring.trackEvent('sales_report_processed', {
      location: location_slug,
      items_processed: itemsProcessed,
      items_failed: itemsFailed,
      revenue: verification.total_revenue,
      user_id: req.user?.id
    });

    // Return 207 Multi-Status if partial failure, 200 if all succeeded
    const statusCode = itemsFailed > 0 ? 207 : 200;
    const success = itemsFailed === 0;

    return res.status(statusCode).json({
      success,
      items_processed: itemsProcessed,
      items_failed: itemsFailed,
      verification, // Keep for UI display of what was attempted
      processed_items: processedItems,
      message: success
        ? `Successfully processed ${itemsProcessed} deductions`
        : `Processed ${itemsProcessed} deductions, ${itemsFailed} failed (insufficient stock)`,
    });

  } catch (error) {
    console.error('Error processing sales report:', error);
    monitoring.trackError(error instanceof Error ? error : new Error('Unknown error'), {
      context: 'sales_report_processing',
      location: req.body?.location_slug,
      user_id: req.user?.id
    });
    return res.status(500).json({
      error: 'Failed to process sales report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default withRateLimitAndAuth(salesReportHandler);