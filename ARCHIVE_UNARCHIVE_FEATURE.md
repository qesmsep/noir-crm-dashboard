# Archive & Unarchive Members Feature

## Overview
Added the ability to view archived members and restore them to active status from the admin members page.

---

## What Was Added

### 1. ArchivedMembersModal Component
**File:** `src/components/ArchivedMembersModal.tsx`

A modal popup that displays all archived members with:
- Member photo/initials
- Name and primary/secondary badge
- Email and phone contact info
- "View Profile" button (navigates to member detail page)
- "Restore" button (unarchives the member)

**Features:**
- Fetches members where `deactivated = true`
- Real-time list refresh after unarchiving
- Responsive design (mobile-friendly)
- Loading and empty states
- Confirmation dialog before restoring

---

### 2. Unarchive API Endpoint
**File:** `src/pages/api/members/[memberId]/unarchive.js`

**Endpoint:** `POST /api/members/[memberId]/unarchive`

**What it does:**
1. Sets `deactivated: false` for the member
2. If secondary member:
   - Increases account `monthly_dues` by $25
   - Updates Stripe subscription to add/update "Additional Member" line item
   - Adjusts quantity based on total active secondary members

**Error Handling:**
- Returns 404 if member not found
- Returns 400 if member is already active
- Continues even if Stripe update fails (logs error)

---

### 3. View Archive Button
**Location:** Admin Members Page (`/admin/members`)

Added archive icon button next to "Add Member" button in the header.

**Icon:** Archive box SVG icon
**Tooltip:** "View Archived Members"

---

### 4. Styling
**File:** `src/styles/ArchivedMembersModal.module.css`

Responsive modal styles with:
- Overlay backdrop
- Centered modal container
- Member card grid
- Mobile-responsive layout (stacks vertically on small screens)
- Hover effects
- Action button states

---

## User Flow

### Archiving a Member (Existing Feature)
1. Admin opens member detail page
2. Clicks "Archive Member" button
3. Confirms deletion
4. Member is marked `deactivated: true`
5. Removed from active members list
6. If secondary member: Stripe subscription updated, monthly dues decreased

### Unarchiving a Member (New Feature)
1. Admin clicks archive icon on `/admin/members` page
2. Modal opens showing all archived members
3. Admin can:
   - **View Profile:** Click to navigate to member's account detail page
   - **Restore:** Click to unarchive member

4. When "Restore" is clicked:
   - Confirmation dialog appears
   - Member is marked `deactivated: false`
   - If secondary member: Stripe subscription updated, monthly dues increased
   - Success toast notification
   - Modal list refreshes
   - Main members list refreshes

---

## Technical Details

### Archive/Unarchive Symmetry

**Archive (DELETE `/api/members/[memberId]`):**
- Sets `deactivated: true`
- Decreases `monthly_dues` by $25 (secondary)
- Removes/decreases Stripe subscription quantity

**Unarchive (POST `/api/members/[memberId]/unarchive`):**
- Sets `deactivated: false`
- Increases `monthly_dues` by $25 (secondary)
- Adds/increases Stripe subscription quantity

**Result:** Archive and unarchive are fully reversible operations.

---

### Data Preservation

Archiving does NOT delete:
- Member record
- Account association
- Ledger transactions
- Member attributes
- Member notes
- Reservations
- Messages

Everything is preserved. Only the `deactivated` flag changes.

---

### Stripe Subscription Handling

When unarchiving a secondary member:

1. **Find "Additional Member" Price:**
   ```javascript
   const additionalMemberPrice = prices.data.find(p => {
     return p.product.name?.includes('additional') &&
            p.product.name?.includes('member') &&
            p.recurring?.interval === 'month';
   });
   ```

2. **Update or Create Line Item:**
   - If line item exists: Update quantity
   - If line item doesn't exist: Create new line item
   - Quantity = total active secondary members

3. **Update Monthly Dues:**
   - `newMonthlyDues = currentMonthlyDues + 25`

---

## UI Components

### Archive Button Icon
```svg
<svg viewBox="0 0 20 20">
  <path d="M5 8h10M5 8a2 2 0 110-4h10a2 2 0 110 4M5 8v10a2 2 0 002 2h6a2 2 0 002-2V8m-3 4h2"
        stroke="currentColor" strokeWidth="1.5"/>
</svg>
```

### Modal Layout
```
┌────────────────────────────────────┐
│ Archived Members              [X]  │
├────────────────────────────────────┤
│                                    │
│  [Photo] John Doe (Primary)        │
│          john@email.com            │
│          (555) 123-4567            │
│          [View Profile] [Restore]  │
│                                    │
│  [Photo] Jane Smith                │
│          jane@email.com            │
│          (555) 987-6543            │
│          [View Profile] [Restore]  │
│                                    │
└────────────────────────────────────┘
```

---

## Testing Checklist

### Test Archive → Unarchive Flow
- [ ] Archive a primary member
- [ ] Verify they disappear from members list
- [ ] Open "View Archive" modal
- [ ] Verify archived member appears
- [ ] Click "Restore"
- [ ] Confirm restoration
- [ ] Verify member reappears in main list
- [ ] Verify member is active (`deactivated: false`)

### Test Secondary Member Stripe Sync
- [ ] Archive secondary member
- [ ] Verify Stripe subscription decreases by 1 quantity
- [ ] Verify monthly dues decreased by $25
- [ ] Unarchive secondary member
- [ ] Verify Stripe subscription increases by 1 quantity
- [ ] Verify monthly dues increased by $25

### Test View Profile from Modal
- [ ] Open archived members modal
- [ ] Click "View Profile" on archived member
- [ ] Verify navigates to correct member detail page
- [ ] Verify can still see member data
- [ ] Verify can unarchive from detail page (future feature)

### Test Edge Cases
- [ ] Archive last secondary member → verify line item removed
- [ ] Unarchive first secondary member → verify line item created
- [ ] Archive/unarchive multiple times → verify idempotent
- [ ] Unarchive already active member → verify error

---

## Future Enhancements

1. **Unarchive from Detail Page:**
   - Add "Unarchive" button on member detail page for archived members
   - Currently can only unarchive from modal

2. **Archive Reason:**
   - Add optional "Reason for archiving" field
   - Store in `archived_reason` column
   - Display in modal

3. **Archive Date:**
   - Add `archived_at` timestamp
   - Show how long member has been archived

4. **Bulk Operations:**
   - Select multiple archived members
   - Bulk restore functionality

5. **Permanent Delete:**
   - Add "Delete Permanently" option for truly removing members
   - Only accessible from archive modal
   - Requires super admin permission

---

## Summary

Archive/unarchive is now fully bidirectional:
- ✅ Archive removes from active list (preserves data)
- ✅ View archived members in modal
- ✅ Unarchive restores to active list
- ✅ Stripe subscriptions stay in sync
- ✅ Monthly dues stay accurate
- ✅ All member data preserved

Members are never truly deleted, just hidden from the active list.
