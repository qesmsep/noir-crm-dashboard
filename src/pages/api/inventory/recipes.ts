import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

/**
 * Recipes API
 * GET: Fetch all recipes
 * POST: Create a new recipe
 * PUT: Update an existing recipe
 * DELETE: Delete a recipe
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = supabaseAdmin || supabase;

  if (req.method === 'GET') {
    try {
      const { data, error } = await client
        .from('inventory_recipes')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching recipes:', error);
        return res.status(500).json({ error: 'Failed to fetch recipes' });
      }

      // Parse ingredients from JSON string if stored that way
      const parsed = (data || []).map((recipe: any) => ({
        ...recipe,
        ingredients:
          typeof recipe.ingredients === 'string'
            ? JSON.parse(recipe.ingredients)
            : recipe.ingredients || [],
      }));

      return res.status(200).json({ data: parsed });
    } catch (err) {
      console.error('Unhandled error fetching recipes:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      const now = new Date().toISOString();

      // Calculate estimated cost from ingredients
      let estimatedCost = 0;
      if (body.ingredients && body.ingredients.length > 0) {
        const { data: inventoryItems } = await client
          .from('inventory_items')
          .select('id, cost_per_unit, volume_ml');

        for (const ing of body.ingredients) {
          const item = inventoryItems?.find((i: any) => i.id === ing.inventory_item_id);
          if (item && item.cost_per_unit && item.volume_ml) {
            const mlPerUnit = ing.unit === 'oz' ? ing.quantity * 29.5735 : ing.quantity;
            estimatedCost += (item.cost_per_unit / item.volume_ml) * mlPerUnit;
          }
        }
      }

      const menuPrice = body.menu_price || 0;
      const margin = menuPrice > 0 && estimatedCost > 0
        ? ((menuPrice - estimatedCost) / menuPrice) * 100
        : 0;

      const { data, error } = await client
        .from('inventory_recipes')
        .insert({
          name: body.name,
          category: body.category || 'cocktail',
          description: body.description || '',
          instructions: body.instructions || '',
          ingredients: JSON.stringify(body.ingredients || []),
          estimated_cost: estimatedCost,
          menu_price: menuPrice,
          margin,
          image_url: body.image_url || '',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating recipe:', error);
        return res.status(500).json({ error: 'Failed to create recipe' });
      }

      return res.status(201).json({
        data: {
          ...data,
          ingredients:
            typeof data.ingredients === 'string'
              ? JSON.parse(data.ingredients)
              : data.ingredients,
        },
      });
    } catch (err) {
      console.error('Unhandled error creating recipe:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, ...body } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Recipe ID is required' });
      }

      let estimatedCost = 0;
      if (body.ingredients && body.ingredients.length > 0) {
        const { data: inventoryItems } = await client
          .from('inventory_items')
          .select('id, cost_per_unit, volume_ml');

        for (const ing of body.ingredients) {
          const item = inventoryItems?.find((i: any) => i.id === ing.inventory_item_id);
          if (item && item.cost_per_unit && item.volume_ml) {
            const mlPerUnit = ing.unit === 'oz' ? ing.quantity * 29.5735 : ing.quantity;
            estimatedCost += (item.cost_per_unit / item.volume_ml) * mlPerUnit;
          }
        }
      }

      const menuPrice = body.menu_price || 0;
      const margin = menuPrice > 0 && estimatedCost > 0
        ? ((menuPrice - estimatedCost) / menuPrice) * 100
        : 0;

      const updateData: any = {
        updated_at: new Date().toISOString(),
        estimated_cost: estimatedCost,
        margin,
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.instructions !== undefined) updateData.instructions = body.instructions;
      if (body.ingredients !== undefined) updateData.ingredients = JSON.stringify(body.ingredients);
      if (body.menu_price !== undefined) updateData.menu_price = body.menu_price;
      if (body.image_url !== undefined) updateData.image_url = body.image_url;

      const { data, error } = await client
        .from('inventory_recipes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating recipe:', error);
        return res.status(500).json({ error: 'Failed to update recipe' });
      }

      return res.status(200).json({
        data: {
          ...data,
          ingredients:
            typeof data.ingredients === 'string'
              ? JSON.parse(data.ingredients)
              : data.ingredients,
        },
      });
    } catch (err) {
      console.error('Unhandled error updating recipe:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Recipe ID is required' });
      }

      const { error } = await client
        .from('inventory_recipes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting recipe:', error);
        return res.status(500).json({ error: 'Failed to delete recipe' });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Unhandled error deleting recipe:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
