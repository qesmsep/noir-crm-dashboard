import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import { withRateLimitAndAuth, type AuthenticatedRequest } from '../../../lib/api-auth';
import { safeJSONParse, calculateIngredientCost, sanitizeInput, validateIngredients } from '../../../lib/inventory-utils';
import { MAX_RECIPE_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from '../../../constants/inventory';
import type { DBRecipe, DBInventoryItem, RecipeIngredient } from '../../../types/inventory';

/**
 * Inventory Recipes API
 *
 * Auth: Admin-only (withAdminAuth)
 * Rationale: Recipes are business-sensitive data (costs, margins) used only in admin
 * inventory management. No public or member-facing pages access this endpoint.
 * All callers are in admin/inventory.tsx and admin-only components.
 */

/**
 * API Error Response Helper
 */
function errorResponse(
  res: NextApiResponse,
  status: number,
  message: string,
  code: string,
  details?: unknown
) {
  return res.status(status).json({
    error: message,
    code,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
  });
}

/**
 * Parses recipe from database format to client format
 */
function parseRecipe(recipe: DBRecipe) {
  return {
    ...recipe,
    ingredients: safeJSONParse(recipe.ingredients, [] as RecipeIngredient[]),
    batch_ingredients: safeJSONParse(recipe.batch_ingredients, null),
  };
}

/**
 * Calculates estimated cost for recipe ingredients
 */
async function calculateRecipeCost(
  ingredients: RecipeIngredient[],
  client: typeof supabase
): Promise<number> {
  if (!ingredients || ingredients.length === 0) return 0;

  // Optimize: Only fetch items we need
  const ingredientIds = ingredients.map(ing => ing.inventory_item_id);
  const { data: inventoryItems } = await client
    .from('inventory_items')
    .select('id, cost_per_unit, volume_ml')
    .in('id', ingredientIds);

  if (!inventoryItems) return 0;

  // Create Map for O(1) lookups
  const itemMap = new Map<string, DBInventoryItem>(
    inventoryItems.map(item => [item.id, item as DBInventoryItem])
  );

  let totalCost = 0;
  for (const ingredient of ingredients) {
    const item = itemMap.get(ingredient.inventory_item_id);
    if (item) {
      totalCost += calculateIngredientCost(
        ingredient,
        item.cost_per_unit,
        item.volume_ml
      );
    }
  }

  return totalCost;
}

/**
 * Recipes API Handler
 * GET: Fetch all recipes (optionally filtered by location)
 * POST: Create a new recipe
 * PUT: Update an existing recipe
 * DELETE: Delete a recipe
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const client = supabaseAdmin;

  // GET: Fetch recipes
  if (req.method === 'GET') {
    try {
      const { location_slug } = req.query;

      let query = client
        .from('inventory_recipes')
        .select('*')
        .eq('is_active', true) // Only show active recipes by default
        .order('name', { ascending: true });

      // Filter by location if specified
      if (location_slug && location_slug !== 'all') {
        const { data: locationData, error: locError } = await client
          .from('locations')
          .select('id')
          .eq('slug', location_slug)
          .single();

        if (locError) {
          return errorResponse(res, 404, 'Location not found', 'LOCATION_NOT_FOUND', locError);
        }

        if (locationData) {
          // Support both location_id (singular) and location_ids (array) for backward compatibility
          query = query.or(`location_id.eq.${locationData.id},location_ids.cs.{${locationData.id}}`);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching recipes:', error);
        return errorResponse(res, 500, 'Failed to fetch recipes', 'RECIPE_FETCH_ERROR', error);
      }

      const parsed = (data as DBRecipe[] || []).map(parseRecipe);
      return res.status(200).json({ data: parsed });
    } catch (err) {
      console.error('Unhandled error fetching recipes:', err);
      return errorResponse(res, 500, 'Internal server error', 'INTERNAL_ERROR', err);
    }
  }

  // POST: Create recipe
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // Validate required fields
      if (!body.name || !body.name.trim()) {
        return errorResponse(res, 400, 'Recipe name is required', 'VALIDATION_ERROR');
      }

      if (!body.ingredients || body.ingredients.length === 0) {
        return errorResponse(res, 400, 'Recipe must have at least one ingredient', 'VALIDATION_ERROR');
      }

      // Sanitize inputs
      const sanitizedName = sanitizeInput(body.name, MAX_RECIPE_NAME_LENGTH);
      const sanitizedDescription = sanitizeInput(body.description, MAX_DESCRIPTION_LENGTH);

      // Validate ingredients exist
      const ingredientIds = body.ingredients.map((ing: RecipeIngredient) => ing.inventory_item_id);
      const { data: itemCheck } = await client
        .from('inventory_items')
        .select('id')
        .in('id', ingredientIds);

      const validItemIds = new Set((itemCheck || []).map((item: { id: string }) => item.id));
      if (!validateIngredients(body.ingredients, validItemIds)) {
        return errorResponse(
          res,
          400,
          'One or more ingredients reference invalid inventory items',
          'INVALID_INGREDIENTS'
        );
      }

      // Calculate cost and margin
      const estimatedCost = await calculateRecipeCost(body.ingredients, client);
      const menuPrice = body.menu_price || 0;
      const margin = menuPrice > 0 && estimatedCost > 0
        ? ((menuPrice - estimatedCost) / menuPrice) * 100
        : 0;

      const now = new Date().toISOString();
      const insertData: Record<string, unknown> = {
        name: sanitizedName,
        category: body.category || 'cocktail',
        description: sanitizedDescription,
        instructions: sanitizeInput(body.instructions, 5000),
        ingredients: JSON.stringify(body.ingredients),
        estimated_cost: estimatedCost,
        menu_price: menuPrice,
        margin,
        image_url: body.image_url || '',
        created_at: now,
        updated_at: now,
      };

      // Optional fields
      if (body.descriptors) insertData.descriptors = body.descriptors;
      if (body.glass_type) insertData.glass_type = sanitizeInput(body.glass_type, 100);
      if (body.garnish) insertData.garnish = sanitizeInput(body.garnish, 100);
      if (body.location_id) insertData.location_id = body.location_id;
      if (body.location_ids) insertData.location_ids = body.location_ids;
      if (body.batch_ingredients) insertData.batch_ingredients = JSON.stringify(body.batch_ingredients);
      if (body.batch_yield) insertData.batch_yield = body.batch_yield;
      if (body.batch_instructions) insertData.batch_instructions = sanitizeInput(body.batch_instructions, 5000);

      const { data, error } = await client
        .from('inventory_recipes')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating recipe:', error);
        return errorResponse(res, 500, 'Failed to create recipe', 'RECIPE_CREATE_ERROR', error);
      }

      return res.status(201).json({ data: parseRecipe(data as DBRecipe) });
    } catch (err) {
      console.error('Unhandled error creating recipe:', err);
      return errorResponse(res, 500, 'Internal server error', 'INTERNAL_ERROR', err);
    }
  }

  // PUT: Update recipe
  if (req.method === 'PUT') {
    try {
      const { id, ...body } = req.body;

      if (!id) {
        return errorResponse(res, 400, 'Recipe ID is required', 'VALIDATION_ERROR');
      }

      // Validate ingredients if provided
      if (body.ingredients) {
        if (body.ingredients.length === 0) {
          return errorResponse(res, 400, 'Recipe must have at least one ingredient', 'VALIDATION_ERROR');
        }

        const ingredientIds = body.ingredients.map((ing: RecipeIngredient) => ing.inventory_item_id);
        const { data: itemCheck } = await client
          .from('inventory_items')
          .select('id')
          .in('id', ingredientIds);

        const validItemIds = new Set((itemCheck || []).map((item: { id: string }) => item.id));
        if (!validateIngredients(body.ingredients, validItemIds)) {
          return errorResponse(
            res,
            400,
            'One or more ingredients reference invalid inventory items',
            'INVALID_INGREDIENTS'
          );
        }
      }

      // Calculate cost if ingredients provided
      const estimatedCost = body.ingredients
        ? await calculateRecipeCost(body.ingredients, client)
        : undefined;

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Only update cost/margin if we recalculated
      if (estimatedCost !== undefined) {
        const menuPrice = body.menu_price || 0;
        updateData.estimated_cost = estimatedCost;
        updateData.margin = menuPrice > 0 && estimatedCost > 0
          ? ((menuPrice - estimatedCost) / menuPrice) * 100
          : 0;
      }

      // Update fields with sanitization
      if (body.name !== undefined) updateData.name = sanitizeInput(body.name, MAX_RECIPE_NAME_LENGTH);
      if (body.category !== undefined) updateData.category = body.category;
      if (body.description !== undefined) updateData.description = sanitizeInput(body.description, MAX_DESCRIPTION_LENGTH);
      if (body.instructions !== undefined) updateData.instructions = sanitizeInput(body.instructions, 5000);
      if (body.ingredients !== undefined) updateData.ingredients = JSON.stringify(body.ingredients);
      if (body.menu_price !== undefined) updateData.menu_price = body.menu_price;
      if (body.image_url !== undefined) updateData.image_url = body.image_url;
      if (body.descriptors !== undefined) updateData.descriptors = body.descriptors;
      if (body.glass_type !== undefined) updateData.glass_type = sanitizeInput(body.glass_type, 100);
      if (body.garnish !== undefined) updateData.garnish = sanitizeInput(body.garnish, 100);
      if (body.location_id !== undefined) updateData.location_id = body.location_id;
      if (body.location_ids !== undefined) updateData.location_ids = body.location_ids;
      if (body.batch_ingredients !== undefined) updateData.batch_ingredients = JSON.stringify(body.batch_ingredients);
      if (body.batch_yield !== undefined) updateData.batch_yield = body.batch_yield;
      if (body.batch_instructions !== undefined) updateData.batch_instructions = sanitizeInput(body.batch_instructions, 5000);
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const { data, error } = await client
        .from('inventory_recipes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating recipe:', error);
        return errorResponse(res, 500, 'Failed to update recipe', 'RECIPE_UPDATE_ERROR', error);
      }

      return res.status(200).json({ data: parseRecipe(data as DBRecipe) });
    } catch (err) {
      console.error('Unhandled error updating recipe:', err);
      return errorResponse(res, 500, 'Internal server error', 'INTERNAL_ERROR', err);
    }
  }

  // DELETE: Delete recipe
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return errorResponse(res, 400, 'Recipe ID is required', 'VALIDATION_ERROR');
      }

      const { error } = await client
        .from('inventory_recipes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting recipe:', error);
        return errorResponse(res, 500, 'Failed to delete recipe', 'RECIPE_DELETE_ERROR', error);
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Unhandled error deleting recipe:', err);
      return errorResponse(res, 500, 'Internal server error', 'INTERNAL_ERROR', err);
    }
  }

  return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
}

// Export with authentication middleware
export default withRateLimitAndAuth(handler);
