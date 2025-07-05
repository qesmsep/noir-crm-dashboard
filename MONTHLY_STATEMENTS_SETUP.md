# Monthly Statement System

This system automatically sends monthly statements as PDF attachments to members the day before their renewal date each month. The statements include the previous month's ledger details.

## Overview

The monthly statement system consists of:
- **PDF Generation**: Creates professional PDF statements with member info and transaction history
- **Email Delivery**: Sends statements via SendGrid with PDF attachments
- **Automated Scheduling**: Runs daily to check for members with upcoming renewals
- **Renewal Date Calculation**: Determines renewal dates based on member join dates

## Components

### 1. API Endpoints

#### `/api/monthly-statements` (POST)
Generates and downloads a monthly statement for a specific member.

**Request Body:**
```json
{
  "member_id": "member123",  // Optional: specific member ID
  "account_id": "acc456",    // Optional: specific account ID
  "month": 12,               // Optional: month (1-12)
  "year": 2024               // Optional: year
}
```

**Response:** PDF file download

#### `/api/send-monthly-statements` (POST)
Sends monthly statements via email.

**Request Body:**
```json
{
  "member_id": "member123",  // Optional: specific member ID
  "account_id": "acc456",    // Optional: specific account ID
  "month": 12,               // Optional: month (1-12)
  "year": 2024,              // Optional: year
  "send_all": true           // Optional: send to all members with renewal tomorrow
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 members",
  "results": [...],
  "successful_sends": 4,
  "failed_sends": 1
}
```

#### `/api/cron/send-statements` (GET)
Automated endpoint for daily statement sending (cron job).

**Response:**
```json
{
  "success": true,
  "message": "Daily statement job completed",
  "members_processed": 3,
  "successful_sends": 3,
  "failed_sends": 0,
  "statement_month": "January 2024",
  "results": [...]
}
```

### 2. Database Schema

#### `statement_logs` table
Tracks statement sending activities:
```sql
CREATE TABLE statement_logs (
    id UUID PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL,
    total_processed INTEGER,
    successful_sends INTEGER,
    failed_sends INTEGER,
    results JSONB,
    created_at TIMESTAMPTZ
);
```

## Setup Instructions

### 1. Environment Variables

Add these environment variables to your `.env` file:

```env
# SendGrid (required for email sending)
SENDGRID_API_KEY=your_sendgrid_api_key_here

# Application URL (for cron job)
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Database Migration

Run the database migration to create the statement_logs table:

```bash
# Apply the migration
supabase migration up
```

Or manually run the SQL in `supabase/migrations/20250201_add_statement_logs.sql`.

### 3. SendGrid Setup

1. **Create SendGrid Account**: Sign up at https://sendgrid.com/
2. **Create API Key**: 
   - Go to Settings → API Keys
   - Create a new API key with "Full Access" permissions
   - Copy the API key to your `.env` file
3. **Verify Sender**: 
   - Go to Settings → Sender Authentication
   - Verify the email address you'll use to send statements
   - Update your business email in the settings table

### 4. Cron Job Setup

#### Option A: Using the Node.js Script (Recommended)

1. Make the script executable:
```bash
chmod +x scripts/send-monthly-statements.js
```

2. Set up a cron job:
```bash
# Edit crontab
crontab -e

# Add this line to run daily at 9 AM
0 9 * * * /usr/bin/node /path/to/your/project/scripts/send-monthly-statements.js >> /var/log/monthly-statements.log 2>&1
```

#### Option B: Using curl/wget

```bash
# Add to crontab
0 9 * * * curl -X GET "https://your-domain.com/api/cron/send-statements" >> /var/log/monthly-statements.log 2>&1
```

#### Option C: Using Vercel Cron (if deployed on Vercel)

Add to your `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/send-statements",
      "schedule": "0 9 * * *"
    }
  ]
}
```

## Usage

### Manual Statement Generation

#### Generate PDF for a specific member:
```bash
curl -X POST "https://your-domain.com/api/monthly-statements" \
  -H "Content-Type: application/json" \
  -d '{"member_id": "member123"}' \
  --output statement.pdf
```

#### Send statement via email:
```bash
curl -X POST "https://your-domain.com/api/send-monthly-statements" \
  -H "Content-Type: application/json" \
  -d '{"member_id": "member123"}'
```

### Automated Daily Sending

The system automatically:
1. Runs daily at 9 AM (configurable)
2. Finds members whose renewal date is tomorrow
3. Generates monthly statements for the previous month
4. Sends statements via email with PDF attachments
5. Logs all activity to the `statement_logs` table

### Testing

#### Test the cron job script:
```bash
# Dry run (no emails sent)
node scripts/send-monthly-statements.js --dry-run

# Verbose output
node scripts/send-monthly-statements.js --verbose

# Normal run
node scripts/send-monthly-statements.js
```

#### Test API endpoints:
```bash
# Test cron endpoint
curl -X GET "http://localhost:3000/api/cron/send-statements"

# Test manual sending
curl -X POST "http://localhost:3000/api/send-monthly-statements" \
  -H "Content-Type: application/json" \
  -d '{"send_all": true}'
```

## How It Works

### Renewal Date Calculation
The system calculates renewal dates based on the member's `join_date`:
- If a member joined on January 15, 2024, their renewal date is January 15, 2025
- If the renewal date has passed this year, it uses next year's date
- Members with renewal date = tomorrow receive statements

### Statement Content
Each statement includes:
- **Member Information**: Name, email, phone, membership type, member ID
- **Transaction History**: All transactions from the previous month
- **Summary**: Total charges, total payments, current balance
- **Due Notice**: Warning if there's an outstanding balance
- **Company Information**: Business name, address, contact details

### Email Template
The email includes:
- Professional HTML formatting
- Renewal date reminder
- PDF statement attached
- Company branding and contact information

## Troubleshooting

### Common Issues

1. **SendGrid API Key Error**
   - Verify your API key is correct
   - Check that the API key has full access permissions
   - Ensure the sender email is verified in SendGrid

2. **PDF Generation Fails**
   - Check if all required packages are installed
   - Verify html-pdf-node is working properly
   - Look for memory issues with large statements

3. **Member Not Found**
   - Ensure member has a valid `join_date`
   - Check that member is not deactivated
   - Verify member has a valid email address

4. **Cron Job Not Running**
   - Check cron service is running: `systemctl status cron`
   - Verify file permissions on the script
   - Check logs for errors: `tail -f /var/log/monthly-statements.log`

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=statement:*
```

### Monitoring

Monitor statement sending activity:
```sql
-- Check recent statement sending logs
SELECT * FROM statement_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- Check success rate
SELECT 
  DATE(created_at) as date,
  SUM(successful_sends) as total_sent,
  SUM(failed_sends) as total_failed
FROM statement_logs 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Security Considerations

1. **API Access**: The cron endpoint should be protected or limited to specific IPs
2. **Email Security**: Use verified sender domains
3. **Data Privacy**: Statements contain sensitive financial information
4. **Rate Limiting**: Consider implementing rate limits for manual API calls

## Customization

### PDF Styling
Modify the CSS in `generateStatementHTML()` function to customize:
- Colors and fonts
- Layout and spacing
- Company branding
- Logo placement

### Email Template
Update the email HTML in `sendStatementEmail()` function to change:
- Email subject line
- Message content
- Branding elements
- Footer information

### Renewal Date Logic
Modify `calculateNextRenewalDate()` function to change:
- Renewal frequency (monthly vs annual)
- Grace periods
- Custom renewal schedules

## Support

For issues or questions:
1. Check the logs in `/var/log/monthly-statements.log`
2. Review the `statement_logs` table in the database
3. Test individual components using the provided curl commands
4. Contact the development team with specific error messages