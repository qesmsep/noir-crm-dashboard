import { supabaseAdmin } from '../supabase';
import { safeJSONParse } from '../inventory-utils';
import {
  buildDeductionPlan,
  DeductionPlan,
  RecipeIngredientRef,
  RecipeRef,
  StockItem,
  ToastLink,
} from '../toastSalesCore';
import { getLossAllowance } from '../inventory/lossAllowance';

export interface PlanContext {
  links: ToastLink[];
  recipes: RecipeRef[];
  items: StockItem[];
  locations: { id: string; slug: string; name: string }[];
  allowance: { poured_pct: number; packaged_pct: number };
}

async function all<T>(label: string, q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data || [];
}

export async function loadPlanContext(): Promise<PlanContext> {
  const [links, recipeRows, itemRows, locations, allowance] = await Promise.all([
    all<ToastLink>('toast_item_links', supabaseAdmin.from('toast_item_links').select('toast_item_id, link_type, recipe_id, inventory_item_id, amount, amount_unit')),
    all<{ id: string; name: string; category: string | null; is_active: boolean | null; ingredients: unknown }>(
      'inventory_recipes',
      supabaseAdmin.from('inventory_recipes').select('id, name, category, is_active, ingredients')
    ),
    all<StockItem>(
      'inventory_items',
      supabaseAdmin.from('inventory_items').select('id, name, brand, category, unit, volume_ml, quantity, cost_per_unit, location_id')
    ),
    all<{ id: string; slug: string; name: string }>('locations', supabaseAdmin.from('locations').select('id, slug, name')),
    getLossAllowance(),
  ]);

  return {
    links: links.map(l => ({ ...l, amount: l.amount === null ? null : Number(l.amount) })),
    recipes: recipeRows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      is_active: r.is_active !== false,
      ingredients: safeJSONParse(r.ingredients as string | RecipeIngredientRef[], [] as RecipeIngredientRef[]).map(i => ({
        ...i,
        quantity: Number(i.quantity),
      })),
    })),
    items: itemRows.map(i => ({
      ...i,
      brand: i.brand || '',
      volume_ml: Number(i.volume_ml) || 0,
      quantity: Number(i.quantity) || 0,
      cost_per_unit: Number(i.cost_per_unit) || 0,
    })),
    locations,
    allowance: { poured_pct: allowance.poured_pct, packaged_pct: allowance.packaged_pct },
  };
}

export interface PendingLine {
  item_selection_id: string;
  business_date: string;
  toast_item_id: string;
  menu_item: string;
  menu_group: string;
  menu: string;
  qty: number;
  voided: boolean;
}

/** Lines not yet applied (voids and zero-qty lines never need applying). */
export async function pendingLines(businessDates: string[]): Promise<PendingLine[]> {
  if (businessDates.length === 0) return [];
  const out: PendingLine[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabaseAdmin
      .from('toast_sales_lines')
      .select('item_selection_id, business_date, toast_item_id, menu_item, menu_group, menu, qty, voided')
      .in('business_date', businessDates)
      .is('applied_at', null)
      .eq('voided', false)
      .gt('qty', 0)
      .order('item_selection_id')
      .range(from, from + page - 1);
    if (error) throw new Error(`toast_sales_lines: ${error.message}`);
    for (const l of data || []) out.push({ ...l, qty: Number(l.qty) });
    if (!data || data.length < page) break;
  }
  return out;
}

export function planFor(lines: PendingLine[], ctx: PlanContext): DeductionPlan {
  return buildDeductionPlan(lines, ctx.links, ctx.recipes, ctx.items, ctx.locations, ctx.allowance);
}

export interface DayPreviewRow {
  item_id: string;
  name: string;
  brand: string;
  location: string;
  unit: string;
  before: number;
  change: number;
  after: number;
}

export function previewRows(plan: DeductionPlan, ctx: PlanContext): DayPreviewRow[] {
  const items = new Map(ctx.items.map(i => [i.id, i]));
  const locs = new Map(ctx.locations.map(l => [l.id, l.name]));
  return Array.from(plan.totals.entries())
    .map(([itemId, units]) => {
      const item = items.get(itemId);
      const before = item?.quantity ?? 0;
      return {
        item_id: itemId,
        name: item?.name || 'Unknown item',
        brand: item?.brand || '',
        location: (item && locs.get(item.location_id)) || '',
        unit: item?.unit || '',
        before,
        change: -units,
        after: before - units,
      };
    })
    .sort((a, b) => a.location.localeCompare(b.location) || a.name.localeCompare(b.name));
}
