# 90-Day Member Journey

Tracks a new member's first 90 days and sends the onboarding text series.

## How it works

- **Day 0** is the member's `join_date` (set when their signup payment completes).
- **Visits** are counted from the ledger: a day with a house-account purchase at a venue is one visit (`isVisit` in `src/lib/businessMetricsCore.ts`, the same rule the business dashboard uses).
- Nothing about a member's journey is stored except `member_journey_log`: the texts sent and the team actions marked done. Everything else is worked out from the join date and the ledger.

## Texts

- 16 texts in `member_journey_steps`, each with the day it sends. Edit the words, the day, or turn one off in **Admin > Member journey** (`/admin/member-journey`).
- Sent at **10:28 AM Central** by `/api/cron/member-journey` (Vercel cron at 15:28 and 16:28 UTC; only the one that is 10:28 local sends).
- At most one text per member per day. A member who falls behind catches up one morning at a time.
- A text that links to a how-to post waits until that post is published in Admin > Noir.life. Later texts are not held up.
- Three billing texts (house account, card on file, statements) go to the account holder only.
- Not sent when: the series is off, the member joined before the series start date, has no mobile number, turned texts off in their profile, or the account is not active.
- **The series is off until someone turns it on** on the Member journey page. The day it is first turned on becomes the start date; only members who join from then on are texted.
- When the series is on, the signup welcome text (`src/pages/api/payment/confirm.ts`) tells the member the weekly notes are coming.

## Dashboard (`/admin/business`)

- **Today's Member Details**: every member with a reservation today, by location, with visit number, journey day, profile attributes, notes and what to do on visits 1, 2 and 3.
- **90-Day Member Journey**: what needs a person. No visit by day 21, the first-visit note, the referral ask after visit 2, gifts not marked given, an unexpected touch for regulars on days 60 to 75, and the 30 and 90 day milestones. Each clears with Done.

## Files

| What | Where |
|---|---|
| Rules (unit tested) | `src/lib/memberJourney.ts`, `src/lib/__tests__/memberJourney.test.ts` |
| Loading and sending | `src/lib/memberJourneyData.ts` |
| Cron | `src/pages/api/cron/member-journey.ts`, `vercel.json` |
| Admin API | `src/pages/api/admin/member-journey.ts` |
| Cards and page | `src/components/admin/MemberJourneyCards.tsx`, `src/pages/admin/member-journey.tsx` |
| Tables, texts, draft posts | `supabase/migrations/20261111000000_add_member_journey.sql` (+ `_ROLLBACK`) |
