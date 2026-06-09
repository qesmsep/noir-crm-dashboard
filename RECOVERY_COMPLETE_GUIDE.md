# 🔄 Inventory System Recovery Complete Guide

## Current Status: PARTIALLY RECOVERED
**Database:** ✅ 100% Intact
**Core Security:** ✅ Recovered
**APIs:** ⚠️  Need Recreation
**Components:** ⚠️  Need Recreation

---

## ✅ What's Already Working (Database)

### Tables & Columns
- ✅ `inventory_items` has `location_id`
- ✅ `inventory_transactions` has `location_id`
- ✅ `inventory_recipes` has `location_id`
- ✅ `inventory_sales_records` table exists

### Database Functions (All Working!)
```sql
-- Check they exist:
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name LIKE '%inventory%';

Results:
✅ adjust_inventory_quantity          -- Atomic updates, prevents race conditions
✅ check_inventory_availability       -- Pre-flight stock checks
✅ copy_inventory_to_location         -- Clone inventory between locations
✅ process_sales_adjustments          -- Batch sales processing
```

### Data Integrity
- ✅ Noir KC: 17 inventory items
- ✅ RooftopKC: 36 inventory items, 14 recipes
- ✅ All items properly linked to locations

---

## 📁 Files Recovered

### ✅ Security Infrastructure (COMPLETE)
```
src/lib/
  ✅ api-auth.ts             - Admin authentication middleware
  ✅ inventory-validation.ts - Zod schemas for input validation
```

### ❌ Missing API Endpoints (NEED RECREATION)
```
src/pages/api/inventory/
  ❌ process-sales-report.ts    - Sales CSV/TSV processing with verification
  ❌ calculate-recipe-cost.ts   - Automatic recipe cost calculation
```

### ⚠️ Existing APIs Need Security Updates
```
src/pages/api/inventory/
  ⚠️  index.ts         - Add: auth, location filtering, validation
  ⚠️  transactions.ts  - Add: auth, atomic updates, location_id
  ⚠️  recipes.ts       - Add: auth, location filtering
  ⚠️  settings.ts      - Add: auth
```

### ❌ Missing Components (NEED RECREATION)
```
src/components/inventory/
  ❌ InventoryItemModal.tsx      - Radix UI modal (replaces drawer)
  ❌ EnhancedSalesUpload.tsx     - Sales upload with verification UI
```

### ⚠️ Pages Need Updates
```
src/pages/admin/
  ⚠️  inventory.tsx - Add: location selector dropdown, import new modal
```

---

## 🔐 Security Features to Restore

### 1. Authentication (Priority: CRITICAL)
**What:** All inventory endpoints require admin JWT token
**Why:** Currently anyone can read/modify inventory
**Files:** All `/api/inventory/*.ts`
**Pattern:**
```typescript
import { withAdminAuth, AuthenticatedRequest } from '../../../lib/api-auth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Your handler code
}

export default withAdminAuth(handler);
```

### 2. Input Validation (Priority: HIGH)
**What:** Validate all POST/PUT request bodies
**Why:** Prevents malformed data, SQL injection attempts
**Files:** `index.ts`, `transactions.ts`, `recipes.ts`
**Pattern:**
```typescript
import { InventoryItemSchema, validateRequest, formatZodErrors } from '../../../lib/inventory-validation';

const validation = validateRequest(InventoryItemSchema, req.body);
if (!validation.success) {
  return res.status(400).json({
    error: 'Invalid input',
    details: formatZodErrors(validation.errors)
  });
}
```

### 3. Atomic Updates (Priority: HIGH)
**What:** Use database functions instead of read-modify-write
**Why:** Prevents race conditions under concurrent access
**File:** `transactions.ts`
**Pattern:**
```typescript
// OLD (Race condition):
const item = await getItem(id);
const newQty = item.quantity - change;
await updateItem(id, newQty);

// NEW (Atomic):
const { data } = await client.rpc('adjust_inventory_quantity', {
  p_item_id: id,
  p_quantity_change: change,
  p_transaction_type: type,
  p_created_by: req.user?.email
});
```

### 4. Location Filtering (Priority: MEDIUM)
**What:** Filter inventory by location_slug
**Why:** Multi-location support
**Files:** `index.ts`, `recipes.ts`
**Pattern:**
```typescript
const { location_slug } = req.query;
const { data: location } = await client
  .from('locations')
  .select('id')
  .eq('slug', location_slug)
  .single();

query = query.eq('location_id', location.id);
```

### 5. CSV Security (Priority: HIGH)
**What:** Disable dynamic typing, add file size limits
**Why:** Prevent injection attacks
**File:** `process-sales-report.ts`
**Pattern:**
```typescript
Papa.parse(csv_content, {
  dynamicTyping: false,  // CRITICAL: Disable auto type conversion
  maxRows: 10000,        // Prevent DOS
});

// Validate CSV size
if (csv_content.length > 1024 * 1024) {
  return res.status(400).json({ error: 'File too large' });
}
```

---

## 🚀 Recovery Steps (In Order)

### Step 1: Update Existing APIs with Security ⚠️
```bash
# Add auth + validation to:
1. src/pages/api/inventory/index.ts
2. src/pages/api/inventory/transactions.ts
3. src/pages/api/inventory/recipes.ts
4. src/pages/api/inventory/settings.ts
```

### Step 2: Recreate Sales Processing API ❌
```bash
# Critical for RooftopKC sales imports
File: src/pages/api/inventory/process-sales-report.ts
Features:
- TSV/CSV parsing (Tab or comma delimited)
- Aggregate duplicates (Buffalo Trace, Tito's, etc)
- Match cocktails → recipes → ingredient deduction
- Match spirits → direct inventory deduction
- Verification mode (preview before applying)
- Block processing if out of stock
- 1MB file size limit
- No dynamic typing (security)
```

### Step 3: Recreate Recipe Cost Calculator ❌
```bash
# Auto-calculate recipe costs based on ingredients
File: src/pages/api/inventory/calculate-recipe-cost.ts
Features:
- Calculate total cost from ingredients
- Unit conversions (oz ↔ bottle, ml ↔ bottle)
- Profit margin calculations
- Stock availability checks
```

### Step 4: Recreate Radix UI Modal ❌
```bash
# Replace drawer with modal
File: src/components/inventory/InventoryItemModal.tsx
Uses: @radix-ui/react-dialog (already installed)
Features:
- Add/Edit inventory items
- Delete confirmation
- Mobile responsive
- Cork theme colors
```

### Step 5: Recreate Enhanced Sales Upload ❌
```bash
# UI for sales report uploads
File: src/components/inventory/EnhancedSalesUpload.tsx
Features:
- CSV file upload or manual paste
- Verification results display
- Out of stock warnings
- Low stock warnings
- Unmatched items list
```

### Step 6: Update Main Inventory Page ⚠️
```bash
File: src/pages/admin/inventory.tsx
Changes:
- Add location selector dropdown
- Import InventoryItemModal (not Drawer)
- Filter data by location
- Import EnhancedSalesUpload
```

---

## 🧪 Testing Recovery

### Test 1: Database Functions
```sql
-- Test atomic update
SELECT adjust_inventory_quantity(
  '<item_id>',
  -5,
  'sales',
  'Test deduction',
  'test@noirkc.com'
);

-- Should return JSONB with before/after quantities
```

### Test 2: Authentication
```bash
# Should fail (401)
curl http://localhost:3000/api/inventory

# Should succeed with valid token
curl -H "Authorization: Bearer <JWT>" \
  http://localhost:3000/api/inventory?location_slug=rooftopkc
```

### Test 3: Location Filtering
```bash
# Should return only RooftopKC items (36 items)
curl -H "Authorization: Bearer <JWT>" \
  "http://localhost:3000/api/inventory?location_slug=rooftopkc"

# Should return only Noir KC items (17 items)
curl -H "Authorization: Bearer <JWT>" \
  "http://localhost:3000/api/inventory?location_slug=noirkc"
```

### Test 4: Sales Processing
```bash
# Upload the RooftopKC Saturday sales report
# Should:
- Aggregate 43 rows → 38 unique items
- Match 12 cocktails to recipes
- Match 9 spirits directly
- Total revenue: $2,777
- Warn about any insufficient stock
```

---

## 📊 Progress Tracker

### Core Infrastructure
- [x] Database migrations applied
- [x] Atomic functions created
- [x] api-auth.ts recreated
- [x] inventory-validation.ts recreated

### API Endpoints
- [ ] index.ts - Add auth + location filtering
- [ ] transactions.ts - Add auth + atomic updates
- [ ] recipes.ts - Add auth + location filtering
- [ ] settings.ts - Add auth
- [ ] process-sales-report.ts - RECREATE
- [ ] calculate-recipe-cost.ts - RECREATE

### Components
- [ ] InventoryItemModal.tsx - RECREATE
- [ ] EnhancedSalesUpload.tsx - RECREATE

### Pages
- [ ] inventory.tsx - Add location selector

---

## 💾 Backup Strategy Going Forward

To prevent future data loss:

1. **Commit frequently** to git
2. **Tag important milestones**
3. **Keep migrations separate** from application code
4. **Document database functions** in migration files
5. **Export database schema** periodically

---

## 🆘 Quick Reference

### Get Current Location IDs
```sql
SELECT id, slug, name FROM locations;
```

### Check Inventory by Location
```sql
SELECT l.name, COUNT(i.*) as items
FROM locations l
LEFT JOIN inventory_items i ON i.location_id = l.id
GROUP BY l.name;
```

### List All Atomic Functions
```sql
\df adjust_inventory_quantity
\df process_sales_adjustments
\df check_inventory_availability
```

### Test Sales Import Format
```
Menu Item	Menu Group	Menu	Item Qty	Net Amount
Espresso Martini	Noir Signatures	RooftopKC	18	$260.00
Tito's	Vodka	Liquor	8	$112.00
```

---

**Next Action:** Continue with Step 1 - Update existing APIs with security