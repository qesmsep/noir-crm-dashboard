# Waitlist System Setup Guide

## Overview

The waitlist system allows potential members to submit applications via SMS and Typeform. The system uses **dynamic field mapping** to handle Typeform changes without code modifications.

## How It Works

1. **User texts "MEMBER"** to 913.777.4488
2. **OpenPhone webhook** sends Typeform link via SMS
3. **User completes Typeform** application
4. **Typeform webhook** processes submission and stores in database
5. **Admin dashboard** shows applications for review
6. **Admin approves/denies** applications with automated SMS responses

## Dynamic Field Mapping

The system uses a configuration-based approach for maximum flexibility:

### Configuration File: `config/typeform-mapping.js`

```javascript
const FIELD_MAPPING = {
  'first_name': ['Q1', 'first_name_field', 'First name'],
  'last_name': ['Q2', 'last_name_field', 'Last name'],
  'email': ['Q3', 'email_field', 'Email'],
  'phone': ['Q4', 'phone_field', 'Phone number'],
  // Add new fields here
};
```

### Adding New Questions

1. **Add to Typeform**: Create the new question in your Typeform
2. **Update config**: Add the field mapping to `config/typeform-mapping.js`
3. **Add database column** (if needed): `ALTER TABLE waitlist ADD COLUMN new_field TEXT;`

### Field Types Supported

- `text` - Short text answers
- `long_text` - Long text answers  
- `email` - Email addresses
- `phone_number` - Phone numbers
- `choice` - Multiple choice answers
- `date` - Date selections
- `file_url` - File uploads

## Setup Instructions

### 1. Environment Variables

```bash
# OpenPhone Configuration
OPENPHONE_API_KEY=sk-proj-...
OPENPHONE_PHONE_NUMBER_ID=...

# Supabase Configuration  
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Typeform Configuration
TYPEFORM_WEBHOOK_URL=https://your-domain.com/api/waitlist-webhook
```

### 2. OpenPhone Webhook Setup

1. Go to OpenPhone dashboard
2. Navigate to Integrations/Webhooks
3. Add webhook with URL: `https://your-domain.com/api/openphoneWebhook`
4. Set trigger to "Message received"

### 3. Typeform Webhook Setup

1. Go to Typeform dashboard
2. Open your waitlist form
3. Go to Connect > Webhooks
4. Add webhook with URL: `https://your-domain.com/api/waitlist-webhook`
5. Set trigger to "Form response"

### 4. Database Setup

The waitlist table is created automatically via Supabase migration:

```sql
CREATE TABLE waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  city_state TEXT,
  referral TEXT,
  visit_frequency TEXT,
  go_to_drink TEXT,
  status waitlist_status DEFAULT 'review',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT,
  review_notes TEXT,
  typeform_response_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints

### GET `/api/waitlist`
Fetch waitlist entries with filtering and pagination.

**Query Parameters:**
- `status` - Filter by status (review, approved, denied)
- `limit` - Number of entries to return (default: 10)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "data": [...],
  "count": 5,
  "statusCounts": [
    {"status": "review", "count": 3},
    {"status": "approved", "count": 1},
    {"status": "denied", "count": 1}
  ]
}
```

### PATCH `/api/waitlist`
Update waitlist entry status and send SMS notification.

**Request Body:**
```json
{
  "id": "entry-uuid",
  "status": "approved|denied",
  "review_notes": "Optional notes"
}
```

**Response:**
```json
{
  "success": true,
  "data": {...},
  "message": "Waitlist entry approved successfully"
}
```

## Admin Interface

### Dashboard Integration

The dashboard automatically shows:
- **Members Queue count** - Number of applications in "review" status
- **Waitlist Queue** - Next 5 applications with click-to-review functionality

### Waitlist Management Page

Access via `/admin/waitlist` for full management:
- Filter by status
- Search by name/email
- Bulk operations
- Review modal with approve/deny actions

## SMS Messages

### Automatic Messages

1. **MEMBER Text Response:**
   ```
   Thank you for your interest in becoming a member! Please complete our application form: [Typeform URL]
   ```

2. **Application Confirmation:**
   ```
   Thank you for submitting an invitation request. We typically respond to all requests within 72 hours.
   ```

3. **Approval Message:**
   ```
   This is your invitation to become a Noir Member. To complete your membership you must complete the following form within 24 hours. https://skylineandco.typeform.com/noirkc-signup#auth_code=tw Please respond to this text with any questions. Thank you.
   ```

4. **Denial Message:**
   ```
   Thank you for your membership invitation request. At this time, our membership is full, and we will keep your information on file should any spots become available. Thank you again.
   ```

## Troubleshooting

### Common Issues

1. **"Unauthorized" SMS Errors**
   - Check OpenPhone API key and phone number ID
   - Verify API key is active in OpenPhone dashboard

2. **Webhook Not Receiving Data**
   - Verify webhook URLs are correct
   - Check Typeform webhook is active
   - Ensure domain is accessible from Typeform

3. **Field Mapping Issues**
   - Check `config/typeform-mapping.js` for correct field refs
   - Use debug logging to see actual Typeform payload
   - Update field refs based on actual Typeform structure

### Debug Tools

1. **Test Dynamic Mapping:**
   ```bash
   node test-dynamic-mapping.js
   ```

2. **Test Webhook:**
   ```bash
   node test-waitlist-webhook.js
   ```

3. **Check API Endpoints:**
   ```bash
   curl http://localhost:3000/api/waitlist?status=review
   ```

## Maintenance

### Adding New Fields

1. **Update Typeform** with new question
2. **Add to config** in `config/typeform-mapping.js`:
   ```javascript
   'new_field': ['Q10', 'new_field_ref', 'Question Title'],
   ```
3. **Add field type** in `FIELD_TYPES`:
   ```javascript
   'new_field': 'text', // or appropriate type
   ```
4. **Add database column** (if needed):
   ```sql
   ALTER TABLE waitlist ADD COLUMN new_field TEXT;
   ```

### Updating Field References

If Typeform field refs change:
1. **Get new refs** from Typeform webhook payload
2. **Update config** with new refs
3. **Test** with sample submission

### Monitoring

- Check webhook logs for errors
- Monitor SMS delivery rates
- Review waitlist application quality
- Track approval/denial rates

## Security Considerations

- All webhooks validate required fields
- Duplicate submissions are prevented
- SMS messages are rate-limited
- Admin actions are logged
- Sensitive data is encrypted in transit

## Support

For issues or questions:
1. Check this documentation
2. Review server logs
3. Test with provided debug tools
4. Contact development team 