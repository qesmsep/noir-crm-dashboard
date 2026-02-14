# Noir Member Portal System

## Overview

I've created a comprehensive member portal system for your existing Next.js/Supabase application. The system includes phone number authentication, profile management with admin approval workflow, billing information management, and a complete ledger system.

## Features Implemented

### 🔐 Authentication System
- **Phone number login** with OTP verification
- **Email login** support as alternative
- **Password creation/reset** functionality
- **New user registration** with automatic profile creation
- **Welcome credit** ($25) for new members
- Secure token-based authentication

### 🏠 Member Portal Dashboard
- **Modern, responsive design** using Chakra UI
- **Dark theme** matching your brand colors (#23201C, #28251F, #BCA892, #ECEDE8)
- **Tabbed navigation** (Overview, Profile, Ledger, Billing, Reservations)
- **Mobile-friendly** interface with responsive design
- **Real-time balance display** and account summary

### 👤 Profile Management
- **Photo upload** with 5MB limit and image validation
- **Complete profile editing** (name, email, phone, preferences)
- **Dietary restrictions** management with tag system
- **Communication preferences** (email, SMS, marketing)
- **Seating preferences** and special occasions notes
- **Admin approval workflow** for all profile changes

### 💰 Financial Management
- **Complete ledger system** showing all transactions
- **Transaction filtering** by type, date range, and search
- **Balance calculations** with credit/debit tracking
- **CSV export** functionality
- **Transaction categories**: charges, credits, payments, membership fees, beverage credits
- **Real-time balance updates**

### 💳 Billing System
- **Payment method management** (ready for Stripe integration)
- **Billing address management**
- **Default payment method** selection
- **Membership billing information**
- **Secure payment processing** infrastructure

## Database Schema

### New Tables Created
1. **`members`** - Core member profile information
2. **`member_profile_changes`** - Admin approval workflow for profile changes
3. **`member_ledger`** - Financial transaction history
4. **`member_billing_info`** - Payment methods and billing details
5. **`password_reset_tokens`** - Secure password reset functionality

### Key Features
- **Row Level Security (RLS)** on all tables
- **Audit trails** for all changes
- **Automatic balance calculations** with PostgreSQL functions
- **Enum types** for consistent data validation
- **Indexes** for optimal performance

## API Endpoints

### Authentication
- `/auth/member-login` - Enhanced login page with phone/email support

### Member Portal APIs
- `/api/member-portal/profile` - Get member profile data
- `/api/member-portal/ledger` - Get transaction history
- `/api/member-portal/pending-changes` - Get pending approval items
- `/api/member-portal/create-profile` - Create new member profile
- `/api/member-portal/submit-changes` - Submit profile changes for approval
- `/api/member-portal/upload-photo` - Handle photo uploads

## Components Created

### Core Components
1. **`MemberProfileModal`** - Comprehensive profile editing with approval workflow
2. **`MemberLedger`** - Transaction history with filtering and export
3. **`MemberBilling`** - Payment method and billing address management
4. **Member Portal Dashboard** - Main portal interface

### Key Features
- **TypeScript support** throughout
- **Error handling** and user feedback
- **Loading states** and progress indicators
- **Form validation** and data sanitization
- **Responsive design** for all screen sizes

## Security Features

### Data Protection
- **Row Level Security** ensures members only see their own data
- **JWT token validation** on all API endpoints
- **File upload validation** with type and size checks
- **SQL injection protection** via parameterized queries
- **Admin approval workflow** for sensitive changes

### User Experience
- **Phone number formatting** and validation
- **Real-time form validation**
- **Toast notifications** for user feedback
- **Confirmation dialogs** for destructive actions
- **Auto-save** functionality where appropriate

## Integration Points

### Existing System
- **Supabase authentication** integration
- **Stripe payment processing** ready for implementation
- **Existing reservation system** compatibility
- **Admin dashboard** integration points
- **SMS/Email notifications** infrastructure

### Future Enhancements
- **Reservation management** in member portal
- **Guest management** features
- **Event booking** capabilities
- **Loyalty program** integration
- **Mobile app** support

## File Structure

```
src/
├── pages/
│   ├── auth/
│   │   └── member-login.tsx           # Enhanced login page
│   ├── member-portal/
│   │   └── index.tsx                  # Main portal dashboard
│   └── api/
│       └── member-portal/
│           ├── profile.ts             # Profile data API
│           ├── ledger.ts              # Transaction history API
│           ├── pending-changes.ts     # Approval workflow API
│           ├── create-profile.ts      # New member creation
│           ├── submit-changes.ts      # Change submission API
│           └── upload-photo.ts        # Photo upload handler
├── components/
│   └── member-portal/
│       ├── MemberProfileModal.tsx     # Profile editing modal
│       ├── MemberLedger.tsx          # Transaction history component
│       └── MemberBilling.tsx         # Billing management component
└── supabase/
    └── migrations/
        └── 20250127_member_portal_enhancements.sql
```

## Getting Started

### 1. Run Database Migration
```bash
# Apply the database migration
psql -d your_database -f supabase/migrations/20250127_member_portal_enhancements.sql
```

### 2. Install Dependencies
```bash
npm install formidable
```

### 3. Environment Variables
Ensure your `.env.local` includes:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Create Upload Directory
```bash
mkdir -p public/uploads/member-photos
```

### 5. Access the Portal
- **Member Login**: `http://localhost:3000/auth/member-login`
- **Member Portal**: `http://localhost:3000/member-portal`

## Admin Features

### Approval Workflow
- All profile changes are tracked in `member_profile_changes` table
- Admin dashboard can review and approve/reject changes
- Email/SMS notifications can be sent to admins for pending changes
- Audit trail maintains complete change history

### Member Management
- View all member profiles and changes
- Approve/reject profile modifications
- Monitor account balances and transactions
- Manage billing and payment methods

## Testing the System

### Test User Flow
1. **Registration**: Go to login page, enter phone number, complete OTP verification, set password
2. **Profile Setup**: Upload photo, add dietary restrictions, set preferences
3. **Profile Changes**: Modify information and submit for approval
4. **Ledger Review**: View transaction history, filter by type/date, export CSV
5. **Billing Management**: Add payment methods, update billing address

### Sample Data
The system automatically creates:
- Welcome credit for new members ($25)
- Default communication preferences
- Basic member profile structure

## Next Steps

1. **Integrate Stripe payment processing** for the billing system
2. **Build admin approval interface** for reviewing member changes
3. **Add reservation management** to the member portal
4. **Implement email/SMS notifications** for approvals
5. **Add mobile app** support with PWA features

## Support

The system is built with comprehensive error handling, logging, and user feedback. All sensitive operations require admin approval, ensuring data integrity and security while providing members with a seamless self-service experience.