# Private Events RSVP System Setup Guide

## Overview

This guide will help you set up the Private Events RSVP system for your Noir CRM Dashboard. The system allows admins to create private events with custom RSVP pages that guests can access via unique URLs.

## Features

- **Admin Features:**
  - Create private events with custom details
  - Enable/disable RSVP functionality per event
  - Upload custom background images for RSVP pages
  - Set time selection requirements
  - Manage event status (active/cancelled/completed)
  - View and manage RSVP submissions

- **Guest Features:**
  - Access RSVP pages via unique URLs
  - Submit RSVP with contact information
  - Select preferred time (if required)
  - Receive SMS confirmation
  - View event details and requirements

## Database Setup

### Step 1: Run the Migration Script

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `private_events_migration.sql`
4. Click "Run" to execute the migration

This will create:
- `private_events` table
- New columns in the `reservations` table
- Required indexes and triggers
- Row Level Security (RLS) policies
- Storage bucket for images
- Function to generate unique RSVP URLs

### Step 2: Verify Setup

After running the migration, verify that:
- The `private_events` table exists
- The `reservations` table has new columns: `private_event_id`, `source`, `time_selected`
- The storage bucket `private-events` is created
- RLS policies are in place

## Application Setup

### Step 1: Install Dependencies

The system uses existing dependencies. No additional packages are required.

### Step 2: Verify Environment Variables

Ensure your `.env.local` file contains:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENPHONE_API_KEY=your_openphone_api_key
OPENPHONE_PHONE_NUMBER_ID=your_phone_number_id
```

### Step 3: Start the Development Server

```bash
npm run dev
```

## Usage Guide

### For Admins

1. **Access Private Events Manager:**
   - Go to Admin Dashboard → Settings
   - Scroll down to the "Private Events" section

2. **Create a Private Event:**
   - Click "Create Private Event"
   - Fill in event details:
     - Title and event type
     - Date and time
     - Maximum guests
     - Deposit amount (if any)
     - Event description
   - Enable RSVP if desired
   - Upload background image (optional)
   - Set time selection requirement (optional)
   - Click "Create Event"

3. **Manage Events:**
   - View all created events in the table
   - Edit event details
   - Delete events
   - View RSVP link (if enabled)
   - Monitor RSVP submissions

### For Guests

1. **Access RSVP Page:**
   - Use the unique RSVP URL provided by the admin
   - Format: `https://yourdomain.com/rsvp/[unique-code]`

2. **Submit RSVP:**
   - Fill in contact information
   - Select party size
   - Choose preferred time (if required)
   - Add special requests
   - Submit the form

3. **Confirmation:**
   - Receive SMS confirmation
   - View confirmation modal
   - Event appears on the main calendar

## API Endpoints

### Private Events Management
- `POST /api/private-events` - Create new private event
- `GET /api/private-events` - List all private events
- `GET /api/private-events/[id]` - Get specific event
- `PATCH /api/private-events/[id]` - Update event
- `DELETE /api/private-events/[id]` - Delete event

### RSVP Functionality
- `GET /api/rsvp/[rsvpUrl]` - Get event details for RSVP page
- `POST /api/rsvp` - Submit RSVP
- `POST /api/upload-image` - Upload background image

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── private-events/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── rsvp/
│   │   │   ├── route.ts
│   │   │   └── [rsvpUrl]/route.ts
│   │   └── upload-image/route.ts
│   └── rsvp/[rsvpUrl]/page.tsx
├── components/
│   └── PrivateEventsManager.tsx
└── pages/admin/settings.tsx (updated)
```

## Calendar Integration

RSVP reservations automatically appear on the main calendar with:
- Visual indicator (blue background)
- Source marked as "rsvp_private_event"
- Link to the original private event
- Time selection (if applicable)

## SMS Integration

The system uses the existing OpenPhone integration to send:
- Confirmation messages to guests
- Event details and timing
- Contact information for changes

## Security Features

- Row Level Security (RLS) policies
- Admin-only access to event management
- Public access to active RSVP pages
- Secure image upload with validation
- Unique URL generation for each event

## Troubleshooting

### Common Issues

1. **Migration Errors:**
   - Ensure you have admin access to Supabase
   - Check that the `handle_updated_at()` function exists
   - Verify RLS policies are properly configured

2. **Image Upload Issues:**
   - Check storage bucket permissions
   - Verify file size limits (5MB max)
   - Ensure correct file types (JPEG, PNG, WebP)

3. **RSVP Page Not Found:**
   - Verify the RSVP URL is correct
   - Check that the event status is "active"
   - Ensure the event exists in the database

4. **SMS Not Sending:**
   - Verify OpenPhone API credentials
   - Check phone number formatting
   - Review API rate limits

### Debug Mode

Enable debug logging by adding to your environment:
```
DEBUG=true
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the Supabase logs
3. Check browser console for errors
4. Verify all environment variables are set correctly

## Future Enhancements

Potential improvements:
- Email confirmations in addition to SMS
- RSVP analytics and reporting
- Bulk RSVP management
- Custom RSVP form fields
- Integration with external calendar systems
- Advanced image editing capabilities 