/**
 * @jest-environment node
 */
/**
 * Creating an item refuses a second row for the same product at one bar and,
 * unless confirm_new is sent, a likely look-alike. A bottle pick on a recipe
 * only writes over the version it read, and only a bottle stocked at that bar.
 */
type Op = { table: string; calls: Array<[string, unknown[]]> };
const mockOps: Op[] = [];
let mockRespond: (op: Op) => { data: unknown; error: unknown } = () => ({ data: null, error: null });

function mockBuilder(table: string) {
  const op: Op = { table, calls: [] };
  mockOps.push(op);
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'eq', 'is', 'in', 'order', 'range', 'single', 'maybeSingle']) {
    b[m] = (...args: unknown[]) => {
      op.calls.push([m, args]);
      return b;
    };
  }
  b.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(mockRespond(op)).then(ok, bad);
  return b;
}

jest.mock('../../lib/api-auth', () => ({ withRateLimitAndAuth: (h: unknown) => h }));
jest.mock('../../lib/supabase', () => ({ supabaseAdmin: { from: (t: string) => mockBuilder(t) }, supabase: null }));
jest.mock('../../lib/monitoring', () => ({ monitoring: { trackError: () => undefined, trackEvent: () => undefined } }));
const mockSettle = jest.fn();
jest.mock('../../lib/toast/settle', () => ({ settleDaysWithNothingToApprove: () => mockSettle() }));

import inventoryHandler from '../../pages/api/inventory/index';
import pickHandler from '../../pages/api/inventory/recipe-location-pick';
import recipesHandler from '../../pages/api/inventory/recipes';

function call(handler: unknown, method: string, body: unknown) {
  const res: { statusCode?: number; body?: any; status: (c: number) => typeof res; json: (b: unknown) => typeof res } = {
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return Promise.resolve((handler as (req: never, res: never) => unknown)({ method, body, query: {}, user: { email: 'a@b.c' } } as never, res as never)).then(() => res);
}

const has = (op: Op, m: string) => op.calls.some(([name]) => name === m);
const BAR1 = '11111111-1111-4111-8111-111111111111';
const BAR2 = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const RECIPE = '55555555-5555-4555-8555-555555555555';

beforeEach(() => {
  mockOps.length = 0;
  mockSettle.mockReset();
});

describe('POST /api/inventory duplicate check', () => {
  const stock = [
    { id: ITEM, name: 'Kahlua Coffee Liqueur', brand: 'Kahlua', location_id: BAR1 },
    { id: OTHER, name: 'Buffalo Trace', brand: 'Buffalo Trace', location_id: BAR2 },
  ];
  const item = (name: string, brand: string, location_id: string, extra = {}) => ({
    name, brand, location_id, category: 'spirits', unit: 'bottle', quantity: 1, ...extra,
  });
  beforeEach(() => {
    mockRespond = op => (has(op, 'insert') ? { data: { id: 'new' }, error: null } : { data: stock, error: null });
  });
  const inserted = () => mockOps.some(o => has(o, 'insert'));

  it('refuses the same product twice at one bar, even with confirm_new', async () => {
    const res = await call(inventoryHandler, 'POST', item('Kahlua Coffee Liqueur', 'Kahlua', BAR1, { confirm_new: true }));
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('ALREADY_EXISTS');
    expect(inserted()).toBe(false);
  });

  it('adds the same product at another bar', async () => {
    const res = await call(inventoryHandler, 'POST', item('Kahlua Coffee Liqueur', 'Kahlua', BAR2));
    expect(res.statusCode).toBe(201);
    expect(inserted()).toBe(true);
  });

  it('holds a likely look-alike without confirm_new', async () => {
    const res = await call(inventoryHandler, 'POST', item('Bufalo Trace', 'Bufalo Trace', BAR1));
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('SIMILAR_ITEMS');
    expect(res.body.similar.map((s: { id: string }) => s.id)).toEqual([OTHER]);
    expect(inserted()).toBe(false);
  });

  it('adds a look-alike with confirm_new', async () => {
    const res = await call(inventoryHandler, 'POST', item('Bufalo Trace', 'Bufalo Trace', BAR1, { confirm_new: true }));
    expect(res.statusCode).toBe(201);
    expect(inserted()).toBe(true);
  });
});

describe('POST /api/inventory past the row cap', () => {
  it('pages through every row, so a duplicate on row 1001 is still caught', async () => {
    const filler = Array.from({ length: 1000 }, (_, i) => ({ id: `f${i}`, name: `Filler ${i}`, brand: 'X', location_id: BAR2 }));
    mockRespond = op => {
      if (has(op, 'insert')) return { data: { id: 'new' }, error: null };
      const range = op.calls.find(([m]) => m === 'range');
      const from = range ? (range[1][0] as number) : 0;
      return { data: from === 0 ? filler : [{ id: ITEM, name: 'Kahlua Coffee Liqueur', brand: 'Kahlua', location_id: BAR1 }], error: null };
    };
    const res = await call(inventoryHandler, 'POST', {
      name: 'Kahlua Coffee Liqueur', brand: 'Kahlua', location_id: BAR1, category: 'spirits', unit: 'bottle', quantity: 1,
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('ALREADY_EXISTS');
  });
});

describe('PUT /api/inventory rename check', () => {
  const rows = [
    { id: ITEM, name: 'Buffalo Trace', brand: 'Buffalo Trace', location_id: BAR1 },
    { id: OTHER, name: 'Bourbon', brand: 'Old Forester', location_id: BAR1 },
  ];
  beforeEach(() => {
    mockRespond = op => {
      if (has(op, 'update')) return { data: { id: OTHER }, error: null };
      if (has(op, 'maybeSingle')) return { data: rows[1], error: null };
      return { data: rows, error: null };
    };
  });
  const updated = () => mockOps.some(o => has(o, 'update'));

  it('refuses a rename onto an item already at that bar', async () => {
    const res = await call(inventoryHandler, 'PUT', { id: OTHER, name: 'Buffalo Trace', brand: 'Buffalo Trace' });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('ALREADY_EXISTS');
    expect(updated()).toBe(false);
  });

  it('saves a rename that clashes with nothing, and edits that keep the name', async () => {
    expect((await call(inventoryHandler, 'PUT', { id: OTHER, name: 'Old Forester 86', brand: 'Old Forester' })).statusCode).toBe(200);
    expect((await call(inventoryHandler, 'PUT', { id: OTHER, name: 'Bourbon', brand: 'Old Forester', quantity: 3 })).statusCode).toBe(200);
  });
});

describe('PUT /api/inventory/recipe-location-pick', () => {
  const STAMP = '2026-10-14T16:00:00.000000+00:00';
  const recipe = {
    id: RECIPE,
    name: 'Espresso Martini',
    updated_at: STAMP,
    ingredients: JSON.stringify([{ inventory_item_id: ITEM, name: 'Kahlua', quantity: 1, unit: 'oz' }]),
  };
  let saveRows: unknown[];
  beforeEach(() => {
    saveRows = [{ id: RECIPE }];
    mockRespond = op => {
      if (op.table === 'inventory_recipes') return has(op, 'update') ? { data: saveRows, error: null } : { data: recipe, error: null };
      if (op.table === 'locations') return { data: { id: BAR2 }, error: null };
      if (op.table === 'inventory_items') return { data: { id: OTHER, location_id: BAR2 }, error: null };
      return { data: null, error: null };
    };
  });
  const body = (pick: unknown, extra = {}) => ({
    recipe_id: RECIPE, ingredient_index: 0, inventory_item_id: ITEM, location_id: BAR2, pick, ...extra,
  });
  const update = () => mockOps.find(o => o.table === 'inventory_recipes' && has(o, 'update'));

  it('saves a bottle stocked at that bar, only over the version it read', async () => {
    const res = await call(pickHandler, 'PUT', body(OTHER));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.location_items).toEqual({ [BAR2]: OTHER });
    expect(update()!.calls).toContainEqual(['eq', ['updated_at', STAMP]]);
  });

  it('saves not tracked here, and auto clears the pick', async () => {
    expect((await call(pickHandler, 'PUT', body(null))).body.data.location_items).toEqual({ [BAR2]: null });
    expect((await call(pickHandler, 'PUT', body('auto'))).body.data.location_items).toEqual({});
  });

  it('refuses a bottle from another bar', async () => {
    const res = await call(pickHandler, 'PUT', body(OTHER, { location_id: BAR1 }));
    expect(res.statusCode).toBe(400);
    expect(update()).toBeUndefined();
  });

  it('409s when the ingredient list changed since it was loaded', async () => {
    const res = await call(pickHandler, 'PUT', body(null, { inventory_item_id: OTHER }));
    expect(res.statusCode).toBe(409);
    expect(update()).toBeUndefined();
  });

  it('409s when the recipe was saved in between', async () => {
    saveRows = [];
    const res = await call(pickHandler, 'PUT', body(null));
    expect(res.statusCode).toBe(409);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it('still reports a saved pick when settling days fails', async () => {
    mockSettle.mockRejectedValue(new Error('boom'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await call(pickHandler, 'PUT', body(null));
    spy.mockRestore();
    expect(res.statusCode).toBe(200);
  });
});

describe('PUT /api/inventory/recipes version check', () => {
  const STAMP = '2026-10-14T16:00:00.000000+00:00';
  let rows: unknown[];
  beforeEach(() => {
    rows = [{ id: RECIPE, name: 'Espresso Martini', ingredients: '[]', updated_at: STAMP }];
    mockRespond = op => (has(op, 'update') ? { data: rows, error: null } : { data: [], error: null });
  });
  const update = () => mockOps.find(o => o.table === 'inventory_recipes' && has(o, 'update'));

  it('saves only over the version the editor opened', async () => {
    const res = await call(recipesHandler, 'PUT', { id: RECIPE, name: 'Espresso Martini', expected_updated_at: STAMP });
    expect(res.statusCode).toBe(200);
    expect(update()!.calls).toContainEqual(['eq', ['updated_at', STAMP]]);
  });

  it('409s when the recipe changed since it was opened', async () => {
    rows = [];
    const res = await call(recipesHandler, 'PUT', { id: RECIPE, name: 'Espresso Martini', expected_updated_at: STAMP });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('STALE_RECIPE');
  });

  it('saves without a version check when none is sent (archive)', async () => {
    const res = await call(recipesHandler, 'PUT', { id: RECIPE, is_active: false });
    expect(res.statusCode).toBe(200);
    expect(update()!.calls.some(([m, a]) => m === 'eq' && (a as unknown[])[0] === 'updated_at')).toBe(false);
  });
});
