# Timezone Fixes - Member Portal

## Issue
Transaction dates created at night (e.g., 8:20 PM CST) were showing as the previous day in the member portal. This was caused by:
1. Transaction dates being created in UTC timezone
2. Date-only strings being parsed as UTC midnight, which becomes the previous day in CST

## Root Cause
When JavaScript's `new Date()` parses a date-only string like "2026-03-05", it treats it as UTC midnight (00:00:00 UTC). When displayed in CST (UTC-6), this becomes 6:00 PM the previous day (March 4th).

## Fixes Applied

### 1. Transaction Creation (Backend)
**File:** `src/app/api/rsvp/route.ts`

Changed from:
```typescript
date: new Date().toISOString().split('T')[0], // UTC date
```

To:
```typescript
const cstDate = DateTime.now().setZone('America/Chicago').toISODate();
date: cstDate, // CST timezone date
```

This ensures transaction dates are created in the correct timezone (CST).

### 2. Date Display (Frontend)
Added `parseLocalDate()` helper function to properly parse date-only strings:

```typescript
const parseLocalDate = (dateString: string) => {
  if (!dateString) return new Date();
  // If it's a date-only string (YYYY-MM-DD), parse it as local time
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Otherwise parse normally (for full timestamps)
  return new Date(dateString);
};
```

**Files Updated:**
- ✅ `src/app/member/balance/page.tsx` (desktop & mobile views)
- ✅ `src/app/member/dashboard/page.tsx` (balance card preview)
- ✅ `src/components/member/BalanceModal.tsx` (transaction list & receipt)

### 3. What Was NOT Changed
The following components use full timestamps (with time information), so they don't need the parseLocalDate helper:
- ✅ `UpcomingEventsModal.tsx` - uses `start_time` timestamps
- ✅ `ReservationsModal.tsx` - uses `start_time` timestamps
- ✅ Event RSVPs and calendar displays - all use timestamps

## Testing Checklist

- [x] Create transaction in CST evening (after 6 PM)
- [ ] Verify transaction shows correct date in balance page
- [ ] Verify transaction shows correct date in dashboard preview
- [ ] Verify transaction shows correct date in balance modal
- [ ] Test on different timezones (PST, EST, UTC)
- [ ] Verify existing transactions display correctly

## Technical Notes

### Date-Only Strings vs Timestamps
- **Date-only string:** "2026-03-05" → Requires `parseLocalDate()`
- **Timestamp:** "2026-03-05T20:20:01.322076+00:00" → Normal `new Date()` works fine

### Why This Matters
The `ledger` table uses a `DATE` field (not TIMESTAMP), so the API returns date-only strings. These must be parsed carefully to avoid timezone shifting.

### Future Considerations
If more date-only fields are added to the database, use the `parseLocalDate()` helper when displaying them in the frontend.

## Files Modified

### Backend
- `src/app/api/rsvp/route.ts`

### Frontend
- `src/app/member/balance/page.tsx`
- `src/app/member/dashboard/page.tsx`
- `src/components/member/BalanceModal.tsx`

## Implementation Date
March 6, 2026
