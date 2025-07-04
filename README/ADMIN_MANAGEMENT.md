# Admin Management System

## Overview

The Admin Management System provides comprehensive control over admin users within the Noir CRM Dashboard. It allows super admins to create, edit, and manage admin access levels with granular permissions.

## Features

### 🎯 Core Functionality
- **Admin User Management**: Create, edit, and remove admin users
- **Access Level Control**: Assign different permission levels (Admin, Super Admin)
- **User Profile Management**: Update admin information including name, email, and phone
- **Search & Filtering**: Find admins quickly with search and filter options
- **Audit Logging**: Track all admin management actions
- **Statistics Dashboard**: View admin counts and status overview

### 🔐 Access Levels

#### Admin
- Full access to manage the application
- Can manage members, reservations, settings, and templates
- Cannot manage other admins
- Cannot access system-level settings

#### Super Admin
- Enhanced permissions including admin management
- Can manage everything including other admins and system settings
- Full access to all features
- Can delete other admins

### 📊 Admin Statistics
- **Total Admins**: Count of all admin users
- **Active Admins**: Count of active admin users
- **Super Admins**: Count of super admin users

## Database Schema

### Tables Used

#### `admins`
Dedicated table for admin user information:
```sql
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    access_level TEXT NOT NULL DEFAULT 'admin' CHECK (access_level IN ('admin', 'super_admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
```

#### `auth.users`
Supabase authentication users (managed by Supabase):
- Stores authentication credentials
- Links to admin records via `auth_user_id`
- Handles login/logout and session management

#### `audit_logs`
Tracks admin management actions:
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action audit_action NOT NULL,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### Admin Management
- `GET /api/admins` - List all admins
- `POST /api/admins` - Create new admin
- `PUT /api/admins` - Update existing admin
- `DELETE /api/admins?id={id}` - Remove admin role

### Request/Response Examples

#### GET /api/admins
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "admin@example.com",
      "phone": "+1234567890",
      "first_name": "John",
      "last_name": "Doe",
      "access_level": "admin",
      "status": "active",
      "created_at": "2024-01-28T10:00:00Z",
      "last_login_at": "2024-01-28T15:30:00Z"
    }
  ]
}
```

#### POST /api/admins
```json
{
  "email": "newadmin@example.com",
  "password": "securepassword123",
  "phone": "+1234567890",
  "first_name": "Jane",
  "last_name": "Smith",
  "access_level": "admin"
}
```

#### PUT /api/admins
```json
{
  "id": "uuid",
  "email": "updated@example.com",
  "phone": "+1234567890",
  "first_name": "Jane",
  "last_name": "Smith",
  "access_level": "super_admin"
}
```

## Admin Interface

### Access
Navigate to **Admin → Admins** in the sidebar to access the admin management interface.

### Features

#### Admin List
- **Table View**: Displays all admins with their information
- **Search**: Search by name, email, or phone number
- **Filters**: Filter by status and access level
- **Actions**: Edit or remove admin access

#### Add New Admin
1. Click "Add Admin" button
2. Fill in required information:
   - First Name (required)
   - Last Name (required)
   - Email (required)
   - Phone (optional)
   - Access Level (Admin or Super Admin)
   - Password (required for new admins)
3. Click "Create Admin"

#### Edit Admin
1. Click the edit icon next to an admin
2. Update the information
3. Click "Update Admin"

#### Remove Admin
1. Click the delete icon next to an admin
2. Confirm the action
3. Admin role will be removed (user account remains)

## Security Features

### Row Level Security (RLS)
- Admins can only view and manage profiles they have permission for
- Super admins have full access to admin management
- Regular admins cannot manage other admins

### Audit Logging
- All admin management actions are logged
- Includes user ID, action type, and details
- Tracks IP address and timestamp

### Permission System
- Granular permissions for different admin levels
- Role-based access control
- Secure API endpoints with proper validation

## Setup Instructions

### 1. Database Migration
Run the admin management migrations:
```sql
-- Execute the migration files:
-- supabase/migrations/20250128_add_admin_management.sql
-- supabase/migrations/20250129_create_admins_table.sql
```

### 2. Environment Variables
Ensure these environment variables are set:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Initial Admin Setup
1. The migration will automatically create a super admin for `tim@828.life`
2. Log in with your existing credentials
3. Access the admin interface to manage additional admins
4. Only super admins can access the admin management page

## Best Practices

### Admin Management
- **Limit Super Admins**: Only assign super admin to trusted users
- **Regular Review**: Periodically review admin access and permissions
- **Strong Passwords**: Enforce strong password policies
- **Audit Logs**: Regularly review audit logs for suspicious activity

### Security
- **Principle of Least Privilege**: Only grant necessary permissions
- **Regular Updates**: Keep admin accounts updated with current information
- **Access Monitoring**: Monitor admin login patterns
- **Backup Procedures**: Maintain backup admin accounts

## Troubleshooting

### Common Issues

#### Admin Cannot Access Management
- Check if user has admin role assigned
- Verify RLS policies are properly configured
- Ensure user has required permissions

#### API Errors
- Verify service role key is correct
- Check database connection
- Review audit logs for detailed error information

#### Permission Denied
- Confirm user has appropriate role
- Check role permissions in database
- Verify RLS policies

### Support
For technical support or questions about admin management:
1. Check the audit logs for error details
2. Verify database permissions and roles
3. Review API endpoint responses
4. Contact system administrator

## Future Enhancements

### Planned Features
- **Two-Factor Authentication**: Enhanced security for admin accounts
- **Admin Activity Dashboard**: Detailed activity monitoring
- **Bulk Operations**: Manage multiple admins at once
- **Advanced Permissions**: More granular permission system
- **Admin Groups**: Group-based permission management
- **Session Management**: Monitor and manage admin sessions

### Integration Opportunities
- **SSO Integration**: Single sign-on for admin access
- **LDAP/Active Directory**: Enterprise directory integration
- **API Rate Limiting**: Enhanced API security
- **Webhook Notifications**: Real-time admin activity notifications 