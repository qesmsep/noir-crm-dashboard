import { createHash } from 'crypto';
import SftpClient from 'ssh2-sftp-client';
import { supabaseAdmin } from '../supabase';

/**
 * Toast nightly data export, read over SFTP.
 *
 * Toast writes one folder per business day under the restaurant's export id:
 *   /<exportId>/<YYYYMMDD>/ItemSelectionDetails.csv (+ other files)
 * Files are kept for 7 days, then Toast deletes them.
 *
 * Env: TOAST_SFTP_HOST, TOAST_SFTP_USER, TOAST_SFTP_PRIVATE_KEY,
 *      TOAST_SFTP_EXPORT_ID (optional — found automatically when there's one),
 *      TOAST_SFTP_HOST_FINGERPRINT (optional — "SHA256:…" as ssh-keygen -l
 *      prints it; otherwise the first key seen is pinned in system_settings).
 */

const PINNED_KEY = 'toast_sftp_host_fingerprint';

/** OpenSSH-style fingerprint of a raw host key: SHA256:<base64, unpadded>. */
export function hostKeyFingerprint(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
}

function normalizeFingerprint(f: string): string {
  const v = f.trim().replace(/=+$/, '');
  return v.startsWith('SHA256:') ? v : `SHA256:${v}`;
}

/** The fingerprint the server must present: the env var, else the one pinned on first connect, else null. */
async function expectedFingerprint(): Promise<string | null> {
  if (process.env.TOAST_SFTP_HOST_FINGERPRINT?.trim()) return normalizeFingerprint(process.env.TOAST_SFTP_HOST_FINGERPRINT);
  const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', PINNED_KEY).maybeSingle();
  const pinned = data?.value?.fingerprint;
  return typeof pinned === 'string' && pinned ? pinned : null;
}

async function pinFingerprint(fingerprint: string): Promise<void> {
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin.from('system_settings').select('id').eq('key', PINNED_KEY).maybeSingle();
  const value = { fingerprint, host: process.env.TOAST_SFTP_HOST, pinned_at: now };
  if (data) await supabaseAdmin.from('system_settings').update({ value, updated_at: now }).eq('key', PINNED_KEY);
  else await supabaseAdmin.from('system_settings').insert({ key: PINNED_KEY, value, created_at: now, updated_at: now });
}

export function toastSftpConfigured(): boolean {
  return !!(process.env.TOAST_SFTP_HOST && process.env.TOAST_SFTP_USER && process.env.TOAST_SFTP_PRIVATE_KEY);
}

function privateKey(): string {
  // A key pasted into a single-line field arrives with literal "\n"s.
  return (process.env.TOAST_SFTP_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim() + '\n';
}

export async function withToastSftp<T>(fn: (sftp: SftpClient) => Promise<T>): Promise<T> {
  if (!toastSftpConfigured()) {
    throw new Error('Toast SFTP is not configured (TOAST_SFTP_HOST / TOAST_SFTP_USER / TOAST_SFTP_PRIVATE_KEY)');
  }
  // Only trust sales data from the real Toast server: the host key must match
  // the pinned fingerprint (trust on first use when nothing is pinned yet).
  const expected = await expectedFingerprint();
  let presented = '';
  const sftp = new SftpClient('toast-export');
  try {
    await sftp.connect({
      host: process.env.TOAST_SFTP_HOST,
      port: 22,
      username: process.env.TOAST_SFTP_USER,
      privateKey: privateKey(),
      readyTimeout: 20_000,
      hostVerifier: (key: Buffer) => {
        presented = hostKeyFingerprint(key);
        return expected === null || presented === expected;
      },
    });
  } catch (err) {
    if (expected && presented && presented !== expected) {
      throw new Error(
        `Toast SFTP server presented host key ${presented}, expected ${expected}. Refusing to connect. ` +
          `If Toast rotated its server key, set TOAST_SFTP_HOST_FINGERPRINT to the new value (or delete the "${PINNED_KEY}" system setting).`
      );
    }
    throw err;
  }
  try {
    if (expected === null && presented) await pinFingerprint(presented);
    return await fn(sftp);
  } finally {
    await sftp.end().catch(() => undefined);
  }
}

/** The restaurant's export folder: the configured id, or the only folder at the root. */
export async function exportRoot(sftp: SftpClient): Promise<string> {
  const configured = process.env.TOAST_SFTP_EXPORT_ID?.trim();
  if (configured) return `/${configured}`;
  const dirs = (await sftp.list('/')).filter(e => e.type === 'd' && !e.name.startsWith('.'));
  if (dirs.length !== 1) {
    throw new Error(
      `Expected one export folder on the Toast SFTP server, found ${dirs.length} (${dirs.map(d => d.name).join(', ')}). Set TOAST_SFTP_EXPORT_ID.`
    );
  }
  return `/${dirs[0].name}`;
}

export async function listDayFolders(sftp: SftpClient, root: string): Promise<string[]> {
  return (await sftp.list(root))
    .filter(e => e.type === 'd' && /^\d{8}$/.test(e.name))
    .map(e => e.name)
    .sort();
}

/** Contents of a day's file, or null if Toast didn't write it that night. */
export async function readDayFile(sftp: SftpClient, root: string, folder: string, file: string): Promise<string | null> {
  try {
    const buf = (await sftp.get(`${root}/${folder}/${file}`)) as Buffer;
    return buf.toString('utf8');
  } catch (err) {
    // ssh2-sftp-client reports a missing file as ERR_BAD_PATH / ENOENT / "No such file".
    const e = err as { code?: string; message?: string };
    if (e.code === 'ERR_BAD_PATH' || e.code === 'ENOENT' || /no such file/i.test(e.message || '')) return null;
    throw err;
  }
}
