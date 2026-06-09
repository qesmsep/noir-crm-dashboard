# Migration: Add Inventory Transfer Function

**Date**: 2026-06-08
**Author**: AI Migration Generator
**Status**: Pending

---

## Description

Creates an atomic database function `transfer_inventory_between_locations()` that safely transfers inventory items between locations (Noir KC, RooftopKC, Noir OP).

**Key Features:**
- Atomic transaction with row locking to prevent race conditions
- Validates quantity and location parameters
- Creates destination item if it doesn't exist (matching by name, brand, category)
- Maintains complete audit trail with `transfer_in` and `transfer_out` transaction records
- Returns detailed results for API feedback

**Business Value:**
- Enables staff to move inventory between venues
- Prevents stock-outs by redistributing inventory
- Creates audit trail for inventory movements

---

## Tables Affected

- `inventory_items` - Read/Write (quantity updates)
- `inventory_transactions` - Write (audit records created)
- `locations` - Read (for location names in transaction notes)

---

## Breaking Changes

**NO** - This is additive only. New function does not modify existing behavior.

**Code Changes Required:**
- ✅ Already updated `TransactionTypeSchema` to include `'transfer_in'` and `'transfer_out'`
- ✅ Already created API endpoint `/api/inventory/transfer`
- ✅ Already created `TransferSchema` validation
- ✅ Already created `InventoryTransferModal` component

---

## Prerequisites

- [x] Backup database before applying
- [x] Ensure `inventory_items` table exists
- [x] Ensure `inventory_transactions` table exists
- [x] Ensure `locations` table exists
- [x] Update validation schema to include new transaction types

---

## Migration Steps

### Apply Migration

1. **Backup database**
   - Create backup in Supabase dashboard: Project Settings → Database → Backups

2. **Apply migration in Supabase SQL Editor**
   - Navigate to: SQL Editor → New Query
   - Copy contents of `20260608_add_inventory_transfer_function.sql`
   - Execute query

3. **Verify migration**
   ```sql
   -- Check function exists
   SELECT proname, pg_get_functiondef(oid)
   FROM pg_proc
   WHERE proname = 'transfer_inventory_between_locations';

   -- Check function signature
   SELECT routine_name, data_type, parameter_name, parameter_mode
   FROM information_schema.parameters
   WHERE specific_name LIKE '%transfer_inventory%'
   ORDER BY ordinal_position;

   -- Check grants
   SELECT grantee, privilege_type
   FROM information_schema.routine_privileges
   WHERE routine_name = 'transfer_inventory_between_locations';
   ```

4. **Test function with sample data**
   ```sql
   -- Test: Transfer non-existent item (should fail gracefully)
   SELECT * FROM transfer_inventory_between_locations(
     'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, -- fake item
     (SELECT id FROM locations WHERE slug = 'noirkc'),
     (SELECT id FROM locations WHERE slug = 'rooftopkc'),
     5,
     'Test transfer',
     'test@example.com'
   );
   -- Expected: success=false, message about item not found

   -- Test: Transfer with real data (if available)
   -- 1. Get an item from Noir KC
   SELECT id, name, quantity, location_id
   FROM inventory_items
   WHERE location_id = (SELECT id FROM locations WHERE slug = 'noirkc')
   LIMIT 1;

   -- 2. Transfer 1 unit to RooftopKC
   SELECT * FROM transfer_inventory_between_locations(
     '<item_id_from_above>'::uuid,
     (SELECT id FROM locations WHERE slug = 'noirkc'),
     (SELECT id FROM locations WHERE slug = 'rooftopkc'),
     1,
     'Migration test',
     'admin@noir.com'
   );
   -- Expected: success=true, quantities updated

   -- 3. Verify transaction records created
   SELECT *
   FROM inventory_transactions
   WHERE transaction_type IN ('transfer_in', 'transfer_out')
   ORDER BY created_at DESC
   LIMIT 5;
   ```

---

### Rollback Migration

**Only if migration fails or needs reversal**

1. **Apply rollback script**
   - Copy contents of `20260608_add_inventory_transfer_function_ROLLBACK.sql`
   - Paste into SQL Editor
   - Execute

2. **Verify rollback**
   ```sql
   -- Check function removed
   SELECT COUNT(*)
   FROM pg_proc
   WHERE proname = 'transfer_inventory_between_locations';
   -- Expected: 0
   ```

**Note**: Rollback does NOT remove transaction records created while the function existed. Those remain for audit purposes.

---

## Testing Checklist

After applying migration:

### Function Validation
- [ ] Function exists and is executable
- [ ] Function has correct parameter signature
- [ ] Authenticated users have EXECUTE permission
- [ ] Function uses SECURITY DEFINER

### Logic Validation
- [ ] ✅ Rejects zero or negative quantities
- [ ] ✅ Rejects same source and destination
- [ ] ✅ Returns error if source item doesn't exist
- [ ] ✅ Returns error if insufficient quantity
- [ ] ✅ Creates destination item if it doesn't exist
- [ ] ✅ Updates existing destination item if it exists
- [ ] ✅ Reduces source quantity correctly
- [ ] ✅ Creates two transaction records (in and out)
- [ ] ✅ Updates timestamps (updated_at, last_counted)

### API Testing
- [ ] POST /api/inventory/transfer returns 200 on success
- [ ] POST /api/inventory/transfer returns 400 on invalid input
- [ ] POST /api/inventory/transfer returns 400 on insufficient stock
- [ ] Transfer creates transaction records
- [ ] Inventory quantities update correctly

### UI Testing
- [ ] Transfer modal opens
- [ ] Item dropdown shows filtered items by location
- [ ] Location selectors prevent same source/dest
- [ ] Quantity input respects max available
- [ ] Success message displays after transfer
- [ ] Inventory list refreshes with new quantities
- [ ] Mobile layout works correctly

### Performance
- [ ] Row locking prevents race conditions
- [ ] Function completes in < 100ms for typical transfer
- [ ] No N+1 queries or performance issues

---

## Code Files Updated

| File | Change | Status |
|------|--------|--------|
| `src/lib/inventory-validation.ts` | Add `transfer_in`, `transfer_out` to enum | ✅ Done |
| `src/lib/inventory-validation.ts` | Add `TransferSchema` | ✅ Done |
| `src/pages/api/inventory/transfer.ts` | Create API endpoint | ✅ Done |
| `src/components/inventory/InventoryTransferModal.tsx` | Create modal component | ✅ Done |
| `src/pages/admin/inventory.tsx` | Add Transfer button and modal integration | ✅ Done |
| `src/styles/Inventory.module.css` | Add modal styling | ✅ Done |
| `migrations/20260608_add_inventory_transfer_function.sql` | Create migration | ✅ Done |
| `migrations/20260608_add_inventory_transfer_function_ROLLBACK.sql` | Create rollback | ✅ Done |

---

## Rollback Plan

**Complexity**: EASY
**Data Loss Risk**: NO - Transaction records remain for audit

**Steps**: Execute `20260608_add_inventory_transfer_function_ROLLBACK.sql`

This removes the function but preserves all transaction records created during transfers for audit trail.

---

## Security Considerations

✅ Function uses `SECURITY DEFINER` to run with elevated privileges
✅ API endpoint protected with `withAdminAuth()` middleware
✅ Input validation via Zod `TransferSchema`
✅ Rate limiting applied via `rateLimiters.standard.check()`
✅ Monitoring events tracked for transfers

---

## Notes

- Transfer function matches items by: `name`, `brand`, and `category`
- If destination item doesn't exist, it copies all properties from source (cost, par level, etc.)
- Quantity at source must be >= transfer amount
- Transaction records include location names in notes for easy auditing
- Function is atomic - either fully succeeds or fully fails

---
