"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Newspaper } from 'lucide-react';
import { NOIR_LIFE_CLUB_LABEL, NoirLifeClub, NoirLifePost, formatPostDate } from '@/lib/noirLife';

// The Noir.life card on the member dashboard. Same shell as the other dashboard
// cards (Reservations, Balance, Membership) with a preview of the latest posts.
// The card opens the feed; a post opens that post. The newest (or pinned) post
// is featured with its cover image as a full-width banner.

export type NoirLifeCardPost = Pick<
  NoirLifePost,
  'id' | 'club' | 'title' | 'summary' | 'cover_image_url' | 'is_pinned' | 'published_at'
>;

interface Props {
  posts: NoirLifeCardPost[];
  loading: boolean;
  onOpenFeed: () => void;
  onOpenPost: (postId: string) => void;
}

function PostMeta({ post }: { post: NoirLifeCardPost }) {
  return (
    <p className="text-xs text-[#8C7C6D]">
      <span className="font-semibold text-[#A59480]">
        {NOIR_LIFE_CLUB_LABEL[post.club as NoirLifeClub] ?? 'Noir.life'}
      </span>
      {post.published_at && ` · ${formatPostDate(post.published_at)}`}
      {post.is_pinned && ' · Pinned'}
    </p>
  );
}

export default function NoirLifeCard({ posts, loading, onOpenFeed, onOpenPost }: Props) {
  // The first post is featured: its cover image runs full width as a banner.
  // Any further posts stay as compact rows so the card doesn't grow too tall.
  const [featured, ...rest] = posts;

  const open = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    onOpenPost(postId);
  };

  return (
    <Card
      className="bg-white rounded-2xl border border-[#ECEAE5] shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
      onClick={onOpenFeed}
      data-testid="noir-life-card"
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Newspaper className="w-5 h-5 text-[#A59480]" />
            <span className="text-xl font-semibold text-[#1F1F1F]">Noir.life</span>
          </div>
          <span className="text-sm font-medium text-[#A59480]">See all ›</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 pt-0 pb-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="text-[#A59480]" />
          </div>
        ) : featured ? (
          <>
            <button
              type="button"
              onClick={(e) => open(e, featured.id)}
              className="w-full block text-left pb-3 hover:opacity-95"
              style={{ touchAction: 'manipulation' }}
              data-testid="noir-life-featured"
            >
              {featured.cover_image_url && (
                <img
                  src={featured.cover_image_url}
                  alt=""
                  className="w-full aspect-video rounded-xl object-cover mb-3"
                  data-testid="noir-life-banner"
                />
              )}
              <PostMeta post={featured} />
              <p className="text-base font-medium text-[#1F1F1F] mt-0.5">{featured.title}</p>
              {featured.summary && (
                <p className="text-sm text-[#5A5A5A] line-clamp-2 mt-0.5">{featured.summary}</p>
              )}
            </button>
            {rest.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={(e) => open(e, post.id)}
                className="w-full flex items-center gap-3 py-2 min-h-[44px] border-t border-[#ECEAE5] text-left hover:bg-[#FBFBFA]"
                style={{ touchAction: 'manipulation' }}
              >
                {post.cover_image_url && (
                  <img
                    src={post.cover_image_url}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <PostMeta post={post} />
                  <p className="text-sm font-medium text-[#1F1F1F] truncate">{post.title}</p>
                  {post.summary && (
                    <p className="text-xs text-[#5A5A5A] line-clamp-1">{post.summary}</p>
                  )}
                </div>
              </button>
            ))}
          </>
        ) : (
          <p className="text-sm text-[#5A5A5A] text-center py-4">Nothing posted yet</p>
        )}
      </CardContent>
    </Card>
  );
}
