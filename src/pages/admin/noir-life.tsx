import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { supabase } from '../../lib/supabase';
import {
  BLOCK_LABEL,
  NOIR_LIFE_CLUB_LABEL,
  NoirLifeBlock,
  NoirLifeBlockType,
  NoirLifeClub,
  NoirLifePost,
  formatEventWhen,
  formatPostDate,
  newBlock,
} from '@/lib/noirLife';
import NoirLifeBlocks from '@/components/member/NoirLifeBlocks';

// Admin > Noir.life: write the posts members see on the Noir.life card in the portal.
// Upcoming member events (Events tab) show in the member feed on their own; a post
// can link to one so its RSVP button appears on the post.

interface EventOption {
  id: string;
  title: string;
  start_time: string;
}

interface Draft {
  id?: string;
  title: string;
  summary: string;
  club: NoirLifeClub;
  cover_image_url: string | null;
  blocks: NoirLifeBlock[];
  private_event_id: string | null;
  is_pinned: boolean;
  is_published: boolean;
}

const EMPTY: Draft = {
  title: '',
  summary: '',
  club: 'all',
  cover_image_url: null,
  blocks: [newBlock('text')],
  private_event_id: null,
  is_pinned: false,
  is_published: false,
};

const inputClass =
  'w-full rounded-lg border border-[#DAD7D0] bg-white px-3 py-2.5 text-[15px] text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#A59480]';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  };
}

export default function NoirLifeAdmin() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<NoirLifePost[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [tableReady, setTableReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/noir-life-posts', { headers: await authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      const data = await res.json();
      setPosts(data.posts || []);
      setEvents(data.events || []);
      setTableReady(data.tableReady !== false);
    } catch (e: any) {
      toast({ title: 'Could not load posts', description: e.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (publish: boolean) => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast({ title: 'Add a title first', variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/noir-life-posts', {
        method: draft.id ? 'PUT' : 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ ...draft, is_published: publish }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      toast({ title: publish ? 'Published to Noir.life' : 'Saved as draft' });
      setDraft(null);
      load();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/noir-life-posts?id=${draft.id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
      toast({ title: 'Post deleted' });
      setDraft(null);
      load();
    } catch (e: any) {
      toast({ title: 'Could not delete', description: e.message, variant: 'error' });
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  // Upload a photo or video to storage and return its public URL
  const uploadFile = async (file: File, kind: 'image' | 'video'): Promise<string | null> => {
    if (kind === 'video' && file.size > 50 * 1024 * 1024) {
      toast({ title: 'Video is over 50 MB', description: 'Trim it, or paste a YouTube or Vimeo link instead.', variant: 'error' });
      return null;
    }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const path = `noir-life/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from('uploads').upload(path, file, { contentType: file.type });
      if (error) throw error;
      return supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl;
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'error' });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const setBlock = (id: string, patch: Partial<NoirLifeBlock>) =>
    setDraft((d) => (d ? { ...d, blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as NoirLifeBlock) : b)) } : d));

  const moveBlock = (id: string, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const i = d.blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.blocks.length) return d;
      const blocks = [...d.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...d, blocks };
    });

  const removeBlock = (id: string) =>
    setDraft((d) => (d ? { ...d, blocks: d.blocks.filter((b) => b.id !== id) } : d));

  const addBlock = (type: NoirLifeBlockType) =>
    setDraft((d) => (d ? { ...d, blocks: [...d.blocks, newBlock(type)] } : d));

  const edit = (p: NoirLifePost) => {
    setConfirmDelete(false);
    setDraft({
      id: p.id,
      title: p.title,
      summary: p.summary,
      club: p.club,
      cover_image_url: p.cover_image_url,
      blocks: p.blocks || [],
      private_event_id: p.private_event_id,
      is_pinned: p.is_pinned,
      is_published: p.is_published,
    });
  };

  return (
    <AdminLayout>
      <div className="bg-[#F6F5F2] min-h-screen py-6 md:py-10">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#1F1F1F]" style={{ fontFamily: 'IvyJournal, serif' }}>
                Noir.life
              </h1>
              <p className="mt-1 text-gray-600 text-sm">
                Posts members see on the Noir.life card. Member events from the Events tab show there on their own.
              </p>
            </div>
            {!draft && tableReady && (
              <Button onClick={() => { setConfirmDelete(false); setDraft({ ...EMPTY }); }}>New post</Button>
            )}
          </div>

          {!tableReady && (
            <div className="rounded-xl border border-[#E7C9A0] bg-[#FFF7EC] p-4 text-sm text-[#5A4A35]">
              The Noir.life posts table isn&apos;t set up in the database yet, so posts can&apos;t be saved.
            </div>
          )}

          {draft && (
            <div className="flex lg:hidden bg-white rounded-full p-1 border border-[#ECEAE5]">
              {(['edit', 'preview'] as const).map((t) => (
                <button key={t} onClick={() => setMobileTab(t)}
                  className={`flex-1 min-h-[40px] rounded-full text-sm font-semibold ${mobileTab === t ? 'bg-[#23201C] text-[#ECEDE8]' : 'text-[#5A5A5A]'}`}>
                  {t === 'edit' ? 'Edit' : 'Preview'}
                </button>
              ))}
            </div>
          )}

          {draft && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-6 items-start">
            <div className={`bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-5 flex-col gap-4 ${mobileTab === 'edit' ? 'flex' : 'hidden lg:flex'}`}>
              <div>
                <label className="block text-sm font-semibold text-[#1F1F1F] mb-1">Title</label>
                <input
                  className={inputClass}
                  value={draft.title}
                  maxLength={200}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="What's new"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1F1F1F] mb-1">Club</label>
                <select
                  className={inputClass}
                  value={draft.club}
                  onChange={(e) => setDraft({ ...draft, club: e.target.value as NoirLifeClub })}
                >
                  <option value="all">Both (Noir.life)</option>
                  <option value="noir">Noir</option>
                  <option value="noir-op">Noir OP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1F1F1F] mb-1">Summary for the feed card</label>
                <input
                  className={inputClass}
                  value={draft.summary}
                  maxLength={300}
                  onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                  placeholder="One line that makes members tap in"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1F1F1F] mb-1">Cover photo</label>
                {draft.cover_image_url ? (
                  <div className="flex items-start gap-3">
                    <img src={draft.cover_image_url} alt="" className="w-40 aspect-[4/3] object-cover rounded-lg" />
                    <Button variant="outline" onClick={() => setDraft({ ...draft, cover_image_url: null })}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadFile(f, 'image');
                      if (url) setDraft((d) => (d ? { ...d, cover_image_url: url } : d));
                    }}
                    className="text-sm"
                  />
                )}
              </div>

              {/* Block builder */}
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-[#1F1F1F]">Post</p>
                {draft.blocks.map((b, i) => (
                  <div key={b.id} className="rounded-xl border border-[#ECEAE5] bg-[#FAF9F7] p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#A59480] mr-auto">
                        {BLOCK_LABEL[b.type]}
                      </span>
                      <button className="px-2 py-1 text-gray-500 disabled:opacity-30" disabled={i === 0} onClick={() => moveBlock(b.id, -1)} aria-label="Move up">↑</button>
                      <button className="px-2 py-1 text-gray-500 disabled:opacity-30" disabled={i === draft.blocks.length - 1} onClick={() => moveBlock(b.id, 1)} aria-label="Move down">↓</button>
                      <button className="px-2 py-1 text-red-500" onClick={() => removeBlock(b.id)} aria-label="Remove block">✕</button>
                    </div>

                    {b.type === 'heading' && (
                      <input className={inputClass} value={b.text} maxLength={200} placeholder="Heading"
                        onChange={(e) => setBlock(b.id, { text: e.target.value })} />
                    )}

                    {b.type === 'text' && (
                      <textarea className={`${inputClass} min-h-[120px]`} value={b.text} placeholder="Write here. Line breaks are kept."
                        onChange={(e) => setBlock(b.id, { text: e.target.value })} />
                    )}

                    {b.type === 'image' && (
                      <>
                        {b.url ? (
                          <img src={b.url} alt="" className="w-full max-w-xs rounded-lg" />
                        ) : (
                          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} className="text-sm"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const url = await uploadFile(f, 'image');
                              if (url) setBlock(b.id, { url });
                            }} />
                        )}
                        <input className={inputClass} value={b.caption || ''} maxLength={300} placeholder="Caption (optional)"
                          onChange={(e) => setBlock(b.id, { caption: e.target.value })} />
                      </>
                    )}

                    {b.type === 'gallery' && (
                      <>
                        {b.urls.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {b.urls.map((u, k) => (
                              <div key={u + k} className="relative">
                                <img src={u} alt="" className="w-20 h-24 object-cover rounded-md" />
                                <button className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border text-xs text-red-500"
                                  onClick={() => setBlock(b.id, { urls: b.urls.filter((_, x) => x !== k) })} aria-label="Remove photo">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploading} className="text-sm"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            const urls: string[] = [];
                            for (const f of files) {
                              const url = await uploadFile(f, 'image');
                              if (url) urls.push(url);
                            }
                            if (urls.length) {
                              setDraft((d) => d ? { ...d, blocks: d.blocks.map((x) => x.id === b.id && x.type === 'gallery' ? { ...x, urls: [...x.urls, ...urls] } : x) } : d);
                            }
                            e.target.value = '';
                          }} />
                        <p className="text-xs text-gray-500">Pick several photos at once. Members swipe through them.</p>
                      </>
                    )}

                    {b.type === 'video' && (
                      <>
                        <input className={inputClass} value={b.url} placeholder="Paste a YouTube or Vimeo link, or upload below"
                          onChange={(e) => setBlock(b.id, { url: e.target.value.trim() })} />
                        <input type="file" accept="video/mp4,video/quicktime,video/webm" disabled={uploading} className="text-sm"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const url = await uploadFile(f, 'video');
                            if (url) setBlock(b.id, { url });
                          }} />
                        <p className="text-xs text-gray-500">Uploads up to 50 MB. Longer videos work best as a YouTube or Vimeo link.</p>
                      </>
                    )}

                    {b.type === 'button' && (
                      <>
                        <input className={inputClass} value={b.label} maxLength={40} placeholder="Button text"
                          onChange={(e) => setBlock(b.id, { label: e.target.value })} />
                        <select className={inputClass} value={b.action}
                          onChange={(e) => setBlock(b.id, { action: e.target.value as 'rsvp' | 'reserve' | 'link' })}>
                          <option value="rsvp">RSVP to the linked event</option>
                          <option value="reserve">Make a reservation</option>
                          <option value="link">Open a web link</option>
                        </select>
                        {b.action === 'link' && (
                          <input className={inputClass} value={b.url || ''} placeholder="https://"
                            onChange={(e) => setBlock(b.id, { url: e.target.value.trim() })} />
                        )}
                        {b.action === 'rsvp' && !draft.private_event_id && (
                          <p className="text-xs text-amber-700">Link a member event below, or this button stays hidden.</p>
                        )}
                      </>
                    )}
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  {(Object.keys(BLOCK_LABEL) as NoirLifeBlockType[]).map((t) => (
                    <button key={t} onClick={() => addBlock(t)}
                      className="min-h-[40px] px-3 rounded-full border border-[#DAD7D0] bg-white text-sm text-[#1F1F1F] hover:bg-[#F6F5F2]">
                      + {BLOCK_LABEL[t]}
                    </button>
                  ))}
                </div>
                {uploading && <p className="text-xs text-gray-500">Uploading…</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1F1F1F] mb-1">Link a member event (optional)</label>
                <select
                  className={inputClass}
                  value={draft.private_event_id || ''}
                  onChange={(e) => setDraft({ ...draft, private_event_id: e.target.value || null })}
                >
                  <option value="">No event</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {formatEventWhen(ev.start_time)}: {ev.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Members get the event&apos;s RSVP button on the post, or a reservation button if RSVP is off.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-[#1F1F1F]">
                <input
                  type="checkbox"
                  checked={draft.is_pinned}
                  onChange={(e) => setDraft({ ...draft, is_pinned: e.target.checked })}
                />
                Pin to the top of the feed
              </label>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#ECEAE5]">
                <Button onClick={() => save(true)} disabled={saving || uploading}>
                  {draft.is_published ? 'Save changes' : 'Publish'}
                </Button>
                <Button variant="outline" onClick={() => save(false)} disabled={saving || uploading}>
                  {draft.is_published ? 'Unpublish' : 'Save draft'}
                </Button>
                <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
                  Cancel
                </Button>
                {draft.id && (
                  <Button
                    variant="ghost"
                    className="ml-auto text-red-600"
                    onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
                    disabled={saving}
                  >
                    {confirmDelete ? 'Tap again to delete' : 'Delete'}
                  </Button>
                )}
              </div>
            </div>

            {/* Live preview: what members see on a phone */}
            <div className={`lg:sticky lg:top-6 ${mobileTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#A59480] mb-2">Member view</p>
              <div className="mx-auto w-full max-w-[390px] rounded-[36px] border-[10px] border-[#23201C] bg-[#ECEDE8] overflow-hidden">
                <div className="max-h-[760px] overflow-y-auto px-4 py-5 space-y-4">
                  {draft.cover_image_url && (
                    <img src={draft.cover_image_url} alt="" className="w-full rounded-2xl aspect-[4/3] object-cover" />
                  )}
                  <div>
                    <p className="text-xs text-[#8C7C6D]" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      <span className="font-semibold text-[#A59480]">{NOIR_LIFE_CLUB_LABEL[draft.club]}</span> · {formatPostDate(new Date().toISOString())}
                    </p>
                    <h1 className="text-2xl text-[#1F1F1F] mt-1" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', letterSpacing: '0.04em' }}>
                      {draft.title || 'Post title'}
                    </h1>
                  </div>
                  <NoirLifeBlocks
                    blocks={draft.blocks}
                    onRSVP={draft.private_event_id ? () => {} : undefined}
                    onReserve={() => {}}
                  />
                </div>
              </div>
            </div>
          </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : posts.length === 0 ? (
            tableReady && <p className="text-sm text-gray-600">No posts yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {posts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => edit(p)}
                  className="text-left bg-white rounded-xl border border-[#ECEAE5] p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={p.is_published ? 'default' : 'secondary'}>
                      {p.is_published ? 'Published' : 'Draft'}
                    </Badge>
                    {p.is_pinned && <Badge variant="outline">Pinned</Badge>}
                    <span className="text-xs text-gray-500">
                      {NOIR_LIFE_CLUB_LABEL[p.club]} · {formatPostDate(p.published_at || p.created_at)}
                    </span>
                  </div>
                  <p className="font-semibold text-[#1F1F1F] mt-1">{p.title}</p>
                  {p.summary && <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">{p.summary}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
