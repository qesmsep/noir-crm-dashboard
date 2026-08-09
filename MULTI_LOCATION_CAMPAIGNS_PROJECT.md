# Multi-Location Campaign Support - Project State Document

**Project**: Add Multi-Location Support to Campaigns System
**Status**: 🟡 Phase 1 Ready for Review & Application
**Last Updated**: 2026-04-24
**Estimated Completion**: 4-6 weeks (5 phases)

---

## 🎯 Project Overview

### Business Goal
Enable campaigns to be assigned to specific locations (NoirKC, RooftopKC, future locations) instead of applying to all locations globally.

### Technical Goal
- Add multi-location support via junction table pattern
- Consolidate `reservation_reminder_templates` into campaigns system
- Make system scalable for 3+ future locations

### Why This Matters
- Different locations have different customer bases
- RooftopKC may need different messaging than NoirKC
- Prevents inappropriate cross-location messaging
- Prepares for future expansion to additional venues

---

## 📊 Current State (As of 2026-04-24)

### What Exists Now

**Tables**:
- ✅ `campaigns` - 5 existing campaigns, no location awareness
- ✅ `campaign_messages` - messages for campaigns
- ✅ `reservation_reminder_templates` - 3 templates (old system, to be deprecated)
- ✅ `scheduled_reservation_reminders` - old system
- ✅ `locations` - NoirKC and RooftopKC exist
- ✅ `reservations` - has `table_id` → tables.location_id (indirect)
- ✅ `tables` - has `location_id` (direct reference)

**Active Systems**:
1. **Campaign System** - `"Noir Reservation Reminder"` campaign (active)
2. **Template System** - `"ACCESS"` template (active, 1 hour before)

**Problem**: Both systems running, no location filtering, potential duplicates

### What's Been Done

1. ✅ **Research Phase** - Analyzed existing multi-location pattern
2. ✅ **Architecture Review** - Senior agent identified 8 critical issues
3. ✅ **Phase 1 Migration Created** - Infrastructure-only, production-safe
4. ⏳ **Waiting for Application** - Ready to apply to database

---

## 🗂️ Files Created (Ready to Use)

### Migration Files
Located in: `supabase/migrations/`

1. **`20260424_phase1_campaign_locations_infrastructure.sql`**
   - Forward migration (creates infrastructure)
   - 450+ lines, fully commented
   - Creates tables, indexes, triggers, functions
   - **Safe to apply - no behavioral changes**

2. **`20260424_phase1_campaign_locations_infrastructure_ROLLBACK.sql`**
   - Reverses Phase 1 completely
   - Zero data loss risk
   - Can apply at any time

3. **`20260424_phase1_campaign_locations_infrastructure_README.md`**
   - 500+ line comprehensive guide
   - Architecture decisions explained
   - Step-by-step instructions
   - Testing checklist
   - Troubleshooting guide

### This Document
- **`MULTI_LOCATION_CAMPAIGNS_PROJECT.md`** (this file)
  - Project state and resume guide

---

## 🔄 5-Phase Migration Plan

### Phase 1: Infrastructure (READY TO APPLY) ✅

**Status**: 🟢 Complete, awaiting database application
**Risk Level**: 🟢 Low (no behavioral changes)
**Estimated Time**: 15 minutes to apply
**Rollback Time**: < 5 minutes

**What it does**:
- Creates `campaign_locations` junction table
- Adds `location_id` to `reservations` table
- Adds `applies_to_all_locations` flag to `campaigns`
- Creates indexes for performance
- Adds RLS policies
- Creates helper functions

**What it does NOT do**:
- Does not modify any existing data
- Does not change application behavior
- Does not require code changes
- Does not affect campaign processing

**Files**:
- `supabase/migrations/20260424_phase1_campaign_locations_infrastructure.sql`
- `supabase/migrations/20260424_phase1_campaign_locations_infrastructure_ROLLBACK.sql`
- `supabase/migrations/20260424_phase1_campaign_locations_infrastructure_README.md`

**To Apply Phase 1**:
```bash
# 1. Backup database in Supabase Dashboard
# 2. Open SQL Editor
# 3. Copy/paste contents of migration file
# 4. Execute
# 5. Run verification queries (in README)
# 6. Monitor for 48 hours before Phase 2
```

---

### Phase 2: Data Backfill (NOT STARTED) ⏳

**Status**: 🔴 Not Created Yet
**Risk Level**: 🟡 Medium (modifies existing data)
**Estimated Time**: 1 hour to create, 30 min to apply

**What it will do**:
- Backfill `reservations.location_id` from `tables.location_id` where `table_id` exists
- Assign all existing campaigns to NoirKC location (default)
- Verify data integrity
- Set `applies_to_all_locations=true` for "Noir Reservation Reminder" campaign (decision needed)

**Decisions Needed Before Creating Phase 2**:
- [ ] Which existing campaigns should be NoirKC-only vs All Locations?
- [ ] How to handle reservations without `table_id`? (assign to NoirKC default?)
- [ ] Verify all tables have `location_id` populated

**Prerequisites**:
- Phase 1 applied successfully
- 48-hour monitoring period passed
- No issues detected from Phase 1

**To Create Phase 2** (when ready):
```bash
# Use migration-generator agent
/migration-gen Backfill location_id on reservations from tables. Assign existing campaigns to NoirKC location. Phase 2 of multi-location campaign support.
```

---

### Phase 3: Migrate Templates → Campaigns (NOT STARTED) ⏳

**Status**: 🔴 Not Created Yet
**Risk Level**: 🟡 Medium (consolidates two systems)
**Estimated Time**: 2-3 hours to create, 1 hour to apply

**What it will do**:
- Create campaigns from active `reservation_reminder_templates`
- Map `reminder_type` (day_of/hour_before) → campaign `timing_type`
- Assign migrated campaigns to all locations initially
- Keep old tables for backward compatibility (mark deprecated)

**Template Mapping**:
```
"ACCESS" (hour_before, 1 hour)
  → Campaign: "Reservation Reminder - 1 Hour Before"
  → timing_type: 'relative'
  → relative_proximity: 'before'
  → relative_quantity: 1
  → relative_unit: 'hour'

"Access Instructions" (day_of, 15:00)
  → Campaign: "Reservation Reminder - Day Of 3PM"
  → timing_type: 'specific_time'
  → specific_time: '15:00'
```

**Prerequisites**:
- Phase 2 applied successfully
- Data backfill verified
- Decision on which templates to migrate

**To Create Phase 3** (when ready):
```bash
# Use migration-generator agent
/migration-gen Migrate reservation_reminder_templates to campaigns system. Phase 3 of multi-location campaign support.
```

---

### Phase 4: Update Code & UI (NOT STARTED) ⏳

**Status**: 🔴 Not Created Yet
**Risk Level**: 🔴 High (changes application behavior)
**Estimated Time**: 1-2 weeks

**What it will do**:
- Add location filtering to campaign processing
- Update admin UI with location multi-select
- Add feature flag for gradual rollout
- Update TypeScript types
- Add location display to campaign lists

**Files to Modify**:
1. `src/types/index.ts` - Add Campaign location types
2. `src/pages/api/process-campaign-messages.ts` - Add location filtering (lines 211-215, 285-289)
3. `src/components/CampaignDrawer.tsx` - Add location multi-select UI
4. `src/pages/admin/communication.tsx` - Display campaign locations
5. Add feature flag: `FEATURE_LOCATION_CAMPAIGNS=false`

**Code Changes Needed**:

**1. Update TypeScript Types** (`src/types/index.ts`):
```typescript
export interface Campaign {
  // ... existing fields ...
  applies_to_all_locations?: boolean;
  location_ids?: string[]; // From campaign_locations join
}

export interface CampaignLocation {
  campaign_id: string;
  location_id: string;
  created_at: string;
}
```

**2. Update Campaign Processing** (`src/pages/api/process-campaign-messages.ts`):
```typescript
// Around line 211-215
// BEFORE:
const { data: reservationData, error: reservationError } = await supabaseAdmin
  .from('reservations')
  .select('phone, start_time, end_time, party_size')
  .gte('start_time', searchStart)
  .lte('start_time', searchEnd);

// AFTER (with location filtering):
const { data: reservationData, error: reservationError } = await supabaseAdmin
  .from('reservations')
  .select(`
    phone,
    start_time,
    end_time,
    party_size,
    location_id
  `)
  .gte('start_time', searchStart)
  .lte('start_time', searchEnd);

// Filter by campaign locations
if (!campaign.applies_to_all_locations) {
  const locationIds = await getCampaignLocationIds(campaign.id);
  reservationData = reservationData.filter(r =>
    locationIds.includes(r.location_id)
  );
}
```

**3. Add Location Multi-Select UI** (`src/components/CampaignDrawer.tsx`):
```typescript
// Add to component state (around line 70)
const [locations, setLocations] = useState<Array<{id: string; name: string}>>([]);
const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

// Add to formData (around line 76)
const [formData, setFormData] = useState({
  // ... existing fields ...
  applies_to_all_locations: false,
});

// Fetch locations (around line 90)
useEffect(() => {
  fetchLocations();
}, []);

const fetchLocations = async () => {
  const { data } = await supabase
    .from('locations')
    .select('id, name, slug')
    .eq('status', 'active')
    .order('name');
  setLocations(data || []);
};

// Add UI component (around line 580)
<FormControl>
  <FormLabel>Locations</FormLabel>
  <Checkbox
    isChecked={formData.applies_to_all_locations}
    onChange={(e) => handleInputChange('applies_to_all_locations', e.target.checked)}
  >
    Apply to all locations
  </Checkbox>
  {!formData.applies_to_all_locations && (
    <CheckboxGroup value={selectedLocationIds} onChange={setSelectedLocationIds}>
      <Stack>
        {locations.map((location) => (
          <Checkbox key={location.id} value={location.id}>
            {location.name}
          </Checkbox>
        ))}
      </Stack>
    </CheckboxGroup>
  )}
</FormControl>
```

**Prerequisites**:
- Phase 3 applied successfully
- Templates migrated
- Feature flag system ready
- Testing environment available

---

### Phase 5: Deprecation & Cleanup (NOT STARTED) ⏳

**Status**: 🔴 Not Created Yet
**Risk Level**: 🟡 Medium
**Estimated Time**: 1 week

**What it will do**:
- Mark old reservation reminder APIs as deprecated
- Add console warnings to old system usage
- Create views to redirect old queries (if needed)
- Remove old tables after 30-day grace period

**Prerequisites**:
- Phase 4 deployed to production
- 2+ weeks of monitoring
- Zero duplicate messages confirmed
- Stakeholder approval

---

## 🚨 Critical Issues Identified (All Addressed in Phase 1)

A senior database architect agent reviewed the original plan and found **8 critical issues**. All have been addressed:

| # | Issue | How Phase 1 Addresses It |
|---|-------|--------------------------|
| 1 | Reservation reminder system will break | Phase 1 doesn't touch it (Phase 3+ handles migration) |
| 2 | CASCADE deletion data loss risk | Changed to `ON DELETE RESTRICT` + validation trigger |
| 3 | Empty junction table ambiguity | Added explicit `applies_to_all_locations` flag |
| 4 | Reservations may not have table_id | Added direct `location_id` column to reservations |
| 5 | No rollback strategy | Complete rollback script provided for all phases |
| 6 | Race conditions (dual system) | Phased approach prevents old/new overlap |
| 7 | Performance concerns with JOINs | Proper indexes + direct location_id column |
| 8 | Orphaned campaigns on location delete | Validation trigger prevents deletion |

**Review Document**: See conversation history for full 10-section senior architect review

---

## 📋 Decisions Made

### Architecture Decisions

1. **Junction Table vs Single Column**
   - ✅ **Decision**: Use junction table (`campaign_locations`)
   - **Reason**: Supports 1 campaign → many locations (future 3+ locations)
   - **Alternative**: Single `location_id` column (rejected - can't scale)

2. **How to Handle "All Locations"**
   - ✅ **Decision**: Explicit `applies_to_all_locations` flag
   - **Reason**: Removes ambiguity of empty junction table
   - **Alternative**: NULL in junction table (rejected - ambiguous)

3. **Location Reference on Reservations**
   - ✅ **Decision**: Direct `location_id` column
   - **Reason**: Reservations may not have `table_id` when created
   - **Alternative**: Always use JOIN through tables (rejected - fragile)

4. **Deletion Safety**
   - ✅ **Decision**: `ON DELETE RESTRICT` for locations
   - **Reason**: Prevents accidental data loss
   - **Alternative**: `ON DELETE CASCADE` (rejected - too dangerous)

5. **Migration Strategy**
   - ✅ **Decision**: 5 separate phases over 4-6 weeks
   - **Reason**: Minimize risk, allow monitoring between phases
   - **Alternative**: Single big-bang migration (rejected - too risky)

### Business Decisions Needed

**Before Phase 2**:
- [ ] Should existing campaigns default to NoirKC-only or All Locations?
  - Current plan: NoirKC-only
  - Alternative: All locations (safer but less specific)

- [ ] How to handle "Noir Reservation Reminder" campaign?
  - Option A: NoirKC-only (rename to "NoirKC Reservation Reminder")
  - Option B: All locations (keep name generic)
  - **Recommendation**: Option B (all locations) to maintain current behavior

**Before Phase 3**:
- [ ] Which `reservation_reminder_templates` to migrate?
  - Active templates only?
  - Include inactive templates for historical reference?

- [ ] Should migrated campaigns be location-specific initially?
  - Recommendation: All locations initially, let admin adjust

**Before Phase 4**:
- [ ] When to enable feature flag in production?
  - Recommendation: Enable for RooftopKC only first (new location)
  - Monitor for 1 week, then enable for NoirKC

---

## 🔧 How to Resume This Project

### If You're Picking This Up Today

1. **Read this document** (you're doing it!)
2. **Review Phase 1 README**: `supabase/migrations/20260424_phase1_campaign_locations_infrastructure_README.md`
3. **Review Phase 1 migration SQL**: `supabase/migrations/20260424_phase1_campaign_locations_infrastructure.sql`
4. **Apply Phase 1** (see instructions below)
5. **Monitor for 48 hours**
6. **Come back to plan Phase 2**

### If You're Picking This Up After Computer Reset

1. **Clone repo**: `git clone <repo-url>` (if needed)
2. **Read this document**: `MULTI_LOCATION_CAMPAIGNS_PROJECT.md`
3. **Check which phase was completed**:
   ```sql
   -- In Supabase SQL Editor, check if Phase 1 applied
   SELECT COUNT(*) FROM information_schema.tables
   WHERE table_name = 'campaign_locations';
   -- Result = 1 means Phase 1 is applied
   -- Result = 0 means Phase 1 not yet applied
   ```
4. **Resume at appropriate phase** (see phase checklist below)

### If You're Picking This Up in 1+ Months

1. **Read this document** thoroughly
2. **Check production state**:
   ```sql
   -- Which phase is production on?

   -- Phase 1 check
   SELECT EXISTS (
     SELECT 1 FROM information_schema.tables
     WHERE table_name = 'campaign_locations'
   ) as phase_1_applied;

   -- Phase 2 check
   SELECT
     COUNT(*) as total,
     COUNT(location_id) as with_location
   FROM reservations;
   -- If with_location > 0, Phase 2 likely applied

   -- Phase 3 check
   SELECT COUNT(*) FROM campaigns
   WHERE name LIKE '%Reservation Reminder%';
   -- If > 1, Phase 3 likely applied (templates migrated)

   -- Phase 4 check
   -- Check git history for changes to process-campaign-messages.ts
   ```
3. **Review what was done** (check git commits)
4. **Resume at next phase**

---

## 📝 Quick Start Commands

### Apply Phase 1 (First Time)

```bash
# 1. Navigate to project
cd /Users/qesmsep/noir-crm-dashboard

# 2. Open Supabase Dashboard
open "https://supabase.com/dashboard/project/<your-project-id>"

# 3. Go to SQL Editor

# 4. Copy migration contents
cat supabase/migrations/20260424_phase1_campaign_locations_infrastructure.sql | pbcopy

# 5. Paste in SQL Editor and Execute

# 6. Verify success
cat supabase/migrations/20260424_phase1_campaign_locations_infrastructure_README.md
# (See "Verify Migration Success" section)
```

### Check Current Phase Status

```sql
-- Run in Supabase SQL Editor

-- Phase 1 Status
SELECT
  'Phase 1' as phase,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_locations')
    THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status;

-- Phase 2 Status (if Phase 1 applied)
SELECT
  'Phase 2' as phase,
  CASE
    WHEN (SELECT COUNT(location_id) FROM reservations WHERE location_id IS NOT NULL) > 0
    THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status;

-- Show detailed state
SELECT
  'campaign_locations' as table_name,
  COUNT(*) as row_count
FROM campaign_locations
UNION ALL
SELECT
  'reservations (with location)',
  COUNT(location_id)
FROM reservations
UNION ALL
SELECT
  'campaigns (all locations flag)',
  COUNT(*)
FROM campaigns
WHERE applies_to_all_locations = true;
```

### Rollback Phase 1 (If Needed)

```bash
# 1. Open Supabase SQL Editor

# 2. Copy rollback contents
cat supabase/migrations/20260424_phase1_campaign_locations_infrastructure_ROLLBACK.sql | pbcopy

# 3. Paste in SQL Editor and Execute

# 4. Verify rollback
# Check that campaign_locations table is gone
```

---

## 🗃️ Related Files & Documentation

### Migration Files
- `supabase/migrations/20260424_phase1_campaign_locations_infrastructure.sql`
- `supabase/migrations/20260424_phase1_campaign_locations_infrastructure_ROLLBACK.sql`
- `supabase/migrations/20260424_phase1_campaign_locations_infrastructure_README.md`

### Related Migrations (Dependencies)
- `supabase/migrations/20260413000000_create_locations_table.sql` - Creates locations table
- `supabase/migrations/20260413000001_add_location_id_to_tables.sql` - Adds location to tables

### Code Files to Modify (Phase 4)
- `src/types/index.ts` - TypeScript types
- `src/pages/api/process-campaign-messages.ts` - Campaign processing
- `src/components/CampaignDrawer.tsx` - Admin UI
- `src/pages/admin/communication.tsx` - Campaign list display

### Old System Files (To Deprecate in Phase 5)
- `src/pages/api/process-simplified-reminders.ts` - Uses reservation_reminder_templates
- `src/pages/api/schedule-reservation-reminders.ts` - Schedules from templates
- `src/pages/api/check-upcoming-reservations.ts` - Checks and schedules
- `src/pages/api/pending-reservation-reminders.ts` - Gets pending

### Documentation
- `HOWTO.md` - Main project documentation (will need updating after Phase 5)
- `README/RESERVATION_REMINDERS.md` - Old system docs (mark deprecated)
- This file: `MULTI_LOCATION_CAMPAIGNS_PROJECT.md`

---

## ✅ Phase Completion Checklist

### Phase 1: Infrastructure
- [x] Migration SQL created
- [x] Rollback SQL created
- [x] README documentation created
- [ ] **Migration applied to database** ⬅️ YOU ARE HERE
- [ ] Verification queries run successfully
- [ ] 48-hour monitoring period completed
- [ ] No errors in application logs
- [ ] No performance degradation detected

### Phase 2: Data Backfill
- [ ] Business decisions made (default locations)
- [ ] Migration SQL created
- [ ] Rollback SQL created
- [ ] Tested on database copy
- [ ] Applied to production
- [ ] Data verification complete
- [ ] Monitoring period completed

### Phase 3: Template Migration
- [ ] Template mapping documented
- [ ] Migration SQL created
- [ ] Old system marked deprecated
- [ ] Applied to production
- [ ] Dual system verified working
- [ ] Monitoring period completed

### Phase 4: Code Updates
- [ ] Feature flag implemented
- [ ] TypeScript types updated
- [ ] Campaign processing updated
- [ ] Admin UI updated
- [ ] Integration tests written
- [ ] Code deployed with flag OFF
- [ ] Flag enabled for test location
- [ ] Flag enabled for all locations
- [ ] 2+ weeks production monitoring

### Phase 5: Deprecation
- [ ] Stakeholder approval obtained
- [ ] Deprecation warnings added
- [ ] Old APIs marked deprecated
- [ ] 30-day notice period completed
- [ ] Old tables removed
- [ ] Documentation updated
- [ ] Project complete ✨

---

## 🆘 Troubleshooting & Support

### Common Issues

**Issue**: "I don't remember where we left off"
**Solution**: Run the "Check Current Phase Status" SQL queries above

**Issue**: "Migration file is missing"
**Solution**: Files are in `supabase/migrations/` folder with prefix `20260424_phase1_`

**Issue**: "I need to create Phase 2 but don't know how"
**Solution**: Use `/migration-gen` agent with description of Phase 2 changes

**Issue**: "Something broke in production"
**Solution**:
1. Check which phase was last applied
2. Run appropriate rollback script
3. Review logs to identify issue
4. Fix and re-apply

### Getting Help

1. **Read the README**: Phase 1 README has extensive troubleshooting section
2. **Check Conversation History**: Full context of decisions and review
3. **Use Agents**:
   - `/schema-scout` - Analyze dependencies
   - `/migration-gen` - Create next phase
   - General agent - Review and debug
4. **Consult Senior DBA**: If uncertain about data safety

---

## 📞 Key Contacts & Resources

### Agents to Use

- **`/migration-gen`** - Generate SQL migrations
- **`/schema-scout <table>`** - Analyze table dependencies before changes
- **General agent** - Review migrations, debug issues

### Slack Commands (If Applicable)

```
# Review conversation for context
/claude history

# Get help with specific issue
/claude debug <description>
```

---

## 🎓 What You've Learned

This project demonstrates:
- **Phased migration strategy** - Breaking large changes into safe increments
- **Junction table pattern** - Proper many-to-many relationships
- **Safety-first approach** - Rollbacks, monitoring, feature flags
- **Senior review process** - Having AI review AI work catches critical issues
- **Production-safe development** - No big-bang changes, gradual rollout

---

## 📌 Important Notes

### DO NOT

- ❌ Skip phases or apply out of order
- ❌ Apply migrations without reading README first
- ❌ Ignore monitoring periods between phases
- ❌ Delete old system tables before Phase 5
- ❌ Deploy Phase 4 code changes without feature flag

### ALWAYS

- ✅ Backup database before applying migrations
- ✅ Read the phase README thoroughly
- ✅ Run verification queries after migration
- ✅ Monitor for 24-48 hours between phases
- ✅ Test rollback procedure before production use

### IF IN DOUBT

- ⏸️ Pause and review documentation
- ⏸️ Ask for senior agent review
- ⏸️ Test on database copy first
- ⏸️ Wait for stakeholder approval

---

## 🔮 Future Enhancements (Post-Phase 5)

After all 5 phases complete, consider:
- Location-specific campaign templates
- Location-based analytics dashboard
- Automated location assignment based on member address
- Cross-location campaign orchestration
- Location-specific A/B testing

---

## ✨ Success Criteria

Project is complete when:
- ✅ All 5 phases applied successfully
- ✅ Old reservation_reminder_templates system deprecated
- ✅ Campaigns can be assigned to specific locations
- ✅ Admin UI shows location assignments
- ✅ Campaign processing filters by location
- ✅ Zero duplicate messages
- ✅ Zero data loss
- ✅ No performance degradation
- ✅ Documentation updated

---

**Last Updated**: 2026-04-24
**Next Review**: After Phase 1 application + 48 hours
**Estimated Project Completion**: 4-6 weeks from Phase 1 start

---

**You are currently at**: 🎯 **Phase 1 Ready to Apply**

**Next immediate step**: Apply Phase 1 migration to database

Good luck! 🚀
