/**
 * @jest-environment node
 */
/**
 * runToastSync's lock: a second sync while one is running is reported as
 * busy (the unique index on running rows rejects the insert) and never
 * touches the Toast server.
 */
const mockWithSftp = jest.fn();
const mockNotifyFailure = jest.fn();
let insertResult: { data: unknown; error: unknown };

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      // stale-run cleanup: update(...).eq(...).lt(...).select(...)
      update: () => ({ eq: () => ({ lt: () => ({ select: async () => ({ data: [], error: null }) }) }) }),
      insert: () => ({ select: () => ({ single: async () => insertResult }) }),
    }),
  },
}));
jest.mock('../lib/toast/sftp', () => ({
  withToastSftp: (...a: unknown[]) => mockWithSftp(...a),
  exportRoot: jest.fn(),
  listDayFolders: jest.fn(),
  readDayFile: jest.fn(),
}));
jest.mock('../lib/toast/notify', () => ({
  notifySyncFailure: (...a: unknown[]) => mockNotifyFailure(...a),
  notifyNewGaps: jest.fn(),
  clearSyncFailure: jest.fn(),
}));
jest.mock('../lib/toast/settle', () => ({ reopenIfPending: jest.fn(), settleDaysWithNothingToApprove: jest.fn() }));

import { runToastSync, ToastSyncBusyError } from '../lib/toast/sync';

describe('runToastSync lock', () => {
  beforeEach(() => {
    mockWithSftp.mockReset();
    mockNotifyFailure.mockReset();
  });

  it('reports busy when another sync holds the lock', async () => {
    insertResult = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "uniq_toast_sync_runs_one_running"' } };
    await expect(runToastSync('manual')).rejects.toBeInstanceOf(ToastSyncBusyError);
    expect(mockWithSftp).not.toHaveBeenCalled();
    expect(mockNotifyFailure).not.toHaveBeenCalled();
  });

  it('surfaces any other insert failure as an error', async () => {
    insertResult = { data: null, error: { code: '42P01', message: 'relation "toast_sync_runs" does not exist' } };
    await expect(runToastSync('cron')).rejects.toThrow('toast_sync_runs');
    expect(mockWithSftp).not.toHaveBeenCalled();
  });
});
