# Multi-Location Campaigns - Quick Start Guide

**⚡ 2-Minute Resume Guide** - Read this first, then dive into full project doc

---

## 🎯 Where You Left Off

**Status**: Phase 1 migration files created, ready to apply to database
**Next Step**: Apply Phase 1 migration
**Time Required**: 15 minutes

---

## 📂 Files You Created

All in `supabase/migrations/`:
1. **`20260424_phase1_campaign_locations_infrastructure.sql`** ← Apply this
2. **`20260424_phase1_campaign_locations_infrastructure_ROLLBACK.sql`** ← Emergency use
3. **`20260424_phase1_campaign_locations_infrastructure_README.md`** ← Full guide

---

## ⚡ Apply Phase 1 Right Now

### 3-Step Process

**Step 1: Backup** (2 min)
```
1. Open Supabase Dashboard
2. Settings → Database → Backups → Create Backup
```

**Step 2: Apply Migration** (5 min)
```
1. SQL Editor in Supabase
2. Open: supabase/migrations/20260424_phase1_campaign_locations_infrastructure.sql
3. Copy entire file
4. Paste in SQL Editor
5. Click RUN
6. Look for "✓" success messages
```

**Step 3: Verify** (5 min)
```sql
-- Paste this in SQL Editor to verify
SELECT
  'campaign_locations' as table_created,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_locations') as exists;

SELECT COUNT(*) as total_checks_passed
FROM (
  SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_locations')
  UNION ALL
  SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'location_id')
  UNION ALL
  SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'applies_to_all_locations')
) checks;
-- Should return 3
```

**Done!** ✅ Monitor for 48 hours, then come back for Phase 2.

---

## 🚨 If Something Goes Wrong

**Rollback in 2 Minutes:**
```
1. Open: supabase/migrations/20260424_phase1_campaign_locations_infrastructure_ROLLBACK.sql
2. Copy entire file
3. Paste in SQL Editor
4. RUN
5. Verify rollback complete (table should be gone)
```

---

## 📚 Full Documentation

- **`MULTI_LOCATION_CAMPAIGNS_PROJECT.md`** ← Complete project state (read after applying)
- **Phase 1 README** ← In migrations folder, 500+ lines of detail

---

## 🔄 What Are the 5 Phases?

1. **Phase 1** ← YOU ARE HERE (Infrastructure only, safe)
2. **Phase 2** - Backfill data (future)
3. **Phase 3** - Migrate templates (future)
4. **Phase 4** - Update code (future)
5. **Phase 5** - Deprecate old system (future)

**Total timeline**: 4-6 weeks for all phases

---

## ❓ Quick FAQ

**Q: Is Phase 1 safe to apply?**
A: Yes! Zero behavioral changes, 100% reversible.

**Q: Will it break anything?**
A: No. It only creates new tables/columns. Nothing uses them yet.

**Q: Do I need to change any code?**
A: No, not for Phase 1. Code changes come in Phase 4.

**Q: What if I reset my computer before finishing?**
A: This document + project doc have everything you need to resume.

**Q: How do I know if I already applied Phase 1?**
A: Run the verification query above. If it returns 3, Phase 1 is done.

---

## 📞 Next Steps After Phase 1

**Immediately after applying**:
1. Run verification queries
2. Check application still works (create a reservation, view campaigns)
3. Monitor logs for 48 hours

**48 hours later**:
1. Review monitoring (no errors expected)
2. Come back to `MULTI_LOCATION_CAMPAIGNS_PROJECT.md`
3. Plan Phase 2 (data backfill)
4. Use `/migration-gen` to create Phase 2 migration

---

## 💡 Pro Tips

- ✅ Phase 1 is the safest phase - infrastructure only
- ✅ Always backup before any migration (even safe ones)
- ✅ Read the full README if you have time (it's excellent)
- ✅ Wait 48 hours between phases for safety
- ✅ Don't rush - this is a 4-6 week project for good reason

---

**Ready?** Go apply Phase 1! Then come back here for Phase 2 in 48 hours. 🚀

**Questions?** Read `MULTI_LOCATION_CAMPAIGNS_PROJECT.md` for complete context.
