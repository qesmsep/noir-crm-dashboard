# Campaign Hierarchy System

## Overview

The new campaign system uses a hierarchical structure with separate tables for campaigns and campaign messages. This provides better organization, easier tracking, and more flexible message management.

## Database Schema

### 1. Campaigns Table
```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'member_signup',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Defines the campaign itself - what triggers it, when it runs, etc.

**Key Fields**:
- `id`: Unique UUID for the campaign
- `name`: Human-readable name (e.g., "reservation-reminder")
- `trigger_type`: What triggers this campaign (member_signup, reservation_time, etc.)
- `is_active`: Whether the campaign is currently active

### 2. Campaign Messages Table
```sql
CREATE TABLE campaign_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    recipient_type TEXT NOT NULL DEFAULT 'member',
    specific_phone TEXT,
    timing_type TEXT NOT NULL DEFAULT 'specific_time',
    specific_time TEXT, -- HH:MM format
    duration_quantity INTEGER DEFAULT 1,
    duration_unit TEXT DEFAULT 'hr',
    duration_proximity TEXT DEFAULT 'after',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Individual messages within a campaign - the actual SMS content and timing.

**Key Fields**:
- `id`: Unique UUID for the message
- `campaign_id`: Links to the parent campaign
- `content`: The actual SMS message text
- `timing_type`: When to send (specific_time or duration)
- `duration_quantity/unit/proximity`: For duration-based timing

### 3. Scheduled Messages Table
```sql
CREATE TABLE scheduled_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_message_id UUID NOT NULL REFERENCES campaign_messages(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(member_id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    message_content TEXT NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    sent_time TIMESTAMPTZ,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Tracks individual scheduled messages that are ready to be sent.

## Hierarchical Structure

```
Campaign (reservation-reminder)
├── Campaign Message (24 Hour Reminder)
│   ├── Scheduled Message (for Member A)
│   └── Scheduled Message (for Member B)
├── Campaign Message (2 Hour Reminder)
│   ├── Scheduled Message (for Member A)
│   └── Scheduled Message (for Member B)
└── Campaign Message (Day Of Reminder)
    ├── Scheduled Message (for Member A)
    └── Scheduled Message (for Member B)
```

## Benefits of This Structure

### 1. **Better Organization**
- Campaigns group related messages together
- Easy to see all messages for a specific trigger type
- Clear hierarchy: Campaign → Messages → Scheduled Messages

### 2. **Easier Management**
- Activate/deactivate entire campaigns
- Modify campaign-wide settings (trigger type, description)
- Individual message control within campaigns

### 3. **Better Tracking**
- Track which campaign a message belongs to
- See campaign performance as a whole
- Monitor individual message performance

### 4. **Flexibility**
- Multiple messages per campaign
- Different timing for each message
- Different recipients for each message

## API Endpoints

### Campaigns
- `GET /api/campaigns` - List all campaigns
- `POST /api/campaigns` - Create new campaign
- `PUT /api/campaigns/[id]` - Update campaign
- `DELETE /api/campaigns/[id]` - Delete campaign

### Campaign Messages
- `GET /api/campaign-messages` - List all messages
- `GET /api/campaign-messages?campaign_id=[id]` - List messages for a campaign
- `POST /api/campaign-messages` - Create new message
- `PUT /api/campaign-messages/[id]` - Update message
- `DELETE /api/campaign-messages/[id]` - Delete message

## Usage Examples

### Creating a Campaign
```typescript
const campaign = await fetch('/api/campaigns', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'reservation-reminder',
    description: 'Reminder messages for reservations',
    trigger_type: 'reservation_time',
    is_active: true
  })
});
```

### Adding Messages to a Campaign
```typescript
const message = await fetch('/api/campaign-messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    campaign_id: 'campaign-uuid',
    name: '24 Hour Reminder',
    content: 'Your reservation is tomorrow at {time}',
    timing_type: 'duration',
    duration_quantity: 24,
    duration_unit: 'hr',
    duration_proximity: 'before',
    recipient_type: 'member'
  })
});
```

## Migration from Old System

The migration script (`create_campaign_hierarchy.sql`) will:

1. **Backup existing data** to prevent loss
2. **Create new tables** with proper structure
3. **Migrate existing data** to new format
4. **Set up indexes** for performance
5. **Enable RLS** for security
6. **Verify the migration** worked correctly

## Common Campaign Types

### Reservation Reminders
- **Campaign**: `reservation-reminder`
- **Trigger**: `reservation_time`
- **Messages**: 24hr, 2hr, day-of reminders

### Welcome Series
- **Campaign**: `welcome-series`
- **Trigger**: `member_signup`
- **Messages**: Welcome, follow-up, first visit

### Birthday Campaigns
- **Campaign**: `birthday-campaign`
- **Trigger**: `member_birthday`
- **Messages**: Birthday wishes, special offers

This hierarchical approach makes the system much more organized and easier to manage! 