# Comprehensive Analysis: Admin Calendar Page Functionality

## Executive Summary
This document provides a complete analysis of the admin calendar page functionality to guide the creation of a new, properly architected reservations page.

---

## 1. Calendar Page Structure (`src/pages/admin/calendar.tsx`)

### Main Components
- **FullCalendarTimeline**: Day view timeline component
- **ReservationEditDrawer**: Slide-out drawer for editing reservations
- **NewReservationModal**: Modal for creating new reservations
- **MonthView**: Month grid view component
- **AllReservationsView**: List view of all reservations

### View Types
1. **Day Timeline**: FullCalendar resource timeline view
2. **Month Covers**: Calendar grid showing daily reservation counts
3. **All Reservations**: List/table view with search and filters

### State Management
- `reloadKey`: Forces re-fetch of data
- `currentView`: Controls which view is displayed
- `currentDate`: Currently selected date
- `isFullScreen`: Full screen toggle state
- Modal/Drawer open states managed at page level

---

## 2. FullCalendarTimeline Component Analysis

### Core Features
- **FullCalendar Library**: Uses `@fullcalendar/react` with:
  - `resourceTimelinePlugin`: Timeline view with resources (tables)
  - `interactionPlugin`: Drag/drop and resizing

### Key Functionality

#### Data Fetching
- Fetches tables from `/api/tables` → mapped to resources
- Fetches reservations from `/api/reservations` → mapped to events
- Fetches private events from `/api/private-events`
- Real-time updates via Supabase subscription:
  ```typescript
  supabase
    .channel('reservations')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'reservations'
    }, () => fetchReservations())
    .subscribe();
  ```

#### Event Rendering
- **Custom event content** via `eventContent` prop
- Shows: Name, Party Size, Event Type Emoji
- Member indicator: 🖤 prefix for members
- Check-in status: Different background color (`#a59480` checked in, `#353535` not checked)
- Blocking events: Private events shown as gray blocking overlays

#### Drag & Drop
- **Drag**: Move reservation to different time/table
- **Resize**: Change reservation duration
- **Touch Support**: Optimized for touch devices
  - `eventDragMinDistance`: 5px for touch, 3px for mouse
  - Long press delays adjusted for touch
- **Validation**: Prevents dropping on private event blocks

#### Interaction
- **Slot Click**: Opens NewReservationModal
- **Event Click**: Opens ReservationEditDrawer
- **Private Event Blocking**: Prevents slot clicks during private events

#### Private Events
- Creates blocking events across all tables
- Shows private event title with 🔒 icon
- Prevents new reservations during blocked times
- Displays RSVP list below calendar on desktop

#### Mobile Optimizations
- Touch detection and mobile-specific layouts
- Custom header with date navigation
- Adjusted slot sizes and font sizes
- Touch-friendly drag distances

---

## 3. Reservation Data Structure

### Database Schema (from migrations)
```sql
reservations:
  - id: UUID (primary key)
  - table_id: UUID (nullable for private events)
  - start_time: TIMESTAMPTZ
  - end_time: TIMESTAMPTZ
  - party_size: INTEGER
  - first_name: TEXT
  - last_name: TEXT
  - email: TEXT
  - phone: TEXT
  - event_type: TEXT
  - notes: TEXT
  - membership_type: TEXT ('member' | 'non-member')
  - checked_in: BOOLEAN
  - checked_in_at: TIMESTAMPTZ
  - source: TEXT ('website' | 'manual' | etc.)
  - private_event_id: UUID (nullable)
  - payment_intent_id: UUID (nullable)
  - hold_amount: DECIMAL
  - hold_status: TEXT
  - created_at: TIMESTAMPTZ
  - updated_at: TIMESTAMPTZ
```

### Event Type Icons
- birthday: 🎂
- engagement: 💍
- anniversary: 🥂
- party: 🎉
- graduation: 🎓
- corporate: 🧑‍💼
- holiday: ❄️
- networking: 🤝
- fundraiser: 🎗️
- bachelor: 🥳
- bachelorette: 🥳
- fun: 🍸
- date: 💕
- private_event: 🔒

---

## 4. API Endpoints

### GET `/api/reservations`
- Optional query params: `startDate`, `endDate`
- Returns all reservations with table relationships
- Ordered by `start_time` ascending

### POST `/api/reservations`
- Creates new reservation
- Auto-assigns table if not provided
- Creates Stripe hold for non-members
- Sends SMS confirmation
- Sends admin notification
- Returns created reservation

### GET `/api/reservations/[id]`
- Fetches single reservation with table relationship

### PATCH `/api/reservations/[id]`
- Updates reservation fields
- Sends admin notification on modification
- Returns updated reservation

### DELETE `/api/reservations/[id]`
- Deletes reservation

### GET `/api/tables`
- Returns all tables with `id`, `table_number`, `seats`
- Ordered by `table_number` ascending

---

## 5. Real-Time Updates

### Supabase Subscription
- Subscribes to `postgres_changes` on `reservations` table
- Listens for all events (`*`)
- Automatically refetches reservations on any change
- Enables auto-updates when front-end users submit reservations

---

## 6. Table Management

### Resources as Tables
- Each table becomes a timeline resource (row)
- Table number displayed as resource title
- Tables fetched from database and sorted by number
- Table assignments tracked via `table_id` in reservations

---

## 7. Timezone Handling

### Key Functions (`src/utils/dateUtils.ts`)
- `fromUTC()`: Converts UTC to local timezone (CST default)
- `toUTC()`: Converts local timezone to UTC
- `localInputToUTC()`: Converts datetime-local input to UTC
- `utcToLocalInput()`: Converts UTC to datetime-local format
- All times stored in UTC, displayed in configured timezone

### Settings Context
- Timezone stored in settings table
- Default: `America/Chicago`
- Used throughout for display and conversion

---

## 8. Private Events

### Features
- Block all tables during private event times
- Display as gray blocking overlays
- Prevent new reservations during blocked times
- Show RSVP list with inline editing
- Expandable table rows for RSVP management

### Database Structure
```sql
private_events:
  - id: UUID
  - title: TEXT
  - start_time: TIMESTAMPTZ
  - end_time: TIMESTAMPTZ
  - status: ENUM ('active', 'cancelled', 'completed')
  - full_day: BOOLEAN
  - require_time_selection: BOOLEAN
  - rsvp_url: TEXT (unique)
```

---

## 9. Mobile/Touch Optimizations

### Touch Detection
- Detects touch devices vs desktop
- Different interaction thresholds
- Mobile-specific layouts

### Mobile Features
- Custom header with navigation
- Adjusted font sizes
- Touch-friendly drag distances
- Optimized scrolling
- Prevented text selection during drag

---

## 10. Customization Points

### Display Customization
- Event content rendering (name, party size, emoji)
- Colors based on check-in status
- Member indicators
- Event type icons
- Private event blocking visualization

### Interaction Customization
- Drag/drop enable/disable
- Slot selection enable/disable
- View-only mode

---

## 11. Goals for New Reservations Page

1. **Timeline View**: Show reservations across tables on a timeline
2. **Customizable Information**: Display configurable reservation details
3. **Auto-Updates**: Real-time updates when front-end users submit
4. **Drag/Drop**: Move reservations between times/tables
5. **Touch Support**: Full mobile/touch optimization
6. **Proper Modal Handling**: No z-index or stacking context issues
7. **Clean Architecture**: Proper component separation and state management

---

## 12. Key Issues to Avoid

### From Current Implementation
- **Modal Z-Index Conflicts**: FullCalendar creates stacking contexts
- **Portal Issues**: Need proper portal configuration
- **CSS Conflicts**: Multiple CSS files with conflicting rules
- **State Management**: Modal state at wrong level
- **Drag/Drop Conflicts**: High z-index during drag

### Solutions for New Page
- Use React Portal for modals (render at document.body)
- Proper CSS architecture with clear z-index hierarchy
- State management at appropriate component levels
- Separate concerns: timeline, modals, drawers
- Use CSS modules or styled-components for isolation

---

## Next Steps

1. Create new reservations page route
2. Build timeline component with proper architecture
3. Implement modal with correct portal handling
4. Add drag/drop functionality
5. Integrate real-time updates
6. Add customization options
7. Optimize for mobile/touch


