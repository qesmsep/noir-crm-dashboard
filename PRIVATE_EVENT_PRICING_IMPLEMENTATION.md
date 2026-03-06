# Private Event Per-Seat Pricing Implementation

## Overview
This implementation adds the ability to set a per-seat price for private events. When members RSVP to an event with a per-seat price, the total cost (price_per_seat × party_size) is automatically charged to their account ledger.

## Implementation Date
March 5, 2026

---

## Database Changes

### Migration File
**File:** `supabase/migrations/20260305_add_price_per_seat_to_private_events.sql`

**Changes:**
- Added `price_per_seat` column to `private_events` table (NUMERIC(10,2), default: 0)
- Added index on `price_per_seat` for events with pricing > 0
- Added column documentation comment

**Rollback File:** `supabase/migrations/20260305_add_price_per_seat_to_private_events_ROLLBACK.sql`

**Migration Status:** ✅ Applied successfully

---

## Backend Changes

### 1. RSVP API Route
**File:** `src/app/api/rsvp/route.ts`

**Changes:**
- Added automatic transaction creation after successful RSVP
- Finds member by email or phone
- Calculates total cost: `price_per_seat * party_size`
- Creates transaction in `member_ledger` with:
  - `transaction_type`: 'charge'
  - `amount`: total cost
  - `description`: "Private Event: [Event Title] - [X] seat(s)"
  - `reference_id`: reservation ID
  - `balance_after`: calculated running balance
  - `metadata`: event details (event_id, event_title, party_size, price_per_seat)

**Logic:**
- Only creates transaction if `price_per_seat > 0`
- Gracefully handles non-member RSVPs (logs but doesn't fail)
- Does not fail the RSVP if transaction creation fails (logs error for manual resolution)
- Charges decrease member balance (negative = amount owed)

---

## Frontend Changes

### 1. Member Portal - RSVP Modal
**File:** `src/components/member/RSVPModal.tsx`

**Changes:**
- Updated `PrivateEvent` interface to include `price_per_seat: number`
- Added price per seat display in event details section
- Added dynamic total cost calculator that updates with party size
- Added highlighted cost summary box showing:
  - Total cost calculation
  - Notice that amount will be added to account ledger

**UI Features:**
- Shows "Price per seat: $X.XX" below event details
- Shows total cost in a yellow-highlighted box
- Updates in real-time as user changes party size
- Only displays pricing UI when `price_per_seat > 0`

### 2. Admin - Private Events Manager
**File:** `src/components/admin/PrivateEventsManager.tsx`

**Changes:**
- Updated `PrivateEvent` interface to include `price_per_seat`
- Added `price_per_seat` field to form state (default: 0)
- Added "Price Per Seat" input field in RSVP-enabled section:
  - Number input with step of 0.01
  - Min value: 0
  - Help text: "Cost per seat charged to member's account ledger when they RSVP. Leave at 0 for free events."
- Added price badge to event cards showing "$X.XX/seat" when price > 0
- Updated `handleSubmit` to include `price_per_seat` in both create and update operations
- Updated `handleEdit` to populate `price_per_seat` when editing events
- Updated `handleCloseModal` to reset `price_per_seat` to 0

**UI Features:**
- Price input appears only when RSVP is enabled
- Event cards display a badge with the per-seat price
- Price is only saved when RSVP is enabled (defaults to 0 otherwise)

---

## Transaction Flow

### When a Member RSVPs to a Paid Event:

1. **Member submits RSVP** via member portal
2. **Reservation created** in `reservations` table
3. **System checks** if event has `price_per_seat > 0`
4. **If yes:**
   - Finds member by email/phone
   - Calculates: `total_cost = price_per_seat * party_size`
   - Gets current balance from latest ledger entry
   - Calculates new balance: `new_balance = current_balance - total_cost`
   - Creates transaction in `member_ledger`:
     ```sql
     {
       member_id: [member's UUID],
       transaction_type: 'charge',
       amount: [total_cost],
       description: "Private Event: [Event Title] - [X] seat(s)",
       reference_id: [reservation_id],
       balance_after: [new_balance],
       metadata: {
         event_id: [event UUID],
         event_title: [event name],
         party_size: [number],
         price_per_seat: [price]
       }
     }
     ```
5. **SMS confirmation** sent to member
6. **Transaction appears** immediately in member's ledger

---

## Usage Guide

### For Admins - Creating a Paid Private Event:

1. Navigate to Private Events Manager
2. Click "Create Private Event"
3. Fill in basic event details (name, dates, description)
4. **Enable RSVP** checkbox
5. Set Max Guests Per Reservation (e.g., 10)
6. Set Total Event Capacity (e.g., 100)
7. **Set Price Per Seat** (e.g., 25.00 for $25 per seat)
8. Optionally check "Show in Member Portal Calendar"
9. Save event
10. Share RSVP link with members

### For Members - RSVPing to a Paid Event:

1. Access event via RSVP link or member portal calendar
2. Click RSVP/Register
3. **Review pricing** shown in modal:
   - "Price per seat: $X.XX"
   - Total cost updates as you change party size
4. Enter party size
5. Add any special requests (optional)
6. **Review total cost** in highlighted box
7. Submit RSVP
8. **Charge is automatically added to account ledger**
9. View transaction in Balance/Ledger page

---

## Testing Checklist

- [x] Database migration applied successfully
- [ ] Create new event with per-seat pricing via admin UI
- [ ] Verify event shows price badge in admin event list
- [ ] Edit existing event to add/change pricing
- [ ] Member views paid event in RSVP modal - sees pricing
- [ ] Member RSVPs to paid event with party size 1
- [ ] Verify transaction created in member_ledger
- [ ] Verify transaction shows correct amount
- [ ] Verify balance_after calculated correctly
- [ ] Member RSVPs with party size > 1
- [ ] Verify total cost = price_per_seat * party_size
- [ ] Member views transaction in balance page
- [ ] Create free event (price = 0)
- [ ] Verify no transaction created for free events
- [ ] Test with non-member RSVP (should not create transaction)

---

## Key Files Modified

1. **Database:**
   - `supabase/migrations/20260305_add_price_per_seat_to_private_events.sql`
   - `supabase/migrations/20260305_add_price_per_seat_to_private_events_ROLLBACK.sql`

2. **Backend:**
   - `src/app/api/rsvp/route.ts`

3. **Frontend:**
   - `src/components/member/RSVPModal.tsx`
   - `src/components/admin/PrivateEventsManager.tsx`

---

## Edge Cases Handled

1. **Non-member RSVPs:** System logs but doesn't fail if member not found
2. **Transaction failure:** RSVP still succeeds, error logged for manual resolution
3. **Free events:** No transaction created when price_per_seat = 0
4. **RSVP disabled:** Price field only saved when RSVP is enabled
5. **Balance calculation:** Uses most recent ledger entry for accurate running balance
6. **Existing events:** Migration adds column with default value 0 (free)

---

## Future Enhancements (Not Implemented)

- [ ] Per-table pricing option (currently per-seat only)
- [ ] Deposit/partial payment option
- [ ] Refund capability if RSVP cancelled
- [ ] Email confirmation of charge
- [ ] Payment method selection at RSVP time
- [ ] Early bird pricing (date-based pricing tiers)
- [ ] Group discount pricing
- [ ] Admin dashboard showing revenue per event
- [ ] Export event financials report

---

## Support Notes

### Viewing Event Charges:
- Members can view charges in their ledger at `/member/balance`
- Admin can view member ledgers in member detail page
- Transaction includes `reference_id` linking to reservation

### Modifying Charges:
- If a charge needs to be adjusted, create a new transaction entry
- Use transaction_type 'credit' to refund
- Include original reference_id in description for tracking

### Troubleshooting:
- Check member_ledger table for transaction records
- Verify member exists with matching email/phone
- Check reservation.private_event_id matches event.id
- Review API logs for transaction creation errors
