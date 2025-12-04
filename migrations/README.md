# Database Migrations

This directory contains all SQL migration files for the Noir CRM Dashboard database.

## Organization

Migrations are organized chronologically and by feature area. Each migration file should be named descriptively to indicate its purpose.

## Running Migrations

### Production
1. **ALWAYS** backup the database before running migrations
2. Test migrations in staging environment first
3. Review the migration file carefully
4. Execute in Supabase SQL Editor
5. Verify results with test queries
6. Document any manual steps required

### Staging/Development
1. Copy the SQL from the migration file
2. Run in Supabase SQL Editor for your environment
3. Test the changes thoroughly
4. Document any issues

## Migration Checklist

Before running a migration:
- [ ] Database backup completed
- [ ] Migration reviewed by team
- [ ] Tested in staging environment
- [ ] No production traffic expected during migration
- [ ] Rollback plan prepared
- [ ] Monitoring/alerts configured

## Rollback Procedure

If a migration fails:
1. Stop immediately
2. Restore from backup if needed
3. Review error logs
4. Fix migration or create rollback migration
5. Document the issue
6. Re-test before attempting again

## Migration File Naming Convention

Use descriptive names that indicate the purpose:
- `add_[feature]_migration.sql` - Adding new features
- `fix_[issue]_migration.sql` - Fixing bugs or issues
- `update_[table]_migration.sql` - Updating existing tables
- `create_[table].sql` - Creating new tables

## Important Notes

- Never modify migration files after they've been run in production
- Always include both up and down migrations when possible
- Document breaking changes clearly
- Include comments in SQL for complex operations
- Test with realistic data volumes

## Migration History

See individual migration files for detailed information about each change.
