// Member portal updates for Noir and Noir OP.
// Newest first. Add a new entry at the top of the list to post an update.
// `club` decides which tab it shows under on /member/updates.

export type UpdateClub = 'noir' | 'noir-op';

export interface MemberUpdate {
  id: string;
  date: string; // YYYY-MM-DD
  club: UpdateClub;
  title: string;
  body: string;
}

export const CLUB_LABEL: Record<UpdateClub, string> = {
  noir: 'Noir',
  'noir-op': 'Noir OP',
};

export const MEMBER_UPDATES: MemberUpdate[] = [
  {
    id: '2026-11-op-lease',
    date: '2026-11-02',
    club: 'noir-op',
    title: 'The lease is in its final round',
    body: 'The lease at Corbin Park is in its last round of edits. Design work starts once it is signed, and we will share it here as it comes together.',
  },
  {
    id: '2026-11-updates-launch',
    date: '2026-11-02',
    club: 'noir',
    title: 'Updates now live in your portal',
    body: 'News from Noir and Noir OP will post here. Check back each week, or watch for a text when something new is up.',
  },
];

export function formatUpdateDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
