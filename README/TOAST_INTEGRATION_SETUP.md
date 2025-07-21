# Toast API Integration Setup Guide

## Overview

This integration connects Toast POS system with your Noir CRM to automatically sync house account transactions in real-time. When members make purchases using their house account in Toast, the transactions are automatically recorded in your CRM's ledger.

## Features

- **Real-time webhook processing** - Instant transaction sync
- **Automatic ledger entries** - Creates ledger transactions for house account purchases
- **Member linking** - Links transactions to members via phone number
- **Admin monitoring** - View sync status and transaction history
- **Error notifications** - SMS alerts for sync failures
- **Transaction details** - Stores items, server, table, and payment method

## Database Schema

### New Tables

#### `toast_transactions`
Stores all Toast house account transactions:
```sql
CREATE TABLE toast_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(member_id),
    account_id UUID NOT NULL,
    toast_transaction_id TEXT UNIQUE NOT NULL,
    toast_order_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    items JSONB,
    payment_method TEXT,
    server_name TEXT,
    table_number TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `toast_sync_status`
Tracks sync operations and their status:
```sql
CREATE TABLE toast_sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Updated Tables

#### `members`
Added Toast-specific fields:
```sql
ALTER TABLE members ADD COLUMN toast_account_id TEXT;
ALTER TABLE members ADD COLUMN toast_customer_id TEXT;
```

## Environment Variables

Add these to your `.env.local` file:

```bash
# Toast API Configuration
TOAST_API_KEY=your_toast_api_key_here
TOAST_BASE_URL=https://api.toasttab.com/v1
TOAST_LOCATION_ID=your_location_id

# Webhook Configuration (optional)
TOAST_WEBHOOK_SECRET=your_webhook_secret_here
```

## API Endpoints

### Webhook Endpoint
- **URL**: `/api/toast-webhook`
- **Method**: POST
- **Purpose**: Receives real-time transaction notifications from Toast

### Transaction API
- **URL**: `/api/toast-transactions`
- **Method**: GET
- **Parameters**: 
  - `member_id` (optional) - Filter by member
  - `limit` (optional) - Number of records (default: 50)
  - `offset` (optional) - Pagination offset (default: 0)

### Sync Status API
- **URL**: `/api/toast-sync-status`
- **Method**: GET
- **Parameters**:
  - `limit` (optional) - Number of records (default: 10)

## Toast Webhook Setup

### 1. Configure Toast Webhook
In your Toast POS system:
1. Navigate to **Settings > Integrations > Webhooks**
2. Add new webhook with URL: `https://your-domain.com/api/toast-webhook`
3. Set event type to: `transaction.completed`
4. Configure authentication (API key or signature)

### 2. Webhook Payload Format
Toast should send webhooks in this format:
```json
{
  "eventType": "transaction.completed",
  "transaction": {
    "id": "toast_tx_123456",
    "orderId": "order_789",
    "amount": 45.67,
    "customerPhone": "8584129797",
    "items": [
      {
        "name": "Old Fashioned",
        "description": "House cocktail",
        "price": 18.00
      }
    ],
    "paymentMethod": "house_account",
    "serverName": "Sarah",
    "tableNumber": "12",
    "transactionDate": "2024-01-15T19:30:00Z"
  },
  "customer": {
    "phone": "8584129797",
    "name": "Tim Wirick"
  }
}
```

## Admin Interface

### Member Detail Page
The Toast integration adds two new sections to member detail pages:

1. **Toast House Account Activity**
   - Shows recent Toast transactions for the member
   - Displays transaction details (date, amount, items, server, table)
   - Refresh button to manually sync

2. **Toast Sync Status**
   - Real-time sync status monitoring
   - Success/failure statistics
   - Error tracking and notifications

### Features
- **Real-time updates** - Transactions appear immediately
- **Error handling** - Failed syncs are logged and reported
- **Member linking** - Automatically links transactions to members by phone
- **Ledger integration** - Creates ledger entries for all purchases

## Testing

### Test Script
Run the provided test script to verify integration:

```bash
node test-toast-integration.js
```

This script tests:
- Member lookup by phone number
- Webhook processing
- Transaction API endpoints
- Sync status monitoring

### Manual Testing
1. **Test Member Lookup**:
   ```bash
   curl "http://localhost:3000/api/members?phone=8584129797"
   ```

2. **Test Webhook**:
   ```bash
   curl -X POST http://localhost:3000/api/toast-webhook \
     -H "Content-Type: application/json" \
     -d @test-webhook-payload.json
   ```

3. **Test Transactions API**:
   ```bash
   curl "http://localhost:3000/api/toast-transactions?limit=10"
   ```

## Error Handling

### Automatic Error Notifications
- Failed webhook processing sends SMS to `9137774488`
- Sync errors are logged in `toast_sync_status` table
- Admin interface shows error details and statistics

### Common Issues

1. **Member Not Found**
   - Phone number doesn't match any member
   - Check phone number format in Toast vs CRM
   - Verify member exists in database

2. **Webhook Authentication**
   - Invalid API key or signature
   - Check environment variables
   - Verify Toast webhook configuration

3. **Database Errors**
   - Check Supabase connection
   - Verify table permissions
   - Review error logs

## Monitoring

### Sync Status Dashboard
- **Total Syncs (24h)** - Number of sync operations
- **Records Processed** - Successful transaction imports
- **Success Rate** - Percentage of successful syncs
- **Error Details** - Specific error messages and timestamps

### Logs
- Webhook processing logs in console
- Database errors in Supabase logs
- SMS notifications for critical failures

## Security

### Webhook Security
- API key authentication
- Optional webhook signature verification
- Rate limiting (implemented in webhook handler)

### Data Protection
- Phone numbers are normalized for matching
- Sensitive data is not logged
- RLS policies protect transaction data

## Troubleshooting

### Webhook Not Receiving Data
1. Check Toast webhook configuration
2. Verify webhook URL is accessible
3. Test with curl or Postman
4. Check server logs for errors

### Transactions Not Appearing
1. Verify member exists with correct phone
2. Check webhook payload format
3. Review sync status for errors
4. Test member lookup API

### Sync Failures
1. Check environment variables
2. Verify database permissions
3. Review error messages in sync status
4. Test individual API endpoints

## Future Enhancements

### Planned Features
- **Batch sync** - Manual sync of historical data
- **Transaction reconciliation** - Compare Toast vs CRM totals
- **Advanced filtering** - Filter transactions by date, amount, etc.
- **Export functionality** - Export transaction data
- **Analytics dashboard** - Spending patterns and trends

### API Improvements
- **Webhook signature verification** - Enhanced security
- **Rate limiting** - Prevent abuse
- **Retry logic** - Handle temporary failures
- **Bulk operations** - Process multiple transactions

## Support

For issues or questions:
1. Check the sync status dashboard
2. Review error logs in console
3. Test with the provided test script
4. Contact development team with specific error messages

## Migration Notes

### Database Migration
Run the migration to create required tables:
```bash
# Apply the migration
supabase db push
```

### Environment Setup
1. Add Toast API credentials to environment
2. Configure webhook URL in Toast
3. Test with provided test script
4. Monitor sync status dashboard

### Member Data
- Existing members will work automatically
- Phone numbers are matched using multiple formats
- No manual data migration required 