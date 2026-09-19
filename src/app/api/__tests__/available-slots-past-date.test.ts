/**
 * @jest-environment node
 */
/**
 * The second enforcement point for a day that has already passed at the
 * venue: the slots endpoint behind the public reservation form.
 */
import { DateTime } from 'luxon';

const mockFrom = jest.fn();

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
  supabaseAdmin: { from: (...args: any[]) => mockFrom(...args) },
}));

import { POST } from '../available-slots/route';

function locationsChain(timezone: string) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'loc-1', timezone },
          error: null,
        }),
      }),
    }),
  };
}

function request(body: Record<string, any>) {
  return { json: async () => body } as unknown as Request;
}

describe('POST /api/available-slots past-date gate', () => {
  beforeEach(() => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'locations') return locationsChain('America/Chicago');
      throw new Error(`Unexpected query on '${table}' — the past-date check should short-circuit first`);
    });
  });

  it('returns no slots for a day that has passed at the venue', async () => {
    const yesterday = DateTime.now().setZone('America/Chicago').minus({ days: 1 }).toFormat('yyyy-MM-dd');

    const response = await POST(request({ date: yesterday, party_size: 2, location: 'rooftopkc' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ slots: [] });
    // Nothing beyond the location lookup should have been queried
    expect(mockFrom).toHaveBeenCalledWith('locations');
    expect(mockFrom).not.toHaveBeenCalledWith('settings');
  });

  it('reads the venue day rather than the server day', async () => {
    // A server running in UTC is already on the next calendar day for part of
    // the evening in Chicago, which would wrongly reject the venue's today.
    mockFrom.mockImplementation((table: string) => {
      if (table === 'locations') return locationsChain('America/Chicago');
      throw new Error(`Reached '${table}' — the date was accepted`);
    });

    const todayAtVenue = DateTime.now().setZone('America/Chicago').toFormat('yyyy-MM-dd');

    // Accepted dates fall through to the settings query, which the mock throws
    // on — so the throw itself is the signal that the gate let the date pass.
    await expect(
      POST(request({ date: todayAtVenue, party_size: 2, location: 'rooftopkc' }))
    ).resolves.toBeDefined();
    expect(mockFrom).toHaveBeenCalledWith('settings');
  });
});
