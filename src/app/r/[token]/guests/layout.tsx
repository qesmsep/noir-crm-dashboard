import type { Metadata } from 'next';

// The token in this URL is the only credential: keep it out of Referer headers
// and search indexes.
export const metadata: Metadata = {
  title: 'Add your guests',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default function GuestLinkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
