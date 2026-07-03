/**
 * @jest-environment node
 *
 * Route-level tests for the tables API. These focus on the validation,
 * authorization, and error-code branches added over this feature's review
 * rounds (integer guards, status enum, seats message, duplicate/FK 409s).
 */
import { NextResponse } from 'next/server';

// --- Mocks -----------------------------------------------------------------

// Control admin auth per test.
jest.mock('@/lib/admin-middleware', () => ({
  verifyAdminAccess: jest.fn(),
}));

// Supabase admin client: delegate to a per-test `mockFrom`.
let mockFrom: (table: string) => any;
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (table: string) => mockFrom(table) },
}));

import { verifyAdminAccess } from '@/lib/admin-middleware';
import { GET, POST } from '../route';
import { PUT, DELETE } from '../[id]/route';

const mockedVerify = verifyAdminAccess as jest.MockedFunction<typeof verifyAdminAccess>;

// A chainable query-builder stub that resolves (via await or .single/.maybeSingle)
// to the provided `{ data, error }`.
function chain(result: { data: any; error: any }) {
  const obj: any = {
    select: () => obj,
    insert: () => obj,
    update: () => obj,
    delete: () => obj,
    eq: () => obj,
    neq: () => obj,
    gt: () => obj,
    gte: () => obj,
    order: () => obj,
    limit: () => obj,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (onF: any, onR: any) => Promise.resolve(result).then(onF, onR),
  };
  return obj;
}

// Build a `from(table)` that shifts the next configured result per table.
function makeFrom(config: Record<string, Array<{ data: any; error: any }>>) {
  const queues: Record<string, Array<{ data: any; error: any }>> = { ...config };
  return (table: string) => {
    const q = queues[table] || [];
    const result = q.shift() ?? { data: null, error: null };
    return chain(result);
  };
}

function authOk() {
  mockedVerify.mockResolvedValue({ authorized: true } as any);
}
function authFail() {
  mockedVerify.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
  } as any);
}

function postReq(body: any) {
  return { json: async () => body, headers: { get: () => 'Bearer x' } } as any;
}
function getReq(url: string) {
  return { url, headers: { get: () => null } } as any;
}

beforeEach(() => {
  mockFrom = makeFrom({});
});

// --- POST ------------------------------------------------------------------

describe('POST /api/tables', () => {
  it('rejects a non-admin with 403', async () => {
    authFail();
    const res = await POST(postReq({ table_number: 1, seats: 2, location_slug: 'noirkc' }));
    expect(res.status).toBe(403);
  });

  it('rejects a non-integer table_number with 400', async () => {
    authOk();
    const res = await POST(postReq({ table_number: 1.5, seats: 2, location_slug: 'noirkc' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/table number/i);
  });

  it('rejects seats = 0 with the specific seats message (not "missing fields")', async () => {
    authOk();
    const res = await POST(postReq({ table_number: 1, seats: 0, location_slug: 'noirkc' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/seats must be an integer/i);
  });

  it('rejects seats out of range with 400', async () => {
    authOk();
    const res = await POST(postReq({ table_number: 1, seats: 25, location_slug: 'noirkc' }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid status with 400', async () => {
    authOk();
    const res = await POST(postReq({ table_number: 1, seats: 2, status: 'bogus', location_slug: 'noirkc' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/active or inactive/i);
  });

  it('returns 409 when the table number already exists at the location', async () => {
    authOk();
    mockFrom = makeFrom({
      locations: [{ data: { id: 'loc1' }, error: null }],
      tables: [{ data: { id: 'existing' }, error: null }], // existence check finds a row
    });
    const res = await POST(postReq({ table_number: 5, seats: 4, location_slug: 'noirkc' }));
    expect(res.status).toBe(409);
  });

  it('creates a table (201) when input is valid and unique', async () => {
    authOk();
    mockFrom = makeFrom({
      locations: [{ data: { id: 'loc1' }, error: null }],
      tables: [
        { data: null, error: null }, // existence check: none
        { data: { id: 't1', table_number: 5, seats: 4, status: 'active', location_id: 'loc1' }, error: null }, // insert
      ],
    });
    const res = await POST(postReq({ table_number: 5, seats: 4, location_slug: 'noirkc' }));
    expect(res.status).toBe(201);
  });
});

// --- PUT -------------------------------------------------------------------

describe('PUT /api/tables/[id]', () => {
  const params = { params: Promise.resolve({ id: 'abc' }) };

  it('rejects a non-admin with 403', async () => {
    authFail();
    const res = await PUT(postReq({ table_number: 1, seats: 2, status: 'active' }), params);
    expect(res.status).toBe(403);
  });

  it('rejects a non-integer table_number with 400', async () => {
    authOk();
    const res = await PUT(postReq({ table_number: 0, seats: 2, status: 'active' }), params);
    expect(res.status).toBe(400);
  });

  it('rejects an invalid status with 400', async () => {
    authOk();
    const res = await PUT(postReq({ table_number: 1, seats: 2, status: 'bogus' }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/active or inactive/i);
  });
});

// --- DELETE ----------------------------------------------------------------

describe('DELETE /api/tables/[id]', () => {
  const params = { params: Promise.resolve({ id: 'abc' }) };

  it('rejects a non-admin with 403', async () => {
    authFail();
    const res = await DELETE(postReq({}), params);
    expect(res.status).toBe(403);
  });

  it('returns 409 when the table has an active/future reservation', async () => {
    authOk();
    mockFrom = makeFrom({
      reservations: [{ data: [{ id: 'r1' }], error: null }], // a non-cancelled, not-yet-ended reservation
    });
    const res = await DELETE(postReq({}), params);
    expect(res.status).toBe(409);
  });
});

// --- GET (public) ----------------------------------------------------------

describe('GET /api/tables', () => {
  it('is public and returns mapped tables', async () => {
    mockFrom = makeFrom({
      tables: [
        {
          data: [
            { id: 't1', table_number: 5, seats: 4, status: 'active', location_id: 'loc1', locations: { slug: 'noirkc' } },
          ],
          error: null,
        },
      ],
    });
    const res = await GET(getReq('http://localhost/api/tables'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0]).toMatchObject({ id: 't1', table_number: 5, location_slug: 'noirkc' });
    expect(mockedVerify).not.toHaveBeenCalled(); // GET must not require admin auth
  });

  it('rejects an invalid status filter with 400', async () => {
    const res = await GET(getReq('http://localhost/api/tables?status=bogus'));
    expect(res.status).toBe(400);
  });
});
