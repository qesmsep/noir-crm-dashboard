# Simple Reservation Request System

## Overview
Replaced the complex reservation booking system on the member dashboard with a simplified reservation request flow that sends SMS notifications instead of creating confirmed reservations.

---

## What Changed

### Old System (Removed from Dashboard)
- Complex `ReservationForm` with availability checking
- Payment capture
- Occasion dropdown
- Automatic reservation creation
- Blocking of unavailable dates

### New System (Member Dashboard Only)
- Simple request form with just the essentials
- SMS notification to business
- Manual confirmation workflow
- No payment upfront
- Open calendar (Thu/Fri/Sat only, 60 days out)

---

## New Components

### 1. SimpleReservationRequestModal
**File:** `src/components/member/SimpleReservationRequestModal.tsx`

A simplified modal that collects:
- **Date** - Only Thu/Fri/Sat, up to 30 days in the future
- **Time** - 4:00 PM to 10:00 PM for Thursdays, 6:00 PM to 11:00 PM for Fri/Sat (15-minute intervals)
- **Number of Guests** - 1 to 15
- **Special Requests/Notes** - Optional text area

**Features:**
- Clean, simple UI
- Thu/Fri/Sat dates available (up to 30 days out)
- **Smart time filtering** - automatically hides times reserved for private events
- Shows "Loading times..." while checking availability
- Shows "No times available" if date is fully booked
- No payment capture
- No occasion selection
- Calendar opens to current month

---

### 2. Check Date Availability API
**File:** `src/pages/api/check-date-availability.ts`

**Endpoint:** `GET /api/check-date-availability?date=YYYY-MM-DD`

**Query Parameters:**
- `date` (required): Date in format YYYY-MM-DD (e.g., "2026-03-15")

**Response:**
```json
{
  "date": "2026-03-15",
  "blockedTimeRanges": [
    {
      "id": "event-123",
      "title": "Private Event",
      "startTime": "7:00 PM",
      "endTime": "10:00 PM",
      "startHour": 19,
      "startMinute": 0,
      "endHour": 22,
      "endMinute": 0
    }
  ]
}
```

**Functionality:**
- Fetches all private events for the specified date
- Returns time ranges that are blocked due to events
- Modal uses this to filter out unavailable time slots

---

### 3. Send Reservation Request API
**File:** `src/pages/api/send-reservation-request.ts`

**Endpoint:** `POST /api/send-reservation-request`

**Request Body:**
```json
{
  "memberName": "John Doe",
  "memberPhone": "+15555551234",
  "date": "March 15, 2026",
  "time": "7:00 PM",
  "partySize": "4",
  "notes": "Window seat preferred"
}
```

**Functionality:**
1. Formats a reservation request message
2. Sends SMS to member's phone (confirmation they requested)
3. Sends SMS to business phone (+16464621266) for notification
4. Uses OpenPhone API for SMS delivery

**Message Format:**
```
🎉 RESERVATION REQUEST

From: John Doe
Phone: +15555551234

📅 Date: March 15, 2026
🕐 Time: 7:00 PM
👥 Party Size: 4

📝 Notes: Window seat preferred
```

---

## Member Dashboard Changes

**File:** `src/app/member/dashboard/page.tsx`

**Removed:**
- `ReservationForm` component import
- Chakra UI Modal imports (using modal from SimpleReservationRequestModal)
- `baseDays`, `bookingStartDate`, `bookingEndDate` state
- `fetchConfig()` useEffect (no longer needed)

**Added:**
- `SimpleReservationRequestModal` import and usage
- Passes member name and phone to modal

---

## User Flow

### Member Side:
1. Member clicks "Book Now" button on dashboard
2. Simple modal opens with 4 fields (date, time, guests, notes)
3. Member selects any Thursday, Friday, or Saturday within 30 days
4. System checks for private events on selected date
5. Member sees only available time slots (blocked times are automatically hidden)
6. Member selects time from dropdown
7. Member selects party size
8. Member optionally adds special requests
9. Member clicks "Send Request"
10. Member receives confirmation toast: "Request Sent! We'll confirm your reservation shortly via text"

### Business Side:
1. Business receives SMS notification with all details
2. Business can manually confirm or deny via text/phone
3. Business can check availability before confirming
4. Business responds to member directly

---

## Benefits

### For Members:
- ✅ Faster, simpler booking process
- ✅ No payment required upfront
- ✅ Can request any date without availability blocking
- ✅ Less friction = more likely to book

### For Business:
- ✅ Manual review before confirming
- ✅ Can check actual availability
- ✅ Can accommodate special requests
- ✅ Personal touch with direct communication
- ✅ Flexibility to adjust based on current capacity

---

## Configuration

### Required Environment Variables:
```env
OPENPHONE_API_KEY=your_api_key
OPENPHONE_PHONE_NUMBER_ID=your_phone_number_id
```

### Business Phone Number:
Currently hardcoded in the API as `+16464621266`. Update in:
`src/pages/api/send-reservation-request.ts` (line 49)

---

## Calendar Settings

**Days Allowed:** Thursday (4), Friday (5), Saturday (6)
**Date Range:** Today to 30 days in the future
**Time Range:**
- Thursday: 4:00 PM to 10:00 PM (15-minute intervals)
- Friday/Saturday: 6:00 PM to 11:00 PM (15-minute intervals)
**Max Party Size:** 15 guests

---

## Future Enhancements

Potential improvements if needed:

1. **Auto-confirmation for members in good standing**
   - Check member status
   - Auto-confirm if they have no cancellations/no-shows

2. **Add to calendar after confirmation**
   - Send calendar invite after manual confirmation
   - Create reservation record in database

3. **Track request status**
   - Add "pending", "confirmed", "denied" status
   - Show status in member dashboard
   - Allow member to cancel pending requests

4. **Smart time suggestions**
   - Based on typical availability
   - Suggest alternative times if requested time is likely busy

5. **Customizable business phone**
   - Store in settings table
   - Update via admin panel

---

## Testing

### Test the Request Flow:
1. Navigate to member dashboard: `/member/dashboard`
2. Click "Book Now" button on reservation card
3. Select a Thursday, Friday, or Saturday
4. Choose a time
5. Enter party size and optional notes
6. Click "Send Request"
7. Check that SMS is received on business phone

### Verify SMS Content:
- Member name and phone displayed
- Date formatted correctly
- Time displayed correctly
- Party size shown
- Notes included (if provided)

---

## Rollback

If you need to revert to the old system:

1. Remove `SimpleReservationRequestModal` import
2. Re-add `ReservationForm` import
3. Restore Modal wrapper around ReservationForm
4. Restore `baseDays`, `bookingStartDate`, `bookingEndDate` state
5. Restore `fetchConfig()` useEffect

The old `ReservationForm` component is still available in the codebase, just not used on the member dashboard.

---

## Notes

- The complex `ReservationForm` is still used elsewhere (public booking page, admin)
- This simplified flow is ONLY on the member dashboard
- No database changes required
- No migration needed
- SMS costs apply via OpenPhone
