/**
 * Tests for NoirLifeCard (member dashboard)
 *
 * Covers: loading state, empty state, post preview rows, and that a post row
 * opens the post without also opening the feed.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  Newspaper: () => <span data-testid="newspaper-icon" />,
}));

jest.mock('@/components/ui/spinner', () => ({
  Spinner: () => <span data-testid="spinner" />,
}));

import NoirLifeCard, { NoirLifeCardPost } from '../NoirLifeCard';

const posts: NoirLifeCardPost[] = [
  {
    id: 'post-1',
    club: 'all',
    title: 'Welcome to Noir.life',
    summary: 'News, member events and reservations, all in one place.',
    cover_image_url: null,
    is_pinned: true,
    published_at: '2026-11-02T22:00:00.000Z',
  },
  {
    id: 'post-2',
    club: 'noir-op',
    title: 'Noir OP: the lease is in its final round',
    summary: 'Design starts once the Corbin Park lease is signed.',
    cover_image_url: 'https://example.com/cover.jpg',
    is_pinned: false,
    published_at: '2026-11-01T22:00:00.000Z',
  },
];

describe('NoirLifeCard', () => {
  it('shows a spinner while loading', () => {
    render(<NoirLifeCard posts={[]} loading onOpenFeed={jest.fn()} onOpenPost={jest.fn()} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.getByText('Noir.life')).toBeInTheDocument();
  });

  it('shows an empty state when there are no posts', () => {
    render(<NoirLifeCard posts={[]} loading={false} onOpenFeed={jest.fn()} onOpenPost={jest.fn()} />);
    expect(screen.getByText('Nothing posted yet')).toBeInTheDocument();
  });

  it('previews each post with club, date, title and summary', () => {
    const { container } = render(
      <NoirLifeCard posts={posts} loading={false} onOpenFeed={jest.fn()} onOpenPost={jest.fn()} />
    );
    expect(screen.getByText('Welcome to Noir.life')).toBeInTheDocument();
    expect(screen.getByText('Noir OP: the lease is in its final round')).toBeInTheDocument();
    expect(screen.getByText('Design starts once the Corbin Park lease is signed.')).toBeInTheDocument();
    expect(screen.getByText('Noir OP')).toBeInTheDocument();
    expect(screen.getByText(/November 2, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Pinned/)).toBeInTheDocument();
    // Only the post with a cover image renders a thumbnail (decorative, so no img role)
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('shows the first post cover on the left half of the card', () => {
    const withCover = [{ ...posts[1], id: 'post-3', is_pinned: true }, posts[0], posts[1]];
    const { container } = render(
      <NoirLifeCard posts={withCover} loading={false} onOpenFeed={jest.fn()} onOpenPost={jest.fn()} />
    );
    const banner = screen.getByTestId('noir-life-banner');
    expect(banner).toHaveClass('w-1/2', 'object-cover');
    expect(screen.getByTestId('noir-life-featured')).toContainElement(banner);
    // Later posts keep the small square thumbnail
    const thumbs = container.querySelectorAll('img.w-14');
    expect(thumbs).toHaveLength(1);
  });

  it('hides the featured image if it fails to load', () => {
    render(<NoirLifeCard posts={[posts[1]]} loading={false} onOpenFeed={jest.fn()} onOpenPost={jest.fn()} />);
    const banner = screen.getByTestId('noir-life-banner');
    fireEvent.error(banner);
    expect(banner).not.toBeVisible();
  });

  it('shows no banner when the featured post has no cover image', () => {
    render(<NoirLifeCard posts={posts} loading={false} onOpenFeed={jest.fn()} onOpenPost={jest.fn()} />);
    expect(screen.queryByTestId('noir-life-banner')).not.toBeInTheDocument();
  });

  it('opens the featured post, not the feed, when the banner is clicked', () => {
    const onOpenFeed = jest.fn();
    const onOpenPost = jest.fn();
    render(<NoirLifeCard posts={[posts[1]]} loading={false} onOpenFeed={onOpenFeed} onOpenPost={onOpenPost} />);
    fireEvent.click(screen.getByTestId('noir-life-banner'));
    expect(onOpenPost).toHaveBeenCalledWith('post-2');
    expect(onOpenFeed).not.toHaveBeenCalled();
  });

  it('opens the feed when the card is clicked', () => {
    const onOpenFeed = jest.fn();
    render(<NoirLifeCard posts={posts} loading={false} onOpenFeed={onOpenFeed} onOpenPost={jest.fn()} />);
    fireEvent.click(screen.getByText('See all ›'));
    expect(onOpenFeed).toHaveBeenCalledTimes(1);
  });

  it('opens the post, not the feed, when a post row is clicked', () => {
    const onOpenFeed = jest.fn();
    const onOpenPost = jest.fn();
    render(<NoirLifeCard posts={posts} loading={false} onOpenFeed={onOpenFeed} onOpenPost={onOpenPost} />);
    fireEvent.click(screen.getByText('Noir OP: the lease is in its final round'));
    expect(onOpenPost).toHaveBeenCalledWith('post-2');
    expect(onOpenFeed).not.toHaveBeenCalled();
  });
});
