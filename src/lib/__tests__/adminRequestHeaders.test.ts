const mockGetSession = jest.fn();

jest.mock('../supabase', () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}));

import { adminRequestHeaders } from '../adminRequestHeaders';

describe('adminRequestHeaders', () => {
  it('attaches the admin session so the server can tell staff from a guest', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok_123' } } });

    await expect(adminRequestHeaders()).resolves.toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok_123',
    });
  });

  it('still returns usable headers when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(adminRequestHeaders()).resolves.toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('does not let a session lookup failure block the request', async () => {
    mockGetSession.mockRejectedValue(new Error('network down'));

    await expect(adminRequestHeaders()).resolves.toEqual({
      'Content-Type': 'application/json',
    });
  });
});
