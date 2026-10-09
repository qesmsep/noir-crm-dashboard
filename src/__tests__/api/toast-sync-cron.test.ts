/**
 * @jest-environment node
 */
/**
 * The Toast sync cron is reachable from the internet; only Vercel Cron (which
 * sends the CRON_SECRET bearer token) may run it.
 */
const mockRun = jest.fn();

jest.mock('../../lib/toast/sync', () => {
  class ToastSyncBusyError extends Error {}
  return { runToastSync: (...args: unknown[]) => mockRun(...args), ToastSyncBusyError };
});

import handler from '../../pages/api/cron/toast-sync';
import { ToastSyncBusyError } from '../../lib/toast/sync';

function call(authorization?: string) {
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
  return Promise.resolve(handler({ headers: authorization ? { authorization } : {} } as never, res as never)).then(() => res);
}

describe('/api/cron/toast-sync auth', () => {
  const saved = process.env.CRON_SECRET;
  beforeEach(() => {
    mockRun.mockReset().mockResolvedValue({ days_imported: 1 });
    process.env.CRON_SECRET = 'right-secret';
  });
  afterAll(() => {
    process.env.CRON_SECRET = saved;
  });

  it('rejects a request with no token', async () => {
    expect((await call()).statusCode).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('rejects a wrong token', async () => {
    expect((await call('Bearer wrong')).statusCode).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('fails closed when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;
    expect((await call('Bearer undefined')).statusCode).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('runs the sync with the right token', async () => {
    const res = await call('Bearer right-secret');
    expect(res.statusCode).toBe(200);
    expect(mockRun).toHaveBeenCalledWith('cron');
  });

  it('skips quietly when a sync is already running', async () => {
    mockRun.mockRejectedValue(new ToastSyncBusyError());
    const res = await call('Bearer right-secret');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('skipped');
  });
});
