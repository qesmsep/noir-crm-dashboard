# Noir Referral System

## Overview
Complete referral system that allows members to invite friends to apply for membership through personalized referral links.

## Features

### 1. **Member Portal Integration**
- Members get a unique referral code (e.g., `JOH1234`)
- Shareable referral link: `https://yourdomain.com/refer/JOH1234`
- Track referral count in member portal
- Share via SMS or Email with pre-filled messages

### 2. **Referral Landing Page**
- Custom page at `/refer/[code]` for each member's referral link
- Shows who referred them
- Uses the same beautiful invitation questionnaire flow
- Automatically tracks the referrer when application is submitted

### 3. **Database Tracking**
- `members.referral_code` - Unique code for each member
- `members.referral_count` - Number of successful referrals
- `members.referred_by_member_id` - Who referred this member
- `waitlist.referral_code` & `waitlist.referred_by_member_id` - Track referrals during application phase

### 4. **Automatic Features**
- Referral codes auto-generated for all members (format: FIRST3LAST1+4digits)
- Referral count auto-increments when referred member joins
- SMS notifications to both applicant and referrer
- Referrer gets notified when someone uses their link

## Files Created

### Database Migrations
1. `supabase/migrations/20260308_add_referral_tracking.sql` - Members table referral columns
2. `supabase/migrations/20260308_add_referral_to_waitlist.sql` - Waitlist table referral columns

### Components
1. `src/components/member/ReferralSection.tsx` - Member portal referral component

### Pages
1. `src/app/refer/[code]/page.tsx` - Referral landing page

### API Endpoints
1. `src/pages/api/referral/validate.ts` - Validate referral codes
2. `src/pages/api/referral/submit.ts` - Submit referral applications
3. `src/pages/api/member/referral-info.ts` - Get member's referral stats

## How to Use

### Step 1: Run Migrations
```bash
# Apply the database migrations
npm run migrate
# or manually run the SQL files in your Supabase dashboard
```

### Step 2: Add Referral Section to Member Portal
Add the ReferralSection component to your member portal page:

```tsx
import ReferralSection from '@/components/member/ReferralSection';

// In your member portal page component:
const [referralInfo, setReferralInfo] = useState(null);

useEffect(() => {
  async function fetchReferralInfo() {
    const response = await fetch('/api/member/referral-info', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    setReferralInfo(data);
  }
  fetchReferralInfo();
}, []);

// In your JSX:
{referralInfo && (
  <ReferralSection
    referralCode={referralInfo.referral_code}
    referralCount={referralInfo.referral_count}
    memberId={memberId}
  />
)}
```

### Step 3: Test the Flow
1. Go to member portal and find your referral link
2. Share it with someone (or open in incognito)
3. Complete the application using the referral link
4. Check that the waitlist entry has the referral info
5. When you approve the application, the referral count increments

## Member Flow

1. **Member shares link**: `https://yourdomain.com/refer/JOH1234`
2. **Friend clicks link**: Sees personalized invitation page showing who referred them
3. **Friend completes application**: Goes through same beautiful questionnaire
4. **Application submitted**:
   - Waitlist entry created with `referred_by_member_id` and `referral_code`
   - Both friend and member get SMS notifications
5. **Admin approves**: When creating member account, the `referred_by_member_id` is copied from waitlist
6. **Referral count updates**: Automatically increments when referred member is created

## Customization

### Change Referral Code Format
Edit the `generate_referral_code()` function in the migration:
```sql
-- Current format: FIRST3LAST1 + 4 random digits (e.g., JOH1234)
base_code := UPPER(LEFT(first_name, 3) || LEFT(last_name, 1)) || LPAD((FLOOR(RANDOM() * 9999)::TEXT), 4, '0');
```

### Customize SMS Messages
Edit the messages in `/api/referral/submit.ts`:
- Line ~85: Message to applicant
- Line ~103: Message to referring member

### Styling
All components use your existing Noir color scheme:
- Primary: `#a59480`
- Background: `#1F1F1F`
- Text: `#ECEDE8`

## Admin View (Future Enhancement)

You can add a referral leaderboard to your admin dashboard:

```sql
SELECT
  m.member_id,
  m.first_name,
  m.last_name,
  m.referral_code,
  m.referral_count,
  COUNT(referred.member_id) as active_referrals
FROM members m
LEFT JOIN members referred ON referred.referred_by_member_id = m.member_id
WHERE m.deactivated = false
GROUP BY m.member_id
ORDER BY m.referral_count DESC
LIMIT 10;
```

## Notes

- Referral codes are case-insensitive (stored uppercase)
- Referral codes are unique across all members
- Existing members will get codes auto-generated on first update
- If referral code generation fails, check `first_name` and `last_name` are not null
- SMS notifications require OpenPhone API to be configured

## Testing Checklist

- [ ] Run both migrations successfully
- [ ] Verify existing members have referral codes
- [ ] Add ReferralSection to member portal
- [ ] Member can see and copy their referral link
- [ ] Referral link opens the custom application page
- [ ] Application shows referrer's name
- [ ] Submitting application creates waitlist entry with referral info
- [ ] Both parties receive SMS notifications
- [ ] When approving waitlist → member, referral count increments
