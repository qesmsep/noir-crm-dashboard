/**
 * How inventory items are named, shown and matched.
 *
 * An item's label is its brand followed by its name, except where that would
 * say the brand twice ("Tito's" / "Tito's") or where the brand isn't a label
 * at all ("House-made"). The same bottle at two bars is two rows with the same
 * label; that's how a shared recipe finds it at each bar.
 */

export interface NamedItem {
  name: string;
  brand?: string | null;
}

/** Brands that describe where an item comes from rather than what's on a label. */
const UNLABELLED_BRANDS = new Set(['house-made', 'housemade', 'house made']);

/** Lowercase, no accents, "&" as "and", apostrophes dropped, other punctuation as spaces. */
export function looseText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "Buffalo Trace Bourbon", never "Buffalo Trace Buffalo Trace Bourbon". */
export function itemLabel(item: NamedItem): string {
  const name = (item.name || '').trim();
  const brand = (item.brand || '').trim();
  if (!brand || UNLABELLED_BRANDS.has(brand.toLowerCase())) return name;
  const b = looseText(brand);
  const n = looseText(name);
  if (n === b || n.startsWith(`${b} `)) return name;
  return `${brand} ${name}`;
}

/** Two items with the same key are the same product (used to find a bottle at another bar). */
export function matchKey(item: NamedItem): string {
  return looseText(itemLabel(item));
}

// ---------------------------------------------------------------------------
// Similar items: catch "St Germain" vs "St. Germain Elderflower Liqueur",
// "Cimmaron" vs "Cimarron", "RosesPetals" vs "Rose Petals" before a second
// row gets created.
// ---------------------------------------------------------------------------

/**
 * Words that say what kind of thing an item is, not which one. A name often
 * leaves the type off ("St George Spiced Pear" is the liqueur), so a missing
 * type word isn't a difference, but two different ones are ("Grapefruit
 * Vodka" isn't "Grapefruit Juice").
 */
const TYPE_WORDS = new Set([
  'liqueur', 'liquor', 'cordial', 'vodka', 'gin', 'rum', 'tequila', 'mezcal', 'whiskey', 'whisky',
  'bourbon', 'rye', 'scotch', 'brandy', 'cognac', 'amaro', 'vermouth', 'wine', 'beer', 'ipa',
]);
/** Words that change what the thing is: lime juice is not limes, and honey syrup is not honey. */
const FORM_WORDS = new Set(['juice', 'syrup', 'puree', 'bitters', 'water', 'tea', 'beans', 'bean', 'slices', 'slice', 'wedges', 'wedge', 'brine', 'milk', 'cream']);
/**
 * Words many different bottles share ("Reposado", "Single Barrel", "Rosé").
 * They count toward a match, but a match on these alone is no match.
 */
const STYLE_WORDS = new Set([
  'blanco', 'silver', 'plata', 'reposado', 'anejo', 'extra', 'cristalino', 'joven', 'rose', 'rosso', 'rouge',
  'blanc', 'white', 'red', 'black', 'gold', 'dry', 'sweet', 'spiced', 'dark', 'light', 'single', 'barrel',
  'small', 'batch', 'reserve', 'proof', 'year', 'old', 'aged', 'straight', 'label', 'bottled', 'bond', 'house',
]);
const FILLER_WORDS = new Set(['the', 'and', 'of', 'de', 'du', 'la', 'le', 'di', 'del', 'ml', 'l', 'oz']);

function stem(word: string): string {
  return word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

interface Words {
  sig: string[]; // the words that say which product it is
  types: Set<string>;
  forms: Set<string>;
}

function words(s: string): Words {
  const all = looseText(s)
    .replace(/\b\d+(\.\d+)?\s?(ml|l|oz)\b/g, ' ')
    .split(' ')
    .filter(w => w && !FILLER_WORDS.has(w));
  const types = new Set(all.filter(w => TYPE_WORDS.has(w)));
  const forms = new Set(all.filter(w => FORM_WORDS.has(w)).map(stem));
  const sig = all.filter(w => !TYPE_WORDS.has(w) && !FORM_WORDS.has(w)).map(stem);
  return { sig, types, forms };
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && Array.from(a).every(x => b.has(x));
}

function disjoint(a: Set<string>, b: Set<string>): boolean {
  return Array.from(a).every(x => !b.has(x));
}

function numbers(ws: string[]): string {
  return ws.filter(w => /^\d+$/.test(w)).sort().join(',');
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Same word, allowing a typo in longer words ("cimmaron"/"cimarron", "yakamaniac"/"yakimaniac"). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  const shorter = Math.min(a.length, b.length);
  if (shorter >= 8) return editDistance(a, b, 2) <= 2;
  if (shorter >= 5) return editDistance(a, b, 1) <= 1;
  return false;
}

function wordScore(wa: Words, wb: Words, allowStyleOnly: boolean): number {
  const a = wa.sig;
  const b = wb.sig;
  if (a.length === 0 || b.length === 0) return 0;
  const used = new Set<number>();
  let matched = 0;
  let distinctive = 0;
  for (const w of a) {
    const j = b.findIndex((x, k) => !used.has(k) && sameWord(w, x));
    if (j >= 0) {
      used.add(j);
      matched++;
      if (!STYLE_WORDS.has(w) && !STYLE_WORDS.has(b[j])) distinctive++;
    }
  }
  // A name that is nothing but a style ("Cristalino") can still be worth a look.
  const allStyle = (ws: string[]) => ws.every(w => STYLE_WORDS.has(w));
  if (distinctive === 0 && !(allowStyleOnly && (allStyle(a) || allStyle(b)))) return 0;
  // Every word on both sides lines up: the same product, maybe with a typo.
  // Otherwise one name has words the other doesn't ("Blanton's Gold Single
  // Barrel" vs "Blanton's Single Barrel"), which is worth a look but may well
  // be a different bottle.
  let score =
    matched === a.length && matched === b.length
      ? 1
      : Math.min(0.84, 0.6 * (matched / Math.min(a.length, b.length)) + 0.4 * (matched / Math.max(a.length, b.length)));
  if (distinctive === 0) score = Math.min(score, 0.7);
  if (!sameSet(wa.forms, wb.forms)) score = Math.min(score, 0.6);
  if (wa.types.size > 0 && wb.types.size > 0 && disjoint(wa.types, wb.types)) score = Math.min(score, 0.6);
  // "Weller 12 Year" isn't "Weller 7 Year".
  if (numbers(a) !== numbers(b)) score = Math.min(score, 0.6);
  return score;
}

/** Same letters once the spaces are gone ("Passionfruit" / "Passion Fruit", "RosesPetals" / "Rose Petals"). */
function squashedScore(a: string, b: string): number {
  const la = looseText(a);
  const lb = looseText(b);
  if (!la || !lb) return 0;
  if (numbers(la.split(' ')) !== numbers(lb.split(' '))) return 0;
  const sa = la.replace(/ /g, '');
  const sb = lb.replace(/ /g, '');
  if (sa === sb) return 1;
  const shorter = Math.min(sa.length, sb.length);
  if (shorter >= 8 && editDistance(sa, sb, 1) <= 1) return 0.95;
  return 0;
}

/** 0–1: how likely two items are the same product. */
export function similarity(a: NamedItem, b: NamedItem): number {
  const la = itemLabel(a);
  const lb = itemLabel(b);
  if (looseText(la) === looseText(lb)) return 1;
  let score = Math.max(squashedScore(la, lb), wordScore(words(la), words(lb), true));
  // Compare the names alone only when the brands can't disagree: "Sex Rosé"
  // and "Glendalough Rose Gin" are both "Rose" something.
  const ba = looseText(a.brand || '');
  const bb = looseText(b.brand || '');
  if (!ba || !bb || ba === bb) {
    score = Math.max(score, squashedScore(a.name, b.name), wordScore(words(a.name), words(b.name), false));
  }
  return score;
}

/** At or above this, a new item is treated as a likely duplicate and needs a deliberate "create anyway". */
export const LIKELY_DUPLICATE = 0.85;
/** At or above this, it's shown as "similar" so the person can check. */
export const SIMILAR = 0.6;

export interface SimilarMatch<T> {
  item: T;
  score: number;
  likely: boolean;
}

/**
 * Items that look like the one being added, best first. Pass the item's own
 * id as `excludeId` when editing. Rows that are the same product at another
 * bar (same label) are collapsed to one entry per label.
 */
export function findSimilarItems<T extends NamedItem & { id?: string }>(
  candidate: NamedItem,
  items: T[],
  opts: { excludeId?: string; limit?: number } = {}
): SimilarMatch<T>[] {
  if (!looseText(candidate.name || '')) return [];
  const best = new Map<string, SimilarMatch<T>>();
  for (const item of items) {
    if (opts.excludeId && item.id === opts.excludeId) continue;
    const score = similarity(candidate, item);
    if (score < SIMILAR) continue;
    const key = matchKey(item);
    const prev = best.get(key);
    if (!prev || score > prev.score) best.set(key, { item, score, likely: score >= LIKELY_DUPLICATE });
  }
  return Array.from(best.values())
    .sort((x, y) => y.score - x.score)
    .slice(0, opts.limit ?? 5);
}
