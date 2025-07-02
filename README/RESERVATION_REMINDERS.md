# Reservation Reminder System

## Overview

The Reservation Reminder System automatically sends SMS reminders to customers about their upcoming reservations. It integrates seamlessly with the existing reservation system and provides a flexible template-based approach for managing reminder messages.

## Features

### 🎯 Core Functionality
- **Day-of Reminders**: Send reminders on the day of the reservation (e.g., 10:00 AM)
- **Hour-before Reminders**: Send reminders X hours before the reservation (e.g., 1 hour before)
- **Customizable Templates**: Edit message content and timing through the admin interface
- **Automatic Scheduling**: Reminders are automatically scheduled when reservations are created
- **SMS Integration**: Uses OpenPhone API for reliable SMS delivery

### 📱 Message Templates
- **Placeholder Support**: Use `{{first_name}}`, `{{reservation_time}}`, and `{{party_size}}` in messages
- **Flexible Timing**: Set different times for day-of reminders and hours-before reminders
- **Active/Inactive Toggle**: Enable or disable specific reminder templates

### 🛠️ Admin Interface
- **Template Management**: Create, edit, and delete reminder templates
- **Real-time Statistics**: View pending, sent, and failed reminders
- **Test Functionality**: Send test messages to verify templates
- **Manual Processing**: Trigger reminder processing manually

## Database Schema

### Tables

#### `reservation_reminder_templates`
Stores the reminder message templates and timing settings.

```sql
CREATE TABLE reservation_reminder_templates (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    message_template TEXT NOT NULL,
    reminder_type reminder_type NOT NULL, -- 'day_of' or 'hour_before'
    send_time TIME NOT NULL DEFAULT '10:00:00',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `scheduled_reservation_reminders`
Tracks individual reminders scheduled for delivery.

```sql
CREATE TABLE scheduled_reservation_reminders (
    id UUID PRIMARY KEY,
    reservation_id UUID NOT NULL REFERENCES reservations(id),
    template_id UUID NOT NULL REFERENCES reservation_reminder_templates(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
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

### Enums

#### `reminder_type`
- `day_of`: Reminder sent on the day of the reservation
- `hour_before`: Reminder sent X hours before the reservation

#### `message_status`
- `pending`: Reminder scheduled but not yet sent
- `sent`: Reminder successfully delivered
- `failed`: Reminder failed to send
- `cancelled`: Reminder cancelled

## Setup Instructions

### 1. Database Migration

Run the migration to create the required tables and functions:

```bash
# Display the migration SQL
node run-migration.js

# Then manually run the SQL in your Supabase dashboard:
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy the SQL content from the output above
# 3. Click "Run" to execute
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

The migration automatically creates two default templates:

1. **Day of Reminder**
   - Sent at 10:00 AM on the day of the reservation
   - Message: "Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!"

2. **1 Hour Before Reminder**
   - Sent 1 hour before the reservation
   - Message: "Hi {{first_name}}! Your reservation at Noir is in 1 hour at {{reservation_time}} for {{party_size}} guests. See you soon!"

## API Endpoints

### Reservation Reminder Templates
- `GET /api/reservation-reminder-templates` - List all templates
- `POST /api/reservation-reminder-templates` - Create new template
- `PUT /api/reservation-reminder-templates` - Update existing template
- `DELETE /api/reservation-reminder-templates?id={id}` - Delete template

### Reminder Processing
- `POST /api/process-reservation-reminders` - Process and send pending reminders
- `GET /api/process-reservation-reminders?days={7}` - Get reminder statistics

### Reservation Integration
- `POST /api/schedule-reservation-reminders` - Schedule reminders for a reservation

## Admin Interface

### Access
Navigate to **Admin → Templates** and click the **Reservation Reminders** tab.

### Features

#### Template Management
- **Create Template**: Add new reminder templates
- **Edit Template**: Modify existing templates
- **Delete Template**: Remove templates (if not in use)
- **Toggle Active**: Enable/disable templates

#### Message Testing
- **Preview Messages**: See how messages will appear with test data
- **Send Test SMS**: Send test messages to verify templates
- **Customize Test Data**: Change test first name and phone number

#### Statistics Dashboard
- **Total Reminders**: All scheduled reminders
- **Pending**: Reminders waiting to be sent
- **Sent**: Successfully delivered reminders
- **Failed**: Reminders that failed to send
- **Templates**: Number of active templates

#### Manual Processing
- **Process Reminders**: Manually trigger reminder processing
- **Real-time Updates**: See processing results immediately

## Usage Examples

### Creating a Custom Template

1. Go to **Admin → Templates → Reservation Reminders**
2. Click **Create Reminder Template**
3. Fill in the details:
   - **Name**: "2 Hours Before Reminder"
   - **Description**: "Remind customers 2 hours before their reservation"
   - **Message Template**: "Hi {{first_name}}! Your reservation at Noir is in 2 hours at {{reservation_time}} for {{party_size}} guests. Please let us know if you need to make any changes."
   - **Reminder Type**: "Hours Before Reservation"
   - **Send Time**: "2"
4. Click **Create**

### Testing a Template

1. In the templates list, click the **eye icon** (Test)
2. Enter test phone number: `9137774488`
3. Enter test first name: `John`
4. Review the preview message
5. Click **Send Test Reminder Message**

### Processing Reminders

1. Click **Process Reservation Reminders** to send pending reminders
2. View the results showing how many were processed successfully
3. Check the statistics dashboard for updated counts

## Message Placeholders

### Available Placeholders
- `{{first_name}}` - Customer's first name
- `{{reservation_time}}` - Reservation time (e.g., "7:00 PM")
- `{{party_size}}` - Number of guests

### Example Message
```
Hi {{first_name}}! Your reservation at Noir is in 1 hour at {{reservation_time}} for {{party_size}} guests. See you soon!
```

## Automatic Scheduling

### How It Works
1. When a reservation is created with status "confirmed"
2. The system automatically checks for active reminder templates
3. For each template, it calculates the appropriate send time:
   - **Day-of**: Same day at specified time (e.g., 10:00 AM)
   - **Hour-before**: X hours before reservation time
4. Reminders are scheduled only if the send time hasn't passed
5. Messages are personalized with customer and reservation details

### Trigger Conditions
- Reservation status must be "confirmed"
- Template must be active
- Send time must be in the future
- Customer must have a valid phone number

## Processing Reminders

### Manual Processing
1. Go to **Admin → Templates → Reservation Reminders**
2. Click **Process Reservation Reminders**
3. System will send all pending reminders that are due
4. View results showing success/failure counts

### Automated Processing
For production use, set up a cron job or scheduled task to call:
```
POST /api/process-reservation-reminders
```

### Processing Logic
1. Find all pending reminders where `scheduled_for <= NOW()`
2. Send SMS via OpenPhone API
3. Update status to "sent" or "failed"
4. Record OpenPhone message ID for tracking
5. Log any errors for debugging

## Testing

### Test Script
Run the provided test script to verify functionality:

```bash
# Test the complete system
node test-reservation-reminders.js
```

### Manual Testing
1. Create a test reservation for tomorrow
2. Verify reminders are scheduled in the database
3. Manually trigger processing
4. Check that SMS is sent successfully

## Troubleshooting

### Common Issues

#### Reminders Not Being Scheduled
- Check if reservation status is "confirmed"
- Verify reminder templates are active
- Ensure customer has a valid phone number
- Check database logs for trigger errors

#### SMS Not Being Sent
- Verify OpenPhone API credentials
- Check phone number format (should start with +)
- Review error messages in the database
- Test SMS sending manually

#### Templates Not Appearing
- Check if migration was run successfully
- Verify RLS policies allow admin access
- Check database connection

### Debug Steps
1. Check the browser console for JavaScript errors
2. Review server logs for API errors
3. Query the database directly to verify data
4. Test individual API endpoints

## Security Considerations

- **Row Level Security (RLS)** enabled on all tables
- **Admin-only access** to template management
- **Input validation** on all API endpoints
- **Error handling** prevents sensitive data exposure
- **Rate limiting** on SMS sending to prevent abuse

## Future Enhancements

### Planned Features
- **Email reminders** in addition to SMS
- **Advanced personalization** (restaurant name, location, etc.)
- **A/B testing** for message effectiveness
- **Analytics dashboard** with engagement metrics
- **Bulk operations** for template management
- **Conditional messaging** based on reservation type

### Integration Opportunities
- **Calendar integration** for external calendar reminders
- **Payment integration** for deposit reminders
- **Event integration** for special event notifications
- **Survey integration** for post-visit feedback

## Support

For issues or questions:
1. Check this documentation
2. Review the troubleshooting section
3. Run the test scripts to verify functionality
4. Check server logs for error details
5. Contact the development team

## Maintenance

### Regular Tasks
- **Monitor reminder delivery rates** weekly
- **Review failed reminders** and investigate causes
- **Update templates** based on customer feedback
- **Clean up old reminders** periodically
- **Backup template configurations** before major changes

### Performance Optimization
- **Index optimization** for large reminder volumes
- **Batch processing** for high-volume scenarios
- **Caching** for frequently accessed templates
- **Rate limiting** to prevent API abuse 