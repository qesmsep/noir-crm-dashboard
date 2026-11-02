// Shared types and helpers for the Noir.life feed (member portal + admin).

export type NoirLifeClub = 'all' | 'noir' | 'noir-op';

export const NOIR_LIFE_CLUB_LABEL: Record<NoirLifeClub, string> = {
  all: 'Noir.life',
  noir: 'Noir',
  'noir-op': 'Noir OP',
};

export interface NoirLifeLinkedEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  rsvp_enabled: boolean | null;
  rsvp_url: string | null;
}

export interface NoirLifePost {
  id: string;
  club: NoirLifeClub;
  title: string;
  summary: string;
  cover_image_url: string | null;
  blocks: NoirLifeBlock[];
  private_event_id: string | null;
  is_pinned: boolean;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  private_events?: NoirLifeLinkedEvent | null;
}

// ---- Post blocks ----------------------------------------------------------

export type NoirLifeBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; url: string; caption?: string }
  | { id: string; type: 'gallery'; urls: string[] }
  | { id: string; type: 'video'; url: string }
  | { id: string; type: 'button'; label: string; action: 'rsvp' | 'reserve' | 'link'; url?: string };

export type NoirLifeBlockType = NoirLifeBlock['type'];

export const BLOCK_LABEL: Record<NoirLifeBlockType, string> = {
  heading: 'Heading',
  text: 'Text',
  image: 'Photo',
  gallery: 'Gallery',
  video: 'Video',
  button: 'Button',
};

export function newBlock(type: NoirLifeBlockType): NoirLifeBlock {
  const id = Math.random().toString(36).slice(2, 10);
  switch (type) {
    case 'heading': return { id, type, text: '' };
    case 'text': return { id, type, text: '' };
    case 'image': return { id, type, url: '', caption: '' };
    case 'gallery': return { id, type, urls: [] };
    case 'video': return { id, type, url: '' };
    case 'button': return { id, type, label: 'RSVP', action: 'rsvp' };
  }
}

const isHttpsUrl = (u: unknown): u is string => {
  if (typeof u !== 'string' || u.length > 2000) return false;
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Keep only known block types and fields; drop anything unsafe (non-https links, etc.). */
export function sanitizeBlocks(input: unknown): NoirLifeBlock[] {
  if (!Array.isArray(input)) return [];
  const out: NoirLifeBlock[] = [];
  for (const raw of input.slice(0, 60)) {
    if (!raw || typeof raw !== 'object') continue;
    const b = raw as Record<string, unknown>;
    const id = str(b.id, 20) || Math.random().toString(36).slice(2, 10);
    switch (b.type) {
      case 'heading':
      case 'text':
        out.push({ id, type: b.type, text: str(b.text, b.type === 'heading' ? 200 : 10000) });
        break;
      case 'image':
        if (isHttpsUrl(b.url)) out.push({ id, type: 'image', url: b.url, caption: str(b.caption, 300) });
        break;
      case 'gallery': {
        const urls = Array.isArray(b.urls) ? b.urls.filter(isHttpsUrl).slice(0, 20) : [];
        if (urls.length) out.push({ id, type: 'gallery', urls });
        break;
      }
      case 'video':
        if (isHttpsUrl(b.url)) out.push({ id, type: 'video', url: b.url });
        break;
      case 'button': {
        const action = b.action === 'reserve' || b.action === 'link' ? b.action : 'rsvp';
        const label = str(b.label, 40) || 'Learn more';
        if (action === 'link') {
          if (isHttpsUrl(b.url)) out.push({ id, type: 'button', label, action, url: b.url });
        } else {
          out.push({ id, type: 'button', label, action });
        }
        break;
      }
    }
  }
  return out;
}

/** YouTube or Vimeo link -> embed URL. Anything else is treated as an uploaded video file. */
export function videoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?playsinline=1`;
    if (host === 'youtube.com') {
      const v = u.searchParams.get('v') || (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : '');
      return v ? `https://www.youtube-nocookie.com/embed/${v}?playsinline=1` : null;
    }
    if (host === 'vimeo.com') {
      const vid = u.pathname.split('/').filter(Boolean)[0];
      return /^\d+$/.test(vid || '') ? `https://player.vimeo.com/video/${vid}?playsinline=1` : null;
    }
  } catch {}
  return null;
}

export interface NoirLifeEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  event_description: string | null;
  rsvp_enabled: boolean | null;
  rsvp_url: string | null;
  background_image_url: string | null;
}

export const NOIR_LIFE_POST_COLUMNS =
  'id, club, title, summary, cover_image_url, blocks, private_event_id, is_pinned, is_published, published_at, created_at, updated_at, private_events(id, title, start_time, end_time, rsvp_enabled, rsvp_url)';

/** Postgres "relation does not exist": the posts table has not been created yet. */
export function isMissingTable(error: { code?: string } | null | undefined) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

export function formatPostDate(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  });
}

export function formatEventWhen(start: string, end?: string | null) {
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'America/Chicago' };
  const day = new Date(start).toLocaleDateString('en-US', { ...opts, weekday: 'short', month: 'short', day: 'numeric' });
  const t = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { ...opts, hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  return end ? `${day} · ${t(start)} to ${t(end)}` : `${day} · ${t(start)}`;
}
