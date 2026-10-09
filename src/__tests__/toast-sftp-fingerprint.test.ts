/**
 * @jest-environment node
 */
jest.mock('../lib/supabase', () => ({ supabaseAdmin: {} }));

import { createHash } from 'crypto';
import { hostKeyFingerprint } from '../lib/toast/sftp';

describe('hostKeyFingerprint', () => {
  it('matches the OpenSSH SHA256 format (base64, no padding)', () => {
    const key = Buffer.from('example host key blob');
    const b64 = createHash('sha256').update(key).digest('base64');
    expect(hostKeyFingerprint(key)).toBe(`SHA256:${b64.replace(/=+$/, '')}`);
    expect(hostKeyFingerprint(key)).not.toMatch(/=$/);
  });
  it('differs for different keys', () => {
    expect(hostKeyFingerprint(Buffer.from('a'))).not.toBe(hostKeyFingerprint(Buffer.from('b')));
  });
});
