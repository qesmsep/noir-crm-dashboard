# Timezone Implementation with Luxon

## Overview

This document describes the comprehensive timezone handling implementation using Luxon throughout the Noir CRM Dashboard application. The implementation ensures robust, accurate timezone handling for all date/time operations.

## Key Features

### 1. **Consistent Timezone Handling**
- All date/time inputs are interpreted in the user's configured timezone
- All date/time displays convert UTC from the database to the configured local timezone
- Seamless timezone conversion across the entire application

### 2. **Luxon Integration**
- Replaced native JavaScript Date objects with Luxon DateTime for timezone operations
- Maintained backward compatibility with existing code
- Added comprehensive utility functions for common timezone operations

## Implementation Details

### Core Utility Functions (`src/utils/dateUtils.js`)

#### Input/Output Conversion
- `utcToLocalInput(utcString, timezone)` - Convert UTC to datetime-local input value
- `localInputToUTC(localString, timezone)` - Convert datetime-local input to UTC
- `utcToDateInput(utcString, timezone)` - Convert UTC to date input value
- `dateInputToUTC(dateString, timezone)` - Convert date input to UTC
- `utcToTimeInput(utcString, timezone)` - Convert UTC to time input value
- `timeInputToUTC(timeString, timezone, date)` - Convert time input to UTC

#### Display Formatting
- `formatDate(date, timezone, options)` - Format date for display
- `formatTime(date, timezone, options)` - Format time for display
- `formatDateTime(date, timezone, options)` - Format date and time for display

#### Timezone Conversion
- `fromUTC(utcString, timezone)` - Convert UTC string to DateTime in specified timezone
- `toUTC(dateTime, timezone)` - Convert DateTime to UTC ISO string
- `isSameDay(date1, date2, timezone)` - Compare if two dates are the same day
- `startOfDay(date, timezone)` - Get start of day in timezone
- `endOfDay(date, timezone)` - Get end of day in timezone

#### Utility Functions
- `getCurrentTime(timezone)` - Get current time in timezone
- `getCurrentTimeUTC()` - Get current time as UTC
- `addDays(date, days, timezone)` - Add days to date
- `subtractDays(date, days, timezone)` - Subtract days from date
- `parseNaturalDate(dateStr, timezone)` - Parse natural date strings

### Updated Components

#### 1. **ReservationEditDrawer**
- Uses `utcToLocalInput()` and `localInputToUTC()` for datetime-local inputs
- Properly converts between UTC storage and local timezone display
- Maintains timezone consistency during edit operations

#### 2. **PrivateEventsManager**
- Updated form handling to use timezone-aware conversions
- Full-day events properly handle timezone boundaries
- Display formatting uses configured timezone

#### 3. **ReminderEditDrawer**
- Already used Luxon, now uses centralized utility functions
- Consistent timezone handling with other components

#### 4. **FullCalendarTimeline**
- Updated to use `fromUTC()` and `isSameDay()` functions
- Proper timezone handling for calendar events
- Consistent date comparison logic

#### 5. **CalendarView**
- Updated to use `fromUTC()` for event display
- Maintains compatibility with react-big-calendar

#### 6. **ReservationForm**
- Updated to use `createDateTimeFromTimeString()` with timezone support
- Proper timezone handling for reservation creation

#### 7. **SMS Reservation System**
- **smsReservation.js**: Updated to use Luxon for natural language date parsing
- **openphoneWebhook.js**: Updated to use Luxon for date/time formatting
- **reservations/route.ts**: Updated SMS confirmation messages to use Luxon
- **rsvp/route.ts**: Updated RSVP confirmation messages to use Luxon
- All SMS messages now display times in the correct timezone (America/Chicago)
- Natural language date parsing now handles timezone-aware date calculations

#### 8. **CalendarAvailabilityControl**
- Updated to use Luxon for all date/time operations
- Private event creation and editing now uses timezone-aware date handling
- Date display functions updated to use timezone-aware formatting
- Booking window date handling updated to use Luxon
- Exceptional opens/closures date display updated for timezone consistency

### Settings Integration

The implementation leverages the existing Settings context to provide timezone configuration:

```typescript
const { settings } = useSettings();
const timezone = settings?.timezone || 'America/Chicago';
```

## Usage Examples

### Converting UTC to Local Input
```javascript
// Convert UTC from database to local input
const localInput = utcToLocalInput(reservation.start_time, timezone);
// Returns: "2024-01-15T18:00"
```

### Converting Local Input to UTC
```javascript
// Convert local input to UTC for storage
const utcTime = localInputToUTC("2024-01-15T18:00", timezone);
// Returns: "2024-01-15T23:00:00Z"
```

### Formatting for Display
```javascript
// Format date/time for display
const displayTime = formatDateTime(new Date(utcTime), timezone, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});
// Returns: "6:00 PM"
```

### Date Comparison
```javascript
// Compare if two dates are the same day
const isSame = isSameDay(date1, date2, timezone);
```

## Backward Compatibility

The implementation maintains backward compatibility by:

1. **Preserving existing function names** where possible
2. **Providing fallback timezone** (America/Chicago) when settings are not available
3. **Maintaining existing API contracts** for external integrations

## Testing

The implementation has been thoroughly tested with:

1. **Build verification** - All components compile successfully
2. **Development server** - Application runs without errors
3. **Timezone conversion tests** - Verified correct timezone handling
4. **Input/output consistency** - Ensured round-trip conversions work correctly

## Benefits

### 1. **Accuracy**
- Proper handling of daylight saving time transitions
- Accurate timezone offset calculations
- Consistent behavior across different timezones

### 2. **Maintainability**
- Centralized timezone logic in utility functions
- Consistent patterns across all components
- Easy to update timezone handling globally

### 3. **User Experience**
- Times displayed in user's configured timezone
- Input times interpreted correctly in local timezone
- No confusion about timezone conversions

### 4. **Reliability**
- Robust error handling for invalid dates
- Graceful fallbacks for missing timezone settings
- Consistent behavior across different browsers

## Future Enhancements

1. **User Timezone Detection** - Automatically detect user's timezone
2. **Timezone Selection UI** - Allow users to change their timezone
3. **Multi-timezone Support** - Display times in multiple timezones
4. **Timezone-aware Notifications** - Send notifications at appropriate local times

## Migration Notes

For developers working with this codebase:

1. **Always use the utility functions** instead of direct Date manipulation
2. **Pass timezone parameter** to all date/time functions
3. **Use settings context** to get the configured timezone
4. **Test with different timezones** to ensure proper behavior

## Conclusion

The implementation provides a robust, maintainable solution for timezone handling throughout the application. All date/time operations now properly respect the configured timezone, ensuring a consistent and accurate user experience. 