# Reservation Reminders System

A comprehensive system for automatically sending SMS reminders to customers about their upcoming reservations.

## Features

### ✅ Minute-Level Precision
- **Day-of reminders**: Send at specific times (e.g., 10:00 AM, 10:05 AM, 2:30 PM)
- **Hour-before reminders**: Send X hours and Y minutes before (e.g., 1:30 hours before, 2:15 hours before)
- **Timezone-aware**: All times respect the business timezone setting

### ✅ Automatic Processing
- **Recurring checks**: System automatically checks for upcoming reservations every 5-15 minutes
- **Same-day handling**: Reservations made the same day automatically receive missed reminders immediately
- **Smart scheduling**: Only schedules reminders that haven't passed their send time

### ✅ Enhanced Management
- **Template management**: Create, edit, and delete reminder templates
- **Real-time preview**: See how messages will appear with test data
- **Statistics dashboard**: Track sent, pending, and failed reminders
- **Manual processing**: Trigger reminder processing manually when needed

## Database Schema

### `reservation_reminder_templates`
Stores reminder template configurations.

```sql
CREATE TABLE reservation_reminder_templates (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    message_template TEXT NOT NULL,
    reminder_type reminder_type NOT NULL,
    send_time TEXT NOT NULL, -- "HH:MM" for day_of, "H:M" or "H" for hour_before
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `scheduled_reservation_reminders`
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

### 2. Update Existing Data (if needed)

If you have existing reminder templates, run the update script:

```sql
-- Run this in Supabase SQL Editor
-- Updates existing templates to support minute-level precision
-- See update_reminder_times_on_reservation_update.sql
```

### 3. Environment Variables

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

# Optional: Webhook secret for secure processing
WEBHOOK_SECRET=your_webhook_secret
```

### 4. Default Templates

The migration automatically creates three default templates:

1. **Day of Reminder (10:00 AM)**
   - Sent at 10:00 AM on the day of the reservation
   - Message: "Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!"

2. **Day of Reminder (10:05 AM)**
   - Sent at 10:05 AM on the day of the reservation
   - Message: "Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!"

3. **1 Hour Before Reminder**
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
- `POST /api/check-upcoming-reservations` - Check for upcoming reservations and schedule missed reminders

### Automatic Processing
- `POST /api/webhook-process-reminders` - Process reminders via webhook (for cron jobs)

## Admin Interface

### Access
Navigate to **Admin → Templates** and click the **Reservation Reminders** tab.

### Features

#### Template Management
- **Create Template**: Add new reminder templates with minute-level precision
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
- **Check Upcoming**: Manually check for upcoming reservations and missed reminders
- **Real-time Updates**: See processing results immediately

## Usage Examples

### Creating a Custom Template with Minute Precision

1. Go to **Admin → Templates → Reservation Reminders**
2. Click **Create Reminder Template**
3. Fill in the details:
   - **Name**: "2 Hours 30 Minutes Before Reminder"
   - **Description**: "Remind customers 2 hours and 30 minutes before their reservation"
   - **Message Template**: "Hi {{first_name}}! Your reservation at Noir is in 2 hours and 30 minutes at {{reservation_time}} for {{party_size}} guests. Please let us know if you need to make any changes."
   - **Reminder Type**: "Hours Before Reservation"
   - **Send Time**: "2:30" (2 hours, 30 minutes)
4. Click **Create**

### Creating a Day-of Template with Specific Time

1. Go to **Admin → Templates → Reservation Reminders**
2. Click **Create Reminder Template**
3. Fill in the details:
   - **Name**: "Day of Reminder - 2:30 PM"
   - **Description**: "Remind customers at 2:30 PM on the day of their reservation"
   - **Message Template**: "Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!"
   - **Reminder Type**: "Day Of Reservation"
   - **Send Time**: "14:30" (2:30 PM)
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

### Checking Upcoming Reservations

1. Click **Check Upcoming Reservations** to find reservations that need reminders
2. The system will automatically schedule any missed reminders for same-day reservations
3. View the results showing how many reminders were scheduled

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
   - **Day-of**: Same day at specified time (e.g., 10:05 AM)
   - **Hour-before**: X hours and Y minutes before reservation time
4. Reminders are scheduled only if the send time hasn't passed
5. For same-day reservations, missed reminders are scheduled for immediate sending
6. Messages are personalized with customer and reservation details

### Trigger Conditions
- Reservation status must be "confirmed"
- Template must be active
- Send time must be in the future (or same-day reservations get immediate scheduling)
- Customer must have a valid phone number

## Processing Reminders

### Manual Processing
1. Go to **Admin → Templates → Reservation Reminders**
2. Click **Process Reservation Reminders**
3. System will send all pending reminders that are due
4. View results showing success/failure counts

### Automated Processing
For production use, set up a cron job or scheduled task to call:

```bash
# Check for upcoming reservations and schedule missed reminders (every 5-15 minutes)
curl -X POST https://your-domain.com/api/check-upcoming-reservations

# Process and send pending reminders (every 5-15 minutes)
curl -X POST https://your-domain.com/api/webhook-process-reminders \
  -H "x-webhook-secret: your_webhook_secret"
```

### Cron Job Setup

#### Using crontab (Linux/Mac)
```bash
# Edit crontab
crontab -e

# Add these lines (adjust timing as needed)
*/10 * * * * curl -X POST https://your-domain.com/api/check-upcoming-reservations
*/10 * * * * curl -X POST https://your-domain.com/api/webhook-process-reminders -H "x-webhook-secret: your_webhook_secret"
```

#### Using Vercel Cron Jobs
Create a `vercel.json` file:
```json
{
  "crons": [
    {
      "path": "/api/check-upcoming-reservations",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/webhook-process-reminders",
      "schedule": "*/10 * * * *"
    }
  ]
}
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

### Testing Minute Precision
1. Create a template with "1:30" hours before
2. Create a reservation for 2 hours from now
3. Verify the reminder is scheduled for 30 minutes from now
4. Test day-of templates with specific times like "10:05"

## Troubleshooting

### Common Issues

#### Reminders Not Being Scheduled
- Check if reservation status is "confirmed"
- Verify reminder templates are active
- Ensure customer has a valid phone number
- Check database logs for trigger errors
- Verify timezone settings

#### SMS Not Being Sent
- Verify OpenPhone API credentials
- Check phone number format (should start with +)
- Review error messages in the database
- Test SMS sending manually

#### Templates Not Appearing
- Check if migration was run successfully
- Verify RLS policies allow admin access
- Check database connection

#### Minute Precision Not Working
- Verify send_time format is correct ("HH:MM" for day_of, "H:M" for hour_before)
- Check that the migration script was run
- Ensure the API is using the updated logic

### Debug Steps
1. Check the browser console for JavaScript errors
2. Review server logs for API errors
3. Query the database directly to verify data
4. Test individual API endpoints
5. Check timezone settings in admin/settings

## Security Considerations

- **Row Level Security (RLS)** enabled on all tables
- **Admin-only access** to template management
- **Webhook secret** for secure automated processing
- **Input validation** on all API endpoints
- **Error logging** for debugging without exposing sensitive data

## Performance Considerations

- **Indexed queries** for efficient reminder processing
- **Batch processing** to handle multiple reminders efficiently
- **Cron job optimization** to avoid overwhelming the system
- **Database connection pooling** for better performance

## Future Enhancements

- **A/B testing** for message templates
- **Customer preferences** for reminder timing
- **Advanced scheduling** (weekdays only, specific dates)
- **Analytics dashboard** for reminder effectiveness
- **Integration with calendar systems**

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