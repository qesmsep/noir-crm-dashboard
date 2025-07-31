# Deployment Checklist - Member Attributes & Balance Management

## Pre-Deployment Testing ✅
- [x] Database connection verified
- [x] Test script created and working
- [x] All SQL files created
- [x] API endpoints created
- [x] Implementation summary documented

## Database Migrations (Run in Supabase SQL Editor)

### Step 1: Add Member Attributes
```sql
-- Run this first
-- File: add_membership_attributes_migration.sql
```

### Step 2: Create Monthly Credit Function
```sql
-- Run this second
-- File: monthly_credit_processing_function.sql
```

### Step 3: Add Campaign Filtering
```sql
-- Run this third
-- File: add_membership_filter_to_campaigns.sql
```

## API Deployment

### Step 1: Deploy API Endpoints
1. Copy `src/pages/api/process-monthly-credits.ts` to your project
2. Copy `src/pages/api/process-campaign-messages-updated.ts` to your project
3. Copy `src/pages/api/cron-status.ts` to your project (for monitoring)
4. Update existing campaign processing if needed

### Step 2: Configure Environment Variables
Ensure these are set in your Vercel environment:
```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CAMPAIGN_PROCESSING_TOKEN=your-secret-token
```

### Step 3: Set Up Cron Jobs
1. Add `vercel-cron-config.json` to your project root
2. Deploy to Vercel to activate the monthly credit cron job
3. Verify cron job is running in Vercel dashboard

**Cron Job Schedule:**
- **Monthly Credits**: `0 7 * * *` (7am CST daily)
- **Backup Credits**: `0 8 * * *` (8am CST daily - backup, optional)

## Testing After Deployment

### Step 1: Verify Database Changes
```bash
# Run the test script
node test_monthly_credits.js
```

Expected results:
- ✅ Database connection successful
- ✅ Database function exists (no error)
- ✅ Members table has new columns
- ✅ Sample member data shows new fields

### Step 2: Test API Endpoints
```bash
# Test monthly credit processing
curl -X POST http://localhost:3000/api/process-monthly-credits \
  -H "Authorization: Bearer your-token"

# Test cron status monitoring
curl http://localhost:3000/api/cron-status
```

### Step 3: Test Campaign Filtering
1. Create a test campaign message with membership type filter
2. Verify it only sends to appropriate members

### Step 4: Verify Cron Jobs
1. Check Vercel dashboard for cron job status
2. Monitor logs for successful execution
3. Test manual trigger if needed

## Production Deployment

### Step 1: Database Migration
1. **BACKUP YOUR DATABASE FIRST**
2. Run migrations in order (1, 2, 3)
3. Verify no errors in Supabase logs

### Step 2: Deploy to Production
1. Deploy API endpoints to production
2. Configure production environment variables
3. Set up production cron jobs
4. Deploy monitoring endpoint

### Step 3: Monitor Initial Processing
1. Check logs after first cron job runs
2. Verify Skyline members are processed correctly
3. Check Stripe charges are created properly
4. Monitor cron status endpoint

## Cron Job Monitoring

### Daily Monitoring
- [ ] Check Vercel cron job execution logs
- [ ] Verify monthly credit processing completed
- [ ] Monitor Stripe charges for any failures
- [ ] Check cron status endpoint for statistics

### Weekly Monitoring
- [ ] Review Skyline member processing logs
- [ ] Audit Stripe payment intents
- [ ] Verify backup cron job is not needed

### Monthly Monitoring
- [ ] Verify all Skyline members processed
- [ ] Review credit/charge patterns
- [ ] Check for any failed renewals
- [ ] Update membership types as needed

## Rollback Plan

If issues occur:
1. **Database**: Restore from backup
2. **API**: Revert to previous version
3. **Cron**: Disable in Vercel dashboard
4. **Environment**: Rollback environment variables

## Success Criteria

- [ ] Skyline members get $100 credit monthly
- [ ] Overspend charges are processed via Stripe
- [ ] Campaign filtering works correctly
- [ ] No impact on existing functionality
- [ ] All logs show successful processing
- [ ] Monthly credit cron job executes reliably
- [ ] Monitoring endpoint provides accurate status

## Monitoring & Troubleshooting

### Cron Status Endpoint
```bash
# Check cron job status
curl https://your-domain.vercel.app/api/cron-status
```

### Vercel Dashboard
- Monitor cron job execution in Vercel dashboard
- Check function logs for errors
- Verify environment variables are set

### Database Monitoring
```sql
-- Check Skyline members
SELECT member_id, first_name, last_name, membership, monthly_credit, last_credit_date, credit_renewal_date 
FROM members 
WHERE membership = 'Skyline';

-- Check recent ledger entries
SELECT * FROM ledger 
WHERE type IN ('credit', 'charge') 
AND date >= CURRENT_DATE 
ORDER BY created_at DESC;
```

## Files to Deploy

### Database Files
- `add_membership_attributes_migration.sql`
- `monthly_credit_processing_function.sql`
- `add_membership_filter_to_campaigns.sql`

### API Files
- `src/pages/api/process-monthly-credits.ts`
- `src/pages/api/process-campaign-messages-updated.ts`
- `src/pages/api/cron-status.ts`

### Configuration Files
- `vercel-cron-config.json` (or `vercel-cron-config-advanced.json`)
- `test_monthly_credits.js` (for testing)

### Documentation
- `MEMBER_ATTRIBUTES_IMPLEMENTATION_SUMMARY.md`
- `DEPLOYMENT_CHECKLIST.md` (this file)

## Final Notes

1. **Test thoroughly** before production deployment
2. **Monitor closely** after deployment
3. **Have rollback plan** ready
4. **Document any issues** for future reference
5. **Train staff** on new features when UI is updated
6. **Set up alerts** for cron job failures
7. **Regular monitoring** of cron status endpoint

This implementation provides a robust foundation for membership management while maintaining system stability and providing comprehensive monitoring. 