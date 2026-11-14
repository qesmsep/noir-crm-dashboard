-- ========================================
-- Migration: 90-day member journey
-- Created: 2026-11-14
-- Description: The onboarding text series a new member gets over their first
--              90 days, the record of what was sent and what the team has done,
--              and the how-to posts the texts link to.
--
-- Tables Affected: member_journey_steps (new), member_journey_log (new),
--                  member_journey_settings (new), noir_life_posts (7 new DRAFT rows)
-- Dependencies: members, noir_life_posts
-- Breaking Changes: NO - new tables and new rows only. Nothing existing is altered.
-- Access: RLS on with no policies, so only the server (service role) reads and
--         writes the three new tables. The admin API routes check auth first.
--
-- Nothing sends until the series is switched on in Admin > Member journey.
-- The seven posts are inserted unpublished; a text that links to a post waits
-- until that post is published.
-- ========================================

-- 1. The texts ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_journey_steps (
  key TEXT PRIMARY KEY,
  -- Order in the series; the "3 of 15" shown to the member comes from this
  position INTEGER NOT NULL,
  -- Days after the member's join date (join date = day 0)
  day_offset INTEGER NOT NULL CHECK (day_offset >= 0),
  label TEXT NOT NULL,
  -- {{first_name}}, {{blog_link}} and {{referral_link}} are filled in at send
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  -- The how-to post {{blog_link}} points to. The text waits until it is published.
  post_id UUID REFERENCES public.noir_life_posts(id) ON DELETE SET NULL,
  -- 'primary' = only the account holder gets it (billing topics)
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'primary')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.member_journey_steps ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.member_journey_steps IS
  '90-day member journey: the onboarding texts, in order, with the day each one sends.';

-- 2. What happened, per member ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_journey_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(member_id) ON DELETE CASCADE,
  -- A step key from member_journey_steps (kind 'text'), or a team action such
  -- as 'visit1_gift' (kind 'action')
  step_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'action')),
  -- text: 'sent' or 'failed'. action: 'done'.
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'done')),
  attempts INTEGER NOT NULL DEFAULT 1,
  -- The text as it was sent, or the send error
  detail TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_member_journey_log_member
  ON public.member_journey_log (member_id);

ALTER TABLE public.member_journey_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.member_journey_log IS
  '90-day member journey: one row per text sent to a member and per team action marked done.';

-- 3. The switch ---------------------------------------------------------------
-- One row. Off until someone turns it on. start_date is set the day it is first
-- turned on, so only members who join from then on get the series.
-- Its own table rather than system_settings: any signed-in user (members
-- included) can update system_settings, and this row decides whether texts go
-- out and what is written under every one of them.
CREATE TABLE IF NOT EXISTS public.member_journey_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT false,
  start_date DATE,
  -- Added under every text; {{n}} and {{total}} become the count
  footer TEXT NOT NULL DEFAULT 'Welcome note {{n}} of {{total}}. Sent automatically, but we read and answer every reply.'
    CHECK (char_length(footer) <= 300),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.member_journey_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.member_journey_settings IS
  '90-day member journey: on/off, the first join date it applies to, and the line added under every text. One row.';

INSERT INTO public.member_journey_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- RLS with no policies already keeps the browser roles out. Take the table
-- grants away too, so a policy added by mistake later cannot open these up.
REVOKE ALL ON public.member_journey_steps, public.member_journey_log, public.member_journey_settings
  FROM anon, authenticated;

-- 4. The how-to posts, as drafts ----------------------------------------------
INSERT INTO public.noir_life_posts (id, club, title, summary, blocks, is_published)
VALUES
(
  'a3d1f0c2-5b1e-4c61-9a01-000000000001', 'all',
  'Making and changing a reservation',
  'Book a table in under a minute, and change it just as easily.',
  $json$[
    {"id":"mj1a","type":"text","text":"Your table is always a few taps away. Here is the quickest way to book, and what to do if your plans change."},
    {"id":"mj1b","type":"heading","text":"Book a table"},
    {"id":"mj1c","type":"text","text":"1. Open the Noir app and tap Reservations.\n2. Choose your location.\n3. Pick your date and time.\n4. Enter your party size. Count yourself: two guests plus you is a party of three.\n5. Confirm. You will get a text when your table is set."},
    {"id":"mj1d","type":"heading","text":"Change or cancel"},
    {"id":"mj1e","type":"text","text":"Open Reservations, tap the booking, and update the time or party size, or cancel it. If you are running late or adding a guest at the last minute, a quick text to us works too."},
    {"id":"mj1f","type":"heading","text":"Prefer to text?"},
    {"id":"mj1g","type":"text","text":"Text us the word Reservation with your date, time and number of guests, and we will take care of it. Nicole and Angel are on the other end."},
    {"id":"mj1h","type":"button","label":"Reserve a table","action":"reserve"}
  ]$json$::jsonb,
  false
),
(
  'a3d1f0c2-5b1e-4c61-9a01-000000000002', 'all',
  'Your house account',
  'No check at the end of the night. Here is how your house account works.',
  $json$[
    {"id":"mj2a","type":"text","text":"At Noir there is no check to wait for and no card to hand over. When you are ready to leave, you leave. Everything from your evening goes on your house account."},
    {"id":"mj2b","type":"heading","text":"How it settles"},
    {"id":"mj2c","type":"text","text":"Your house account settles once a week to the card or bank account on file. Your membership credit is applied first, so you only pay for what goes beyond it."},
    {"id":"mj2d","type":"heading","text":"Check your balance"},
    {"id":"mj2e","type":"text","text":"Open the Noir app and tap Balance. You will see your current balance and every charge and credit, with the date and what it was for."},
    {"id":"mj2f","type":"heading","text":"A question about a charge?"},
    {"id":"mj2g","type":"text","text":"Text us and we will look at it with you. We would always rather hear about it."}
  ]$json$::jsonb,
  false
),
(
  'a3d1f0c2-5b1e-4c61-9a01-000000000003', 'all',
  'Updating your profile and membership settings',
  'A minute in the app helps us get every detail right for you.',
  $json$[
    {"id":"mj3a","type":"text","text":"The more we know, the better your evenings get. A minute in your profile means we greet you properly, reach you the right way and remember the dates that matter."},
    {"id":"mj3b","type":"heading","text":"Your profile"},
    {"id":"mj3c","type":"text","text":"Open the Noir app and tap Profile, then Edit Profile. Check your name, phone number and email, and add a photo so the team knows you when you walk in."},
    {"id":"mj3d","type":"heading","text":"How we reach you"},
    {"id":"mj3e","type":"text","text":"Under Contact Preferences, choose whether you hear from us by text, email or both."},
    {"id":"mj3f","type":"heading","text":"Your membership"},
    {"id":"mj3g","type":"text","text":"Your membership details, the people on your account and your payment method are all in the same place. If you would like to add someone to your membership, text us and we will set it up."}
  ]$json$::jsonb,
  false
),
(
  'a3d1f0c2-5b1e-4c61-9a01-000000000004', 'all',
  'How member events work',
  'From the invitation to your RSVP, here is what to expect.',
  $json$[
    {"id":"mj4a","type":"text","text":"Member events are some of our favorite nights: tastings, guest bartenders, dinners and evenings built around what our members love. They are small on purpose."},
    {"id":"mj4b","type":"heading","text":"The invitation"},
    {"id":"mj4c","type":"text","text":"When an event is announced you will get a text, and it will appear under Noir.life in the app with the date, the details and how many seats are open."},
    {"id":"mj4d","type":"heading","text":"Your RSVP"},
    {"id":"mj4e","type":"text","text":"Tap RSVP on the event, tell us how many are coming, and you are set. Seats are limited and go in the order we hear from you, so it is worth answering early."},
    {"id":"mj4f","type":"heading","text":"If your plans change"},
    {"id":"mj4g","type":"text","text":"Let us know as soon as you can so another member can take the seat."}
  ]$json$::jsonb,
  false
),
(
  'a3d1f0c2-5b1e-4c61-9a01-000000000005', 'all',
  'Hosting a private event at Noir',
  'Birthdays, client dinners, celebrations. We take care of every detail.',
  $json$[
    {"id":"mj5a","type":"text","text":"Noir is yours for more than an evening out. Members host birthdays, anniversaries, client dinners, team gatherings and quiet celebrations with us, and we handle the details so you can be a guest at your own event."},
    {"id":"mj5b","type":"heading","text":"What we can do"},
    {"id":"mj5c","type":"text","text":"A reserved section or the whole room, a cocktail menu built for your group, food, and a team that already knows how you like things."},
    {"id":"mj5d","type":"heading","text":"How to start"},
    {"id":"mj5e","type":"text","text":"Text us the occasion, a date you have in mind and roughly how many guests. We will come back with options, usually the same day."},
    {"id":"mj5f","type":"heading","text":"Good to know"},
    {"id":"mj5g","type":"text","text":"Weekends book early. If you have a date in mind, tell us even if the rest is undecided."}
  ]$json$::jsonb,
  false
),
(
  'a3d1f0c2-5b1e-4c61-9a01-000000000006', 'all',
  'Updating your card on file',
  'Change the card or bank account behind your house account anytime.',
  $json$[
    {"id":"mj6a","type":"text","text":"New card, or would you rather use a different one? You can change the payment method behind your house account whenever you like."},
    {"id":"mj6b","type":"heading","text":"Add or change a payment method"},
    {"id":"mj6c","type":"text","text":"1. Open the Noir app and tap Profile.\n2. Find Payment Method.\n3. Tap Add Card or Add Bank and enter the details.\n4. Set the new one as your default."},
    {"id":"mj6d","type":"heading","text":"When it takes effect"},
    {"id":"mj6e","type":"text","text":"Your next weekly settlement and your next dues payment will use the new default. Nothing you have already paid changes."},
    {"id":"mj6f","type":"text","text":"Your card details are held by our payment processor, not by us. If anything looks off, text us."}
  ]$json$::jsonb,
  false
),
(
  'a3d1f0c2-5b1e-4c61-9a01-000000000007', 'all',
  'Viewing past statements and receipts',
  'Every evening, charge and receipt, all in the app.',
  $json$[
    {"id":"mj7a","type":"text","text":"Everything that has gone through your house account is in the app, whenever you want to look back."},
    {"id":"mj7b","type":"heading","text":"Your statement"},
    {"id":"mj7c","type":"text","text":"Open the Noir app and tap Balance. Each line shows the date, what it was for and the amount, with your running balance at the top."},
    {"id":"mj7d","type":"heading","text":"Receipts"},
    {"id":"mj7e","type":"text","text":"Tap a visit to see its receipt. You can save it as a PDF if you need it for your records or an expense report."},
    {"id":"mj7f","type":"heading","text":"Need something older or itemized differently?"},
    {"id":"mj7g","type":"text","text":"Text us and we will send it over."}
  ]$json$::jsonb,
  false
)
ON CONFLICT (id) DO NOTHING;

-- 5. The sixteen texts --------------------------------------------------------
INSERT INTO public.member_journey_steps (key, position, day_offset, label, body, post_id, audience)
VALUES
('w01_welcome', 1, 1, 'Week 1: welcome',
 $t$Hi {{first_name}}, welcome to Noir. We're so excited to have you. I'm Nicole, and Angel and I are here for anything you need, reservations included. Over your first 90 days we'll send a short note like this about once a week to help you get the most from your membership. Text us anytime. Nicole$t$,
 NULL, 'all'),
('w01_reservations', 2, 4, 'Week 1: reservations',
 $t$Booking your table is easiest in the Noir app. Choose your location, then enter your guests plus yourself. You can change a reservation there too. Quick how-to: {{blog_link}}$t$,
 'a3d1f0c2-5b1e-4c61-9a01-000000000001', 'all'),
('w02_house_account', 3, 8, 'Week 2: house account',
 $t$No paying at the end of the night at Noir. Everything runs on your house account, which settles weekly, and your balance is always in the app. Here's how it works: {{blog_link}}$t$,
 'a3d1f0c2-5b1e-4c61-9a01-000000000002', 'primary'),
('w02_profile', 4, 11, 'Week 2: profile',
 $t$Take a minute to make the app yours. Update your profile and membership settings so we get every detail right for you: {{blog_link}}$t$,
 'a3d1f0c2-5b1e-4c61-9a01-000000000003', 'all'),
('w03_member_events', 5, 15, 'Week 3: member events',
 $t$Member events are some of our favorite nights at Noir. Here's a quick look at how they work, from invite to RSVP: {{blog_link}}$t$,
 'a3d1f0c2-5b1e-4c61-9a01-000000000004', 'all'),
('w03_private_events', 6, 18, 'Week 3: private events',
 $t$Celebrating something or bringing a group together? We'd love to host your private event. Reply here and we'll take care of every detail. More on hosting: {{blog_link}}$t$,
 'a3d1f0c2-5b1e-4c61-9a01-000000000005', 'all'),
('w04_thirty_days', 7, 30, 'Week 4: 30 days',
 $t${{first_name}}, you've been with us a month, and we're glad you're here. What's your go-to drink? We'll make sure the team has it ready. Your next table is a tap away in the app.$t$,
 NULL, 'all'),
('w05_blog', 8, 36, 'Week 5: the blog',
 $t$Have you found Noir.life in the app? It's where we share member news and quick how-tos, and it's worth a look now and then: {{blog_link}}$t$,
 NULL, 'all'),
('w06_celebrations', 9, 43, 'Week 6: celebrations',
 $t$We love doing something special for your birthday and the people you celebrate. Want to share any of those dates with us? Just reply here.$t$,
 NULL, 'all'),
('w07_beyond_evenings', 10, 50, 'Week 7: beyond evenings out',
 $t$Our members all do something interesting, and many use Noir to celebrate milestones or host important meetings. What do you do, and how can Noir help you beyond your evenings out?$t$,
 NULL, 'all'),
('w08_referral_link', 11, 57, 'Week 8: referral link',
 $t$Know someone who'd be a great fit at Noir? Your personal invitation link lets them skip the waitlist, and it's always in the app: {{referral_link}}$t$,
 NULL, 'all'),
('w09_check_in', 12, 64, 'Week 9: check-in',
 $t$How's everything going so far, {{first_name}}? Anything we can do better? Nicole reads every reply.$t$,
 NULL, 'all'),
('w10_member_ideas', 13, 71, 'Week 10: member ideas',
 $t$We're always looking for creative ways to bring our members' hobbies and activities into events everyone can enjoy. Do you have any suggestions?$t$,
 NULL, 'all'),
('w11_card_on_file', 14, 78, 'Week 11: card on file',
 $t$A quick one: you can update the card on file for your house account anytime in the app. Here's how: {{blog_link}}$t$,
 'a3d1f0c2-5b1e-4c61-9a01-000000000006', 'primary'),
('w12_statements', 15, 85, 'Week 12: statements',
 $t$Want to keep an eye on your evenings with us? Past statements and receipts are all in the app: {{blog_link}}$t$,
 'a3d1f0c2-5b1e-4c61-9a01-000000000007', 'primary'),
('w13_ninety_days', 16, 90, 'Week 13: 90 days',
 $t${{first_name}}, 90 days in. We love having you as a member. Here's to many more evenings, cocktails and good company. Thank you for being part of Noir. Nicole$t$,
 NULL, 'all')
ON CONFLICT (key) DO NOTHING;
