# Minaka Calendar Sync

This feature syncs events from the Minaka venue management app to the Noir CRM dashboard's event calendar.

## Setup

### Environment Variable

Add the following environment variable to your `.env.local` file (or your deployment environment):

```env
MINAKA_CALENDAR_URL=https://www.minaka.app/api/user/calendar/feed.ics?token=YOUR_TOKEN_HERE
```

Replace `YOUR_TOKEN_HERE` with your actual Minaka calendar feed token.

### How It Works

1. **API Endpoint**: `/api/minaka-events`
   - Fetches the iCal feed from Minaka
   - Parses the iCal data using `node-ical`
   - Converts events to the format used by the calendar
   - Returns events with metadata (guest count, client info, etc.)

2. **Event Calendar Page**: `/admin/event-calendar`
   - Fetches Minaka events alongside local private events
   - Displays them in the calendar view
   - Shows Minaka events with a purple color and calendar icon
   - Includes Minaka events in the day details modal

3. **Full Calendar Timeline**: The timeline view also displays Minaka events alongside other events

## Event Data

Minaka events include:
- **Title**: Event name from Minaka
- **Start/End Time**: Converted from America/Chicago to UTC for storage
- **Guest Count**: Extracted from event description
- **Client Name**: Extracted from event description
- **Client Email**: Extracted from event description
- **Location**: Event location
- **Minaka URL**: Link to view event in Minaka
- **Source**: Marked as `'minaka'` to distinguish from local events

## Timezone Handling

- Events are stored in UTC in the database (consistent with other events)
- Displayed in CST/CDT in the user interface
- The iCal feed uses `America/Chicago` timezone
- Conversion is handled automatically by the API endpoint

## Visual Distinction

Minaka events are visually distinct from local events:
- **Calendar View**: Purple background color (#7B1FA2)
- **Event Cards**: Light purple background (#F3E5F5)
- **Badge**: "Minaka" badge in event details
- **Icon**: Calendar emoji (📅) next to event name

## Troubleshooting

If Minaka events are not appearing:

1. Check that `MINAKA_CALENDAR_URL` is set correctly
2. Verify the token in the URL is valid and has not expired
3. Check the browser console for any error messages
4. Verify the API endpoint `/api/minaka-events` is accessible
5. Check server logs for parsing errors

## API Response Format

```json
{
  "data": [
    {
      "id": "minaka-user-event-xxx",
      "title": "Event Name",
      "start_time": "2025-12-05T23:00:00.000Z",
      "end_time": "2025-12-06T04:30:00.000Z",
      "description": "Event description...",
      "guest_count": 80,
      "client_name": "Client Name",
      "client_email": "client@example.com",
      "location": "Noir",
      "minaka_url": "https://minaka.app/events/xxx",
      "source": "minaka"
    }
  ]
}
```






