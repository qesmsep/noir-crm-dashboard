# Reservation Edit Feature

## Overview
This feature adds the ability to edit reservation details directly from the calendar view using a compact drawer modal that slides in from the right side and pushes the calendar over by 25%.

## Components Created

### 1. API Route: `/api/reservations/[id]/route.ts`
- **GET**: Fetches individual reservation details by ID
- **PATCH**: Updates reservation details
- Supports updating: first_name, last_name, party_size, start_time, end_time, event_type, notes, email, phone
- Automatically updates the `updated_at` timestamp

### 2. React Component: `ReservationEditDrawer.tsx`
- Compact drawer modal (25% viewport width, max 400px) that slides in from the right side
- **Calendar Interaction**: When open, the calendar slides over by 25% to make room for the drawer
- Displays all reservation details in an organized, compact layout
- Allows editing of:
  - Contact Information (first name, last name, email, phone)
  - Reservation Details (party size, event type, start time, end time, notes)
  - Shows system information (created date, last updated, source)
- Real-time validation and error handling
- Success/error toast notifications
- Background overlay with blur effect

## Integration

### FullCalendarTimeline Component Updates
- Replaced the old modal with the new compact drawer
- Added state management for drawer open/close
- Updated event click handler to open drawer instead of modal
- Added CSS transitions to slide calendar over when drawer opens
- Added callback to refresh calendar data after updates

## Features

### Editable Fields
1. **Name**: First and last name
2. **Contact**: Email and phone number (with formatting)
3. **Party Size**: Dropdown with options 1-15 people
4. **Event Type**: Dropdown with predefined event types (birthday, engagement, etc.)
5. **Time**: Start and end time with datetime-local inputs
6. **Notes**: Text area for special requests

### Event Types Available
- 🎂 Birthday
- 💍 Engagement  
- 🥂 Anniversary
- 🎉 Party / Celebration
- 🎓 Graduation
- 🧑‍💼 Corporate Event
- ❄️ Holiday Gathering
- 🤝 Networking
- 🎗️ Fundraiser / Charity
- 🥳 Bachelor / Bachelorette Party
- 🍸 Fun Night Out
- 💕 Date Night

### System Information Display
- Table assignment
- Membership status (Member/Guest)
- Creation date and time
- Last update date and time
- Reservation source

## Usage

1. Click on any reservation in the calendar view
2. The drawer will slide in from the right side (25% width)
3. The calendar will slide over by 25% to make room for the drawer
4. Edit any of the available fields
5. Click "Save Changes" to update the reservation
6. The calendar will automatically refresh to show the updated information

## Technical Details

### API Endpoints
- `GET /api/reservations/[id]` - Fetch reservation details
- `PATCH /api/reservations/[id]` - Update reservation details

### State Management
- Uses React hooks for local state management
- Real-time form validation
- Loading states for API calls
- Error handling with user-friendly messages

### Styling
- Uses Chakra UI components for consistent design
- Compact layout optimized for 25% viewport width
- Smooth CSS transitions for calendar sliding
- Background overlay with blur effect
- Proper spacing and typography
- Color-coded membership badges

## Error Handling
- Network error handling with retry options
- Form validation with real-time feedback
- User-friendly error messages
- Graceful fallbacks for missing data

## Future Enhancements
- Bulk edit capabilities
- Reservation duplication
- Advanced filtering and search
- Export functionality
- Audit trail for changes 