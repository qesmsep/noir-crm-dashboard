/**
 * @jest-environment node
 */
const mockGetSession = jest.fn();

jest.mock('../supabase', () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}));

import { installAdminFetchAuth } from '../admin-fetch-auth';

describe('installAdminFetchAuth', () => {
  const underlying = jest.fn(async () => new Response('{}'));

  beforeAll(() => {
    (globalThis as any).window = { location: { origin: 'https://app.test' }, fetch: underlying };
    installAdminFetchAuth();
  });

  afterAll(() => {
    delete (globalThis as any).window;
  });

  beforeEach(() => {
    underlying.mockClear();
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok_admin' } } });
  });

  const sentHeaders = () => new Headers((underlying.mock.calls[0] as any[])[1]?.headers);

  it('adds the admin token to same-origin /api calls', async () => {
    await window.fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(sentHeaders().get('Authorization')).toBe('Bearer tok_admin');
    expect(sentHeaders().get('Content-Type')).toBe('application/json');
  });

  it('leaves an explicit Authorization header alone', async () => {
    await window.fetch('/api/admins', { headers: { Authorization: 'Bearer mine' } });
    expect(sentHeaders().get('Authorization')).toBe('Bearer mine');
  });

  it('never sends the token to another origin', async () => {
    await window.fetch('https://example.com/api/members');
    expect((underlying.mock.calls[0] as any[])[1]).toBeUndefined();
  });

  it('sends the request unchanged when nobody is signed in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await window.fetch('/api/locations');
    expect((underlying.mock.calls[0] as any[])[1]).toBeUndefined();
  });
});
