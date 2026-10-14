import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { safeJSONParse } from '../../../lib/inventory-utils';
import { settleDaysWithNothingToApprove } from '../../../lib/toast/settle';
import type { RecipeIngredient } from '../../../types/inventory';

const PickSchema = z.object({
  recipe_id: z.string().uuid(),
  ingredient_index: z.number().int().min(0),
  /** The ingredient's own bottle, as the caller saw it — guards against the list having changed since. */
  inventory_item_id: z.string().uuid(),
  location_id: z.string().uuid(),
  /** A bottle at that location, null for "not tracked here", or "auto" to go back to finding it automatically. */
  pick: z.union([z.string().uuid(), z.null(), z.literal('auto')]),
});

/**
 * PUT /api/inventory/recipe-location-pick — set which bottle one recipe
 * ingredient comes out of at one bar, or mark it not tracked there. The
 * recipe stays one recipe: quantities and every other bar are untouched.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  const parsed = PickSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const { recipe_id, ingredient_index, inventory_item_id, location_id, pick } = parsed.data;

  try {
    const { data: recipe, error: recipeErr } = await supabaseAdmin
      .from('inventory_recipes')
      .select('id, name, ingredients')
      .eq('id', recipe_id)
      .maybeSingle();
    if (recipeErr) throw new Error(recipeErr.message);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const ingredients = safeJSONParse(recipe.ingredients as string | RecipeIngredient[], [] as RecipeIngredient[]);
    const ing = ingredients[ingredient_index];
    if (!ing || ing.inventory_item_id !== inventory_item_id) {
      return res.status(409).json({ error: `"${recipe.name}" changed since this was loaded — reload and try again` });
    }

    const { data: location } = await supabaseAdmin.from('locations').select('id').eq('id', location_id).maybeSingle();
    if (!location) return res.status(400).json({ error: 'Unknown location' });

    if (typeof pick === 'string' && pick !== 'auto') {
      const { data: item } = await supabaseAdmin.from('inventory_items').select('id, location_id').eq('id', pick).maybeSingle();
      if (!item || item.location_id !== location_id) {
        return res.status(400).json({ error: 'That bottle is not stocked at this location' });
      }
    }

    const picks = { ...(ing.location_items || {}) };
    if (pick === 'auto') delete picks[location_id];
    else picks[location_id] = pick;
    const { location_items: _old, ...rest } = ing;
    const next: RecipeIngredient = Object.keys(picks).length > 0 ? { ...rest, location_items: picks } : rest;
    const updated = ingredients.map((x, i) => (i === ingredient_index ? next : x));

    const { error: saveErr } = await supabaseAdmin
      .from('inventory_recipes')
      .update({ ingredients: JSON.stringify(updated), updated_at: new Date().toISOString() })
      .eq('id', recipe_id);
    if (saveErr) throw new Error(saveErr.message);

    // A drink whose only gap was this ingredient may now have nothing left to approve.
    await settleDaysWithNothingToApprove();

    return res.status(200).json({ data: { recipe_id, ingredient_index, location_items: next.location_items || {} } });
  } catch (err) {
    console.error('recipe-location-pick failed:', err);
    return res.status(500).json({ error: 'Could not save the pick' });
  }
}

export default withRateLimitAndAuth(handler);
