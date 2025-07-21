# BALANCE SMS Workflow Implementation

## Overview

This implementation adds a new SMS command "BALANCE" to the existing OpenPhone webhook system. When a member sends "BALANCE" to the house account (9137774488), they will receive their current month ledger PDF via SMS.

## Implementation Details

### 1. Webhook Handler (`src/pages/api/openphoneWebhook.js`)

**New BALANCE Command Handler:**
- Added after the existing "MEMBER" command handler
- Checks if sender is a member using existing `checkMemberStatus()` function
- Calculates current billing month based on member's join date
- Generates PDF using existing `LedgerPdfGenerator` class
- Uploads PDF to Supabase storage
- Sends SMS with PDF link and custom message

**Key Features:**
- ✅ Member verification
- ✅ Billing month calculation (based on join date)
- ✅ PDF generation with current month transactions
- ✅ Supabase storage upload
- ✅ SMS delivery with PDF link
- ✅ Error handling with admin notifications
- ✅ User-friendly error messages

### 2. Billing Month Calculation

**Logic:**
```javascript
// Calculate how many months have passed since join date
const monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                       (today.getMonth() - joinDate.getMonth());

// Calculate current billing period
const currentPeriodStart = new Date(joinDate);
currentPeriodStart.setMonth(joinDate.getMonth() + monthsSinceJoin);
currentPeriodStart.setDate(joinDate.getDate());

const currentPeriodEnd = new Date(joinDate);
currentPeriodEnd.setMonth(joinDate.getMonth() + monthsSinceJoin + 1);
currentPeriodEnd.setDate(joinDate.getDate() - 1); // Day before next period
```

**Example:**
- Member joined: April 15, 2025
- Current date: July 21, 2025
- Billing period: July 15, 2025 - August 14, 2025

### 3. SMS Message Format

**Success Message:**
```
Hi {first_name} - Here is the most recent statement for your Noir membership. Please let us know if you have any questions. Thank you! {PDF_URL}
```

**Error Messages:**
- Non-member: "Thank you for your balance request, however only Noir members are able to request their ledger. You may contact us directly for assistance."
- System error: "Sorry, we encountered an error processing your balance request. Please try again later or contact us directly."

### 4. Error Handling

**Comprehensive error handling includes:**
- ✅ Member not found → Send error message to user
- ✅ PDF generation fails → Send error notification to admin (+19137774488)
- ✅ Storage upload fails → Throw error (handled by catch block)
- ✅ SMS sending fails → Log error and return appropriate response

**Admin Notifications:**
- Error messages sent to +19137774488 when BALANCE requests fail
- Includes phone number and error details for debugging

### 5. File Structure

```
src/pages/api/openphoneWebhook.js  # Main webhook handler (updated)
src/utils/ledgerPdfGenerator.js    # PDF generation (existing)
test-balance-logic.js              # Logic testing
test-balance-sms-simple.js         # Webhook testing
test-billing-month-calculation.js  # Billing calculation testing
BALANCE_SMS_IMPLEMENTATION.md      # This documentation
```

## Testing

### 1. Logic Testing
```bash
node test-balance-logic.js
```
Tests:
- ✅ Billing month calculation
- ✅ BALANCE command parsing
- ✅ Phone number formatting
- ✅ Error handling scenarios

### 2. Webhook Testing
```bash
node test-balance-sms-simple.js
```
Tests:
- ✅ BALANCE command with member phone
- ✅ BALANCE command with non-member phone
- ✅ Invalid commands
- ✅ Existing MEMBER command

### 3. Billing Calculation Testing
```bash
node test-billing-month-calculation.js
```
Tests:
- ✅ Various join dates
- ✅ Edge cases (this month, last month)
- ✅ Date calculations

## Usage

### For Members:
1. Send "BALANCE" to +19137774488
2. Receive SMS with PDF link to current month ledger
3. PDF contains all transactions for their billing period

### For Admins:
- Error notifications sent to +19137774488
- Logs available in webhook console
- PDFs stored in Supabase storage bucket 'ledger-pdfs'

## Security & Validation

### Member Verification:
- Uses existing `checkMemberStatus()` function
- Supports multiple phone number formats
- Only active members can request balance

### PDF Security:
- PDFs uploaded to Supabase storage with unique filenames
- Public URLs generated for SMS delivery
- Files include timestamp to prevent conflicts

### Error Prevention:
- Comprehensive try-catch blocks
- Graceful degradation on failures
- Admin notifications for debugging

## Integration Points

### Existing Systems Used:
- ✅ OpenPhone SMS API
- ✅ Supabase database (members table)
- ✅ Supabase storage (ledger-pdfs bucket)
- ✅ LedgerPdfGenerator class
- ✅ Existing webhook infrastructure

### New Features Added:
- ✅ BALANCE command handler
- ✅ Billing month calculation
- ✅ Error notification system
- ✅ Comprehensive testing suite

## Future Enhancements

### Potential Improvements:
1. **Caching**: Cache PDFs for frequently requested periods
2. **Analytics**: Track BALANCE request frequency
3. **Customization**: Allow members to specify date ranges
4. **Notifications**: Email fallback if SMS fails
5. **Rate Limiting**: Prevent spam requests

### Monitoring:
- Log all BALANCE requests
- Track success/failure rates
- Monitor PDF generation times
- Alert on repeated failures

## Deployment Checklist

### Environment Variables Required:
- ✅ `OPENPHONE_API_KEY`
- ✅ `OPENPHONE_PHONE_NUMBER_ID`
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

### Database Requirements:
- ✅ `members` table with phone numbers
- ✅ `ledger` table with transactions
- ✅ `ledger-pdfs` storage bucket

### Testing Requirements:
- ✅ Test with real member phone numbers
- ✅ Verify PDF generation and storage
- ✅ Confirm SMS delivery
- ✅ Test error scenarios

## Support & Maintenance

### Troubleshooting:
1. Check webhook logs for errors
2. Verify member phone numbers in database
3. Confirm Supabase storage permissions
4. Test OpenPhone API connectivity

### Monitoring:
- Monitor webhook response times
- Track PDF generation success rates
- Alert on repeated failures
- Review admin error notifications

---

**Status: ✅ IMPLEMENTATION COMPLETE**

The BALANCE SMS workflow is fully implemented and tested. Members can now text "BALANCE" to +19137774488 to receive their current month ledger PDF via SMS. 