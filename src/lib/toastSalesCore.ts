/**
 * Pure logic for turning Toast's nightly ItemSelectionDetails export into
 * inventory deductions, and for scoring physical inventory counts.
 *
 * No I/O here — everything is unit tested in __tests__/toastSalesCore.test.ts.
 * The SFTP pull and database writes live in src/lib/toast/.
 */
import Papa from 'papaparse';

// ---------------------------------------------------------------------------
// Toast export parsing
// ---------------------------------------------------------------------------

export interface ToastSaleLine {
  item_selection_id: string;
  business_date: string; // YYYY-MM-DD (from the export folder name)
  order_id: string;
  check_id: string;
  toast_item_id: string;
  master_id: string;
  menu_item: string;
  menu_group: string;
  menu: string;
  dining_area: string;
  qty: number;
  gross_price: number;
  discount: number;
  net_price: number;
  voided: boolean;
  ordered_at: string; // as Toast prints it, e.g. "10/8/26 5:17 PM"
}

function num(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[$,]/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Export folder name (YYYYMMDD) → YYYY-MM-DD, or null if it isn't a date folder. */
export function folderToBusinessDate(folder: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(folder.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Parse ItemSelectionDetails.csv. Rows without a selection id or item id are dropped. */
export function parseItemSelectionCsv(csv: string, businessDate: string): ToastSaleLine[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: h => h.trim(),
  });
  const lines: ToastSaleLine[] = [];
  for (const r of parsed.data) {
    const id = (r['Item Selection Id'] || '').trim();
    const itemId = (r['Item Id'] || '').trim();
    if (!id || !itemId) continue;
    lines.push({
      item_selection_id: id,
      business_date: businessDate,
      order_id: (r['Order Id'] || '').trim(),
      check_id: (r['Check Id'] || '').trim(),
      toast_item_id: itemId,
      master_id: (r['Master Id'] || '').trim(),
      menu_item: (r['Menu Item'] || '').trim(),
      menu_group: (r['Menu Group'] || '').trim(),
      menu: (r['Menu'] || '').trim(),
      dining_area: (r['Dining Area'] || '').trim(),
      qty: num(r['Qty']),
      gross_price: num(r['Gross Price']),
      discount: num(r['Discount']),
      net_price: num(r['Net Price']),
      voided: String(r['Void?'] || '').trim().toLowerCase() === 'true',
      ordered_at: (r['Order Date'] || '').trim(),
    });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Sale location
// ---------------------------------------------------------------------------

/**
 * Noir and RooftopKC are one Toast location; the Toast menu says which bar
 * sold the drink. Anything not on the RooftopKC menu is Noir.
 */
export function saleLocationSlug(menu: string): 'noirkc' | 'rooftopkc' {
  return menu.trim().toLowerCase() === 'rooftopkc' ? 'rooftopkc' : 'noirkc';
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export const ML_PER_OZ = 29.5735;

/** Recipe units that are a liquid volume, as ounces per unit. */
const OZ_PER_RECIPE_UNIT: Record<string, number> = {
  oz: 1,
  ml: 1 / ML_PER_OZ,
  dash: 1 / 32,
  splash: 0.25,
  barspoon: 1 / 6,
  drop: 1 / 600,
};

/** Recipe units that are a count of things (garnish), not a volume. */
const COUNT_RECIPE_UNITS = new Set(['each', 'slice', 'sprig', 'wheel']);

export interface StockItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  unit: string; // bottle | can | keg | case | each | liter | oz
  volume_ml: number;
  quantity: number;
  cost_per_unit: number;
  location_id: string;
}

export type AmountUnit = 'oz' | 'ml' | 'unit';

/**
 * Convert one serving amount into the item's stock unit.
 * `poured` marks volume amounts (they carry the pour allowance); whole units
 * (a can, half a can) carry the packaged allowance.
 */
export function toStockUnits(
  amount: number,
  amountUnit: string,
  item: Pick<StockItem, 'unit' | 'volume_ml' | 'name'>
): { units: number; poured: boolean } | { error: string } {
  if (!(amount > 0)) return { error: `amount must be more than 0 for ${item.name}` };

  if (amountUnit === 'unit') return { units: amount, poured: false };

  if (COUNT_RECIPE_UNITS.has(amountUnit)) {
    if (item.unit === 'each') return { units: amount, poured: false };
    return { error: `"${amountUnit}" can't come out of ${item.name}, which is stocked by the ${item.unit}` };
  }

  const ozPer = OZ_PER_RECIPE_UNIT[amountUnit];
  if (ozPer === undefined) return { error: `unknown unit "${amountUnit}" for ${item.name}` };
  const oz = amount * ozPer;

  switch (item.unit) {
    case 'oz':
      return { units: oz, poured: true };
    case 'liter':
      return { units: (oz * ML_PER_OZ) / 1000, poured: true };
    case 'bottle':
    case 'can':
    case 'keg':
      if (!(item.volume_ml > 0)) return { error: `${item.name} has no bottle size (ml) set` };
      return { units: (oz * ML_PER_OZ) / item.volume_ml, poured: true };
    default:
      return { error: `${item.name} is stocked by the ${item.unit}, so a pour can't be measured from it` };
  }
}

// ---------------------------------------------------------------------------
// Links: Toast item → recipe / bottle / ignore
// ---------------------------------------------------------------------------

export interface ToastLink {
  toast_item_id: string;
  link_type: 'recipe' | 'item' | 'ignore';
  recipe_id: string | null;
  inventory_item_id: string | null;
  amount: number | null;
  amount_unit: AmountUnit | null;
}

export interface RecipeIngredientRef {
  inventory_item_id: string;
  name?: string;
  quantity: number;
  unit: string;
}

export interface RecipeRef {
  id: string;
  name: string;
  is_active?: boolean;
  ingredients: RecipeIngredientRef[];
}

export interface LossAllowance {
  poured_pct: number; // e.g. 5 → +5% on every poured amount
  packaged_pct: number; // whole cans / bottles
}

export const DEFAULT_LOSS_ALLOWANCE: LossAllowance = { poured_pct: 5, packaged_pct: 0 };

export interface Deduction {
  item_id: string;
  units: number; // positive = amount to take out of stock
}

export interface ResolvedLine {
  item_selection_id: string;
  deductions: Deduction[]; // empty for ignored items
}

export interface UnresolvedGroup {
  toast_item_id: string;
  menu_item: string;
  menu_group: string;
  menu: string;
  qty: number;
  reasons: string[];
}

export interface DeductionPlan {
  resolved: ResolvedLine[];
  unresolved: UnresolvedGroup[];
  /** item_id → total units out, summed over resolved lines */
  totals: Map<string, number>;
}

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

/** The same product stocked at the sale's location (inventory is per location; name+brand is unique there). */
function atLocation(
  item: StockItem,
  locationId: string,
  byNameBrandLoc: Map<string, StockItem>
): StockItem | null {
  if (item.location_id === locationId) return item;
  return byNameBrandLoc.get(`${normKey(item.name)}|${normKey(item.brand)}|${locationId}`) || null;
}

/** Per-serving deductions for one Toast item at one location, or the reasons it can't be worked out. */
function servingDeductions(
  link: ToastLink | undefined,
  locationId: string,
  locationName: string,
  ctx: {
    recipes: Map<string, RecipeRef>;
    items: Map<string, StockItem>;
    byNameBrandLoc: Map<string, StockItem>;
    allowance: LossAllowance;
  }
): { deductions: Deduction[] } | { reasons: string[] } {
  if (!link) return { reasons: ['Not linked to a recipe or bottle yet'] };
  if (link.link_type === 'ignore') return { deductions: [] };

  const withAllowance = (units: number, poured: boolean) =>
    units * (1 + (poured ? ctx.allowance.poured_pct : ctx.allowance.packaged_pct) / 100);

  const resolveOne = (
    itemId: string | null | undefined,
    amount: number | null | undefined,
    unit: string | null | undefined,
    label: string
  ): Deduction | string => {
    const linked = itemId ? ctx.items.get(itemId) : undefined;
    if (!linked) return `${label}: the linked bottle no longer exists`;
    const local = atLocation(linked, locationId, ctx.byNameBrandLoc);
    if (!local) return `${linked.name} isn't stocked at ${locationName}`;
    const conv = toStockUnits(Number(amount), String(unit || ''), local);
    if ('error' in conv) return `${label}: ${conv.error}`;
    return { item_id: local.id, units: withAllowance(conv.units, conv.poured) };
  };

  const reasons: string[] = [];
  const deductions: Deduction[] = [];

  if (link.link_type === 'item') {
    const d = resolveOne(link.inventory_item_id, link.amount, link.amount_unit, 'Pour');
    if (typeof d === 'string') reasons.push(d);
    else deductions.push(d);
  } else {
    const recipe = link.recipe_id ? ctx.recipes.get(link.recipe_id) : undefined;
    if (!recipe) {
      reasons.push('The linked recipe no longer exists');
    } else if (recipe.is_active === false) {
      reasons.push(`Recipe "${recipe.name}" is archived`);
    } else if (!recipe.ingredients || recipe.ingredients.length === 0) {
      reasons.push(`Recipe "${recipe.name}" has no ingredients`);
    } else {
      for (const ing of recipe.ingredients) {
        const label = `Recipe "${recipe.name}" — ${ing.name || 'ingredient'}`;
        if (!ing.inventory_item_id) {
          reasons.push(`${label} isn't linked to a bottle`);
          continue;
        }
        const d = resolveOne(ing.inventory_item_id, ing.quantity, ing.unit, label);
        if (typeof d === 'string') reasons.push(d);
        else deductions.push(d);
      }
    }
  }

  return reasons.length > 0 ? { reasons } : { deductions };
}

/**
 * Work out what each pending sale takes out of stock. A Toast item is all or
 * nothing: if any part of its recipe can't be worked out, none of its lines
 * are applied and it's reported back with the reasons.
 */
export function buildDeductionPlan(
  lines: Pick<ToastSaleLine, 'item_selection_id' | 'toast_item_id' | 'menu_item' | 'menu_group' | 'menu' | 'qty' | 'voided'>[],
  links: ToastLink[],
  recipes: RecipeRef[],
  items: StockItem[],
  locations: { id: string; slug: string; name: string }[],
  allowance: LossAllowance
): DeductionPlan {
  const ctx = {
    recipes: new Map(recipes.map(r => [r.id, r])),
    items: new Map(items.map(i => [i.id, i])),
    byNameBrandLoc: new Map(items.map(i => [`${normKey(i.name)}|${normKey(i.brand)}|${i.location_id}`, i])),
    allowance,
  };
  const linkMap = new Map(links.map(l => [l.toast_item_id, l]));
  const locBySlug = new Map(locations.map(l => [l.slug, l]));

  const perServing = new Map<string, { deductions: Deduction[] } | { reasons: string[] }>();
  const resolved: ResolvedLine[] = [];
  const unresolvedMap = new Map<string, UnresolvedGroup>();
  const totals = new Map<string, number>();

  for (const line of lines) {
    if (line.voided || !(line.qty > 0)) continue;
    const slug = saleLocationSlug(line.menu);
    const loc = locBySlug.get(slug);
    const key = `${line.toast_item_id}|${slug}`;

    let result = perServing.get(key);
    if (!result) {
      result = loc
        ? servingDeductions(linkMap.get(line.toast_item_id), loc.id, loc.name, ctx)
        : { reasons: [`No "${slug}" location set up in the app`] };
      perServing.set(key, result);
    }

    if ('reasons' in result) {
      const g = unresolvedMap.get(key) || {
        toast_item_id: line.toast_item_id,
        menu_item: line.menu_item,
        menu_group: line.menu_group,
        menu: line.menu,
        qty: 0,
        reasons: result.reasons,
      };
      g.qty += line.qty;
      unresolvedMap.set(key, g);
      continue;
    }

    const deductions = result.deductions.map(d => ({ item_id: d.item_id, units: d.units * line.qty }));
    for (const d of deductions) totals.set(d.item_id, (totals.get(d.item_id) || 0) + d.units);
    resolved.push({ item_selection_id: line.item_selection_id, deductions });
  }

  return {
    resolved,
    unresolved: Array.from(unresolvedMap.values()).sort((a, b) => b.qty - a.qty),
    totals,
  };
}

// ---------------------------------------------------------------------------
// Link suggestions (shown pre-filled on the link screen; never applied unasked)
// ---------------------------------------------------------------------------

export interface LinkSuggestion {
  link_type: 'recipe' | 'item' | 'ignore';
  recipe_id?: string;
  inventory_item_id?: string;
  amount?: number;
  amount_unit?: AmountUnit;
}

function looseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Default pour for a straight sale of one product, from its Toast group and stock category. */
export function defaultServing(menuGroup: string, menuItem: string, item: Pick<StockItem, 'category' | 'unit'>): { amount: number; amount_unit: AmountUnit } {
  const g = `${menuGroup} ${menuItem}`.toLowerCase();
  if (/\bthc\b/.test(g)) return { amount: 0.5, amount_unit: 'unit' }; // 2 servings per can
  if (item.unit === 'can' || item.unit === 'each' || item.category === 'beer') return { amount: 1, amount_unit: 'unit' };
  if (item.category === 'wine') return { amount: 5, amount_unit: 'oz' };
  if (/\bdbl\b|double/.test(g)) return { amount: 3, amount_unit: 'oz' };
  return { amount: 1.5, amount_unit: 'oz' };
}

export function suggestLink(
  toast: { menu_item: string; menu_group: string; menu: string },
  recipes: RecipeRef[],
  items: StockItem[],
  saleLocationId: string | null
): LinkSuggestion | null {
  if (toast.menu.trim().toLowerCase() === 'no menu') return { link_type: 'ignore' };

  const target = looseName(toast.menu_item.replace(/^dbl\s+/i, ''));
  if (!target) return null;

  const recipe = recipes.find(r => r.is_active !== false && looseName(r.name) === target);
  if (recipe) return { link_type: 'recipe', recipe_id: recipe.id };

  const candidates = items.filter(i => {
    const n = looseName(i.name);
    const bn = looseName(`${i.brand} ${i.name}`);
    return n === target || bn === target;
  });
  const item = candidates.find(i => i.location_id === saleLocationId) || candidates[0];
  if (item) {
    return { link_type: 'item', inventory_item_id: item.id, ...defaultServing(toast.menu_group, toast.menu_item, item) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Physical counts
// ---------------------------------------------------------------------------

/** Categories whose stock is poured by volume (these carry the pour allowance). */
export const POURED_CATEGORIES = new Set(['spirits', 'wine', 'mixers']);

export interface CountLine {
  item_id: string;
  category: string;
  cost_per_unit: number;
  system_qty: number; // what the app thought was on the shelf when the count closed
  counted_qty: number | null;
}

export interface CountVariance {
  counted_lines: number;
  uncounted_lines: number;
  /** Counted minus system, in dollars at cost: negative = less on the shelf than the app expected. */
  variance_value: number;
  poured_variance_value: number;
}

export function summarizeCount(lines: CountLine[]): CountVariance {
  let counted = 0;
  let uncounted = 0;
  let value = 0;
  let pouredValue = 0;
  for (const l of lines) {
    if (l.counted_qty === null || l.counted_qty === undefined) {
      uncounted++;
      continue;
    }
    counted++;
    const v = (l.counted_qty - l.system_qty) * (l.cost_per_unit || 0);
    value += v;
    if (POURED_CATEGORIES.has(l.category)) pouredValue += v;
  }
  return { counted_lines: counted, uncounted_lines: uncounted, variance_value: round2(value), poured_variance_value: round2(pouredValue) };
}

/**
 * Real loss rate on poured stock between two counts.
 *
 * `salesValue` is what sales took out of poured stock since the last count
 * (at cost), which already includes the allowance in force. Taking the
 * allowance back out gives the theoretical pours; adding what's missing from
 * the shelf on top gives actual usage. The ratio is the loss rate the
 * allowance should be set to.
 *
 * Returns null when there were no poured sales to measure against.
 */
export function measuredLossPct(salesValue: number, shelfShortfallValue: number, allowancePct: number): number | null {
  if (!(salesValue > 0)) return null;
  const theoretical = salesValue / (1 + allowancePct / 100);
  const actual = salesValue + shelfShortfallValue;
  return round1((actual / theoretical - 1) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
