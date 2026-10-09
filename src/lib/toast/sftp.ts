import SftpClient from 'ssh2-sftp-client';

/**
 * Toast nightly data export, read over SFTP.
 *
 * Toast writes one folder per business day under the restaurant's export id:
 *   /<exportId>/<YYYYMMDD>/ItemSelectionDetails.csv (+ other files)
 * Files are kept for 7 days, then Toast deletes them.
 *
 * Env: TOAST_SFTP_HOST, TOAST_SFTP_USER, TOAST_SFTP_PRIVATE_KEY,
 *      TOAST_SFTP_EXPORT_ID (optional — found automatically when there's one).
 */

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
  const sftp = new SftpClient('toast-export');
  await sftp.connect({
    host: process.env.TOAST_SFTP_HOST,
    port: 22,
    username: process.env.TOAST_SFTP_USER,
    privateKey: privateKey(),
    readyTimeout: 20_000,
  });
  try {
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
  const path = `${root}/${folder}/${file}`;
  if (!(await sftp.exists(path))) return null;
  const buf = (await sftp.get(path)) as Buffer;
  return buf.toString('utf8');
}
