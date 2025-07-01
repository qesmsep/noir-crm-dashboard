# Member Followup Campaign System

## Overview

The Member Followup Campaign System automates SMS communication with new members after they complete the typeform signup process. The system sends a series of timed followup messages to engage new members and encourage their first visit to Noir.

## Features

### 🎯 **Automated Campaigns**
- Automatically triggered when a member completes the typeform signup
- Configurable timing (days after activation)
- Customizable send times (e.g., 10:00 AM, 2:00 PM)
- Personalization with member's first name

### 📝 **Template Management**
- Create, edit, and delete campaign templates
- Preview messages with test data
- Test messages by sending to a specific phone number
- Enable/disable templates without deletion

### ⏰ **Scheduled Messaging**
- Messages are scheduled based on template settings
- Automatic processing of pending messages
- Real-time statistics and monitoring
- Failed message tracking and retry capabilities

### 📊 **Admin Dashboard**
- Complete template management interface
- Message statistics and monitoring
- Manual message processing controls
- Test functionality for templates

## How It Works

### 1. Member Signup Flow
```
Typeform Completion → Member Creation → Campaign Trigger → Message Scheduling
```

1. **User completes typeform** (Noir Membership Sign-up)
2. **Typeform webhook** processes submission and creates member
3. **Campaign trigger** automatically creates followup campaigns
4. **Messages are scheduled** based on template timing settings
5. **Scheduled messages are processed** and sent via SMS

### 2. Campaign Templates
Each template defines:
- **Name**: Descriptive name for the template
- **Description**: Purpose and timing explanation
- **Message Template**: SMS content with `{{first_name}}` placeholder
- **Delay Days**: Days after member activation to send
- **Send Time**: Time of day to send (HH:MM:SS format)
- **Active Status**: Whether the template is currently active

### 3. Default Templates
The system includes three default templates:

1. **Welcome Followup - Day 1**
   - Sent 1 day after activation at 10:00 AM
   - Welcomes member and asks for feedback

2. **Member Engagement - Day 3**
   - Sent 3 days after activation at 2:00 PM
   - Encourages first reservation

3. **First Visit Reminder - Day 7**
   - Sent 7 days after activation at 11:00 AM
   - Reminds member to make their first visit

## Database Schema

### Tables

#### `campaign_templates`
Stores the message templates and timing settings.

```sql
CREATE TABLE campaign_templates (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    message_template TEXT NOT NULL,
    default_delay_days INTEGER NOT NULL DEFAULT 1,
    default_send_time TIME NOT NULL DEFAULT '10:00:00',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `member_campaigns`
Tracks which campaigns are active for each member.

```sql
CREATE TABLE member_campaigns (
    id UUID PRIMARY KEY,
    member_id UUID NOT NULL REFERENCES members(member_id),
    template_id UUID NOT NULL REFERENCES campaign_templates(id),
    campaign_status campaign_status DEFAULT 'active',
    activation_date TIMESTAMPTZ NOT NULL,
    scheduled_messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, template_id)
);
```

#### `scheduled_messages`
Individual messages scheduled for delivery.

```sql
CREATE TABLE scheduled_messages (
    id UUID PRIMARY KEY,
    member_id UUID NOT NULL REFERENCES members(member_id),
    campaign_id UUID REFERENCES member_campaigns(id),
    template_id UUID NOT NULL REFERENCES campaign_templates(id),
    message_content TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status message_status DEFAULT 'pending',
    openphone_message_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### Campaign Templates
- `GET /api/campaign-templates` - List all templates
- `POST /api/campaign-templates` - Create new template
- `PUT /api/campaign-templates` - Update existing template
- `DELETE /api/campaign-templates?id={id}` - Delete template

### Campaign Trigger
- `POST /api/trigger-member-campaign` - Trigger campaigns for a member
- `GET /api/trigger-member-campaign?member_id={id}` - Get campaign status

### Message Processing
- `POST /api/process-scheduled-messages` - Process and send pending messages
- `GET /api/process-scheduled-messages?days={7}` - Get message statistics

## Admin Interface

### Access
Navigate to **Admin → Templates** in the sidebar to access the campaign management interface.

### Features

#### Template Management
- **Create Template**: Add new followup campaign templates
- **Edit Template**: Modify existing templates
- **Delete Template**: Remove templates (if not in use)
- **Toggle Active**: Enable/disable templates

#### Message Testing
- **Preview Messages**: See how messages will appear with test data
- **Send Test SMS**: Send test messages to 913.777.4488
- **Customize Test Data**: Change test first name and phone number

#### Statistics Dashboard
- **Total Messages**: All scheduled messages
- **Pending**: Messages waiting to be sent
- **Sent**: Successfully delivered messages
- **Failed**: Messages that failed to send
- **Templates**: Number of active templates

#### Manual Processing
- **Process Messages**: Manually trigger message processing
- **Real-time Updates**: See processing results immediately

## Setup Instructions

### 1. Database Migration
Run the migration to create the required tables:

```bash
# The migration is automatically applied when the app starts
# Or run manually in Supabase SQL Editor:
# Copy contents of supabase/migrations/20250123_add_member_followup_campaigns.sql
```

### 2. Environment Variables
Ensure these environment variables are set:

```bash
# OpenPhone Configuration (for SMS sending)
OPENPHONE_API_KEY=your_openphone_api_key
OPENPHONE_PHONE_NUMBER_ID=your_phone_number_id

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Site URL for internal API calls
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 3. Default Templates
The system automatically creates three default templates:
- Welcome Followup (Day 1)
- Member Engagement (Day 3)
- First Visit Reminder (Day 7)

### 4. Testing
Use the provided test script to verify the complete flow:

```bash
# Test the complete flow (without sending SMS)
node test-member-followup-flow.js

# Test with actual SMS sending
node test-member-followup-flow.js --send-sms

# Test individual components only
node test-member-followup-flow.js --components-only
```

## Usage Examples

### Creating a Custom Template

1. Go to **Admin → Templates**
2. Click **Create Template**
3. Fill in the details:
   - **Name**: "Birthday Reminder"
   - **Description**: "Remind members about their upcoming birthday"
   - **Message Template**: "Hi {{first_name}}! Your birthday is coming up. We'd love to celebrate with you at Noir!"
   - **Delay Days**: 14
   - **Send Time**: 11:00:00
4. Click **Create**

### Testing a Template

1. In the templates list, click the **eye icon** (Test)
2. Enter test phone number: `9137774488`
3. Enter test first name: `John`
4. Review the preview message
5. Click **Send Test Message**

### Monitoring Campaigns

1. View statistics on the Templates dashboard
2. Check pending message count
3. Click **Process Scheduled Messages** to send pending messages
4. Review success/failure rates

## Message Personalization

### Available Placeholders
- `{{first_name}}` - Member's first name

### Example Messages
```
Hi {{first_name}}! Welcome to Noir! We're excited to have you as a member.

Hi {{first_name}}! Just checking in to see how you're enjoying your Noir membership.

Hi {{first_name}}! It's been a week since you joined Noir. We'd love to see you for your first visit!
```

## Troubleshooting

### Common Issues

#### Messages Not Sending
1. **Check OpenPhone credentials** in environment variables
2. **Verify phone number format** (should be +1XXXXXXXXXX)
3. **Check message processing** - click "Process Scheduled Messages"
4. **Review error logs** in the database

#### Templates Not Creating
1. **Check database migration** was applied successfully
2. **Verify API endpoints** are accessible
3. **Check browser console** for JavaScript errors

#### Campaigns Not Triggering
1. **Verify typeform webhook** is calling the trigger endpoint
2. **Check member creation** in the database
3. **Review trigger endpoint logs**

### Debug Tools

#### Database Queries
```sql
-- Check active templates
SELECT * FROM campaign_templates WHERE is_active = true;

-- Check pending messages
SELECT * FROM scheduled_messages WHERE status = 'pending';

-- Check member campaigns
SELECT mc.*, ct.name as template_name, m.first_name 
FROM member_campaigns mc 
JOIN campaign_templates ct ON mc.template_id = ct.id 
JOIN members m ON mc.member_id = m.member_id;
```

#### API Testing
```bash
# Test template creation
curl -X POST http://localhost:3000/api/campaign-templates \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","message_template":"Hi {{first_name}}!"}'

# Test message processing
curl -X POST http://localhost:3000/api/process-scheduled-messages
```

## Security Considerations

- **Row Level Security (RLS)** enabled on all tables
- **Admin-only access** to template management
- **Input validation** on all API endpoints
- **Error handling** prevents sensitive data exposure
- **Rate limiting** on SMS sending to prevent abuse

## Future Enhancements

### Planned Features
- **Email campaigns** in addition to SMS
- **Advanced personalization** (company, membership type, etc.)
- **A/B testing** for message effectiveness
- **Analytics dashboard** with engagement metrics
- **Bulk operations** for template management
- **Conditional messaging** based on member behavior

### Integration Opportunities
- **Calendar integration** for reservation reminders
- **Payment integration** for dues reminders
- **Event integration** for special event notifications
- **Survey integration** for feedback collection

## Support

For issues or questions:
1. Check this documentation
2. Review the troubleshooting section
3. Run the test scripts to verify functionality
4. Check server logs for error details
5. Contact the development team

## Maintenance

### Regular Tasks
- **Monitor message delivery rates** weekly
- **Review failed messages** and investigate causes
- **Update templates** based on member feedback
- **Clean up old campaigns** periodically
- **Backup template configurations** before major changes

### Performance Optimization
- **Index optimization** for large message volumes
- **Batch processing** for high-volume scenarios
- **Caching** for frequently accessed templates
- **Rate limiting** to prevent API abuse 