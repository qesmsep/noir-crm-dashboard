import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { withAdminAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { rateLimiters } from '../../../lib/rate-limiter';
import { monitoring } from '../../../lib/monitoring';

async function recipeCostHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  const client = supabaseAdmin;

  // Rate limiting
  const rateLimitPassed = await rateLimiters.standard.check(req);
  if (!rateLimitPassed) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please wait before making another request'
    });
  }

  if (req.method === 'POST') {
    try {
      const { recipe_id, ingredients, menu_price, location_slug } = req.body;

      await monitoring.trackEvent('recipe_cost_calculation_started', {
        recipe_id,
        location: location_slug,
        user: req.user?.email
      });

      // Get location
      const { data: locationData, error: locationError } = await client
        .from('locations')
        .select('id, name')
        .eq('slug', location_slug)
        .single();

      if (locationError) {
        return res.status(400).json({ error: 'Invalid location' });
      }

      // Fetch recipe if ID provided
      let recipe: any = null;
      let recipeIngredients = ingredients;

      if (recipe_id) {
        const { data: recipeData, error: recipeError } = await client
          .from('inventory_recipes')
          .select(`
            *,
            inventory_recipe_ingredients (
              id, item_id, quantity, unit
            )
          `)
          .eq('id', recipe_id)
          .single();

        if (recipeError) {
          return res.status(404).json({ error: 'Recipe not found' });
        }

        recipe = recipeData;
        recipeIngredients = recipeData.inventory_recipe_ingredients;
      }

      // Get inventory items
      const itemIds = recipeIngredients.map((i: any) => i.item_id);
      const { data: inventoryItems, error: inventoryError } = await client
        .from('inventory_items')
        .select('*')
        .eq('location_id', locationData.id)
        .in('id', itemIds);

      if (inventoryError) {
        return res.status(500).json({ error: 'Failed to fetch inventory' });
      }

      const inventoryMap = new Map(inventoryItems?.map(item => [item.id, item]) || []);

      // Calculate costs
      const ingredientCosts: any[] = [];
      let totalCost = 0;
      const missingIngredients: string[] = [];

      for (const ingredient of recipeIngredients) {
        const inventoryItem = inventoryMap.get(ingredient.item_id);
        if (!inventoryItem) {
          missingIngredients.push(`Item ${ingredient.item_id} not found`);
          continue;
        }

        // Unit conversion
        let costPerIngredientUnit = inventoryItem.cost_per_unit;

        if (ingredient.unit === 'oz' && inventoryItem.unit === 'bottle') {
          costPerIngredientUnit = inventoryItem.cost_per_unit / 25.36;
        } else if (ingredient.unit === 'ml' && inventoryItem.unit === 'bottle') {
          costPerIngredientUnit = inventoryItem.cost_per_unit / (inventoryItem.volume_ml || 750);
        }

        const ingredientTotalCost = costPerIngredientUnit * ingredient.quantity;
        totalCost += ingredientTotalCost;

        ingredientCosts.push({
          item_id: inventoryItem.id,
          item_name: inventoryItem.name,
          quantity_needed: ingredient.quantity,
          unit: ingredient.unit,
          cost_per_unit: costPerIngredientUnit,
          total_cost: ingredientTotalCost,
          in_stock: inventoryItem.quantity >= ingredient.quantity,
          stock_quantity: inventoryItem.quantity,
        });
      }

      // Calculate profit
      const finalMenuPrice = menu_price || (recipe ? recipe.price : 0) || 0;
      const profitMargin = finalMenuPrice - totalCost;
      const profitPercentage = finalMenuPrice > 0 ? (profitMargin / finalMenuPrice) * 100 : 0;

      const analysis = {
        recipe_id: recipe_id || 'new',
        recipe_name: recipe?.name || 'New Recipe',
        total_cost: totalCost,
        menu_price: finalMenuPrice,
        profit_margin: profitMargin,
        profit_percentage: profitPercentage,
        ingredients: ingredientCosts,
        missing_ingredients: missingIngredients,
        location_id: locationData.id,
        location_name: locationData.name,
      };

      // Update recipe if ID provided
      if (recipe_id && recipe) {
        await client
          .from('inventory_recipes')
          .update({
            estimated_cost: totalCost,
            margin: profitPercentage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipe_id);
      }

      await monitoring.trackEvent('recipe_cost_calculated', {
        recipe_id,
        location: location_slug,
        total_cost: totalCost,
        profit_percentage: profitPercentage,
        ingredient_count: ingredientCosts.length,
        user: req.user?.email
      });

      return res.status(200).json(analysis);

    } catch (error) {
      console.error('Error calculating recipe cost:', error);
      await monitoring.trackError(error instanceof Error ? error : new Error('Unknown error'), {
        context: 'recipe_cost_calculation',
        recipe_id: req.body?.recipe_id,
        user: req.user?.email
      });
      return res.status(500).json({ error: 'Failed to calculate recipe cost' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { location_slug } = req.query;

      const { data: locationData, error: locationError } = await client
        .from('locations')
        .select('id, name')
        .eq('slug', location_slug)
        .single();

      if (locationError) {
        return res.status(400).json({ error: 'Invalid location' });
      }

      const { data: recipes, error: recipesError } = await client
        .from('inventory_recipes')
        .select(`
          *,
          inventory_recipe_ingredients (
            id, item_id, quantity, unit,
            inventory_items (
              name, cost_per_unit, unit, volume_ml, quantity
            )
          )
        `)
        .eq('location_id', locationData.id)
        .eq('is_active', true);

      if (recipesError) {
        return res.status(500).json({ error: 'Failed to fetch recipes' });
      }

      // Calculate costs for all recipes
      const recipeCosts: any[] = [];

      for (const recipe of recipes || []) {
        let totalCost = 0;
        const ingredientCosts: any[] = [];

        for (const ingredient of recipe.inventory_recipe_ingredients || []) {
          if (!ingredient.inventory_items) continue;

          const item = ingredient.inventory_items;
          let costPerIngredientUnit = item.cost_per_unit;

          if (ingredient.unit === 'oz' && item.unit === 'bottle') {
            costPerIngredientUnit = item.cost_per_unit / 25.36;
          } else if (ingredient.unit === 'ml' && item.unit === 'bottle') {
            costPerIngredientUnit = item.cost_per_unit / (item.volume_ml || 750);
          }

          const ingredientTotalCost = costPerIngredientUnit * ingredient.quantity;
          totalCost += ingredientTotalCost;

          ingredientCosts.push({
            item_id: ingredient.item_id,
            item_name: item.name,
            quantity_needed: ingredient.quantity,
            unit: ingredient.unit,
            cost_per_unit: costPerIngredientUnit,
            total_cost: ingredientTotalCost,
            in_stock: item.quantity >= ingredient.quantity,
            stock_quantity: item.quantity,
          });
        }

        const profitMargin = recipe.price - totalCost;
        const profitPercentage = recipe.price > 0 ? (profitMargin / recipe.price) * 100 : 0;

        recipeCosts.push({
          recipe_id: recipe.id,
          recipe_name: recipe.name,
          category: recipe.category,
          total_cost: totalCost,
          menu_price: recipe.price,
          profit_margin: profitMargin,
          profit_percentage: profitPercentage,
          ingredients: ingredientCosts,
          is_active: recipe.is_active,
        });
      }

      recipeCosts.sort((a, b) => b.profit_percentage - a.profit_percentage);

      const summary = {
        total_recipes: recipeCosts.length,
        average_cost: recipeCosts.reduce((sum, r) => sum + r.total_cost, 0) / recipeCosts.length,
        average_profit_margin: recipeCosts.reduce((sum, r) => sum + r.profit_percentage, 0) / recipeCosts.length,
      };

      await monitoring.trackEvent('recipe_costs_fetched', {
        location: location_slug,
        recipe_count: recipeCosts.length,
        average_margin: summary.average_profit_margin,
        user: req.user?.email
      });

      return res.status(200).json({
        location: locationData.name,
        recipes: recipeCosts,
        summary
      });

    } catch (error) {
      console.error('Error fetching recipe costs:', error);
      await monitoring.trackError(error instanceof Error ? error : new Error('Unknown error'), {
        context: 'recipe_costs_fetch',
        location: req.query?.location_slug,
        user: req.user?.email
      });
      return res.status(500).json({ error: 'Failed to fetch recipe costs' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAdminAuth(recipeCostHandler);