/**
 * Pure logic for turning Toast's nightly ItemSelectionDetails export into
 * inventory deductions, and for scoring physical inventory counts.
 *
 * No I/O here — everything is unit tested in __tests__/toastSalesCore.test.ts.
 * The SFTP pull and database writes live in src/lib/toast/.
 */
import Papa from 'papaparse';
import { itemLabel, looseText, matchKey } from './inventory/itemNames';

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
// Hand-uploaded reports
// ---------------------------------------------------------------------------

export type SalesFileFormat = 'item_selections' | 'product_mix';

function headerFields(text: string): string[] {
  const first = text.replace(/^\uFEFF/, '').split(/\r?\n/).find(l => l.trim()) || '';
  return first.split(first.includes('\t') ? '\t' : ',').map(h => h.trim().replace(/^"|"$/g, ''));
}

/** Toast's nightly ItemSelectionDetails.csv, or the Product Mix report exported from Toast Web. */
export function detectSalesFormat(text: string): SalesFileFormat | null {
  const h = new Set(headerFields(text));
  if (h.has('Item Selection Id') && h.has('Item Id')) return 'item_selections';
  if (h.has('Menu Item') && h.has('Item Qty')) return 'product_mix';
  return null;
}

export interface ProductMixRow {
  menu_item: string;
  menu_group: string;
  menu: string;
  qty: number;
  gross: number;
  discount: number;
  net: number;
}

/**
 * Product Mix rows, one per menu item per menu. "Item Qty" already leaves out
 * voids (gross = qty × price; voids are listed separately), and comped or
 * discounted drinks still count — they were poured. Rows naming the same item
 * twice are added together.
 */
export function parseProductMix(text: string): ProductMixRow[] {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: h => h.trim(),
  });
  const byKey = new Map<string, ProductMixRow>();
  for (const r of parsed.data) {
    const menuItem = (r['Menu Item'] || '').trim();
    const qty = num(r['Item Qty']);
    if (!menuItem || !(qty > 0)) continue;
    const row: ProductMixRow = {
      menu_item: menuItem,
      menu_group: (r['Menu Group'] || '').trim(),
      menu: (r['Menu'] || '').trim(),
      qty,
      gross: num(r['Gross Amount']),
      discount: num(r['Discount Amount']),
      net: num(r['Net Amount']),
    };
    const key = productMixKey(row);
    const prev = byKey.get(key);
    if (prev) {
      prev.qty += row.qty;
      prev.gross += row.gross;
      prev.discount += row.discount;
      prev.net += row.net;
    } else {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

/** Name key for a Toast item when its Toast id isn't known (Product Mix has no ids). */
export function productMixKey(r: { menu: string; menu_group: string; menu_item: string }): string {
  return `${r.menu}|${r.menu_group}|${r.menu_item}`.toLowerCase();
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
  /**
   * The bottle this ingredient comes out of at each bar, by location id, when
   * it isn't simply the same product as `inventory_item_id`. `null` means the
   * ingredient isn't tracked at that bar: the drink deducts everything else.
   * A bar not listed here finds its bottle automatically.
   */
  location_items?: Record<string, string | null>;
}

export interface RecipeRef {
  id: string;
  name: string;
  category?: string | null;
  is_active?: boolean;
  ingredients: RecipeIngredientRef[];
}

/**
 * A cocktail or shot must name its spirit in the recipe — there is no house
 * spirit to fall back on. Mocktails are exempt. The recipe's own category
 * decides; when it's blank or generic, the Toast menu group does.
 */
export function needsSpirit(recipeCategory: string | null | undefined, toastMenuGroup: string): boolean {
  const cat = (recipeCategory || '').toLowerCase();
  if (/mocktail/.test(cat)) return false;
  if (/cocktail|shot/.test(cat)) return true;
  if (cat && cat !== 'other') return false;
  const group = toastMenuGroup.toLowerCase();
  return /cocktail|signature|libation/.test(group) && !/mocktail/.test(group);
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

/** A recipe ingredient with no bottle at the bar a drink was sold at — fixable from the review screen. */
export interface IngredientGap {
  recipe_id: string;
  recipe_name: string;
  ingredient_index: number;
  ingredient_name: string;
  inventory_item_id: string;
  location_id: string;
  location_name: string;
  /** missing: nothing like it at that bar; ambiguous: more than one bottle could be it. */
  kind: 'missing' | 'ambiguous';
  candidate_ids: string[];
}

export interface UnresolvedGroup {
  toast_item_id: string;
  menu_item: string;
  menu_group: string;
  menu: string;
  qty: number;
  reasons: string[];
  gaps: IngredientGap[];
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

export interface StockIndex {
  items: Map<string, StockItem>;
  byNameBrandLoc: Map<string, StockItem>;
  byLabelLoc: Map<string, StockItem[]>;
  byNameLoc: Map<string, StockItem[]>;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}

export function indexStock(items: StockItem[]): StockIndex {
  const idx: StockIndex = {
    items: new Map(items.map(i => [i.id, i])),
    byNameBrandLoc: new Map(items.map(i => [`${normKey(i.name)}|${normKey(i.brand)}|${i.location_id}`, i])),
    byLabelLoc: new Map(),
    byNameLoc: new Map(),
  };
  for (const i of items) {
    push(idx.byLabelLoc, `${matchKey(i)}|${i.location_id}`, i);
    push(idx.byNameLoc, `${looseText(i.name)}|${i.location_id}`, i);
  }
  return idx;
}

export type LocalMatch = { item: StockItem } | { missing: true } | { ambiguous: StockItem[] };

/**
 * The same product stocked at another bar. Tried in order: the exact name and
 * brand; the same label (so "Buffalo Trace" with no brand finds "Buffalo
 * Trace" / "Buffalo Trace"); the same name with either brand. Two candidates
 * are settled by bottle size; any more doubt is "ambiguous", never a guess.
 */
export function findAtLocation(item: StockItem, locationId: string, idx: StockIndex): LocalMatch {
  if (item.location_id === locationId) return { item };
  const exact = idx.byNameBrandLoc.get(`${normKey(item.name)}|${normKey(item.brand)}|${locationId}`);
  if (exact) return { item: exact };
  for (const list of [idx.byLabelLoc.get(`${matchKey(item)}|${locationId}`), idx.byNameLoc.get(`${looseText(item.name)}|${locationId}`)]) {
    if (!list || list.length === 0) continue;
    if (list.length === 1) return { item: list[0] };
    const sameSize = list.filter(i => i.volume_ml === item.volume_ml);
    if (sameSize.length === 1) return { item: sameSize[0] };
    return { ambiguous: list };
  }
  return { missing: true };
}

/** Per-serving deductions for one Toast item at one location, or the reasons it can't be worked out. */
function servingDeductions(
  link: ToastLink | undefined,
  locationId: string,
  locationName: string,
  menuGroup: string,
  ctx: {
    recipes: Map<string, RecipeRef>;
    stock: StockIndex;
    allowance: LossAllowance;
  }
): { deductions: Deduction[] } | { reasons: string[]; gaps: IngredientGap[] } {
  if (!link) return { reasons: ['Not linked to a recipe or bottle yet'], gaps: [] };
  if (link.link_type === 'ignore') return { deductions: [] };

  const withAllowance = (units: number, poured: boolean) =>
    units * (1 + (poured ? ctx.allowance.poured_pct : ctx.allowance.packaged_pct) / 100);

  const reasons: string[] = [];
  const gaps: IngredientGap[] = [];
  const deductions: Deduction[] = [];

  const deduct = (local: StockItem, amount: number | null | undefined, unit: string | null | undefined, label: string) => {
    const conv = toStockUnits(Number(amount), String(unit || ''), local);
    if ('error' in conv) reasons.push(`${label}: ${conv.error}`);
    else deductions.push({ item_id: local.id, units: withAllowance(conv.units, conv.poured) });
  };

  /** The bottle at this bar, or why there isn't one (and, for a recipe ingredient, the gap to fix). */
  const localFor = (
    linked: StockItem,
    gap?: Omit<IngredientGap, 'kind' | 'candidate_ids' | 'location_id' | 'location_name'>
  ): StockItem | null => {
    const found = findAtLocation(linked, locationId, ctx.stock);
    if ('item' in found) return found.item;
    const name = itemLabel(linked);
    if ('ambiguous' in found) {
      reasons.push(`${name} matches more than one bottle at ${locationName} — pick one`);
      if (gap) gaps.push({ ...gap, kind: 'ambiguous', candidate_ids: found.ambiguous.map(i => i.id), location_id: locationId, location_name: locationName });
    } else {
      reasons.push(`${name} isn't stocked at ${locationName}`);
      if (gap) gaps.push({ ...gap, kind: 'missing', candidate_ids: [], location_id: locationId, location_name: locationName });
    }
    return null;
  };

  if (link.link_type === 'item') {
    const linked = link.inventory_item_id ? ctx.stock.items.get(link.inventory_item_id) : undefined;
    if (!linked) reasons.push('Pour: the linked bottle no longer exists');
    else {
      const local = localFor(linked);
      if (local) deduct(local, link.amount, link.amount_unit, 'Pour');
    }
  } else {
    const recipe = link.recipe_id ? ctx.recipes.get(link.recipe_id) : undefined;
    if (!recipe) {
      reasons.push('The linked recipe no longer exists');
    } else if (recipe.is_active === false) {
      reasons.push(`Recipe "${recipe.name}" is archived`);
    } else if (!recipe.ingredients || recipe.ingredients.length === 0) {
      reasons.push(`Recipe "${recipe.name}" has no ingredients`);
    } else {
      if (
        needsSpirit(recipe.category, menuGroup) &&
        !recipe.ingredients.some(i => ctx.stock.items.get(i.inventory_item_id)?.category === 'spirits')
      ) {
        reasons.push(`Recipe "${recipe.name}" lists no spirit`);
      }
      recipe.ingredients.forEach((ing, index) => {
        const label = `Recipe "${recipe.name}" — ${ing.name || 'ingredient'}`;
        if (!ing.inventory_item_id) {
          reasons.push(`${label} isn't linked to a bottle`);
          return;
        }
        const picks = ing.location_items || {};
        if (Object.prototype.hasOwnProperty.call(picks, locationId)) {
          const picked = picks[locationId];
          if (picked === null) return; // not tracked at this bar
          const item = ctx.stock.items.get(picked);
          if (!item || item.location_id !== locationId) reasons.push(`${label}: the bottle picked for ${locationName} no longer exists`);
          else deduct(item, ing.quantity, ing.unit, label);
          return;
        }
        const linked = ctx.stock.items.get(ing.inventory_item_id);
        if (!linked) {
          reasons.push(`${label}: the linked bottle no longer exists`);
          return;
        }
        const local = localFor(linked, {
          recipe_id: recipe.id,
          recipe_name: recipe.name,
          ingredient_index: index,
          ingredient_name: ing.name || itemLabel(linked),
          inventory_item_id: ing.inventory_item_id,
        });
        if (local) deduct(local, ing.quantity, ing.unit, label);
      });
    }
  }

  return reasons.length > 0 ? { reasons, gaps } : { deductions };
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
    stock: indexStock(items),
    allowance,
  };
  const linkMap = new Map(links.map(l => [l.toast_item_id, l]));
  const locBySlug = new Map(locations.map(l => [l.slug, l]));

  const perServing = new Map<string, { deductions: Deduction[] } | { reasons: string[]; gaps: IngredientGap[] }>();
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
        ? servingDeductions(linkMap.get(line.toast_item_id), loc.id, loc.name, line.menu_group, ctx)
        : { reasons: [`No "${slug}" location set up in the app`], gaps: [] };
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
        gaps: result.gaps,
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

/** Toast closes its business day at 4am Chicago: a timestamp's business date is its Chicago date 4 hours earlier. */
export function businessDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() - 4 * 3600 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

/** The business date apply_toast_sales() writes into a sales transaction's note ("Toast sales YYYY-MM-DD"). */
export function saleDateFromNote(note: string | null | undefined): string | null {
  const m = /^Toast sales (\d{4}-\d{2}-\d{2})/.exec(note || '');
  return m ? m[1] : null;
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
