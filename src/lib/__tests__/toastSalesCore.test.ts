import {
  parseItemSelectionCsv,
  folderToBusinessDate,
  saleLocationSlug,
  toStockUnits,
  buildDeductionPlan,
  suggestLink,
  defaultServing,
  summarizeCount,
  measuredLossPct,
  needsSpirit,
  detectSalesFormat,
  parseProductMix,
  productMixKey,
  businessDateOf,
  saleDateFromNote,
  StockItem,
  ToastLink,
  RecipeRef,
} from '../toastSalesCore';

const HEADER =
  'Location,Order Id,Order #,Sent Date,Order Date,Check Id,Server,Table,Dining Area,Service,Dining Option,Item Selection Id,Item Id,Master Id,SKU,PLU,Menu Item,Menu Subgroup(s),Menu Group,Menu,Sales Category,Gross Price,Discount,Net Price,Qty,Tax,Void?,Deferred,Tax Exempt,Tax Inclusion Option,Dining Option Tax,Tab Name';

const CSV = [
  HEADER,
  '106 West 11th Street,1300000015734303122,5001,10/8/26 5:18 PM,10/8/26 5:17 PM,1300000015734303115,Server A,6,Lounge,,,1300000015734303101,1300000001877960256,1300000001877960257,,,Espresso Martini,,Classic Cocktails,Cocktails,,20.00,0.00,20.00,1.0,1.99000000,false,false,false,Tax Not Included,No Effect,',
  '106 West 11th Street,1300000015734303122,5001,10/8/26 5:18 PM,10/8/26 5:17 PM,1300000015734303115,Server A,6,Lounge,,,1300000015734303112,1300000008798634857,1300000008798634858,,,G4 Blanco,,Tequila,Liquor,,16.00,0.00,16.00,1.0,1.60000000,false,false,false,Tax Not Included,No Effect,',
  '106 West 11th Street,1300000015734309999,5002,10/8/26 9:00 PM,10/8/26 9:00 PM,1300000015734309998,Server B,,Roof,,,1300000015734309997,1300000009999999999,1300000009999999998,,,"Tito\'s",,Spirits,RooftopKC,,"1,013.00",0.00,13.00,2.0,1.30,true,false,false,Tax Not Included,No Effect,',
].join('\n');

describe('parseItemSelectionCsv', () => {
  it('reads Toast columns, numbers and the void flag', () => {
    const lines = parseItemSelectionCsv(CSV, '2026-10-08');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({
      item_selection_id: '1300000015734303101',
      toast_item_id: '1300000001877960256',
      menu_item: 'Espresso Martini',
      menu_group: 'Classic Cocktails',
      menu: 'Cocktails',
      qty: 1,
      net_price: 20,
      voided: false,
      business_date: '2026-10-08',
    });
    expect(lines[2]).toMatchObject({ menu: 'RooftopKC', qty: 2, gross_price: 1013, voided: true });
  });

  it('drops rows with no selection id', () => {
    expect(parseItemSelectionCsv(`${HEADER}\n,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`, '2026-10-08')).toHaveLength(0);
  });
});

describe('hand-uploaded reports', () => {
  const PMIX = [
    'Menu Item\tMenu Group\tMenu\tAvg Price\tItem Qty\tGross Amount\tVoid Qty\tVoid Amount\tDiscount Amount\tNet Amount\t# Orders\tTax',
    'Afterglow\tRooftopKC Cocktails\tRooftopKC\t$17.00\t16\t$272.00\t2\t$34.00\t$187.00\t$85.00\t12\t$8.45',
    'Espresso Martini\tClassic Cocktails\tCocktails\t$20.00\t51\t"$1,020.00"\t0\t$0.00\t$0.00\t"$1,020.00"\t24\t$101.59',
    'Tes\tOpen Drink\tNo Menu\t$0.00\t0\t$0.00\t1\t$0.00\t$0.00\t$0.00\t1\t$0.00',
  ].join('\n');

  it('tells the two Toast formats apart', () => {
    expect(detectSalesFormat(PMIX)).toBe('product_mix');
    expect(detectSalesFormat(CSV)).toBe('item_selections');
    expect(detectSalesFormat('Name,Qty\nX,1')).toBeNull();
  });

  it('reads Product Mix (tabs or commas), skipping zero-qty rows', () => {
    const rows = parseProductMix(PMIX);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ menu_item: 'Afterglow', menu: 'RooftopKC', qty: 16, net: 85 });
    expect(rows[1]).toMatchObject({ menu_item: 'Espresso Martini', qty: 51, gross: 1020 });
    expect(parseProductMix(PMIX.replace(/\t/g, ','))).toHaveLength(2);
  });

  it('adds duplicate rows together and keys by menu, group and item', () => {
    const dup = PMIX.split('\n').slice(0, 2).concat(PMIX.split('\n')[1]).join('\n');
    expect(parseProductMix(dup)[0].qty).toBe(32);
    expect(productMixKey({ menu: 'RooftopKC', menu_group: 'Spirits', menu_item: "Tito's" })).toBe("rooftopkc|spirits|tito's");
  });
});

describe('folderToBusinessDate / saleLocationSlug', () => {
  it('reads date folders only', () => {
    expect(folderToBusinessDate('20261008')).toBe('2026-10-08');
    expect(folderToBusinessDate('260417')).toBeNull();
  });
  it('maps the RooftopKC menu to rooftop, everything else to Noir', () => {
    expect(saleLocationSlug('RooftopKC')).toBe('rooftopkc');
    expect(saleLocationSlug('Cocktails')).toBe('noirkc');
    expect(saleLocationSlug('Liquor')).toBe('noirkc');
  });
});

describe('toStockUnits', () => {
  const bottle = { name: "Tito's", unit: 'bottle', volume_ml: 750 };
  it('converts an oz pour into a fraction of the bottle', () => {
    const r = toStockUnits(1.5, 'oz', bottle);
    expect('units' in r && r.units).toBeCloseTo((1.5 * 29.5735) / 750, 6);
    expect('poured' in r && r.poured).toBe(true);
  });
  it('treats whole units as packaged', () => {
    expect(toStockUnits(0.5, 'unit', { name: 'THC', unit: 'can', volume_ml: 355 })).toEqual({ units: 0.5, poured: false });
  });
  it('flags bottles with no size, and pours from by-the-each stock', () => {
    expect(toStockUnits(1, 'oz', { name: 'X', unit: 'bottle', volume_ml: 0 })).toHaveProperty('error');
    expect(toStockUnits(1, 'oz', { name: 'Limes', unit: 'each', volume_ml: 0 })).toHaveProperty('error');
  });
  it('allows garnish counts only from by-the-each stock', () => {
    expect(toStockUnits(1, 'wheel', { name: 'Limes', unit: 'each', volume_ml: 0 })).toEqual({ units: 1, poured: false });
    expect(toStockUnits(1, 'wheel', bottle)).toHaveProperty('error');
  });
  it('rejects zero amounts and unknown units', () => {
    expect(toStockUnits(0, 'oz', bottle)).toHaveProperty('error');
    expect(toStockUnits(1, 'pinch', bottle)).toHaveProperty('error');
  });
});

const LOCS = [
  { id: 'loc-noir', slug: 'noirkc', name: 'Noir' },
  { id: 'loc-roof', slug: 'rooftopkc', name: 'RooftopKC' },
];

function item(over: Partial<StockItem>): StockItem {
  return {
    id: 'x',
    name: 'X',
    brand: '',
    category: 'spirits',
    unit: 'bottle',
    volume_ml: 750,
    quantity: 10,
    cost_per_unit: 20,
    location_id: 'loc-noir',
    ...over,
  };
}

const VODKA_NOIR = item({ id: 'vod-n', name: 'Vodka', brand: "Tito's" });
const VODKA_ROOF = item({ id: 'vod-r', name: 'Vodka', brand: "Tito's", location_id: 'loc-roof' });
const KAHLUA_NOIR = item({ id: 'kah-n', name: 'Coffee Liqueur', brand: 'Kahlua' });
const THC_ROOF = item({ id: 'thc-r', name: 'Juicy Grapefruit', category: 'other', unit: 'can', volume_ml: 355, location_id: 'loc-roof' });
const ITEMS = [VODKA_NOIR, VODKA_ROOF, KAHLUA_NOIR, THC_ROOF];

const ESPRESSO: RecipeRef = {
  id: 'r-esp',
  name: 'Espresso Martini',
  ingredients: [
    { inventory_item_id: 'vod-n', name: 'Vodka', quantity: 1.5, unit: 'oz' },
    { inventory_item_id: 'kah-n', name: 'Kahlua', quantity: 1, unit: 'oz' },
  ],
};

const NO_ALLOWANCE = { poured_pct: 0, packaged_pct: 0 };

function line(id: string, toastItem: string, menu: string, qty = 1, voided = false) {
  return { item_selection_id: id, toast_item_id: toastItem, menu_item: toastItem, menu_group: 'G', menu, qty, voided };
}

describe('buildDeductionPlan', () => {
  const links: ToastLink[] = [
    { toast_item_id: 'T-ESP', link_type: 'recipe', recipe_id: 'r-esp', inventory_item_id: null, amount: null, amount_unit: null },
    { toast_item_id: 'T-THC', link_type: 'item', recipe_id: null, inventory_item_id: 'thc-r', amount: 0.5, amount_unit: 'unit' },
    { toast_item_id: 'T-TEST', link_type: 'ignore', recipe_id: null, inventory_item_id: null, amount: null, amount_unit: null },
  ];

  it('deducts recipe ingredients per drink sold', () => {
    const plan = buildDeductionPlan([line('a', 'T-ESP', 'Cocktails', 2)], links, [ESPRESSO], ITEMS, LOCS, NO_ALLOWANCE);
    expect(plan.unresolved).toHaveLength(0);
    expect(plan.totals.get('vod-n')).toBeCloseTo((2 * 1.5 * 29.5735) / 750, 6);
    expect(plan.totals.get('kah-n')).toBeCloseTo((2 * 1 * 29.5735) / 750, 6);
  });

  it('adds the pour allowance to poured amounts only', () => {
    const allowance = { poured_pct: 5, packaged_pct: 0 };
    const plan = buildDeductionPlan(
      [line('a', 'T-ESP', 'Cocktails'), line('b', 'T-THC', 'RooftopKC', 2)],
      links, [ESPRESSO], ITEMS, LOCS, allowance
    );
    expect(plan.totals.get('vod-n')).toBeCloseTo(((1.5 * 29.5735) / 750) * 1.05, 6);
    expect(plan.totals.get('thc-r')).toBe(1); // 2 sold × ½ can, no allowance on cans
  });

  it('pulls each ingredient from the bar that sold it, and from Noir KC when that bar does not stock it', () => {
    const plan = buildDeductionPlan([line('a', 'T-ESP', 'RooftopKC')], links, [ESPRESSO], ITEMS, LOCS, NO_ALLOWANCE);
    // Vodka is stocked on the roof; coffee liqueur isn't, so it comes out of Noir's.
    expect(plan.unresolved).toHaveLength(0);
    expect(Array.from(plan.totals.keys()).sort()).toEqual(['kah-n', 'vod-r']);
  });

  it('holds a drink back only when neither the bar nor Noir KC stocks the ingredient', () => {
    const noKahlua = ITEMS.filter(i => i.id !== 'kah-n');
    const kahlua = ITEMS.find(i => i.id === 'kah-n')!;
    const plan = buildDeductionPlan([line('a', 'T-ESP', 'RooftopKC')], links, [ESPRESSO], [...noKahlua, { ...kahlua, location_id: 'loc-op' }], LOCS, NO_ALLOWANCE);
    expect(plan.resolved).toHaveLength(0);
    expect(plan.unresolved[0].reasons).toEqual(["Kahlua Coffee Liqueur isn't stocked at RooftopKC or Noir"]);
    expect(plan.unresolved[0].gaps).toEqual([
      {
        recipe_id: 'r-esp',
        recipe_name: 'Espresso Martini',
        ingredient_index: 1,
        ingredient_name: 'Kahlua',
        inventory_item_id: 'kah-n',
        location_id: 'loc-roof',
        location_name: 'RooftopKC',
        kind: 'missing',
        candidate_ids: [],
      },
    ]);
  });

  it('settles a Noir KC look-alike with the bottle picked for Noir KC, for Rooftop sales too', () => {
    const kahlua2 = item({ id: 'kah-n2', name: 'Kahlua Coffee Liqueur', brand: 'Kahlua', volume_ml: 750 });
    const base = { ...KAHLUA_NOIR, id: 'kah-r0', location_id: 'loc-op', name: 'Coffee Liqueur', brand: 'Kahlua' };
    const twinNoir = { ...kahlua2, id: 'kah-n3' };
    const recipe: RecipeRef = { ...ESPRESSO, ingredients: [ESPRESSO.ingredients[0], { ...ESPRESSO.ingredients[1], inventory_item_id: 'kah-r0' }] };
    const stock = [VODKA_NOIR, VODKA_ROOF, base, kahlua2, twinNoir];

    let plan = buildDeductionPlan([line('a', 'T-ESP', 'RooftopKC')], links, [recipe], stock, LOCS, NO_ALLOWANCE);
    expect(plan.unresolved[0].reasons).toEqual(['Kahlua Coffee Liqueur matches more than one bottle at Noir — pick one']);
    // The gap is for Noir KC, so the pick it saves is the one the fallback reads.
    expect(plan.unresolved[0].gaps[0]).toEqual(expect.objectContaining({ kind: 'ambiguous', location_id: 'loc-noir' }));

    const picked: RecipeRef = { ...recipe, ingredients: [recipe.ingredients[0], { ...recipe.ingredients[1], location_items: { 'loc-noir': 'kah-n3' } }] };
    plan = buildDeductionPlan([line('a', 'T-ESP', 'RooftopKC')], links, [picked], stock, LOCS, NO_ALLOWANCE);
    expect(plan.unresolved).toHaveLength(0);
    expect(Array.from(plan.totals.keys()).sort()).toEqual(['kah-n3', 'vod-r']);
  });

  it('respects not tracked at Noir KC when a bar falls back to it', () => {
    const recipe: RecipeRef = { ...ESPRESSO, ingredients: [ESPRESSO.ingredients[0], { ...ESPRESSO.ingredients[1], location_items: { 'loc-noir': null } }] };
    const plan = buildDeductionPlan([line('a', 'T-ESP', 'RooftopKC')], links, [recipe], ITEMS, LOCS, NO_ALLOWANCE);
    expect(plan.unresolved).toHaveLength(0);
    expect(Array.from(plan.totals.keys())).toEqual(['vod-r']);
  });

  it('does not fall back when there is no Noir KC location', () => {
    const plan = buildDeductionPlan([line('a', 'T-ESP', 'RooftopKC')], links, [ESPRESSO], ITEMS, [LOCS[1]], NO_ALLOWANCE);
    expect(plan.unresolved[0].reasons).toEqual(["Kahlua Coffee Liqueur isn't stocked at RooftopKC"]);
  });

  it('pours a bottle-linked item from Noir KC when the bar does not stock it', () => {
    const pour: ToastLink = { toast_item_id: 'T-POUR', link_type: 'item', recipe_id: null, inventory_item_id: 'kah-n', amount: 1, amount_unit: 'oz' };
    const plan = buildDeductionPlan([line('a', 'T-POUR', 'RooftopKC')], [pour], [], ITEMS, LOCS, NO_ALLOWANCE);
    expect(plan.unresolved).toHaveLength(0);
    expect(Array.from(plan.totals.keys())).toEqual(['kah-n']);
  });

  it('skips an ingredient marked not tracked at the bar, and deducts the rest', () => {
    const recipe: RecipeRef = {
      ...ESPRESSO,
      ingredients: [ESPRESSO.ingredients[0], { ...ESPRESSO.ingredients[1], location_items: { 'loc-roof': null } }],
    };
    const plan = buildDeductionPlan([line('a', 'T-ESP', 'RooftopKC')], links, [recipe], ITEMS, LOCS, NO_ALLOWANCE);
    expect(plan.unresolved).toHaveLength(0);
    expect(Array.from(plan.totals.keys())).toEqual(['vod-r']);
    // Still deducted where it is tracked.
    const noir = buildDeductionPlan([line('b', 'T-ESP', 'Cocktails')], links, [recipe], ITEMS, LOCS, NO_ALLOWANCE);
    expect(noir.totals.has('kah-n')).toBe(true);
  });

  it('uses the bottle picked for the bar over the automatic match', () => {
    const otherVodka = item({ id: 'abs-r', name: 'Vodka', brand: 'Absolut', location_id: 'loc-roof' });
    const kahluaRoof = item({ id: 'kah-r', name: 'Coffee Liqueur', brand: 'Kahlua', location_id: 'loc-roof' });
    const recipe: RecipeRef = {
      ...ESPRESSO,
      ingredients: [{ ...ESPRESSO.ingredients[0], location_items: { 'loc-roof': 'abs-r' } }, ESPRESSO.ingredients[1]],
    };
    const plan = buildDeductionPlan([line('a', 'T-ESP', 'RooftopKC')], links, [recipe], [...ITEMS, otherVodka, kahluaRoof], LOCS, NO_ALLOWANCE);
    expect(plan.unresolved).toHaveLength(0);
    expect(Array.from(plan.totals.keys()).sort()).toEqual(['abs-r', 'kah-r']);
  });

  it('reports a picked bottle that was deleted or belongs to another bar', () => {
    const recipe: RecipeRef = {
      ...ESPRESSO,
      ingredients: [{ ...ESPRESSO.ingredients[0], location_items: { 'loc-roof': 'vod-n' } }, { ...ESPRESSO.ingredients[1], location_items: { 'loc-roof': 'gone' } }],
    };
    const plan = buildDeductionPlan([line('a', 'T-ESP', 'RooftopKC')], links, [recipe], ITEMS, LOCS, NO_ALLOWANCE);
    expect(plan.unresolved[0].reasons).toEqual([
      'Recipe "Espresso Martini" — Vodka: the bottle picked for RooftopKC no longer exists',
      'Recipe "Espresso Martini" — Kahlua: the bottle picked for RooftopKC no longer exists',
    ]);
    // Each one gets a Fix button.
    expect(plan.unresolved[0].gaps.map(g => [g.ingredient_index, g.location_id, g.kind, g.stale_pick])).toEqual([
      [0, 'loc-roof', 'missing', true],
      [1, 'loc-roof', 'missing', true],
    ]);
  });

  it('finds the bottle at another bar when only one side has the brand filled in', () => {
    // The Trinidad Baddie case: Noir's Buffalo Trace has no brand, the roof's does.
    const btNoir = item({ id: 'bt-n', name: 'Buffalo Trace', brand: '', volume_ml: 1000 });
    const btRoof = item({ id: 'bt-r', name: 'Buffalo Trace', brand: 'Buffalo Trace', volume_ml: 750, location_id: 'loc-roof' });
    const recipe: RecipeRef = { id: 'r-of', name: 'Old Fashioned', ingredients: [{ inventory_item_id: 'bt-r', name: 'Buffalo Trace', quantity: 2, unit: 'oz' }] };
    const l: ToastLink = { toast_item_id: 'T-OF', link_type: 'recipe', recipe_id: 'r-of', inventory_item_id: null, amount: null, amount_unit: null };
    const plan = buildDeductionPlan([line('a', 'T-OF', 'Cocktails')], [l], [recipe], [btNoir, btRoof], LOCS, NO_ALLOWANCE);
    expect(plan.unresolved).toHaveLength(0);
    expect(plan.totals.get('bt-n')).toBeCloseTo((2 * 29.5735) / 1000, 6);
  });

  it('settles two matching bottles by size, and asks when that does not settle it', () => {
    const btNoir = item({ id: 'bt-n', name: 'Buffalo Trace', brand: '', volume_ml: 1000 });
    const roof1l = item({ id: 'bt-r1', name: 'Buffalo Trace', brand: '', volume_ml: 1000, location_id: 'loc-roof' });
    const roof750 = item({ id: 'bt-r7', name: 'Buffalo Trace', brand: 'Buffalo Trace', volume_ml: 750, location_id: 'loc-roof' });
    const recipe: RecipeRef = { id: 'r-of', name: 'Old Fashioned', ingredients: [{ inventory_item_id: 'bt-n', name: 'Buffalo Trace', quantity: 2, unit: 'oz' }] };
    const l: ToastLink = { toast_item_id: 'T-OF', link_type: 'recipe', recipe_id: 'r-of', inventory_item_id: null, amount: null, amount_unit: null };

    // bt-r1 is an exact name+brand match, so it wins outright.
    let plan = buildDeductionPlan([line('a', 'T-OF', 'RooftopKC')], [l], [recipe], [btNoir, roof1l, roof750], LOCS, NO_ALLOWANCE);
    expect(Array.from(plan.totals.keys())).toEqual(['bt-r1']);

    // No exact match, but two roof bottles carry the same label; size picks the 1L.
    const base = { ...btNoir, name: 'Buffalo Trace Bourbon', brand: '' };
    const roofA = { ...roof1l, name: 'Bourbon', brand: 'Buffalo Trace' };
    const roofB = { ...roof750, name: 'Buffalo Trace Bourbon', brand: 'Buffalo Trace' };
    const r2: RecipeRef = { ...recipe, ingredients: [{ ...recipe.ingredients[0], inventory_item_id: 'bt-n' }] };
    plan = buildDeductionPlan([line('a', 'T-OF', 'RooftopKC')], [l], [r2], [base, roofB, roofA], LOCS, NO_ALLOWANCE);
    expect(Array.from(plan.totals.keys())).toEqual(['bt-r1']);

    // Two of the same size: never guess.
    const twin = { ...roofA, id: 'bt-r1b', name: 'Buffalo Trace Bourbon' };
    plan = buildDeductionPlan([line('a', 'T-OF', 'RooftopKC')], [l], [r2], [base, roofA, twin], LOCS, NO_ALLOWANCE);
    expect(plan.unresolved[0].reasons).toEqual(['Buffalo Trace Bourbon matches more than one bottle at RooftopKC — pick one']);
    expect(plan.unresolved[0].gaps[0]).toEqual(expect.objectContaining({ kind: 'ambiguous', candidate_ids: ['bt-r1', 'bt-r1b'] }));
  });

  it('skips voids, applies ignored items with no deduction, and reports unlinked items', () => {
    const plan = buildDeductionPlan(
      [line('v', 'T-ESP', 'Cocktails', 1, true), line('t', 'T-TEST', 'No Menu'), line('u', 'T-NEW', 'Liquor', 3), line('u2', 'T-NEW', 'Liquor', 2)],
      links, [ESPRESSO], ITEMS, LOCS, NO_ALLOWANCE
    );
    expect(plan.resolved).toEqual([{ item_selection_id: 't', deductions: [] }]);
    expect(plan.unresolved).toEqual([
      expect.objectContaining({ toast_item_id: 'T-NEW', qty: 5, reasons: ['Not linked to a recipe or bottle yet'] }),
    ]);
  });

  it('flags broken recipes', () => {
    const broken: RecipeRef = { id: 'r-b', name: 'Bad', ingredients: [{ inventory_item_id: 'gone', name: 'Gin', quantity: 2, unit: 'oz' }] };
    const empty: RecipeRef = { id: 'r-e', name: 'Empty', ingredients: [] };
    const plan = buildDeductionPlan(
      [line('a', 'T-B', 'Cocktails'), line('b', 'T-E', 'Cocktails')],
      [
        { toast_item_id: 'T-B', link_type: 'recipe', recipe_id: 'r-b', inventory_item_id: null, amount: null, amount_unit: null },
        { toast_item_id: 'T-E', link_type: 'recipe', recipe_id: 'r-e', inventory_item_id: null, amount: null, amount_unit: null },
      ],
      [broken, empty], ITEMS, LOCS, NO_ALLOWANCE
    );
    expect(plan.unresolved.map(u => u.reasons[0])).toEqual([
      'Recipe "Bad" — Gin: the linked bottle no longer exists',
      'Recipe "Empty" has no ingredients',
    ]);
  });
});

describe('cocktails must name their spirit', () => {
  const lemon = item({ id: 'lem-n', name: 'Lemon Juice', category: 'mixers' });
  const sour: RecipeRef = {
    id: 'r-sour',
    name: 'Whiskey Sour',
    category: 'Classic Cocktails',
    ingredients: [{ inventory_item_id: 'lem-n', name: 'Lemon', quantity: 1, unit: 'oz' }],
  };
  const link: ToastLink = { toast_item_id: 'T-S', link_type: 'recipe', recipe_id: 'r-sour', inventory_item_id: null, amount: null, amount_unit: null };

  it('holds back a cocktail whose recipe has no spirit', () => {
    const plan = buildDeductionPlan([line('a', 'T-S', 'Cocktails')], [link], [sour], [...ITEMS, lemon], LOCS, NO_ALLOWANCE);
    expect(plan.resolved).toHaveLength(0);
    expect(plan.unresolved[0].reasons).toEqual(['Recipe "Whiskey Sour" lists no spirit']);
  });

  it('applies it once the spirit is in the recipe', () => {
    const fixed = { ...sour, ingredients: [...sour.ingredients, { inventory_item_id: 'vod-n', name: 'Vodka', quantity: 2, unit: 'oz' }] };
    const plan = buildDeductionPlan([line('a', 'T-S', 'Cocktails')], [link], [fixed], [...ITEMS, lemon], LOCS, NO_ALLOWANCE);
    expect(plan.unresolved).toHaveLength(0);
  });

  it('exempts mocktails and decides by recipe category, then Toast group', () => {
    expect(needsSpirit('Mocktails', 'Specialty Mocktails')).toBe(false);
    expect(needsSpirit('cocktail', 'x')).toBe(true);
    expect(needsSpirit('Shots', 'x')).toBe(true);
    expect(needsSpirit('Wine', 'Classic Cocktails')).toBe(false);
    expect(needsSpirit('', 'Noir Signatures')).toBe(true);
    expect(needsSpirit('other', 'Seasonal Cocktails')).toBe(true);
    expect(needsSpirit(null, 'Mocktails')).toBe(false);
  });
});

describe('suggestLink / defaultServing', () => {
  it('matches recipes loosely (& vs and, punctuation)', () => {
    const r: RecipeRef = { id: 'r1', name: 'Cask and Blossom', ingredients: [] };
    expect(suggestLink({ menu_item: 'Cask & Blossom', menu_group: 'x', menu: 'Cocktails' }, [r], [], null)).toEqual({ link_type: 'recipe', recipe_id: 'r1' });
  });
  it('suggests ignoring open/test items', () => {
    expect(suggestLink({ menu_item: 'Test', menu_group: 'Open Drink', menu: 'No Menu' }, [], [], null)).toEqual({ link_type: 'ignore' });
  });
  it('prefers the bottle at the sale location and a double pour for DBL items', () => {
    const s = suggestLink({ menu_item: "DBL Tito's", menu_group: 'Vodka DBL', menu: 'Liquor' }, [],
      [item({ id: 'a', name: "Tito's", location_id: 'loc-roof' }), item({ id: 'b', name: "Tito's", location_id: 'loc-noir' })], 'loc-noir');
    expect(s).toEqual({ link_type: 'item', inventory_item_id: 'b', amount: 3, amount_unit: 'oz' });
  });
  it('defaults pours by kind', () => {
    expect(defaultServing('Bourbon', 'Blantons', { category: 'spirits', unit: 'bottle' })).toEqual({ amount: 1.5, amount_unit: 'oz' });
    expect(defaultServing('Red Wine', 'Pinot', { category: 'wine', unit: 'bottle' })).toEqual({ amount: 5, amount_unit: 'oz' });
    expect(defaultServing('Can Beer', 'Stella', { category: 'beer', unit: 'can' })).toEqual({ amount: 1, amount_unit: 'unit' });
    expect(defaultServing('THC', 'Juicy Grapefruit', { category: 'other', unit: 'can' })).toEqual({ amount: 0.5, amount_unit: 'unit' });
  });
});

describe('business dates for count windows', () => {
  it('treats the hours before the 4am closeout as the previous business day', () => {
    expect(businessDateOf('2026-10-10T06:30:00Z')).toBe('2026-10-09'); // 1:30am CDT Sat → Friday's business day
    expect(businessDateOf('2026-10-10T10:00:00Z')).toBe('2026-10-10'); // 5am CDT Sat
    expect(businessDateOf('2026-12-12T09:30:00Z')).toBe('2026-12-11'); // 3:30am CST
  });
  it('reads the business date back out of a sales transaction note', () => {
    expect(saleDateFromNote('Toast sales 2026-10-08')).toBe('2026-10-08');
    expect(saleDateFromNote('Inventory count')).toBeNull();
    expect(saleDateFromNote(null)).toBeNull();
  });
});

describe('summarizeCount / measuredLossPct', () => {
  it('values the variance at cost and splits out poured stock', () => {
    const s = summarizeCount([
      { item_id: 'a', category: 'spirits', cost_per_unit: 20, system_qty: 5, counted_qty: 4.5 },
      { item_id: 'b', category: 'beer', cost_per_unit: 1, system_qty: 24, counted_qty: 26 },
      { item_id: 'c', category: 'wine', cost_per_unit: 10, system_qty: 3, counted_qty: null },
    ]);
    expect(s).toEqual({ counted_lines: 2, uncounted_lines: 1, variance_value: -8, poured_variance_value: -10 });
  });

  it('measures the real loss rate behind the allowance', () => {
    // $1,050 of poured stock deducted at +5% = $1,000 theoretical; $100 more is missing from the shelf.
    expect(measuredLossPct(1050, 100, 5)).toBe(15);
    // Shelf matches the app exactly → real loss equals the allowance.
    expect(measuredLossPct(1050, 0, 5)).toBe(5);
    expect(measuredLossPct(0, 10, 5)).toBeNull();
  });
});
