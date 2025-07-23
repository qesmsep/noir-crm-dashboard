# Reservation Notification Workflow

## Overview

This system automatically sends SMS notifications to **6199713730** whenever a reservation is created or modified through any channel:

- **Website reservations** (via the booking form)
- **Text message reservations** (via SMS)
- **Manual reservations** (via admin dashboard)

## How It Works

### 1. Notification Endpoint

The system uses a dedicated API endpoint at `/api/reservation-notifications` that:

- Accepts `reservation_id` and `action` parameters
- Fetches reservation details from the database
- Formats a comprehensive message including:
  - Customer name
  - Date and time (in local timezone)
  - Party size
  - Table assignment
  - Event type
  - Member status
  - Source of reservation (Text/Website/Manual)
  - Special requests (if any)

### 2. Integration Points

The notification is triggered at these key points:

#### Website Reservations (`/api/reservations`)
- **Location**: `src/app/api/reservations/route.ts`
- **Trigger**: After successful reservation creation
- **Action**: `created`

#### Reservation Updates (`/api/reservations/[id]`)
- **Location**: `src/app/api/reservations/[id]/route.ts`
- **Trigger**: After successful reservation modification
- **Action**: `modified`

#### SMS Reservations (OpenPhone Webhook)
- **Location**: `src/pages/api/openphoneWebhook.js`
- **Trigger**: After successful SMS reservation creation
- **Action**: `created`

#### Legacy SMS Reservations
- **Location**: `src/pages/api/smsReservation.js`
- **Trigger**: After successful SMS reservation creation
- **Action**: `created`

### 3. Message Format

The notification message includes:

```
Noir Reservation [action] ([source]): [Customer Name], [Date] at [Time], [Party Size] guests, Table [Number], [Event Type], Member: [Yes/No]

Special Requests: [Notes] (if any)
```

**Examples:**
- `Noir Reservation created (Website): John Smith, 01/15/24 at 7:30 PM, 4 guests, Table 5, Dining, Member: Yes`
- `Noir Reservation created (Text): Jane Doe, 01/16/24 at 8:00 PM, 2 guests, Table 3, Birthday, Member: No`

### 4. Error Handling

- **Non-blocking**: Notification failures don't prevent reservation creation/modification
- **Logging**: All notifications are logged in the `guest_messages` table
- **Retry logic**: Built into the OpenPhone API for delivery reliability

## Configuration

### Environment Variables Required

```bash
# OpenPhone Configuration (for SMS sending)
OPENPHONE_API_KEY=your_openphone_api_key
OPENPHONE_PHONE_NUMBER_ID=your_phone_number_id

# Site URL (for internal API calls)
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### Database Requirements

The system uses existing tables:
- `reservations` - for reservation data
- `settings` - for timezone configuration
- `guest_messages` - for notification logging
- `tables` - for table information

## Testing

### Manual Test

Use the test script to verify the notification system:

```bash
node test-reservation-notification.js
```

This script will:
1. Find a recent reservation in the database
2. Send a test notification to 6199713730
3. Verify the message was logged in the database
4. Display the results

### Real-time Testing

1. **Website**: Make a reservation through the booking form
2. **SMS**: Send a text message with reservation details
3. **Admin**: Create a reservation through the admin dashboard

All should trigger notifications to 6199713730.

## Monitoring

### Logs to Watch

- **Success**: `Notification sent successfully to 6199713730`
- **Failure**: `Failed to send notification to 6199713730: [error]`
- **API Errors**: Check server logs for OpenPhone API errors

### Database Monitoring

Check the `guest_messages` table for notification records:

```sql
SELECT * FROM guest_messages 
WHERE phone = '+16199713730' 
ORDER BY timestamp DESC 
LIMIT 10;
```

## Troubleshooting

### Common Issues

1. **No notifications received**
   - Check OpenPhone API credentials
   - Verify `NEXT_PUBLIC_SITE_URL` is set correctly
   - Check server logs for API errors

2. **Notifications sent but not received**
   - Verify phone number format (+16199713730)
   - Check OpenPhone account status
   - Verify message delivery in OpenPhone dashboard

3. **Partial notifications**
   - Check if all integration points are working
   - Verify database connectivity
   - Check for JavaScript errors in browser console

### Debug Steps

1. Run the test script: `node test-reservation-notification.js`
2. Check server logs for notification attempts
3. Verify OpenPhone API credentials
4. Test the notification endpoint directly
5. Check database for logged messages

## Security Considerations

- **Phone number hardcoded**: The target number (6199713730) is hardcoded for security
- **API authentication**: Uses service role key for database access
- **Error handling**: Failures don't expose sensitive information
- **Logging**: All notifications are logged for audit purposes

## Future Enhancements

Potential improvements:
- **Configurable phone numbers**: Allow multiple notification recipients
- **Notification preferences**: Different message formats for different recipients
- **Delivery confirmations**: Track delivery status
- **Rate limiting**: Prevent notification spam
- **Template system**: Customizable message templates 