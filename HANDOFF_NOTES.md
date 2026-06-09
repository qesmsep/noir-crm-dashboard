# Code Review Fixes - Handoff Notes

## Current Status
Branch: `fix/code-review-inventory-improvements`
All changes committed and pushed (latest: 9a315a6)

## What Was Fixed (Latest Session)

### ✅ CRITICAL
- **recipes.ts regression**: Changed `const client = supabase` → `supabaseAdmin` (was breaking all recipe operations)
- **Rate limiting solution**: Added Vercel platform-level rate limiting for `/api/inventory/scan` (20 req/60s) in `vercel.json`

### ✅ HIGH SEVERITY
- x-vercel-forwarded-for for trusted IP (prevents spoofing)
- Migration RAISE WARNING → RAISE EXCEPTION (enforces order in CI)
- Strict rate limit (20/min) for scan endpoint via `withStrictRateLimitAndAuth`

### ✅ MEDIUM SEVERITY
- v_encryption_status: removed key names array (prevents metadata leakage)
- Monitoring: changed `user: req.user?.email` → `user_id: req.user?.id` (removes PII)

### ✅ BLOCKING FROM PRIOR REVIEWS
- encrypt-api-keys.js → TypeScript
- transaction_type validation in DB function
- pbkdf2Sync → async pbkdf2
- Transfer function: added location_id, quantity_before/after columns
- Deadlock handling with SQLSTATE '40P01'
- Advisory lock: two-argument form (reduces collisions)
- TransferSchema: supports fractional quantities

## Outstanding Issues from Latest Code Review

### 🟠 HIGH SEVERITY (Need to Address)

**H3. Scan loop errors are silent** (`src/pages/admin/inventory.tsx`)
```typescript
// Problem: handleScanConfirm loops with no error handling
for (const scanned of scannedItems) {
  await fetch('/api/inventory/transactions', { ... }); // error ignored
}
// Fix: Collect failures and surface to user after loop
```

**H4. No tests**
- PR test plan checklist is unchecked
- Need integration tests for withRateLimitAndAuth and transfer flow

### 🟡 MEDIUM SEVERITY

**M5. PBKDF2 iteration count** (`src/lib/crypto.ts`)
- Currently: 100,000 iterations
- NIST SP 800-132 (2023): recommends ≥210,000
- Consider increasing (may add latency)

**M6. Form submit not guarded** (`src/components/inventory/InventoryItemModal.tsx`)
- Submit button needs `disabled={saving}` to prevent double-submit via keyboard

**M7. Broken migration files**
- Delete `20260607_add_receipt_indexes.sql` (marked "DO NOT USE")
- Keep only `_IMPROVED` versions

**M8. recipes.ts POST missing location_id**
- New recipe creation doesn't accept/insert location_id
- Will fail if inventory_recipes.location_id is NOT NULL

### 🔵 LOW SEVERITY (Optional)
- Type cast in withRateLimitAndAuth
- Duplicate getAuthHeaders calls
- cleanup_old_monitoring_data step numbering

## Rate Limiting Decision Made

**Chose Vercel platform-level rate limiting** instead of Redis/Upstash because:
- This is an internal admin dashboard (~10-20 users)
- All endpoints require admin authentication
- Platform limiting protects expensive AI endpoint (biggest risk)
- Zero cost, zero complexity
- Adequate for threat model

Documented in `src/lib/rate-limiter.ts` with pragmatic mitigation strategy.

## Next Steps

1. **Fix scan loop error handling** (handleScanConfirm in inventory.tsx)
2. **Add location_id to recipe POST handler** (recipes.ts)
3. **Add disabled={saving} to submit button** (InventoryItemModal.tsx)
4. **Delete broken migration files** (keep only _IMPROVED versions)
5. *Optional*: Increase PBKDF2 iterations to 210k
6. *Optional*: Add integration tests

## Files Modified (Latest Session)
- vercel.json (rate limiting config)
- src/lib/rate-limiter.ts (updated docs)
- src/pages/api/inventory/recipes.ts (critical fix)

## Command to Continue Work
```bash
git checkout fix/code-review-inventory-improvements
git pull
# Address outstanding issues above
```
