/**
 * The Add to Waitlist campaign action: approved applicants are handed to the
 * INVITATION campaign; everyone else goes back into the waitlist review queue.
 */
type Row = Record<string, any>;

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
  supabaseAdmin: { from: (...args: any[]) => mockFrom(...args) },
}));
jest.mock('../../lib/admin-auth', () => ({
  verifyAdmin: jest.fn(),
  isInternalCall: jest.fn(),
}));

import { enrollPhone } from '../../pages/api/membership/intake-enroll';

const WAITLIST = { id: 'c-wait', name: 'Waitlist', trigger_word: 'WAITLIST', status: 'active', actions: { add_to_waitlist: { enabled: true } }, non_member_response: null };
const INVITATION = { id: 'c-inv', name: 'Invitation', trigger_word: 'INVITATION', status: 'active', actions: {}, non_member_response: null };

interface World {
  campaigns: Row[];
  waitlist: Row | null; // latest entry for the phone
  member: Row | null;
  waitlistLookupError?: boolean;
  reopenMatches?: number; // rows the reopen update matches (default 1)
}

/** Records every write; returns canned reads per table. */
function setup(world: World) {
  const writes: { table: string; op: string; payload?: any; filters: any[] }[] = [];

  mockFrom.mockImplementation((table: string) => {
    const filters: any[] = [];
    let op = 'select';
    let payload: any;
    const chain: any = {};
    const record = () => writes.push({ table, op, payload, filters });

    const result = (single: boolean) => {
      if (op !== 'select') {
        record();
        if (table === 'sms_intake_enrollments') return { data: { id: `e-${filters.length}-${Math.random()}` }, error: null };
        if (table === 'waitlist' && op === 'insert') return { data: { id: 'w-new' }, error: null };
        if (table === 'waitlist' && op === 'update') return { data: Array(world.reopenMatches ?? 1).fill({ id: 'w' }), error: null };
        return { data: null, error: null };
      }
      if (table === 'sms_intake_campaigns') {
        const word = filters.find(f => f[0] === 'ilike')?.[2];
        const id = filters.find(f => f[0] === 'eq' && f[1] === 'id')?.[2];
        const hit = world.campaigns.find(c => (word && c.trigger_word.toLowerCase() === word.toLowerCase() && c.status === 'active') || (id && c.id === id));
        return { data: hit || null, error: null };
      }
      if (table === 'waitlist') {
        return world.waitlistLookupError ? { data: null, error: { message: 'boom' } } : { data: world.waitlist, error: null };
      }
      if (table === 'members') return { data: world.member, error: null };
      if (table === 'sms_intake_campaign_messages') return { data: [], error: null };
      return { data: single ? null : [], error: null };
    };

    for (const m of ['eq', 'neq', 'in', 'ilike', 'order', 'limit']) {
      chain[m] = jest.fn((...args: any[]) => { filters.push([m, ...args]); return chain; });
    }
    chain.select = jest.fn(() => chain);
    chain.insert = jest.fn((p: any) => { op = 'insert'; payload = p; return chain; });
    chain.update = jest.fn((p: any) => { op = 'update'; payload = p; return chain; });
    chain.single = jest.fn(async () => result(true));
    chain.maybeSingle = jest.fn(async () => result(true));
    chain.then = (resolve: any, reject: any) => Promise.resolve(result(false)).then(resolve, reject);
    return chain;
  });

  return writes;
}

const enrollmentsFor = (writes: any[]) =>
  writes.filter(w => w.table === 'sms_intake_enrollments' && w.op === 'insert').map(w => w.payload.campaign_id);

describe('Add to Waitlist action', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('hands an approved applicant to INVITATION and leaves their entry approved', async () => {
    const writes = setup({ campaigns: [WAITLIST, INVITATION], waitlist: { id: 'w1', status: 'approved' }, member: null });
    const result = await enrollPhone({ trigger_word: 'WAITLIST', phone: '8165550100', source: 'trigger' });

    expect(result.body.redirected_to).toBe('INVITATION');
    expect(enrollmentsFor(writes)).toEqual(['c-inv']);
    expect(writes.some(w => w.table === 'waitlist' && w.op === 'update')).toBe(false);
  });

  it('sends nothing and does not reopen an approved entry when INVITATION is not active', async () => {
    const writes = setup({ campaigns: [WAITLIST], waitlist: { id: 'w1', status: 'approved' }, member: null });
    const result = await enrollPhone({ trigger_word: 'WAITLIST', phone: '8165550100', source: 'trigger' });

    expect(result.status).toBe(200);
    expect(result.body.redirected_to).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it('reopens a non-approved entry for review, guarded against approved', async () => {
    const writes = setup({ campaigns: [WAITLIST, INVITATION], waitlist: { id: 'w2', status: 'waitlisted' }, member: null });
    await enrollPhone({ trigger_word: 'WAITLIST', phone: '8165550100', source: 'trigger' });

    const update = writes.find(w => w.table === 'waitlist' && w.op === 'update');
    expect(update?.payload.status).toBe('review');
    expect(update?.filters).toEqual(expect.arrayContaining([['eq', 'id', 'w2'], ['neq', 'status', 'approved']]));
    expect(enrollmentsFor(writes)).toEqual(['c-wait']);
  });

  it('creates a review entry with member details when there is none', async () => {
    const writes = setup({
      campaigns: [WAITLIST],
      waitlist: null,
      member: { member_id: 'm1', account_id: 'a1', first_name: 'Ada', last_name: 'Lee', email: 'ada@example.com', phone: '+18165550100' },
    });
    await enrollPhone({ trigger_word: 'WAITLIST', phone: '8165550100', source: 'trigger' });

    const insert = writes.find(w => w.table === 'waitlist' && w.op === 'insert');
    expect(insert?.payload).toMatchObject({ phone: '+18165550100', first_name: 'Ada', status: 'review' });
  });

  it('skips Add to Waitlist when Create Onboarding Link is also on', async () => {
    const both = { ...WAITLIST, actions: { add_to_waitlist: { enabled: true }, create_onboarding_link: { enabled: true } } };
    const writes = setup({ campaigns: [both], waitlist: null, member: null });
    await enrollPhone({ trigger_word: 'WAITLIST', phone: '8165550100', source: 'trigger' });

    expect(console.warn).toHaveBeenCalled();
    expect(writes.some(w => w.table === 'waitlist' && w.payload?.status === 'review')).toBe(false);
  });

  it('does not loop when INVITATION itself has Add to Waitlist on', async () => {
    const selfInv = { ...INVITATION, actions: { add_to_waitlist: { enabled: true } } };
    const writes = setup({ campaigns: [selfInv], waitlist: { id: 'w1', status: 'approved' }, member: null });
    await enrollPhone({ trigger_word: 'INVITATION', phone: '8165550100', source: 'trigger' });

    expect(enrollmentsFor(writes)).toEqual(['c-inv']);
  });
  it('reports failure when the entry was approved before the reopen landed', async () => {
    setup({ campaigns: [WAITLIST], waitlist: { id: 'w2', status: 'waitlisted' }, member: null, reopenMatches: 0 });
    const result = await enrollPhone({ trigger_word: 'WAITLIST', phone: '8165550100', source: 'trigger' });

    expect(result.body.action_results).toEqual([expect.objectContaining({ action: 'add_to_waitlist', success: false })]);
  });

  it('still enrolls, recording the failure, when the waitlist lookup errors', async () => {
    const writes = setup({ campaigns: [WAITLIST], waitlist: null, member: null, waitlistLookupError: true });
    const result = await enrollPhone({ trigger_word: 'WAITLIST', phone: '8165550100', source: 'trigger' });

    expect(enrollmentsFor(writes)).toEqual(['c-wait']);
    expect(writes.some(w => w.table === 'waitlist')).toBe(false);
    expect(result.body.action_results).toEqual([expect.objectContaining({ action: 'add_to_waitlist', success: false })]);
  });
});
