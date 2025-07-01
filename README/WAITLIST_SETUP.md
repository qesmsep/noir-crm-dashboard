# Waitlist System Setup Guide

## Overview

The Noir CRM Dashboard now includes a comprehensive waitlist system for managing membership applications. This system allows potential members to request membership information via SMS and submit applications through a Typeform, which are then reviewed by administrators.

## Features

- **SMS Integration**: Users can text "MEMBER" to receive a link to the waitlist form
- **Typeform Integration**: Automated form submission processing
- **Admin Dashboard**: Review and manage applications with approve/deny functionality
- **Automated SMS Responses**: Automatic notifications for application status changes
- **Comprehensive Tracking**: Full audit trail of all applications and decisions

## System Flow

1. **User requests information**: User texts "MEMBER" to 913.777.4488
2. **Automated response**: System sends Typeform link via SMS
3. **Form submission**: User completes Typeform, data is stored in waitlist table
4. **Confirmation SMS**: User receives confirmation of submission
5. **Admin review**: Administrators review applications in the dashboard
6. **Decision**: Admin approves or denies application
7. **Notification**: User receives SMS with decision and next steps

## Database Setup

### Step 1: Run the Migration

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase/migrations/20250122_add_waitlist.sql`
4. Click "Run" to execute the migration

This creates:
- `waitlist` table with all necessary fields
- Status enum (`review`, `approved`, `denied`)
- Indexes for performance
- Row Level Security policies
- Helper functions for status counting

### Step 2: Verify Setup

After running the migration, verify that:
- The `waitlist` table exists with all columns
- The `waitlist_status` enum is created
- RLS policies are in place
- Indexes are created

## Typeform Setup

### Step 1: Create the Waitlist Form

1. Go to [Typeform](https://www.typeform.com) and create a new form
2. Add the following fields (adjust field references as needed):

| Field Type | Field Name | Field Reference | Required |
|------------|------------|-----------------|----------|
| Short Text | First Name | `first_name_field_ref` | Yes |
| Short Text | Last Name | `last_name_field_ref` | Yes |
| Email | Email Address | `email_field_ref` | Yes |
| Phone Number | Phone Number | `phone_field_ref` | Yes |
| Short Text | Company | `company_field_ref` | No |
| Short Text | How did you hear about us? | `how_did_you_hear_field_ref` | No |
| Long Text | Why do you want to join Noir? | `why_noir_field_ref` | No |
| Short Text | Occupation | `occupation_field_ref` | No |
| Short Text | Industry | `industry_field_ref` | No |
| Short Text | Referral | `referral_field_ref` | No |

### Step 2: Configure Webhook

1. In your Typeform, go to Settings > Integrations
2. Add a webhook with the URL: `https://your-domain.com/api/waitlist-webhook`
3. Set the webhook to trigger on form submission
4. Test the webhook to ensure it's working

### Step 3: Update Field References

In `src/pages/api/waitlist-webhook.ts`, update the field references to match your actual Typeform field IDs:

```typescript
const waitlistData = {
  first_name: findAnswer(answers, ['your_actual_first_name_field_id']),
  last_name: findAnswer(answers, ['your_actual_last_name_field_id']),
  email: findAnswer(answers, ['your_actual_email_field_id'], 'email'),
  phone: findAnswer(answers, ['your_actual_phone_field_id'], 'phone_number'),
  // ... other fields
};
```

## SMS Configuration

### Step 1: Update OpenPhone Webhook

The OpenPhone webhook (`src/pages/api/openphoneWebhook.js`) has been updated to handle "MEMBER" messages. Ensure your OpenPhone configuration is set up correctly:

- `OPENPHONE_API_KEY`: Your OpenPhone API key
- `OPENPHONE_PHONE_NUMBER_ID`: Your phone number ID

### Step 2: Test SMS Flow

1. Send "MEMBER" to your configured phone number
2. Verify you receive the Typeform link
3. Complete the form and verify the confirmation SMS

## Admin Interface

### Dashboard Integration

The waitlist queue is now integrated into the main dashboard:

- **Members Queue Card**: Shows count of applications in "Review" status
- **Waitlist Queue Section**: Lists the next 5 applications to be reviewed
- **Click to Review**: Click any application to open the review modal

### Dedicated Waitlist Page

Access the full waitlist management at `/admin/waitlist`:

- **Status Summary**: Overview of applications by status
- **Filtering**: Filter by status and search by name/email/company
- **Pagination**: Navigate through large numbers of applications
- **Bulk Actions**: Review applications with approve/deny functionality

### Review Process

1. **View Application**: Click "Review" on any application
2. **Review Details**: See all submitted information
3. **Add Notes**: Optional internal notes for the decision
4. **Make Decision**: Approve or deny the application
5. **Automatic Notification**: User receives SMS with decision

## API Endpoints

### GET /api/waitlist

Fetch waitlist entries with filtering and pagination:

```javascript
// Get all entries
GET /api/waitlist

// Filter by status
GET /api/waitlist?status=review

// Pagination
GET /api/waitlist?limit=20&offset=0
```

### PATCH /api/waitlist

Update application status:

```javascript
PATCH /api/waitlist
{
  "id": "entry-id",
  "status": "approved|denied",
  "review_notes": "Optional notes"
}
```

### POST /api/waitlist-webhook

Typeform webhook endpoint (handles form submissions automatically).

## Environment Variables

Ensure these environment variables are set:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenPhone (for SMS)
OPENPHONE_API_KEY=your_openphone_api_key
OPENPHONE_PHONE_NUMBER_ID=your_phone_number_id
```

## Testing

### Manual Testing

1. **SMS Flow**: Text "MEMBER" to your phone number
2. **Form Submission**: Complete the Typeform
3. **Admin Review**: Check the dashboard for new applications
4. **Decision Process**: Approve or deny an application
5. **Notification**: Verify the user receives the appropriate SMS

### Automated Testing

Run the test script to verify API functionality:

```bash
node test-waitlist-webhook.js
```

## Troubleshooting

### Common Issues

1. **Webhook not receiving data**: Check Typeform webhook URL and field references
2. **SMS not sending**: Verify OpenPhone API credentials
3. **Database errors**: Ensure migration was run successfully
4. **Permission errors**: Check RLS policies in Supabase

### Debug Logs

Check the browser console and server logs for detailed error information. All API endpoints include comprehensive logging.

## Security Considerations

- All database operations use Row Level Security (RLS)
- API endpoints validate input data
- SMS notifications are rate-limited
- Admin access is restricted to authenticated users

## Maintenance

### Regular Tasks

1. **Review Applications**: Check the waitlist queue regularly
2. **Clean Old Data**: Archive or delete old denied applications
3. **Monitor SMS Usage**: Track OpenPhone usage and costs
4. **Update Field References**: If Typeform fields change, update the webhook

### Backup

The waitlist data is stored in Supabase and automatically backed up. Consider exporting data periodically for additional backup.

## Support

For issues or questions about the waitlist system:

1. Check the troubleshooting section above
2. Review the server logs for error details
3. Verify all environment variables are set correctly
4. Test the individual components (SMS, webhook, database) separately 