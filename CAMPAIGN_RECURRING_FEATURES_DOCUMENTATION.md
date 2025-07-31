# Campaign Recurring Features Documentation

## Overview

This document describes the new campaign features that have been added to the Noir CRM Dashboard, including recurring campaigns, reservation range campaigns, private event campaigns, and enhanced all-members campaigns.

## New Trigger Types

### 1. Recurring Campaigns (`recurring`)
**Purpose**: Send messages on a recurring schedule (daily, weekly, monthly, etc.)

**Features**:
- **Schedule Types**: Daily, Weekly, Monthly, Yearly, Specific Weekdays, 1st of Month, Last Day of Month
- **Weekday Selection**: Multi-select for specific weekdays (Monday, Wednesday, Friday, etc.)
- **Date Range**: Start and end dates for the recurring schedule
- **Recipient Types**: Member, Both Members, Specific Number, All Members, Custom Phone

**Database Fields**:
- `recurring_schedule` (JSONB): Contains schedule configuration
- `recurring_start_date` (DATE): When the recurring schedule starts
- `recurring_end_date` (DATE): When the recurring schedule ends (optional)

### 2. Reservation Range Campaigns (`reservation_range`)
**Purpose**: Send messages to phone numbers from reservations within a specific time period

**Features**:
- **Date/Time Range**: Custom start and end date/time with minute precision
- **Include Past**: Option to include past reservations
- **Minute Precision**: Option for precise time-based filtering
- **Recipient Types**: Reservation Phones, Specific Number, Custom Phone

**Database Fields**:
- `reservation_range_start` (TIMESTAMPTZ): Start of the reservation range
- `reservation_range_end` (TIMESTAMPTZ): End of the reservation range

### 3. Private Event Campaigns (`private_event`)
**Purpose**: Send messages to RSVPs for specific private events

**Features**:
- **Event Selection**: Dropdown with all active private events
- **Chronological Listing**: Events listed by date with event names
- **Date Range**: Option to include events up to a week ago with extension capability
- **Recipient Types**: Private Event RSVPs, Specific Number, Custom Phone

**Database Fields**:
- `selected_private_event_id` (UUID): Reference to the selected private event
- `private_event_date_range` (JSONB): Date range configuration
- `private_event_include_old` (BOOLEAN): Whether to include older events

### 4. All Members Campaigns (`all_members`)
**Purpose**: Send messages to all existing members with optional event list

**Features**:
- **Event List**: Option to include upcoming events within a date range
- **Member Types**: All members, All primary members, Specific number
- **Future Enhancement**: Event list feature will be implemented in next phase

**Database Fields**:
- `include_event_list` (BOOLEAN): Whether to include event list
- `event_list_date_range` (JSONB): Date range for event list

## New Recipient Types

### Enhanced Recipient Options

1. **`both_members`**: Send to both members in a household
2. **`specific_number`**: Send to a specific number of recipients
3. **`reservation_phones`**: Phone numbers from reservations within time period
4. **`private_event_rsvps`**: Phone numbers of RSVPs for private events
5. **`all_primary_members`**: All primary members only

### Recipient Type by Trigger Type

| Trigger Type | Available Recipient Types |
|--------------|---------------------------|
| `member_signup` | member, all_members, specific_phone |
| `member_birthday` | member, all_members, specific_phone |
| `member_renewal` | member, all_members, specific_phone |
| `reservation_time` | member, specific_phone |
| `reservation_created` | member, specific_phone |
| `recurring` | member, both_members, specific_number, all_members, specific_phone |
| `reservation_range` | reservation_phones, specific_number, specific_phone |
| `private_event` | private_event_rsvps, specific_number, specific_phone |
| `all_members` | all_members, all_primary_members, specific_number, specific_phone |

## Enhanced Timing Options

### Recurring Timing Types

For recurring campaigns, new timing options are available:

- **`immediately`**: Send immediately when triggered
- **`specific_time`**: Send at a specific time of day
- **`daily`**: Send daily at specified time
- **`weekly`**: Send weekly on specified days
- **`monthly`**: Send monthly on specified day
- **`yearly`**: Send yearly on specified date
- **`weekdays`**: Send on specific weekdays
- **`first_of_month`**: Send on the 1st of each month
- **`last_of_month`**: Send on the last day of each month

### Database Fields for Recurring Timing

- `recurring_timing_type`: Type of recurring timing
- `recurring_time`: Time of day (HH:MM format)
- `recurring_weekdays`: Array of weekday numbers (0=Sunday, 1=Monday, etc.)
- `recurring_day_of_month`: Day of month for monthly schedules

## Database Schema Changes

### Campaigns Table New Columns

```sql
-- Recurring campaign fields
recurring_schedule JSONB DEFAULT NULL,
recurring_start_date DATE DEFAULT NULL,
recurring_end_date DATE DEFAULT NULL,

-- Reservation range fields
reservation_range_start TIMESTAMPTZ DEFAULT NULL,
reservation_range_end TIMESTAMPTZ DEFAULT NULL,

-- Private event fields
selected_private_event_id UUID REFERENCES private_events(id),

-- Event list fields (for future use)
include_event_list BOOLEAN DEFAULT false,
event_list_date_range JSONB DEFAULT NULL
```

### Campaign Messages Table New Columns

```sql
-- New recipient types
specific_number INTEGER DEFAULT NULL,

-- Recurring timing fields
recurring_timing_type TEXT DEFAULT NULL,
recurring_time TEXT DEFAULT NULL,
recurring_weekdays INTEGER[] DEFAULT NULL,
recurring_day_of_month INTEGER DEFAULT NULL,

-- Reservation range fields
reservation_range_include_past BOOLEAN DEFAULT true,
reservation_range_minute_precision BOOLEAN DEFAULT false,

-- Private event fields
private_event_date_range JSONB DEFAULT NULL,
private_event_include_old BOOLEAN DEFAULT false
```

## UI Components

### CampaignDrawer Updates

The CampaignDrawer component has been enhanced with:

1. **New Trigger Type Selection**: Dropdown with all new trigger types
2. **Trigger-Specific Fields**: Dynamic form fields based on selected trigger type
3. **Recurring Schedule Configuration**: Radio buttons and checkboxes for schedule setup
4. **Date/Time Range Selection**: DateTime inputs for reservation ranges
5. **Private Event Selection**: Dropdown populated with active private events
6. **Event List Toggle**: Switch for all-members campaigns

### CampaignTemplateDrawer Updates

The CampaignTemplateDrawer component has been enhanced with:

1. **New Recipient Types**: Updated dropdown with all new recipient types
2. **Specific Number Field**: Number input for recipient count limits
3. **Enhanced Timing Options**: Support for recurring timing types
4. **Trigger-Specific Validation**: Validation based on campaign trigger type

## API Endpoints

### Updated Validation

All API endpoints have been updated to support the new trigger types and recipient types:

- **Campaigns API**: Validates new trigger types
- **Campaign Messages API**: Validates new recipient types
- **Enhanced Error Handling**: Better error messages for new features

### New Valid Trigger Types

```javascript
const validTriggerTypes = [
  'member_signup', 'member_birthday', 'member_renewal', 'reservation_time', 'reservation_created',
  'recurring', 'reservation_range', 'private_event', 'all_members'
];
```

### New Valid Recipient Types

```javascript
const validRecipientTypes = [
  'member', 'all_members', 'specific_phone', 'both_members', 'specific_number',
  'reservation_phones', 'private_event_rsvps', 'all_primary_members'
];
```

## Migration Scripts

### Backup Script
- `campaign_recurring_features_backup.sql`: Creates backup of existing data before migration

### Migration Script
- `campaign_recurring_features_migration.sql`: Main migration script that:
  - Updates trigger type constraints
  - Adds new database columns
  - Creates indexes for performance
  - Inserts test campaigns for each new trigger type
  - Creates test messages for new campaigns

## Test Campaigns

The migration creates test campaigns for each new trigger type:

1. **TEST-Recurring-Weekly-Promotion**: Weekly recurring campaign
2. **TEST-Reservation-Range-Reminder**: Reservation range campaign
3. **TEST-Private-Event-RSVP**: Private event campaign
4. **TEST-All-Members-Newsletter**: All members campaign

## Testing

### Test Script
- `test_campaign_recurring_features.js`: Comprehensive test script that:
  - Verifies new trigger types are supported
  - Checks new recipient types work correctly
  - Validates database schema changes
  - Tests API endpoint functionality

### Manual Testing Steps

1. **Run Migration**: Execute the backup and migration scripts
2. **Start Development Server**: `npm run dev`
3. **Navigate to Communication Page**: `/admin/communication`
4. **Create Test Campaigns**: Try creating campaigns with each new trigger type
5. **Test Message Templates**: Create messages with new recipient types
6. **Verify Functionality**: Check that all new features work as expected

## Future Enhancements

### Event List Feature
The event list feature for "All Members" campaigns will be implemented in the next phase, allowing users to:
- Include upcoming events in messages
- Filter events by date range
- Add event attributes for filtering

### Advanced Scheduling
Future enhancements may include:
- More granular recurring schedules
- Timezone support
- Advanced conditional logic
- A/B testing capabilities

## Troubleshooting

### Common Issues

1. **Migration Errors**: Ensure you run the backup script first
2. **UI Not Loading**: Check that all new components are properly imported
3. **API Errors**: Verify that new validation rules are working correctly
4. **Database Constraints**: Ensure all new columns have proper constraints

### Debug Steps

1. Check browser console for JavaScript errors
2. Verify database migration completed successfully
3. Test API endpoints directly
4. Check Supabase logs for database errors

## Support

For issues or questions about the new campaign features, please refer to:
- Database migration logs
- API endpoint documentation
- UI component source code
- Test script output 