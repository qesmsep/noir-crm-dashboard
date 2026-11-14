/**
 * @jest-environment node
 */
/**
 * The guest-message cron is reachable from the internet; only the CRON_SECRET
 * bearer (Vercel Cron) or the internal secret header may run it. Vercel-looking
 * user agents and deployment headers are not trusted.
 */
const mockProcess = jest.fn();
jest.mock('../../lib/reservationGuests', () => ({
  processDueGuestMessages: (...a: unknown[]) => mockProcess(...a),
}));

import handler from '../../pages/api/cron/process-guest-messages';

function call(headers: Record<string, string>) {
  const res: { statusCode?: number; body?: unknown; status: (c: number) => typeof res; json: (b: unknown) => typeof res } = {
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return Promise.resolve(handler({ headers } as never, res as never)).then(() => res);
}

describe('/api/cron/process-guest-messages auth', () => {
  const saved = process.env.CRON_SECRET;
  beforeEach(() => {
    mockProcess.mockReset().mockResolvedValue({ claimed: 0, sent: 0, skipped: 0, failed: 0 });
    process.env.CRON_SECRET = 'right';
  });
  afterAll(() => {
    process.env.CRON_SECRET = saved;
  });

  it('rejects no token', async () => {
    expect((await call({})).statusCode).toBe(401);
  });
  it('rejects Vercel-looking headers without the secret', async () => {
    expect((await call({ 'user-agent': 'vercel-cron/1.0', 'x-vercel-deployment-url': 'x.vercel.app', 'x-vercel-cron': '1' })).statusCode).toBe(401);
    expect(mockProcess).not.toHaveBeenCalled();
  });
  it('rejects a wrong token', async () => {
    expect((await call({ authorization: 'Bearer wrong' })).statusCode).toBe(401);
  });
  it('fails closed without CRON_SECRET', async () => {
    delete process.env.CRON_SECRET;
    expect((await call({ authorization: 'Bearer undefined' })).statusCode).toBe(401);
  });
  it('runs with the bearer secret, batch-limited', async () => {
    const res = await call({ authorization: 'Bearer right' });
    expect(res.statusCode).toBe(200);
    expect(mockProcess).toHaveBeenCalledWith({ limit: 50 });
  });
  it('runs with the internal secret header', async () => {
    expect((await call({ 'x-internal-secret': 'right' })).statusCode).toBe(200);
  });
});
