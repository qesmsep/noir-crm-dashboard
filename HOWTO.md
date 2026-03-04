**AI INSTRUCTION: Read this entire HOWTO.md file first to understand the Noir CRM Dashboard application architecture, systems, workflows, and codebase structure. Use this document as your primary reference for all development tasks, troubleshooting, and feature implementation. Reference specific sections as needed throughout our conversation.**

---

## ⚠️ URGENT: DO NOT COMMIT ANY CHANGES WITHOUT EXPRESSED APPROVAL FROM TIM

**CRITICAL RULE**: You must NEVER create git commits or push changes without explicit approval from Tim. Only commit when Tim specifically asks you to commit changes.

---

# Noir CRM Dashboard - HOWTO Guide

**The Critical Reference Document for Understanding and Working with Noir-OS**

> This document serves as the comprehensive guide to understanding, troubleshooting, and extending the Noir CRM Dashboard application. Reference this file at the start of any new development session or when onboarding new developers.

---

## 📋 Summary

**Last Updated**: 2026-02-07

This 100-line summary provides a high-level overview of the Noir CRM Dashboard system architecture, key concepts, and how to use this reference manual efficiently.

### What is Noir CRM Dashboard?

A comprehensive restaurant/membership management system for Noir, a private membership establishment. Built with Next.js 15.3.3, Chakra UI, and Supabase (PostgreSQL with RLS).

**Core Capabilities**:
- Reservation management with table assignment and automated SMS reminders
- Member management (profiles, balances, membership types: Skyline/Duo/Solo/Annual)
- Campaign system for automated SMS followups
- Private events with RSVP system
- Waitlist management and application review
- Financial management (ledger, Stripe integration, balance tracking)
- Member Portal (Phase 1: Login, Dashboard, Profile - read-only)
- Admin Dashboard (comprehensive management interface)

### Tech Stack Quick Reference

**Frontend**: Next.js 15.3.3 (Pages Router + App Router hybrid), Chakra UI 2.7.1, Tailwind CSS 3.4.1, FullCalendar 6.1.17, Luxon 3.6.1 (timezone handling)

**Backend**: Node.js 22.x, Next.js API Routes, Supabase (PostgreSQL + Auth + Storage + RLS)

**External Services**: OpenPhone (SMS), Stripe (payments), Typeform (waitlist), Vercel Analytics

**Key Libraries**: Zod 4.1.12 (validation), Winston 3.18.3 (logging), PDFKit (PDF generation), Lucide React (icons)

### Critical Business Rules

1. **Timezones**: Store UTC, display CST (America/Chicago) - See README/TIMEZONE_IMPLEMENTATION.md
2. **Hold Fees**: Configurable for non-member reservations via Stripe
3. **Membership Types**: Skyline (unlimited + $100 monthly credit), Duo, Solo, Annual
4. **Monthly Credits**: Reset based on join_date, not calendar month
5. **Reservation Duration**: 90min (party ≤2), 120min (party >2)
6. **Test Mode Filter**: Available but does NOT affect reservation campaigns

### Database Architecture (Section 4, Line ~546)

**Core Tables**:
- `members` - Member profiles, accounts, membership types
- `reservations` - Bookings with table assignments, timestamps (UTC)
- `tables` - Table inventory (capacity, location, type)
- `campaigns` - SMS campaign definitions
- `campaign_sends` - Individual SMS sends with status tracking
- `ledger_entries` - Financial transactions (charges, credits, payments)
- `private_events` - Event definitions with RSVP system
- `waitlist_applications` - New member applications from Typeform

**Member Portal Tables** (Phase 1):
- `member_portal_sessions` - Session tracking
- `member_portal_settings` - Portal configuration
- `phone_otp_codes` - SMS OTP for phone authentication
- `member_portal_activity_log` - Audit trail

**RLS Policies**: Enabled on all tables, member portal uses `is_member_portal_admin()` helper

### Design System (Section 3, Line ~97)

**Brand Identity**: Sleek, sexy, elegant, simple, clean, sophisticated, refined, minimal

**Color Palette**:
- Cork (#A59480) - Primary accent, CTAs
- Night Sky (#353535) - Dark backgrounds, secondary buttons
- Wedding Day (#ECEDE8) - Light backgrounds
- Day Break (#1F1F1F) - Primary text

**UI Guidelines**:
- **Mobile-first**: Design for 320px-768px first
- **3-layer drop shadows**: All buttons use sophisticated shadow system
- **Button hierarchy**: Primary (Cork), Secondary (Dark), Tertiary (White)
- **Border radius**: 10px (buttons), 16px (cards), 5-6px (small)
- **Icons**: Lucide React only (NEVER emojis)
- **Typography**: Montserrat (body), IvyJournal (headings)

**Reference**: `.claude/commands/brand.md` for complete design system

### Authentication & Authorization (Section 8, Line ~1105)

**Admin Auth**: Supabase Auth with email/password, AuthContext provides session

**Member Portal Auth**:
- Magic link (email) via Supabase
- SMS OTP (phone) via custom implementation
- MemberAuthContext provides session management
- Session tracking in `member_portal_sessions` table

**RLS Implementation**:
- All tables use Row Level Security
- Admin queries use service role key (bypasses RLS)
- Member portal uses auth token (enforces RLS)
- Helper function: `is_member_portal_admin()` for admin overrides

### API Structure (Section 6, Line ~954)

**Admin APIs** (`/pages/api/*`):
- Members: Create, update, search, balance management
- Reservations: CRUD operations, table assignment
- Campaigns: Create, send SMS, track status
- Private Events: RSVP management
- Waitlist: Application review and approval

**Member Portal APIs** (`/app/api/member/*`):
- `/profile` - Get member profile (read-only)
- `/balance` - Get balance + recent transactions
- `/reservations` - List upcoming/past reservations

**Error Format**: `{ error: "message" }` (consistent across all endpoints)

### Key Workflows (Section 9, Line ~1152)

1. **Create Reservation**: Check availability → Assign table → Create booking → Send confirmation SMS
2. **Member Signup**: Waitlist application → Review → Approve → Create member account → Send welcome email
3. **Campaign Send**: Define campaign → Select recipients → Queue SMS → Track delivery
4. **Balance Management**: Ledger entry → Update balance → Send receipt (if applicable)
5. **Private Event RSVP**: Event page → Guest submits form → Confirmation → Admin dashboard tracking

### File Organization (Section 15, Line ~2563)

```
/src
  /pages
    /admin          - Admin dashboard pages (Pages Router)
    /api            - Admin API routes (Pages Router)
  /app
    /member         - Member portal pages (App Router)
    /api/member     - Member portal APIs (App Router)
  /components       - Shared + admin components
    /member         - Member portal specific components
    /ui             - UI primitives (Shadcn-style)
  /context          - React contexts (Auth, Settings, Member)
  /lib              - Utilities, helpers, constants
  /styles           - CSS modules, global styles
/migrations         - Database migration scripts
/README             - Feature-specific documentation
/.claude/commands   - Specialized AI agents
```

### Common Patterns (Section 14, Line ~2471)

**API Route Pattern**:
```typescript
// Verify auth, get Supabase client with RLS
const { data, error } = await supabase.from('table').select('*')
return res.json({ data }) or res.status(500).json({ error })
```

**Component Pattern**:
- Use Chakra UI components
- Apply brand colors via theme
- Mobile-first responsive design
- Use Lucide React icons

**Database Query Pattern**:
- Always use RLS-enabled client for member portal
- Store timestamps in UTC
- Convert to CST for display using Luxon
- Use foreign keys for relationships

### How to Use This Manual Efficiently

**For Quick Lookups**: Use grep to search for specific sections
```bash
# Read summary (this section)
grep "^## 📋 Summary" HOWTO.md -A 100

# Read database schema section
grep "^## Database Schema" HOWTO.md -A 200

# Read troubleshooting guide
grep "^## Troubleshooting Guide" HOWTO.md -A 100
```

**For Deep Dives**: Jump to the numbered section referenced in parentheses
- Example: "Database Schema (Section 4, Line ~546)" → Read from line 546

**For Feature Work**:
1. Read relevant section (e.g., Section 5 for core systems)
2. Check existing patterns in Section 14
3. Review file organization in Section 15
4. Invoke specialized agents (Pattern Finder, Schema Scout, etc.)

**For Debugging**: Section 13 (Troubleshooting Guide, Line ~2367)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack & Architecture](#tech-stack--architecture)
3. [Design System & Brand Guidelines](#design-system--brand-guidelines)
4. [Database Schema](#database-schema)
5. [Core Systems & Features](#core-systems--features)
6. [API Structure](#api-structure)
7. [Component Architecture](#component-architecture)
8. [Authentication & Authorization](#authentication--authorization)
9. [Key Workflows](#key-workflows)
10. [Integration Points](#integration-points)
11. [Member Portal System](#member-portal-system)
12. [Development Setup](#development-setup)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Common Patterns & Best Practices](#common-patterns--best-practices)
15. [File Organization](#file-organization)
16. [Testing & Deployment](#testing--deployment)
17. [Changelog & Commit Log](#changelog--commit-log)

---

## Project Overview

**Noir CRM Dashboard** is a comprehensive restaurant/membership management system built for Noir, a private membership establishment. The system handles:

- **Reservation Management**: Booking system with table assignment, availability checking, and automated reminders
- **Member Management**: Member profiles, accounts, balances, and membership types (Skyline, Duo, Solo, Annual)
- **Campaign System**: Automated SMS campaigns for member followups, reminders, and communications
- **Private Events**: RSVP system for private events with custom pages
- **Waitlist Management**: Application review system for new members
- **Financial Management**: Ledger system, Stripe integration for holds/charges, balance tracking
- **Admin Dashboard**: Comprehensive admin interface for managing all aspects of the business

### Key Business Rules

- **Timezones**: All times stored in UTC, displayed in CST (America/Chicago) - See [Timezone Implementation](README/TIMEZONE_IMPLEMENTATION.md)
- **Hold Fees**: Configurable hold fees for non-member reservations via Stripe
- **Membership Types**: Skyline, Duo, Solo, Annual with different credit systems
- **Monthly Credits**: Skyline members get $100 credit reset monthly based on join_date
- **Reservation Duration**: 90 minutes for parties ≤2, 120 minutes for parties >2
- **Test Mode Filter**: Does not affect reservation campaigns

---

## Tech Stack & Architecture

### Frontend
- **Framework**: Next.js 15.3.3 (Pages Router + App Router hybrid)
- **UI Library**: Chakra UI 2.7.1
- **State Management**: React Context (AuthContext, SettingsContext, AppContext)
- **Calendar**: FullCalendar 6.1.17 (Resource Timeline), react-big-calendar
- **Forms**: React Hook Form with Zod validation
- **Date/Time**: Luxon 3.6.1 (timezone handling), date-fns-tz, moment
- **Styling**: Tailwind CSS 3.4.1, CSS modules

### Backend
- **Runtime**: Node.js 22.x
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth
- **API**: Next.js API Routes (both `/pages/api` and `/app/api`)

### External Services
- **SMS**: OpenPhone API
- **Payments**: Stripe (Payment Intents for holds, charges)
- **Storage**: Supabase Storage (images, attachments)
- **Forms**: Typeform (waitlist applications)
- **Analytics**: Vercel Analytics

### Key Libraries
- **Validation**: Zod 4.1.12
- **Logging**: Winston 3.18.3
- **PDF Generation**: PDFKit
- **HTTP Client**: node-fetch
- **UUID**: uuid 11.1.0

---

## Design System & Brand Guidelines

### Overview

**Current Status**: The Noir CRM Dashboard is undergoing a complete design transformation to match the sophistication and elegance of the landing page aesthetic.

**Goal**: Transform the functional CRM into a sleek, sexy, elegant, simple, and clean mobile-first experience.

**Design Reference**: `src/pages/admin/homepage.tsx` - This page demonstrates the target aesthetic for ALL admin pages.

### Brand Identity: Noir

**Aesthetic Keywords**: Sleek, sexy, elegant, simple, clean, sophisticated, refined, minimal

**Design Philosophy**:
- Mobile-first approach (design for mobile, scale to tablet/desktop)
- Less text, more icons
- Strategic use of whitespace
- Maximum information density without clutter
- Every pixel serves a purpose

### Color Palette

#### Noir Brand Colors (Primary)

```css
/* Light/Dark Mode Base Colors */
weddingDay: #ECEDE8    /* Light mode background - warm cream */
nightSky: #353535      /* Dark mode background - sophisticated charcoal */

/* Accent Colors (Earth Tones) */
cork: #A59480          /* Warm taupe - primary accent */
daybreak: #CAC2B9      /* Soft beige - secondary accent */
greige: #ABA8A1        /* Neutral greige - tertiary accent */

/* Deep Blacks */
noir.black: #1F1F1F    /* Primary black */
noir.black: #1A1A1A    /* Alternative black */
```

#### Supporting Palette (from Homepage)

```css
/* Backgrounds */
#F6F5F2    /* Light warm grey */
#FBFBFA    /* Off-white */
#F7F6F3    /* Warm white */
white      /* Pure white */

/* Borders */
#ECEAE5    /* Primary border */
#DAD7D0    /* Secondary border */
#EFEDE8    /* Tertiary border */
#E6E0D8    /* Accent border */

/* Text Hierarchy */
#1F1F1F    /* Primary text - deep black */
#2C2C2C    /* Secondary text - charcoal */
#5A5A5A    /* Tertiary text - grey */
#8C7C6D    /* Muted text - warm grey */

/* Functional Colors */
#8B4A4A    /* Error/Destructive - muted red */
```

#### Accent Color Usage Rules

Use Noir brand colors (cork, daybreak, greige) for:
- ✅ **Selected states**: Highlighted boxes, active tabs, selected items
- ✅ **Buttons**: Primary actions (cork/darker accents), secondary (lighter variants)
- ✅ **Icons**: Color-coded by function (edit, delete, info)
- ✅ **Links**: Cork or daybreak with hover/active states
- ✅ **Status indicators**: Earth tones for different states
- ❌ **NOT for distractions**: Colors accent, they don't dominate

**Rule**: Neutral backgrounds + strategic color pops = sophisticated elegance

### Light Mode & Dark Mode

#### Light Mode Configuration
```css
Background: weddingDay (#ECEDE8) or white
Cards: White with subtle borders (#ECEAE5)
Text: Dark (#1F1F1F, #2C2C2C, #5A5A5A)
Accents: Cork, daybreak, greige (unchanged)
Shadows: Minimal, subtle
```

#### Dark Mode Configuration
```css
Background: nightSky (#353535) or darker variants
Cards: Lighter dark (#2A2A2A, #404040) with subtle borders
Text: Light (whites, creams, light greys)
Accents: Cork, daybreak, greige (adjusted for contrast)
Shadows: Deeper, more pronounced
```

#### Dark Mode Implementation Notes
- Maintain earth-tone accents (may need slight contrast adjustments)
- Invert text: dark backgrounds → light text
- Keep borders subtle but visible
- Use elevation/shadows more prominently than in light mode

### Typography

**Principle**: Use the fonts from the landing page throughout the entire app.

**Reference Files**:
- `src/theme-apple.ts` - Apple-inspired theme with font definitions
- `src/theme.js` - Original theme
- `src/pages/admin/homepage.tsx` - Live example of typography in use

#### Font Hierarchy

**Headings**:
- Weight: Bold (700)
- Color: Dark (#1F1F1F in light mode, light in dark mode)
- Clear size hierarchy (H1 > H2 > H3 > H4)

**Body Text**:
- Weight: Regular (400) to Medium (500)
- Color: #2C2C2C (light mode), light grey (dark mode)
- Generous line-height for readability

**Small Text / Captions**:
- Weight: Light (300) to Regular (400)
- Color: Muted (#5A5A5A, #8C7C6D)
- Used for secondary information

#### Responsive Typography
- Mobile: Smaller font sizes, tighter line-height
- Tablet: Medium font sizes
- Desktop: Larger font sizes, generous spacing

### Mobile-First Design Principles

#### Layout Rules (CRITICAL)

**NO Horizontal Scrolling**:
- ✅ All content FIXED width to screen
- ✅ Responsive breakpoints handle different widths
- ❌ NEVER allow horizontal overflow on mobile

**Vertical Scrolling**:
- ✅ Permitted and encouraged for natural mobile behavior
- Use smooth scroll, proper content hierarchy

**Popups & Menus**:
- ✅ All popups/modals/drawers MUST be visible within screen bounds
- ✅ Bottom sheets preferred on mobile over centered modals
- ✅ Dropdowns that extend off-screen must reposition

#### Navigation Patterns

**Primary Actions**:
- Bottom navigation bars (mobile)
- Floating action buttons (FAB) for key actions
- Prominent buttons in easy-to-reach areas

**Secondary Actions**:
- 3-dot menu (⋮) with popover display
- Hidden in hamburger menus or "More" sections
- Swipe gestures where appropriate

**Tertiary Actions**:
- Nested within secondary menus
- Contextual actions in long-press menus

#### Touch Interactions

**Touch Targets**:
- Minimum 44px height (Apple HIG standard)
- Minimum 48px recommended for primary actions
- Adequate spacing between tappable elements (8px minimum)

**Visual Feedback (REQUIRED)**:
Every user action MUST have immediate visual response:
- ✅ Button press: Color shift, scale animation, shadow change
- ✅ Link tap: Color change, underline, background highlight
- ✅ Toggle/Switch: Smooth animation, color transition
- ✅ Loading states: Spinner, skeleton screen, progress indicator
- ✅ Success/Error: Toast notification, color change, checkmark/X icon
- ❌ NO silent actions - user must know their tap was registered

**Animation Timing**:
- Quick feedback: 0.1s - 0.15s (immediate response)
- Standard transitions: 0.2s - 0.3s (smooth, not sluggish)
- Complex animations: 0.3s - 0.5s (drawer open/close)
- Use `cubic-bezier(0.4, 0, 0.2, 1)` for natural easing

#### Screen Real Estate Optimization

**Maximize Efficiency**:
- Show maximum relevant information without overwhelming
- Progressive disclosure: Show essentials, hide details until needed
- Collapsible sections for secondary information
- Card-based layouts for grouped content

**Icon vs Text Strategy**:
- **Phase 1** (Current): Use text labels for clarity
- **Phase 2** (Refinement): Replace text with icons where intuitive
- **Always**: Provide tooltips/labels on icon hover/long-press
- **Best Practice**: Icon + text for primary actions, icon-only for secondary

**Information Density**:
- Mobile: Minimal density, focus on primary info
- Tablet: Medium density, show more context
- Desktop: High density, show full details

### Component Design Standards

#### Borders & Radius

```css
/* Border Radius */
buttons: 8px - 12px      /* Subtle rounding */
cards: 12px - 16px       /* Medium rounding */
modals: 16px - 20px      /* Generous rounding */
images: 8px              /* Subtle image rounding */

/* Border Widths */
default: 1px solid
focus: 2px solid
active: 2px solid

/* Border Colors */
light-mode: #ECEAE5, #DAD7D0, #EFEDE8
dark-mode: Lighter variants of nightSky
```

#### Shadows & Elevation

**Light Mode**:
```css
sm: 0 1px 2px rgba(0, 0, 0, 0.05)
md: 0 4px 6px rgba(0, 0, 0, 0.07)
lg: 0 10px 15px rgba(0, 0, 0, 0.1)
```

**Dark Mode**:
```css
sm: 0 1px 2px rgba(0, 0, 0, 0.3)
md: 0 4px 6px rgba(0, 0, 0, 0.4)
lg: 0 10px 15px rgba(0, 0, 0, 0.5)
```

**Usage**:
- Use sparingly for elevation hierarchy
- Cards: sm shadow
- Modals: md shadow
- Dropdowns: md to lg shadow

#### Spacing Scale

```css
4px   /* xs - tight spacing */
8px   /* sm - compact spacing */
12px  /* md - comfortable spacing */
16px  /* lg - generous spacing */
24px  /* xl - section spacing */
32px  /* 2xl - major section spacing */
48px  /* 3xl - page section spacing */
```

**Application**:
- Between elements: 8px - 12px
- Between sections: 24px - 32px
- Page padding: 16px (mobile), 24px (tablet), 32px (desktop)

#### Button Standards

**Variants**:
```css
solid:   Background filled (cork, nightSky), white text
outline: Border + text color, transparent background
ghost:   No border, text color only, subtle hover background
```

**Sizes**:
```css
sm:  32px height, 12px padding
md:  40px height, 16px padding
lg:  48px height, 20px padding
xl:  56px height, 24px padding (rare, hero actions)
```

**States**:
- **Default**: Base styling
- **Hover**: Slight color shift, subtle scale (1.02x), shadow increase
- **Active**: Pressed state, slight scale down (0.98x)
- **Disabled**: Opacity 0.5, no pointer events
- **Loading**: Spinner icon, disabled state

**Example**:
```css
.button-solid {
  background: #A59480; /* cork */
  color: white;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.button-solid:hover {
  background: #8f7e6b; /* darker cork */
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.button-solid:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
```

### Component Patterns

#### Cards

```tsx
<Card
  bg="white"
  borderRadius="xl"          // 12-16px
  border="1px solid #ECEAE5"
  boxShadow="sm"
  p={{ base: 4, md: 6 }}     // Responsive padding
>
  <CardHeader>
    <Heading size="md" color="#1F1F1F">Title</Heading>
  </CardHeader>
  <Divider borderColor="#ECEAE5" />
  <CardBody>
    {/* Content */}
  </CardBody>
</Card>
```

#### Modals/Drawers

**Mobile**: Bottom drawer (slides up from bottom)
**Tablet/Desktop**: Centered modal or side drawer

```tsx
<Drawer
  placement="bottom"        // Mobile
  size="full"              // Take most of screen
  borderTopRadius="xl"     // Rounded top corners
>
  {/* Content */}
</Drawer>
```

#### Forms

```tsx
<FormControl>
  <FormLabel color="#2C2C2C" fontWeight="medium">
    Label
  </FormLabel>
  <Input
    borderColor="#DAD7D0"
    _hover={{ borderColor: "#A59480" }}  // cork
    _focus={{ borderColor: "#A59480", boxShadow: "0 0 0 1px #A59480" }}
  />
</FormControl>
```

### Responsive Breakpoints

```css
mobile:  0px - 767px     (base in Chakra)
tablet:  768px - 1023px  (md in Chakra)
desktop: 1024px+         (lg in Chakra)
wide:    1440px+         (xl in Chakra)
```

**Usage in Chakra**:
```tsx
<Box
  p={{ base: 4, md: 6, lg: 8 }}
  fontSize={{ base: "sm", md: "md", lg: "lg" }}
>
```

### Design Implementation Phases

#### Phase 1: Foundation (Current)
- ✅ Define color palette and design system
- ✅ Create `/start` command for AI guidance
- ✅ Update HOWTO.md with design documentation
- ⏳ Implement dark/light mode toggle infrastructure
- ⏳ Create reusable component library with Noir palette
- ⏳ Establish responsive breakpoint patterns

#### Phase 2: Component Refactor
- Refactor admin pages to use new design system
- Ensure all components follow mobile-first principles
- Implement visual feedback on all interactive elements
- Remove horizontal scroll issues
- Optimize touch targets for mobile

#### Phase 3: Polish & Refinement
- Replace text with icons where appropriate
- Add micro-interactions and animations
- Conduct mobile usability testing
- Accessibility audit (WCAG 2.1 AA)
- Performance optimization
- Design consistency audit across all pages

### Theme Files

**Current Theme Files**:
- `src/theme.js` - Original simple theme (weddingDay, cork, daybreak, greige, nightSky)
- `src/theme-apple.ts` - Apple-inspired theme with extended design tokens

**Implementation Strategy**:
1. Extend existing themes to include dark mode
2. Add component-specific overrides
3. Create theme provider wrapper
4. Implement theme toggle mechanism
5. Persist user preference (localStorage)

### Mobile Optimization Checklist

For every component/page, verify:
- [ ] No horizontal scrolling on any screen size
- [ ] Touch targets minimum 44px height
- [ ] Visual feedback on all interactions
- [ ] Popups/modals fit within screen bounds
- [ ] Responsive text sizing (smaller on mobile)
- [ ] Adequate spacing between tappable elements
- [ ] Bottom navigation for primary actions (mobile)
- [ ] 3-dot menus for secondary actions
- [ ] Smooth animations (0.2s - 0.3s)
- [ ] Loading states for async operations
- [ ] Error states clearly visible
- [ ] Icons scale appropriately across devices

### Accessibility Standards

While focusing on aesthetics, maintain accessibility:
- **Color Contrast**: WCAG AA minimum (4.5:1 for text)
- **Focus States**: Visible keyboard focus indicators
- **Screen Readers**: Semantic HTML, ARIA labels
- **Touch Targets**: 44px minimum (Apple), 48px recommended (Material)
- **Motion**: Respect `prefers-reduced-motion`
- **Dark Mode**: Respect `prefers-color-scheme`

---

## Database Schema

### Core Tables

#### `members`
- `member_id` (UUID, PK)
- `account_id` (UUID) - Links to accounts table
- `first_name`, `last_name`, `email`, `phone`
- `membership` (TEXT) - 'Skyline', 'Duo', 'Solo', 'Annual'
- `monthly_credit` (DECIMAL) - Current credit balance
- `last_credit_date` (DATE) - Last credit reset
- `credit_renewal_date` (DATE) - Next renewal date
- `deactivated` (BOOLEAN)
- `created_at`, `updated_at`

#### `reservations`
- `id` (UUID, PK)
- `member_id` (UUID, FK) - Nullable for non-members
- `table_id` (UUID, FK)
- `start_time`, `end_time` (TIMESTAMPTZ) - Stored in UTC
- `party_size` (INTEGER)
- `event_type` (TEXT) - 'Dining', 'Birthday', etc.
- `status` (TEXT) - 'pending', 'confirmed', 'cancelled', 'completed'
- `phone`, `email`, `first_name`, `last_name` - For non-members
- `membership_type` (TEXT) - 'member' or 'non-member'
- `payment_method_id` (TEXT) - Stripe payment method
- `payment_intent_id` (TEXT) - Stripe payment intent for holds
- `hold_amount` (DECIMAL)
- `hold_status` (TEXT)
- `hold_created_at` (TIMESTAMPTZ)
- `checked_in` (BOOLEAN)
- `source` (TEXT) - 'website', 'text', 'manual', 'rsvp_private_event'
- `private_event_id` (UUID, FK) - For RSVP reservations
- `notes` (TEXT)
- `created_at`, `updated_at`

#### `tables`
- `id` (UUID, PK)
- `table_number` (INTEGER, UNIQUE)
- `capacity` (INTEGER)
- `status` (TEXT) - 'active', 'inactive'
- `created_at`, `updated_at`

#### `campaigns`
- `id` (UUID, PK)
- `name` (TEXT, UNIQUE)
- `description` (TEXT)
- `trigger_type` (TEXT) - 'member_signup', 'reservation_time', 'recurring', 'reservation_range', 'private_event', 'all_members'
- `is_active` (BOOLEAN)
- `recurring_schedule` (JSONB) - For recurring campaigns
- `recurring_start_date`, `recurring_end_date` (DATE)
- `reservation_range_start`, `reservation_range_end` (TIMESTAMPTZ)
- `selected_private_event_id` (UUID, FK)
- `include_event_list` (BOOLEAN)
- `event_list_date_range` (JSONB)
- `created_at`, `updated_at`

#### `campaign_messages`
- `id` (UUID, PK)
- `campaign_id` (UUID, FK)
- `name`, `description` (TEXT)
- `content` (TEXT) - SMS message template with placeholders
- `recipient_type` (TEXT) - 'member', 'both_members', 'phone', 'reservation_phone'
- `specific_phone` (TEXT) - For specific phone recipient type
- `timing_type` (TEXT) - 'specific_time', 'recurring', 'relative'
- `specific_time` (TEXT) - HH:MM format
- `specific_date` (TEXT) - For specific date timing
- `recurring_type` (TEXT) - 'daily', 'weekly', 'monthly', 'yearly'
- `recurring_time` (TEXT) - Time for recurring messages
- `recurring_weekdays` (INTEGER[]) - Array of weekday numbers
- `relative_time` (TEXT) - Time for relative timing
- `relative_quantity` (INTEGER) - Quantity for relative timing
- `relative_unit` (TEXT) - 'hour', 'day', 'week', 'month', 'year'
- `relative_proximity` (TEXT) - 'before', 'after'
- `is_active` (BOOLEAN)
- `created_at`, `updated_at`

#### `scheduled_messages`
- `id` (UUID, PK)
- `member_id` (UUID, FK)
- `campaign_id` (UUID, FK)
- `campaign_message_id` (UUID, FK)
- `message_content` (TEXT) - Rendered message with placeholders filled
- `scheduled_for` (TIMESTAMPTZ)
- `sent_at` (TIMESTAMPTZ)
- `status` (TEXT) - 'pending', 'sent', 'failed', 'cancelled'
- `openphone_message_id` (TEXT)
- `error_message` (TEXT)
- `created_at`, `updated_at`

#### `reservation_reminder_templates`
- `id` (UUID, PK)
- `name`, `description` (TEXT)
- `message_template` (TEXT) - With {{first_name}}, {{reservation_time}}, {{party_size}} placeholders
- `reminder_type` (TEXT) - 'day_of', 'hour_before'
- `send_time` (TEXT) - "HH:MM" for day_of, "H:M" or "H" for hour_before
- `is_active` (BOOLEAN)
- `created_at`, `updated_at`

#### `scheduled_reservation_reminders`
- `id` (UUID, PK)
- `reservation_id` (UUID, FK)
- `template_id` (UUID, FK)
- `customer_name`, `customer_phone` (TEXT)
- `message_content` (TEXT)
- `scheduled_for` (TIMESTAMPTZ)
- `sent_at` (TIMESTAMPTZ)
- `status` (TEXT) - 'pending', 'sent', 'failed', 'cancelled'
- `openphone_message_id` (TEXT)
- `error_message` (TEXT)
- `created_at`, `updated_at`

#### `private_events`
- `id` (UUID, PK)
- `title`, `event_type` (TEXT)
- `event_date`, `event_time` (TIMESTAMPTZ)
- `max_guests`, `total_attendees_maximum` (INTEGER)
- `deposit_amount` (DECIMAL)
- `description` (TEXT)
- `rsvp_enabled` (BOOLEAN)
- `rsvp_url` (TEXT, UNIQUE) - Unique token for RSVP page
- `background_image_url` (TEXT)
- `time_selection_required` (BOOLEAN)
- `status` (TEXT) - 'active', 'cancelled', 'completed'
- `created_at`, `updated_at`

#### `waitlist`
- `id` (UUID, PK)
- `first_name`, `last_name`, `email`, `phone` (TEXT)
- `company`, `referral`, `how_did_you_hear`, `why_noir`, `occupation`, `industry` (TEXT)
- `status` (TEXT) - 'review', 'approved', 'denied', 'waitlisted'
- `submitted_at`, `reviewed_at` (TIMESTAMPTZ)
- `reviewed_by` (UUID, FK)
- `review_notes` (TEXT)
- `typeform_response_id` (TEXT)
- `created_at`, `updated_at`

#### `ledger`
- `id` (UUID, PK)
- `account_id` (UUID, FK)
- `member_id` (UUID, FK)
- `type` (TEXT) - 'charge', 'payment', 'credit', 'refund'
- `amount` (DECIMAL)
- `date` (DATE)
- `note` (TEXT)
- `stripe_payment_intent_id` (TEXT)
- `stripe_charge_id` (TEXT)
- `created_at`, `updated_at`

#### `admins`
- `id` (UUID, PK)
- `auth_user_id` (UUID, FK) - References auth.users
- `first_name`, `last_name`, `email`, `phone` (TEXT)
- `access_level` (TEXT) - 'admin', 'super_admin'
- `status` (TEXT) - 'active', 'inactive'
- `created_by` (UUID, FK)
- `created_at`, `updated_at`, `last_login_at`

#### `settings`
- `id` (UUID, PK)
- `business_name`, `business_email`, `business_phone`, `address` (TEXT)
- `timezone` (TEXT) - Default: 'America/Chicago'
- `operating_hours` (JSONB) - Per-day open/close times
- `reservation_settings` (JSONB) - max_guests, min_notice_hours, max_advance_days
- `notification_settings` (JSONB) - email_notifications, sms_notifications, notification_email
- `hold_fee_enabled` (BOOLEAN)
- `hold_fee_amount` (DECIMAL)
- `admin_notification_phone` (TEXT) - Phone number for reservation notifications
- `created_at`, `updated_at`

#### `system_settings`
- `id` (UUID, PK)
- `key` (VARCHAR, UNIQUE) - Setting identifier (e.g., 'inventory_categories')
- `value` (JSONB) - Setting data
- `description` (TEXT)
- `created_at`, `updated_at`

**Note**: Used for configurable system settings like inventory categories and subcategories

#### `inventory_items`
- `id` (UUID, PK)
- `name` (VARCHAR) - Item name (e.g., 'Grey Goose Vodka')
- `category` (VARCHAR) - spirits, wine, beer, mixers, garnishes, supplies, other
- `subcategory` (VARCHAR) - vodka, gin, red, white, etc.
- `brand` (VARCHAR) - Brand name
- `quantity` (DECIMAL) - Current stock quantity
- `unit` (VARCHAR) - bottle, can, keg, case, each, liter, oz
- `volume_ml` (INTEGER) - Volume per unit in milliliters
- `cost_per_unit` (DECIMAL) - Purchase cost
- `price_per_serving` (DECIMAL) - Menu price
- `par_level` (DECIMAL) - Minimum stock level for alerts
- `notes` (TEXT)
- `image_url` (TEXT)
- `last_counted` (TIMESTAMPTZ)
- `created_at`, `updated_at`

#### `inventory_transactions`
- `id` (UUID, PK)
- `item_id` (UUID, FK → inventory_items) - Related item
- `transaction_type` (VARCHAR) - add, remove, adjust, count, waste
- `quantity` (DECIMAL) - Amount changed
- `quantity_before` (DECIMAL) - Stock before change
- `quantity_after` (DECIMAL) - Stock after change
- `notes` (TEXT)
- `created_by` (VARCHAR) - User who made change
- `created_at` (TIMESTAMPTZ)

**Note**: Audit trail for all inventory changes

#### `inventory_recipes`
- `id` (UUID, PK)
- `name` (VARCHAR) - Recipe name (e.g., 'Vodka Martini')
- `category` (VARCHAR) - Cocktail category
- `description` (TEXT)
- `instructions` (TEXT)
- `price` (DECIMAL) - Menu price
- `image_url` (TEXT)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at`

#### `inventory_recipe_ingredients`
- `id` (UUID, PK)
- `recipe_id` (UUID, FK → inventory_recipes)
- `item_id` (UUID, FK → inventory_items)
- `quantity` (DECIMAL) - Amount needed
- `unit` (VARCHAR) - oz, ml, dash, etc.
- `notes` (TEXT)
- `created_at`

**Note**: Maps recipes to inventory items for cost tracking

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- **Public read access**: `tables`, `private_events` (for booking)
- **Admin-only**: `settings`, `waitlist`, `campaign_templates`, `reservation_reminder_templates`
- **Authenticated users**: `inventory_items`, `inventory_transactions`, `inventory_recipes`, `inventory_recipe_ingredients`, `system_settings` (read/write)
- **Super admin-only**: `admins`, `roles`, `user_roles`
- **User-specific**: Members can only access their own data

See `migrations/rls_security_configuration*.sql` for detailed policies.

---

## Core Systems & Features

### 1. Reservation System

**Location**: `src/app/api/reservations/route.ts`, `src/components/ReservationForm.tsx`

**Flow**:
1. User selects date/time/party size
2. System checks availability (`/api/available-slots`)
3. For non-members: Stripe hold created if enabled
4. Reservation created with table assignment
5. SMS confirmation sent
6. Admin notification sent to `admin_notification_phone` (6199713730)
7. Reminders scheduled if enabled

**Key Features**:
- Automatic table assignment based on capacity
- Alternative time suggestions if requested time unavailable
- Hold fee system for non-members (configurable)
- Check-in tracking
- Multiple sources: website, SMS, manual, RSVP

**Related Files**:
- `src/components/NewReservationDrawer.tsx` - Admin reservation creation
- `src/components/ReservationEditDrawer.tsx` - Edit existing reservations
- `src/components/DayReservationsDrawer.tsx` - Day view of reservations
- `src/app/api/available-slots/route.ts` - Availability checking
- `src/app/api/find-alternative-times/route.ts` - Alternative time suggestions

### 2. Campaign System

**Location**: `src/pages/admin/campaigns/`, `src/pages/api/campaigns.ts`

**Campaign Types**:
- **member_signup**: Triggered when member completes typeform
- **reservation_time**: Triggered at specific time relative to reservation
- **recurring**: Daily/weekly/monthly/yearly scheduled campaigns
- **reservation_range**: Targets reservations within date range
- **private_event**: Targets RSVPs for specific private event
- **all_members**: Broadcast to all members

**Message Timing**:
- **specific_time**: Send at specific time (HH:MM)
- **recurring**: Daily/weekly/monthly/yearly schedules
- **relative**: X hours/days before/after trigger event

**Processing**:
- Messages scheduled when campaign triggered
- Processed via `/api/process-campaign-messages-updated.ts`
- Cron job runs every 5-15 minutes
- OpenPhone API sends SMS

**Related Files**:
- `src/components/CampaignDrawer.tsx` - Campaign creation/editing
- `src/components/CampaignTemplateDrawer.tsx` - Message template management
- `src/pages/admin/communication.tsx` - Campaign management UI
- `src/lib/campaign-utils.ts` - Campaign utility functions
- `src/utils/campaignSorting.ts` - Campaign sorting logic

### 3. Reservation Reminders

**Location**: `src/pages/api/process-reservation-reminders.ts`, `src/pages/api/schedule-reservation-reminders.ts`

**Features**:
- Minute-level precision (e.g., 10:05 AM, 1:30 hours before)
- Day-of reminders at specific times
- Hour-before reminders with minute precision
- Automatic scheduling on reservation creation
- Same-day reservation handling (immediate scheduling)

**Templates**: `src/pages/admin/templates.tsx` (Reservation Reminders tab)

**Processing**: Cron job calls `/api/webhook-process-reminders` every 5-15 minutes

**Related Files**:
- `src/components/ReminderEditDrawer.tsx` - Template editing
- `src/pages/api/reservation-reminder-templates.ts` - Template API
- `README/RESERVATION_REMINDERS.md` - Full documentation

### 4. Private Events & RSVP

**Location**: `src/app/api/private-events/`, `src/app/api/rsvp/`

**Flow**:
1. Admin creates private event with RSVP enabled
2. Unique RSVP URL generated (`/rsvp/[rsvpUrl]`)
3. Guests access RSVP page via URL
4. Guest submits RSVP with contact info
5. Reservation created with `source: 'rsvp_private_event'`
6. SMS confirmation sent to guest

**Features**:
- Custom background images
- Time selection (optional)
- Maximum guests per RSVP
- Total attendees limit
- Deposit collection (optional)

**Related Files**:
- `src/components/PrivateEventsManager.tsx` - Event management
- `src/app/rsvp/[rsvpUrl]/page.tsx` - Public RSVP page
- `src/components/PrivateEventBooking.tsx` - RSVP form component
- `README/PRIVATE_EVENTS_SETUP.md` - Full documentation

### 5. Waitlist System

**Location**: `src/pages/api/waitlist/`, `src/pages/admin/waitlist.tsx`

**Flow**:
1. User texts "MEMBER" to 913.777.4488
2. OpenPhone webhook sends Typeform link
3. User completes Typeform application
4. Typeform webhook processes submission
5. Entry stored in `waitlist` table with status 'review'
6. Admin reviews and approves/denies
7. SMS sent to applicant with result

**Features**:
- Dynamic field mapping (`config/typeform-mapping.js`)
- Status tracking: review, approved, denied, waitlisted
- Automated SMS responses
- Duplicate detection

**Related Files**:
- `src/pages/api/waitlist-webhook.ts` - Typeform webhook handler
- `src/pages/api/openphoneWebhook.js` - OpenPhone webhook (MEMBER keyword)
- `config/typeform-mapping.js` - Field mapping configuration
- `README/WAITLIST_SETUP.md` - Full documentation

### 6. Member Management

**Location**: `src/pages/admin/members.tsx`, `src/pages/api/members.js`

**Features**:
- Member profiles with account linking
- Membership types: Skyline, Duo, Solo, Annual
- Balance tracking and ledger
- Monthly credit system (Skyline members)
- Member attributes and notes
- Deactivation support

**Monthly Credits**:
- Skyline members get $100 credit monthly
- Reset based on `join_date`
- Processed via `/api/process-monthly-credits.ts` (cron: 7am CST)
- Overspend automatically charged via Stripe (8am CST)

**Related Files**:
- `src/components/MemberDetail.tsx` - Member detail view
- `src/pages/admin/members/[accountId].tsx` - Member detail page
- `src/pages/api/member_attributes.js` - Member attributes API
- `src/pages/api/member_notes.js` - Member notes API
- `src/components/pages/MemberLedger.js` - Ledger view

### 7. Financial System

**Location**: `src/pages/api/chargeBalance.js`, `src/pages/api/stripe-webhook.js`

**Components**:
- **Ledger**: Transaction history (`ledger` table)
- **Stripe Integration**: Holds, charges, payment methods
- **Balance Tracking**: Per-member balance calculation
- **PDF Generation**: Ledger PDFs (`src/utils/ledgerPdfGenerator.ts`)

**Hold System**:
- Non-member reservations require Stripe hold
- Configurable amount via settings
- Holds released on cancellation or completion
- Automatic release of expired holds

**Related Files**:
- `src/app/api/release-holds/route.ts` - Hold release logic
- `src/components/CreditCardHoldModal.tsx` - Hold payment UI
- `src/utils/holdFeeUtils.ts` - Hold fee calculation
- `src/components/LedgerPDFPreview.tsx` - PDF preview
- `src/components/ToastTransactionsSection.tsx` - Transaction display

### 8. Admin Management

**Location**: `src/pages/admin/admins.tsx`, `src/app/api/admins/route.ts`

**Features**:
- Admin user creation/editing/deletion
- Access levels: `admin`, `super_admin`
- Status tracking: `active`, `inactive`
- Audit logging
- Super admin can manage other admins

**Related Files**:
- `src/app/api/admins/middleware.ts` - Super admin middleware
- `README/ADMIN_MANAGEMENT.md` - Full documentation

### 9. Calendar System

**Location**: `src/pages/admin/event-calendar.tsx`, `src/components/FullCalendarTimeline.tsx`

**Features**:
- Resource timeline view (tables as resources)
- Day/week/month views
- Drag-and-drop reservation editing
- Availability visualization
- Private event display
- Timezone-aware display

**Related Files**:
- `src/components/CalendarView.tsx` - Alternative calendar view
- `src/components/CalendarAvailabilityControl.tsx` - Availability management
- `src/components/EventCreationDrawer.tsx` - Event creation

### 10. Settings System

**Location**: `src/pages/admin/settings.tsx`, `src/app/api/settings/route.ts`

**Settings Include**:
- Business information
- Timezone configuration
- Operating hours
- Reservation settings
- Notification settings
- Hold fee configuration
- Admin notification phone

**Context**: `src/context/SettingsContext.tsx` provides settings throughout app

### 11. Inventory Management System

**Location**: `src/pages/admin/inventory.tsx`, `src/pages/api/inventory/`

**Overview**: Complete inventory tracking system for managing bar/restaurant stock, recipes, and sales data.

**Key Features**:

1. **Inventory Items Management**
   - Track spirits, wine, beer, mixers, garnishes, supplies
   - Quantity tracking with par level alerts
   - Cost per unit and pricing management
   - Brand and subcategory organization
   - Quick stock adjustment buttons (+/- inline)
   - Low stock visual indicators (red dot)

2. **Categories & Settings**
   - Customizable inventory categories via Settings drawer
   - Dynamic subcategories per category
   - Recipe categories management
   - Settings stored in `system_settings` table
   - Real-time updates across all forms

3. **Stock Adjustments**
   - Quick +/- buttons for instant quantity changes
   - Automatic transaction logging
   - Transaction history tracking
   - Audit trail with timestamps and notes

4. **Recipe Builder**
   - Create cocktail/drink recipes
   - Link ingredients to inventory items
   - Cost calculation based on ingredient usage
   - Menu pricing and margin tracking

5. **Export & Reporting**
   - CSV export of full inventory
   - Includes all item details, costs, and stock status
   - Date-stamped filenames

**UI/UX Design**:
- **Desktop Table**: Edit button inline with Par Level (last column)
- **Mobile Cards**: Edit button on same row as Par Level field
- **Delete Protection**: Delete only available inside Edit drawer with confirmation
- **Tab Navigation**: Inventory, Recipes, Sales, History

**Database Tables**:
- `inventory_items` - Main inventory tracking
- `inventory_transactions` - Stock change audit trail
- `inventory_recipes` - Recipe definitions
- `inventory_recipe_ingredients` - Recipe-to-item mappings
- `system_settings` - Category configuration

**API Endpoints**:
- `GET/POST/PUT/DELETE /api/inventory` - CRUD for items
- `GET/POST /api/inventory/transactions` - Transaction logging
- `GET/POST /api/inventory/recipes` - Recipe management
- `GET/POST /api/inventory/settings` - Category settings
- `POST /api/inventory/scan` - AI photo scanning (future)

**Migrations**:
- `migrations/20240301_create_inventory_tables.sql` - Core tables
- `migrations/20240302_create_system_settings_table.sql` - Settings storage

**Related Components**:
- `src/components/inventory/InventoryList.tsx` - Item list view
- `src/components/inventory/InventoryItemDrawer.tsx` - Add/Edit drawer
- `src/components/inventory/InventorySettings.tsx` - Settings management
- `src/components/inventory/RecipeBuilder.tsx` - Recipe creation
- `src/components/inventory/RecipeDrawer.tsx` - Recipe edit
- `src/components/inventory/SalesUpload.tsx` - Sales processing

**Common Patterns**:
```typescript
// Quick stock adjustment
const handleAdjustStock = async (id: string, newQuantity: number) => {
  await fetch('/api/inventory/transactions', {
    method: 'POST',
    body: JSON.stringify({
      item_id: id,
      transaction_type: 'adjust',
      quantity_change: Math.abs(newQuantity - currentQuantity),
      notes: 'Quick adjustment'
    })
  });
};

// Export to CSV
const handleExportCSV = () => {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  // Download blob...
};
```

---

## API Structure

### App Router APIs (`/app/api/`)

**Reservations**:
- `GET/POST /api/reservations` - List/create reservations
- `GET/PUT/DELETE /api/reservations/[id]` - Reservation operations

**Private Events**:
- `GET/POST /api/private-events` - List/create events
- `GET/PATCH/DELETE /api/private-events/[id]` - Event operations

**RSVP**:
- `GET /api/rsvp/[rsvpUrl]` - Get event for RSVP page
- `POST /api/rsvp` - Submit RSVP

**Settings**:
- `GET/PUT /api/settings` - Get/update settings
- `GET/PUT /api/settings/hold-fee-config` - Hold fee configuration

**Admin**:
- `GET/POST/PUT/DELETE /api/admins` - Admin management
- `GET /api/admins/middleware` - Super admin middleware

**Other**:
- `GET /api/available-slots` - Check availability
- `GET /api/find-alternative-times` - Find alternative times
- `POST /api/release-holds` - Release Stripe holds
- `GET /api/tables` - List tables
- `GET /api/health` - Health check

### Pages Router APIs (`/pages/api/`)

**Campaigns**:
- `GET/POST /api/campaigns` - Campaign management
- `GET/PUT/DELETE /api/campaigns/[id]` - Campaign operations
- `GET/POST /api/campaign-messages` - Message management
- `GET/PUT/DELETE /api/campaign-messages/[id]` - Message operations
- `POST /api/process-campaign-messages-updated.ts` - Process scheduled messages
- `POST /api/trigger-member-campaign` - Trigger campaigns for member

**Reminders**:
- `GET/POST /api/reservation-reminder-templates` - Template management
- `POST /api/process-reservation-reminders` - Process reminders
- `POST /api/schedule-reservation-reminders` - Schedule reminders
- `POST /api/check-upcoming-reservations` - Check for upcoming reservations
- `POST /api/webhook-process-reminders` - Webhook for cron processing

**Members**:
- `GET/POST /api/members` - Member management
- `GET/PUT/DELETE /api/members/[memberId]` - Member operations
- `POST /api/member_attributes` - Member attributes
- `POST /api/member_notes` - Member notes
- `POST /api/chargeBalance` - Charge member balance
- `POST /api/process-monthly-credits` - Process monthly credits

**Waitlist**:
- `GET /api/waitlist` - List waitlist entries
- `PATCH /api/waitlist` - Update waitlist entry
- `POST /api/waitlist-webhook` - Typeform webhook

**Other**:
- `POST /api/openphoneWebhook` - OpenPhone SMS webhook
- `POST /api/stripe-webhook` - Stripe webhook
- `GET /api/availability` - Availability checking (legacy)
- `GET /api/ledger` - Ledger entries
- `POST /api/sendText` - Send SMS
- `POST /api/sendGuestMessage` - Send guest message

---

## Component Architecture

### Layout Components

**`src/components/layouts/AdminLayout.tsx`**
- Main admin layout with sidebar navigation
- Used by all admin pages

**`src/components/MainNav.tsx`**
- Public navigation (hidden on admin pages)

### Form Components

**`src/components/ReservationForm.tsx`**
- Main reservation booking form
- Handles member/non-member flows
- Stripe integration for holds
- Timezone-aware date/time handling

**`src/components/CreditCardHoldModal.tsx`**
- Stripe PaymentElement for hold collection
- Two-step: info collection → payment

### Drawer Components

**`src/components/NewReservationDrawer.tsx`**
- Admin reservation creation drawer

**`src/components/ReservationEditDrawer.tsx`**
- Edit existing reservations
- Timezone conversion for display/editing

**`src/components/CampaignDrawer.tsx`**
- Campaign creation/editing

**`src/components/CampaignTemplateDrawer.tsx`**
- Campaign message template management

**`src/components/ReminderEditDrawer.tsx`**
- Reservation reminder template editing

**`src/components/DayReservationsDrawer.tsx`**
- Day view of reservations

### Calendar Components

**`src/components/FullCalendarTimeline.tsx`**
- FullCalendar resource timeline view
- Table-based resource display

**`src/components/CalendarView.tsx`**
- Alternative calendar view (react-big-calendar)

**`src/components/CalendarAvailabilityControl.tsx`**
- Availability management UI

### Member Components

**`src/components/MemberDetail.tsx`**
- Member detail view component

**`src/components/members/AddMemberModal.js`**
- Add new member modal

### Context Providers

**`src/context/SettingsContext.tsx`**
- Settings state management
- Provides `useSettings()` hook

**`src/context/AppContext.tsx`**
- App-level state (user, reservations)
- Provides `useAppContext()` hook

**`src/lib/auth-context.tsx`**
- Authentication state
- Provides `useAuth()` hook

---

## Authentication & Authorization

### Authentication Flow

1. User signs in via Supabase Auth (`src/lib/auth-context.tsx`)
2. Session stored in Supabase
3. `AuthProvider` manages auth state
4. Protected routes check auth status

### Authorization Levels

**Regular Users**:
- Can access their own data only
- RLS policies enforce this

**Admins** (`access_level: 'admin'`):
- Can manage members, reservations, campaigns
- Cannot manage other admins
- Cannot access super admin features

**Super Admins** (`access_level: 'super_admin'`):
- Full access to all features
- Can manage other admins
- Can access system settings

### Middleware

**`src/middleware.ts`**:
- Global Next.js middleware
- Adds request ID tracking
- Security headers
- Performance timing

**`src/app/api/admins/middleware.ts`**:
- Super admin verification
- Used by admin management APIs

### RLS Policies

Database-level security via Supabase RLS:
- Policies defined in migrations
- Enforced at database level
- API routes use service role key (bypasses RLS)
- Frontend uses anon key (respects RLS)

---

## Key Workflows

### Reservation Booking Workflow

1. **User selects date/time/party size**
   - `ReservationForm.tsx` → `/api/available-slots`
2. **System checks availability**
   - Queries `reservations` for conflicts
   - Checks table capacity
   - Returns available slots
3. **For non-members: Payment hold**
   - `CreditCardHoldModal.tsx` → Stripe PaymentElement
   - Creates PaymentIntent with `capture_method: 'manual'`
   - Stores `payment_intent_id` in reservation
4. **Reservation creation**
   - `POST /api/reservations` creates reservation
   - Assigns table automatically
   - Stores UTC times
5. **Notifications**
   - SMS confirmation to customer
   - Admin notification to `admin_notification_phone`
6. **Reminder scheduling**
   - `schedule-reservation-reminders` API called
   - Creates `scheduled_reservation_reminders` entries
   - Based on active templates

### Campaign Processing Workflow

1. **Campaign trigger**
   - Member signup → `trigger-member-campaign` API
   - Reservation created → Campaign with `reservation_time` trigger
   - Recurring → Cron job triggers
2. **Message scheduling**
   - Calculates send time based on timing_type
   - Creates `scheduled_messages` entries
   - Personalizes message content
3. **Message processing** (Cron: every 5-15 minutes)
   - `process-campaign-messages-updated.ts` runs
   - Finds pending messages where `scheduled_for <= NOW()`
   - Sends via OpenPhone API
   - Updates status to 'sent' or 'failed'

### Monthly Credit Processing Workflow

1. **Cron job** (7am CST daily)
   - Calls `/api/process-monthly-credits`
2. **Processing**
   - Finds Skyline members where `credit_renewal_date <= TODAY`
   - Resets `monthly_credit` to $100
   - Updates `last_credit_date` and `credit_renewal_date`
   - Creates ledger entry for credit
3. **Overspend charging** (8am CST)
   - Checks for negative balances
   - Creates Stripe PaymentIntent
   - Charges default payment method
   - Creates ledger entry for charge

### RSVP Workflow

1. **Admin creates private event**
   - `PrivateEventsManager.tsx` → `POST /api/private-events`
   - Generates unique `rsvp_url` token
2. **Guest accesses RSVP page**
   - `GET /api/rsvp/[rsvpUrl]` returns event details
   - `src/app/rsvp/[rsvpUrl]/page.tsx` displays form
3. **Guest submits RSVP**
   - `POST /api/rsvp` creates reservation
   - Reservation has `source: 'rsvp_private_event'`
   - Links to `private_event_id`
4. **Confirmation**
   - SMS sent to guest
   - Reservation appears on calendar

---

## Integration Points

### OpenPhone Integration

**Purpose**: SMS sending and receiving

**Configuration**:
- `OPENPHONE_API_KEY` - API key
- `OPENPHONE_PHONE_NUMBER_ID` - Phone number ID

**Webhook**: `src/pages/api/openphoneWebhook.js`
- Handles incoming SMS
- Keywords: "MEMBER" → sends Typeform link
- Reservation booking via SMS
- Natural language date parsing

**Sending SMS**: `src/utils/openphoneUtils.ts`
- `sendSMS()` function
- Used by campaigns, reminders, notifications

### Stripe Integration

**Purpose**: Payment holds and charges

**Configuration**:
- `STRIPE_SECRET_KEY` - Secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Publishable key

**Webhook**: `src/pages/api/stripe-webhook.js`
- Handles payment events
- Updates ledger entries
- Processes subscription events

**Hold Creation**:
- `src/app/api/reservations/route.ts` (non-member reservations)
- `src/pages/api/create-hold.js` (legacy)
- Creates PaymentIntent with `capture_method: 'manual'`

**Hold Release**:
- `src/app/api/release-holds/route.ts`
- Cancels PaymentIntent
- Called on reservation cancellation/completion

**Charges**:
- `src/pages/api/chargeBalance.js` - Charge member balance
- Monthly credit overspend charging
- Uses customer's default payment method

### Typeform Integration

**Purpose**: Waitlist applications

**Webhook**: `src/pages/api/waitlist-webhook.ts`
- Processes form submissions
- Maps fields via `config/typeform-mapping.js`
- Stores in `waitlist` table

**Field Mapping**: `config/typeform-mapping.js`
- Dynamic mapping configuration
- Supports multiple field identifiers
- Easy to update without code changes

### Supabase Integration

**Purpose**: Database, auth, storage

**Configuration**:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key (frontend)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend)

**Client**: `src/lib/supabase.ts`
- `supabase` - Client with anon key (respects RLS)
- `supabaseAdmin` - Client with service key (bypasses RLS)

**Storage**: Used for private event images, transaction attachments

---

## Member Portal System

**Status**: ✅ IMPLEMENTED (Core Features Complete)

**Overview**: A mobile-first member portal allowing members to self-manage their accounts, reservations, payments, and access member-specific features. This system reduces admin workload and provides members with 24/7 access to their account information.

### Authentication System

**Implemented**: Full authentication with phone + password and biometric support

**Login Methods**:
1. **Phone + Password**: Primary authentication method
   - 10-digit phone number (normalizes +1, spaces, dashes, parentheses)
   - Bcrypt password hashing (10 salt rounds)
   - httpOnly session cookies (7-day expiration)
   - Session stored in `member_portal_sessions` table

2. **Biometric Authentication** (WebAuthn/FIDO2):
   - Face ID, Touch ID, Windows Hello support
   - Platform authenticator only (no security keys)
   - Stored in `biometric_credentials` table
   - Counter-based replay attack prevention
   - Endpoints: `register-challenge`, `register-verify`, `login-challenge`, `login-verify`

**Security Features**:
- **Rate Limiting**: 10 requests per 15-minute window per IP
- **Account Lockout**: 5 failed attempts = 15-minute lockout
- **Audit Logging**: All auth events tracked in `auth_audit_logs` (90-day retention)
- **Temporary Password Flow**: Admin-generated temp passwords force password change on first login
- **Admin Unlock**: `/api/admin/unlock-member-account` endpoint for locked accounts

**Session Management**:
- httpOnly cookies (secure in production, `sameSite: lax`)
- `/api/auth/check-session` validates and refreshes sessions
- `/api/auth/logout` clears session cookie and database entry
- Automatic session tracking (IP, user agent, last activity)

**Context**: `src/context/MemberAuthContext.tsx`
- Manages auth state globally
- Supports both custom sessions (password/biometric) and Supabase Auth (email magic links)
- Provides hooks: `signInWithPassword`, `signInWithBiometric`, `registerBiometric`, `signOut`

### Database Schema Additions

**Tables Created**:
```sql
-- Member portal sessions (httpOnly cookie authentication)
member_portal_sessions (
  id UUID PRIMARY KEY,
  member_id UUID REFERENCES members(member_id),
  session_token TEXT UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  last_activity TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- Biometric credentials (WebAuthn)
biometric_credentials (
  id UUID PRIMARY KEY,
  member_id UUID REFERENCES members(member_id),
  credential_id TEXT UNIQUE,
  public_key TEXT,
  counter BIGINT,
  device_name TEXT,
  device_type TEXT,
  transports TEXT[],
  aaguid TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- Authentication audit logs
auth_audit_logs (
  id UUID PRIMARY KEY,
  member_id UUID,
  phone TEXT,
  event_type TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)

-- Login attempt tracking (rate limiting)
login_attempts (
  id UUID PRIMARY KEY,
  phone TEXT,
  ip_address TEXT,
  success BOOLEAN,
  created_at TIMESTAMPTZ
)
```

**Members Table Extensions**:
```sql
ALTER TABLE members ADD COLUMN:
- auth_user_id UUID (references auth.users, nullable)
- password_hash TEXT (bcrypt hash)
- password_set_at TIMESTAMPTZ
- password_is_temporary BOOLEAN (forces password change)
- account_locked_until TIMESTAMPTZ (lockout tracking)
- failed_login_count INTEGER (failed attempt counter)
```

### Implemented Pages

All pages use Noir design system and are fully mobile-responsive with bottom navigation.

#### 1. Login Page (`/member/login`)
- Phone + password form (single input method as requested)
- Biometric button (auto-shows if available and phone entered)
- Redirects to password change if temporary password
- Links to forgot password flow
- Toast notifications for errors/success

#### 2. Dashboard (`/member/dashboard`)
**Features**:
- Welcome header with member name and membership type
- **Next Reservation Card**: Shows upcoming reservation with date, time, party size, table, status
- **Account Balance Card**: Real-time balance from ledger, monthly credit, renewal date
- **Quick Actions**: Book Table, My Reservations, Pay Balance, My Profile
- Empty states with CTAs
- Redirects to change password if `password_is_temporary` flag set

**API**: `/api/member/next-reservation` fetches upcoming reservation by phone/email match

#### 3. Profile Page (`/member/profile`)
**Features**:
- View/edit mode toggle
- Avatar with member initials/photo
- Editable fields: first name, last name, email
- Read-only phone (requires admin)
- Contact preferences: SMS/email toggle switches
- Links to security settings and password change

**API**: `POST /api/member/update-profile` updates member info

#### 4. Reservations Page (`/member/reservations`)
**Features**:
- Two tabs: Upcoming (sorted nearest first) and Past (sorted most recent first)
- Reservation cards with: date, time, party size, table, status badge, notes
- Empty states with "Book a Table" CTA
- Modify button for upcoming confirmed reservations (placeholder)

**API**: `GET /api/member/reservations` fetches all reservations by phone/email match

#### 5. Balance Page (`/member/balance`)
**Features**:
- Large balance display (green for credit, red for debit)
- Monthly credit summary with renewal date
- Full transaction history table with:
  - Date, description, amount (color-coded), running balance
  - Up/down arrows for credit/debit indicators
- "Pay Balance" button if balance negative (placeholder)

**API**: `GET /api/member/transactions` fetches ledger with calculated running balances

#### 6. Settings Page (`/member/settings`)
**Features**:
- **Password Section**: Link to change password
- **Biometric Authentication**:
  - Check availability (detects Face ID/Touch ID/Windows Hello)
  - List enrolled devices (name, last used date)
  - Enroll current device
  - Remove devices individually
  - Smart messaging if biometric unavailable
- **Account Actions**: Edit profile, sign out

**APIs**:
- `GET /api/member/biometric-devices` lists enrolled devices
- `POST /api/member/remove-biometric` removes device

#### 7. Change Password Page (`/member/change-password`)
**Features**:
- Current password verification
- New password (min 8 characters)
- Password confirmation
- Show/hide password toggles
- Warning alert if using temporary password
- Cannot bypass if `password_is_temporary` is true

**API**: `POST /api/member/change-password` updates password and clears temp flag

### Features Overview

The Member Portal will include the following feature sets:

1. **Account Management**
2. **Reservation Management**
3. **Booking System**
4. **Payments & Balance**
5. **Private Events (Placeholder for Future)**
6. **Referral Program**
7. **Calendar Integration**

### 1. Account Management

**Location**: `/member/profile` (future implementation)

**Features**:
- **View/Edit Profile**:
  - Name, phone, email
  - Profile photo upload
  - Contact preferences
- **Membership Display**:
  - Membership tier (Skyline, Duo, Solo, Annual)
  - Membership status (active, inactive)
  - Join date
  - Tier-specific benefits list
- **Balance & Transaction History**:
  - Current account balance
  - Transaction ledger with filters
  - Date range filtering
  - Transaction type filtering (charges, payments, credits, refunds)
- **Payment Methods**:
  - View saved payment methods (Stripe)
  - Add new cards via Stripe
  - Remove payment methods
  - Set default payment method

**Database Changes**:
- Extend `members` table with:
  - `profile_photo_url` (TEXT) - Supabase Storage URL
  - `contact_preferences` (JSONB) - SMS/email preferences
  - `referral_code` (TEXT, UNIQUE) - Member's unique referral code

**API Endpoints**:
- `GET /api/member/profile` - Get member profile
- `PUT /api/member/profile` - Update profile
- `GET /api/member/payment-methods` - List Stripe payment methods
- `POST /api/member/payment-methods` - Add payment method
- `DELETE /api/member/payment-methods/[id]` - Remove payment method
- `PUT /api/member/payment-methods/[id]/default` - Set default method

### 2. Reservation Management

**Location**: `/member/reservations` (future implementation)

**Features**:
- **Upcoming Reservations**:
  - Card-based list layout
  - Sorted by date (nearest first)
  - Quick actions: Cancel, Modify
  - Visual status indicators
- **Reservation History**:
  - Past reservations with details
  - "Rebook" action to duplicate reservation
  - Filters: date range, status
- **Cancel Reservation**:
  - One-tap cancel with confirmation modal
  - Respect cancellation policies
  - SMS confirmation on cancellation
  - Hold release (if applicable)
- **Modify Reservation**:
  - Change date/time
  - Update guest count
  - Add/edit special requests
  - Same availability checking as new bookings

**API Endpoints**:
- `GET /api/member/reservations?status=upcoming|past` - List reservations
- `GET /api/member/reservations/[id]` - Get reservation details
- `PATCH /api/member/reservations/[id]` - Modify reservation
- `DELETE /api/member/reservations/[id]` - Cancel reservation
- `POST /api/member/reservations/[id]/rebook` - Duplicate past reservation

**Business Rules**:
- Members can only access their own reservations (RLS policy)
- Cancellation allowed up to X hours before (configurable in settings)
- Modification requires availability check
- SMS notifications sent on cancel/modify

### 3. Booking System

**Location**: `/member/book` (future implementation)

**Features**:
- **Browse Available Slots**:
  - Calendar view showing availability
  - Alternative: List view by date
  - Visual indicators for available/unavailable times
- **Create New Reservation**:
  - Multi-step booking flow:
    1. Select date
    2. Select time from available slots
    3. Enter guest count
    4. Add special requests (optional)
    5. Review and confirm
  - Real-time availability checking
  - Alternative time suggestions if preferred time unavailable
- **Smart Defaults**:
  - Remember last guest count
  - Remember seating preferences
  - Auto-populate contact info from profile

**API Endpoints**:
- `GET /api/member/available-slots?date=YYYY-MM-DD&party_size=N` - Get available times
- `POST /api/member/reservations` - Create reservation
- `GET /api/member/booking-preferences` - Get saved preferences
- `PUT /api/member/booking-preferences` - Update preferences

**Database Changes**:
- New table: `member_booking_preferences`
  - `member_id` (UUID, FK)
  - `default_party_size` (INTEGER)
  - `seating_preference` (TEXT)
  - `dietary_notes` (TEXT)
  - `created_at`, `updated_at`

**UI/UX Notes**:
- Mobile-first design
- Large touch targets for time selection
- Progress indicator for multi-step flow
- Quick "Book Again" from reservation history
- No hold fee required for members

### 4. Payments & Balance

**Location**: `/member/balance` (future implementation)

**Features**:
- **Balance Overview**:
  - Current balance (positive = credit, negative = owed)
  - Visual indicator (red for owed, green for credit)
  - Recent charges summary
- **Pay Balance**:
  - One-tap payment if default card saved
  - Option to use different card
  - Stripe payment processing
  - SMS/email receipt on success
- **Receipts & Invoices**:
  - Downloadable PDF ledger
  - Email option (send to member email)
  - Date range selection for custom ledgers
- **Transaction Details**:
  - Itemized breakdown per charge
  - Linked to specific reservations (if applicable)
  - Date, amount, type, description

**API Endpoints**:
- `GET /api/member/balance` - Get current balance
- `POST /api/member/pay-balance` - Process payment
- `GET /api/member/ledger?start_date=&end_date=` - Get transactions
- `GET /api/member/ledger/pdf?start_date=&end_date=` - Generate PDF
- `POST /api/member/ledger/email` - Email ledger

**Business Rules**:
- Payments create ledger entry (type: 'payment')
- SMS confirmation sent on successful payment
- Monthly credits for Skyline members reflected in balance
- Minimum payment: $1.00

### 5. Private Events (Placeholder)

**Location**: `/member/private-events` (future implementation)

**Features**:
- **Request Form**:
  - Event type selection
  - Preferred date/time
  - Expected guest count
  - Special requirements
  - Budget range (optional)
  - Admin receives notification
- **Perks & Bonuses Display**:
  - Tier-based benefits showcase
  - Early access to event bookings
  - Complimentary items (based on tier)
  - Special event invitations
  - VIP treatment details
- **Upcoming Private Events** (Future):
  - Member-only event calendar
  - RSVP functionality
  - Event details and descriptions

**API Endpoints**:
- `POST /api/member/private-event-request` - Submit request
- `GET /api/member/perks` - Get tier-based perks
- `GET /api/member/upcoming-events` - List member-accessible events (future)

**Database Changes**:
- New table: `private_event_requests`
  - `id` (UUID, PK)
  - `member_id` (UUID, FK)
  - `event_type` (TEXT)
  - `preferred_date` (DATE)
  - `guest_count` (INTEGER)
  - `budget_range` (TEXT)
  - `requirements` (TEXT)
  - `status` (TEXT) - 'pending', 'reviewing', 'approved', 'declined'
  - `admin_notes` (TEXT)
  - `created_at`, `updated_at`

**UI/UX Notes**:
- Prominent "Request Private Event" CTA
- Visual display of perks with icons
- Tier comparison table (what each tier gets)
- Status tracking for submitted requests

### 6. Referral Program

**Location**: `/member/referrals` (future implementation)

**Features**:
- **Unique Referral Link**:
  - Auto-generated unique code per member
  - Shareable link: `https://noir.com/join/[referral_code]`
  - Copy to clipboard functionality
  - Share via SMS, email, social media
- **Referral Tracking**:
  - Referrals sent (link clicks)
  - Referrals converted (signed up members)
  - Referrals pending (applications submitted)
  - Status per referral
- **Rewards Display**:
  - Credits earned from referrals
  - Benefits unlocked
  - Tier progress (if gamified)
- **Leaderboard** (Optional):
  - Top referrers (monthly/all-time)
  - Gamification element
  - Privacy toggle (opt-in to leaderboard)

**API Endpoints**:
- `GET /api/member/referrals` - Get referral stats
- `POST /api/member/referrals/generate-code` - Generate unique code
- `GET /api/member/referrals/leaderboard` - Get leaderboard
- `POST /api/member/referrals/track-click` - Track link click (public)

**Database Changes**:
- New table: `referral_codes`
  - `id` (UUID, PK)
  - `member_id` (UUID, FK)
  - `code` (TEXT, UNIQUE) - Unique referral code
  - `clicks` (INTEGER) - Number of clicks
  - `conversions` (INTEGER) - Number of signups
  - `created_at`, `updated_at`

- New table: `referral_tracking`
  - `id` (UUID, PK)
  - `referrer_id` (UUID, FK) - Member who referred
  - `referred_member_id` (UUID, FK, NULLABLE) - New member (null until signup)
  - `referral_code` (TEXT)
  - `status` (TEXT) - 'clicked', 'applied', 'approved', 'converted'
  - `clicked_at` (TIMESTAMPTZ)
  - `applied_at` (TIMESTAMPTZ)
  - `converted_at` (TIMESTAMPTZ)
  - `reward_amount` (DECIMAL) - Credit earned
  - `reward_granted` (BOOLEAN)
  - `created_at`, `updated_at`

- Extend `members` table:
  - `referred_by` (UUID, FK) - Member who referred them

**Business Rules**:
- Reward structure (configurable in settings):
  - Referrer gets $X credit when referee becomes member
  - Referee gets $Y credit on signup (optional)
- Rewards only granted on membership approval
- Self-referrals not allowed
- Duplicate referrals tracked to first referrer

**UI/UX Notes**:
- Prominent share button with pre-filled messages
- Visual progress bar for rewards
- Animated confetti on successful conversion
- Push notifications when referral converts

### 7. Calendar Integration

**Location**: Available from reservation detail pages (future implementation)

**Features**:
- **Add to Calendar**:
  - Export individual reservation to calendar
  - Supports: Google Calendar, Apple Calendar, Outlook
  - Generates .ics file download
  - Includes reservation details:
    - Event title: "Reservation at Noir"
    - Date/time (in member's timezone)
    - Location: Noir address
    - Description: Party size, confirmation number
- **Calendar Subscription** (Future):
  - Subscribe to personal calendar feed
  - Auto-sync all upcoming reservations
  - Updates when reservations change/cancel
  - Private iCal URL per member

**API Endpoints**:
- `GET /api/member/calendar-export/[reservation_id]` - Download .ics file
- `GET /api/member/calendar-feed` - iCal subscription URL (future)

**Implementation Notes**:
- Use `ics` library for .ics generation
- Include timezone information in iCal format
- Add reminder: 1 hour before reservation
- Include cancellation link in description (future)

---

### Technical Architecture

#### Authentication & Access

**Supabase Auth**:
- Magic link authentication (email-based)
- SMS OTP authentication (phone-based)
- Minimal friction signup/login
- Optional biometric (future - FaceID/TouchID)
- Session management with persistent login

**Row Level Security (RLS)**:
- Members can only access their own data
- New RLS policies:
  ```sql
  -- Members can read their own profile
  CREATE POLICY "Members can view own profile"
  ON members FOR SELECT
  USING (auth.uid() = auth_user_id);

  -- Members can update their own profile
  CREATE POLICY "Members can update own profile"
  ON members FOR UPDATE
  USING (auth.uid() = auth_user_id);

  -- Members can view their own reservations
  CREATE POLICY "Members can view own reservations"
  ON reservations FOR SELECT
  USING (member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  ));

  -- Members can cancel their own reservations
  CREATE POLICY "Members can cancel own reservations"
  ON reservations FOR UPDATE
  USING (member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  ));
  ```

**Session Tracking**:
- New table: `member_portal_sessions`
  - `id` (UUID, PK)
  - `member_id` (UUID, FK)
  - `session_token` (TEXT)
  - `ip_address` (TEXT)
  - `user_agent` (TEXT)
  - `last_activity` (TIMESTAMPTZ)
  - `created_at`, `expires_at`

#### Database Schema Extensions

**New Tables**:
1. `member_portal_sessions` - Login tracking
2. `referral_codes` - Referral code management
3. `referral_tracking` - Referral conversion tracking
4. `member_booking_preferences` - Saved booking preferences
5. `private_event_requests` - Private event inquiry forms

**Extended Tables**:
1. `members`:
   - `auth_user_id` (UUID, FK) - Link to Supabase auth.users
   - `profile_photo_url` (TEXT)
   - `contact_preferences` (JSONB)
   - `referral_code` (TEXT, UNIQUE)
   - `referred_by` (UUID, FK)
2. `settings`:
   - `member_portal_enabled` (BOOLEAN)
   - `referral_reward_amount` (DECIMAL)
   - `referral_referee_bonus` (DECIMAL)

#### API Structure

**New API Routes** (`/api/member/*`):

All member API routes require authentication and enforce RLS.

**Profile & Account**:
- `GET /api/member/profile` - Get profile
- `PUT /api/member/profile` - Update profile
- `POST /api/member/profile/photo` - Upload photo
- `GET /api/member/payment-methods` - List cards
- `POST /api/member/payment-methods` - Add card
- `DELETE /api/member/payment-methods/[id]` - Remove card
- `PUT /api/member/payment-methods/[id]/default` - Set default

**Reservations**:
- `GET /api/member/reservations?status=upcoming|past` - List
- `GET /api/member/reservations/[id]` - Details
- `POST /api/member/reservations` - Create
- `PATCH /api/member/reservations/[id]` - Modify
- `DELETE /api/member/reservations/[id]` - Cancel
- `POST /api/member/reservations/[id]/rebook` - Rebook

**Booking**:
- `GET /api/member/available-slots` - Check availability
- `GET /api/member/booking-preferences` - Get preferences
- `PUT /api/member/booking-preferences` - Update preferences

**Balance & Payments**:
- `GET /api/member/balance` - Current balance
- `POST /api/member/pay-balance` - Process payment
- `GET /api/member/ledger` - Transaction history
- `GET /api/member/ledger/pdf` - Download PDF
- `POST /api/member/ledger/email` - Email ledger

**Private Events**:
- `POST /api/member/private-event-request` - Submit request
- `GET /api/member/perks` - Get tier benefits

**Referrals**:
- `GET /api/member/referrals` - Referral stats
- `POST /api/member/referrals/generate-code` - Generate code
- `GET /api/member/referrals/leaderboard` - Top referrers

**Calendar**:
- `GET /api/member/calendar-export/[id]` - Export .ics

#### Page Structure

**Member Portal Pages** (`/member/*`):

All pages use Next.js App Router for better performance.

**Main Pages**:
- `/member/login` - Login page (magic link/SMS OTP)
- `/member/dashboard` - Dashboard overview
- `/member/profile` - Account management
- `/member/reservations` - Reservation list
- `/member/book` - New reservation flow
- `/member/balance` - Payments & ledger
- `/member/private-events` - Private event requests & perks
- `/member/referrals` - Referral program dashboard

**Component Structure**:
```
src/
├── app/
│   └── member/
│       ├── layout.tsx            # Member portal layout
│       ├── login/
│       │   └── page.tsx          # Login page
│       ├── dashboard/
│       │   └── page.tsx          # Dashboard
│       ├── profile/
│       │   └── page.tsx          # Profile management
│       ├── reservations/
│       │   ├── page.tsx          # Reservation list
│       │   └── [id]/
│       │       └── page.tsx      # Reservation detail
│       ├── book/
│       │   └── page.tsx          # Booking flow
│       ├── balance/
│       │   └── page.tsx          # Balance & payments
│       ├── private-events/
│       │   └── page.tsx          # Private events
│       └── referrals/
│           └── page.tsx          # Referral program
└── components/
    └── member/
        ├── MemberLayout.tsx      # Portal layout wrapper
        ├── MemberNav.tsx         # Bottom navigation
        ├── ReservationCard.tsx   # Reservation display
        ├── BalanceWidget.tsx     # Balance overview
        ├── BookingCalendar.tsx   # Calendar for booking
        ├── PaymentMethodList.tsx # Payment methods
        ├── ReferralDashboard.tsx # Referral stats
        └── PrivateEventForm.tsx  # Event request form
```

#### UI/UX Design

**Layout**:
- **Bottom Navigation** (Mobile):
  - Dashboard (home icon)
  - Book (calendar icon)
  - Reservations (list icon)
  - Profile (user icon)
- **Floating Action Button**:
  - Primary CTA: "Book Now"
  - Always visible on dashboard/reservations
- **Header**:
  - Logo/back button (left)
  - Page title (center)
  - Menu/notifications (right)

**Design System**:
- Follow Noir brand guidelines (see Design System section)
- Mobile-first responsive design
- Earth-tone color palette
- Noir aesthetic: sleek, elegant, minimal
- Touch targets: 44px minimum
- Visual feedback on all interactions

**Key UI Components**:
1. **Reservation Card**:
   - Date/time (prominent)
   - Party size, table number
   - Status badge
   - Quick actions: Cancel, Modify
   - Swipe actions (mobile)

2. **Balance Widget**:
   - Large balance display
   - Color-coded (red/green)
   - "Pay Now" button (if owed)
   - Recent transactions preview

3. **Booking Calendar**:
   - Month view with availability indicators
   - Tap date → show available times
   - Smooth animations
   - Alternative times suggestion

4. **Payment Form**:
   - Stripe Elements integration
   - Saved cards list
   - "Pay" button with loading state
   - Success/error feedback

### Phased Implementation Plan

#### Phase 1: Foundation (MVP)

**Goal**: Basic member portal with core functionality

**Tasks**:
1. Database schema updates
   - Create new tables
   - Add RLS policies
   - Extend members table with auth_user_id
2. Authentication setup
   - Supabase Auth configuration
   - Magic link/SMS OTP flows
   - Session management
3. Basic pages
   - Login page
   - Dashboard with next reservation + balance
   - Profile view (read-only)
4. API endpoints
   - Profile GET endpoint
   - Reservations GET endpoint
   - Balance GET endpoint

**Deliverables**:
- Members can log in
- View their profile
- See upcoming reservations
- Check account balance

**Timeline**: 1-2 weeks

---

#### Phase 2: Core Functionality

**Goal**: Full reservation and payment management

**Tasks**:
1. Reservation management
   - View upcoming/past reservations
   - Cancel reservation functionality
   - Modify reservation functionality
   - Reservation detail page
2. Booking flow
   - Availability calendar
   - Time selection
   - Guest count input
   - Confirmation page
3. Payment system
   - Stripe integration
   - Pay balance functionality
   - Payment method management
   - Transaction history
4. Profile editing
   - Edit name, phone, email
   - Update contact preferences
   - Upload profile photo

**Deliverables**:
- Members can book reservations
- Cancel/modify existing reservations
- Pay their balance
- Manage payment methods
- Edit their profile

**Timeline**: 2-3 weeks

---

#### Phase 3: Enhanced Features

**Goal**: Referral program and additional features

**Tasks**:
1. Referral program
   - Generate unique referral codes
   - Referral tracking system
   - Share functionality (SMS, email, social)
   - Rewards calculation and granting
   - Referral dashboard
2. Calendar integration
   - .ics file generation
   - Export to calendar
   - iCal feed (future)
3. Transaction/ledger enhancements
   - Download PDF ledgers
   - Email ledger functionality
   - Date range filtering
4. Private events placeholder
   - Request form
   - Perks display
   - Admin notification

**Deliverables**:
- Full referral program
- Calendar export
- PDF ledger downloads
- Private event requests

**Timeline**: 2 weeks

---

#### Phase 4: Polish & Optimization

**Goal**: Refined UX, performance, and accessibility

**Tasks**:
1. UI/UX improvements
   - Micro-interactions
   - Loading states
   - Error handling
   - Empty states
   - Onboarding flow
2. Performance optimization
   - Code splitting
   - Lazy loading
   - Image optimization
   - API response caching
3. Accessibility audit
   - WCAG 2.1 AA compliance
   - Screen reader testing
   - Keyboard navigation
   - Color contrast verification
4. Mobile optimization
   - Touch gesture improvements
   - Offline support (future)
   - Push notifications (future)
   - App-like experience (PWA)

**Deliverables**:
- Polished, production-ready member portal
- Excellent mobile experience
- Accessible to all users
- Fast, performant

**Timeline**: 1-2 weeks

---

### Security Considerations

**Authentication**:
- Secure session management
- JWT token validation
- Rate limiting on login attempts
- Magic link expiration (15 minutes)
- SMS OTP expiration (5 minutes)

**Data Access**:
- RLS policies enforce data isolation
- API routes validate member identity
- No member can access another's data
- Admin access separate from member access

**Payment Security**:
- Stripe handles all card data
- PCI compliance via Stripe
- No card data stored in database
- Payment method tokens only

**API Security**:
- CSRF protection
- Rate limiting (per-member)
- Request validation (Zod schemas)
- Error messages don't leak data

### Testing Strategy

**Unit Tests**:
- API endpoint logic
- RLS policy verification
- Referral calculation logic
- Balance calculation

**Integration Tests**:
- Complete booking flow
- Payment processing
- Referral tracking
- Calendar export

**E2E Tests**:
- Login → Book → Pay flow
- Cancel reservation flow
- Referral share flow
- Profile update flow

**Mobile Testing**:
- iOS Safari
- Android Chrome
- Various screen sizes
- Touch interactions

### Success Metrics

**Engagement**:
- % of members who log in
- Average session duration
- Reservations booked via portal
- Payments processed via portal

**Adoption**:
- New member signups
- Referral program participation
- Repeat logins (weekly/monthly)

**Reduction in Admin Work**:
- Decrease in manual reservation creation
- Decrease in payment processing calls
- Decrease in "balance inquiry" messages

**User Satisfaction**:
- Net Promoter Score (NPS)
- User feedback/ratings
- Support ticket reduction

---

### Future Enhancements (Post-Launch)

**Phase 5+**:
1. Push notifications
   - Reservation reminders
   - Balance alerts
   - Referral conversions
   - Special event invites
2. Social features
   - Member directory (opt-in)
   - Friend connections
   - Group reservations
   - Split payments
3. Loyalty program
   - Points system
   - Tier progression
   - Badges/achievements
   - Exclusive perks
4. Enhanced calendar
   - iCal subscription feed
   - Auto-sync with personal calendar
   - Recurring reservations
5. Mobile app
   - Native iOS app
   - Native Android app
   - Push notifications
   - Biometric login
6. Waitlist access
   - Members can nominate friends
   - Fast-track referrals
   - Sponsored applications

---

**Last Updated**: January 23, 2026
**Status**: Planning complete, ready for implementation
**Next Steps**: Begin Phase 1 implementation

---

## Development Setup

### Prerequisites

- Node.js 22.x
- npm or yarn
- Supabase account
- Stripe account
- OpenPhone account

### Environment Variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# OpenPhone
OPENPHONE_API_KEY=sk-proj-...
OPENPHONE_PHONE_NUMBER_ID=...

# Application
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Optional
WEBHOOK_SECRET=your-webhook-secret
CAMPAIGN_PROCESSING_TOKEN=your-token
```

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Runs on `http://localhost:3000`

### Database Setup

1. Run migrations in Supabase SQL Editor:
   - Start with `supabase/migrations/20240320000000_initial_schema.sql`
   - Apply other migrations as needed
   - See `migrations/README.md` for migration order

2. Set up RLS policies:
   - Run `migrations/rls_security_configuration_safe.sql`

3. Create initial admin:
   - Use Supabase Auth to create user
   - Insert into `admins` table with `access_level: 'super_admin'`

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Troubleshooting Guide

### Common Issues

#### 1. Timezone Issues

**Symptoms**: Times displayed incorrectly, reservations at wrong times

**Solutions**:
- Verify `settings.timezone` is set to 'America/Chicago'
- Check that UTC conversion is working (`src/utils/dateUtils.js`)
- Ensure Luxon is used for all date operations
- See [Timezone Implementation](README/TIMEZONE_IMPLEMENTATION.md)

#### 2. Campaign Messages Not Sending

**Symptoms**: Messages stuck in 'pending' status

**Solutions**:
- Check cron job is running (`/api/process-campaign-messages-updated.ts`)
- Verify OpenPhone credentials
- Check `scheduled_for` times are in the past
- Review error messages in `scheduled_messages.error_message`
- Test OpenPhone API directly

#### 3. Reservation Reminders Not Scheduling

**Symptoms**: No reminders created for new reservations

**Solutions**:
- Verify reminder templates are active
- Check reservation status is 'confirmed'
- Ensure customer has valid phone number
- Review `schedule-reservation-reminders` API logs
- Check timezone calculations for send times

#### 4. Stripe Hold Failures

**Symptoms**: Payment holds not creating

**Solutions**:
- Verify Stripe keys are correct
- Check payment method is valid
- Review Stripe dashboard for errors
- Ensure `hold_fee_enabled` is true in settings
- Check `hold_fee_amount` is set

#### 5. RLS Policy Errors

**Symptoms**: "Permission denied" errors

**Solutions**:
- Verify RLS policies are applied
- Check user has correct role
- Ensure API routes use service role key
- Review `migrations/rls_security_configuration*.sql`
- Check `is_admin()` and `is_super_admin()` functions

#### 6. Member Balance Issues

**Symptoms**: Incorrect balance calculations

**Solutions**:
- Verify ledger entries are correct
- Check monthly credit processing ran
- Review `process-monthly-credits` cron job
- Ensure `membership` column is set correctly
- Check for duplicate ledger entries

### Debug Tools

**Database Queries**:
```sql
-- Check active campaigns
SELECT * FROM campaigns WHERE is_active = true;

-- Check pending messages
SELECT * FROM scheduled_messages WHERE status = 'pending' AND scheduled_for <= NOW();

-- Check reservation reminders
SELECT * FROM scheduled_reservation_reminders WHERE status = 'pending';

-- Check member balances
SELECT member_id, first_name, monthly_credit, last_credit_date FROM members WHERE membership = 'Skyline';
```

**API Testing**:
```bash
# Test campaign processing
curl -X POST http://localhost:3000/api/process-campaign-messages-updated

# Test reminder processing
curl -X POST http://localhost:3000/api/process-reservation-reminders

# Check health
curl http://localhost:3000/api/health
```

**Log Files**:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

---

## Common Patterns & Best Practices

### Date/Time Handling

**Always use Luxon for timezone operations**:
```typescript
import { DateTime } from 'luxon';
import { fromUTC, toUTC, formatDateTime } from '@/utils/dateUtils';

// Convert UTC to local for display
const localTime = fromUTC(utcString, timezone);

// Convert local to UTC for storage
const utcTime = toUTC(localDateTime, timezone);

// Format for display
const display = formatDateTime(date, timezone, { hour: 'numeric', minute: '2-digit' });
```

**Never use native Date objects for timezone operations**

### API Response Format

**Standard response structure**:
```typescript
// Success
return NextResponse.json({ data: result });

// Error
return NextResponse.json(
  { error: 'Error message', details: errorDetails },
  { status: 400 }
);
```

### Error Handling

**Always handle errors gracefully**:
```typescript
try {
  // Operation
} catch (error) {
  console.error('Operation failed:', error);
  Logger.error('Operation failed', { error, context });
  return NextResponse.json(
    { error: 'User-friendly message' },
    { status: 500 }
  );
}
```

### Database Queries

**Use service role key for API routes**:
```typescript
import { supabaseAdmin } from '@/lib/supabase';

const { data, error } = await supabaseAdmin
  .from('table')
  .select('*');
```

**Use anon key for frontend**:
```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('table')
  .select('*');
```

### Component Patterns

**Use Context for shared state**:
```typescript
const { settings } = useSettings();
const { user } = useAuth();
```

**Extract styles to separate files** (per user preference):
- Component: `src/components/Component.tsx`
- Styles: `src/styles/Component.css`

### Mobile Optimization

**Create separate mobile CSS files** (per user preference):
- Desktop: `Component.css`
- Mobile: `Component.mobile.css`
- Update pages to use mobile styles

---

## File Organization

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # App Router API routes
│   ├── admin/             # Admin pages (App Router)
│   ├── members/           # Member pages
│   ├── rsvp/              # RSVP pages
│   └── page.js            # Home page
├── pages/                 # Next.js Pages Router
│   ├── admin/             # Admin pages
│   ├── api/               # Pages Router API routes
│   ├── auth/              # Auth pages
│   └── questionnaire/      # Questionnaire pages
├── components/            # React components
│   ├── common/            # Common components
│   ├── dashboard/         # Dashboard components
│   ├── layouts/          # Layout components
│   ├── members/           # Member components
│   ├── messages/          # Message components
│   └── questionnaire/     # Questionnaire components
├── context/               # React Context providers
├── lib/                   # Library/utility code
├── styles/                # CSS files
├── utils/                 # Utility functions
└── types/                 # TypeScript types

migrations/                # Database migrations
config/                    # Configuration files
public/                    # Static assets
```

### Key File Locations

**API Routes**:
- App Router: `src/app/api/`
- Pages Router: `src/pages/api/`

**Components**:
- Shared: `src/components/`
- Page-specific: Co-located with pages

**Utilities**:
- Date/time: `src/utils/dateUtils.js`
- Campaign: `src/lib/campaign-utils.ts`
- Hold fees: `src/utils/holdFeeUtils.ts`
- OpenPhone: `src/utils/openphoneUtils.ts`

**Context**:
- Settings: `src/context/SettingsContext.tsx`
- Auth: `src/lib/auth-context.tsx`
- App: `src/context/AppContext.tsx`

---

## Testing & Deployment

### Testing

**Unit Tests**:
- Location: `src/**/__tests__/`
- Framework: Jest
- Run: `npm test`

**Test Files**:
- `src/utils/__tests__/dateUtils.test.js`
- `src/utils/__tests__/holdFeeUtils.test.ts`
- `src/utils/__tests__/mobileUtils.test.ts`
- `src/lib/__tests__/validations.test.ts`

### Deployment

**Platform**: Vercel (recommended)

**Build Command**: `npm run build`

**Environment Variables**: Set in Vercel dashboard

**Cron Jobs**: Configure in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/process-campaign-messages-updated",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/process-reservation-reminders",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/process-monthly-credits",
      "schedule": "0 7 * * *"
    }
  ]
}
```

**Database Migrations**: Apply manually in Supabase SQL Editor

**Post-Deployment**:
1. Verify environment variables
2. Test critical workflows
3. Monitor error logs
4. Check cron jobs are running

---

## Quick Reference

### Important Phone Numbers
- **Admin Notifications**: 6199713730
- **OpenPhone Number**: 913.777.4488

### Default Timezone
- **Storage**: UTC
- **Display**: America/Chicago (CST)

### Key Settings
- `hold_fee_enabled`: Enable/disable hold fees
- `hold_fee_amount`: Hold fee amount
- `admin_notification_phone`: Phone for reservation notifications
- `timezone`: Business timezone

### Common Commands
```bash
# Development
npm run dev

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

### Key Documentation Files
- `README/ADMIN_MANAGEMENT.md` - Admin system
- `README/MEMBER_FOLLOWUP_CAMPAIGNS.md` - Campaign system
- `README/RESERVATION_REMINDERS.md` - Reminder system
- `README/PRIVATE_EVENTS_SETUP.md` - Private events
- `README/WAITLIST_SETUP.md` - Waitlist system
- `README/TIMEZONE_IMPLEMENTATION.md` - Timezone handling

---

## Getting Help

### When Stuck

1. **Check this HOWTO** - Most answers are here
2. **Review related documentation** - See README/ directory
3. **Check migration files** - Understand database structure
4. **Review component code** - See how similar features work
5. **Check API routes** - Understand data flow
6. **Review logs** - `logs/combined.log` and `logs/error.log`

### Common Questions

**Q: How do I add a new feature?**
A: Follow existing patterns. Check similar features for structure.

**Q: Where do I add a new API endpoint?**
A: Use App Router (`src/app/api/`) for new endpoints. Pages Router (`src/pages/api/`) for legacy.

**Q: How do I add a new database table?**
A: Create migration in `migrations/`, apply in Supabase, add RLS policies.

**Q: How do I test locally?**
A: Use `npm run dev`, ensure all env vars set, test with local Supabase or staging.

**Q: How do I debug timezone issues?**
A: Check `settings.timezone`, verify UTC conversion, use Luxon for all operations.

---

## Changelog & Commit Log

This section maintains a running log of all significant commits and changes to the codebase. Each entry should include:
- Date and commit hash
- Brief description of the change
- Reference to the HOWTO.md section where detailed documentation was added/updated

### Format
```
### YYYY-MM-DD - Commit: [hash] - [Brief Description]
**Changes**: [What was changed]
**Documentation**: See [Section Name](#section-link)
**Git Commit**: `git commit message`
```

---

### 2026-01-23 - Member Portal Phase 1 Implementation Complete

**Changes**:
- **Database**: Created 5 new tables (member_portal_sessions, member_booking_preferences, referral_codes, referral_tracking, private_event_requests)
- **Database**: Extended members table with auth fields (auth_user_id, profile_photo_url, contact_preferences, referral_code, referred_by)
- **Database**: Extended settings table with portal config (member_portal_enabled, referral_reward_amount, referral_referee_bonus)
- **Security**: Implemented comprehensive RLS policies for member data isolation
- **Auth**: Created MemberAuthContext with magic link + SMS OTP support
- **Auth**: Implemented session tracking with auto-refresh every 5 minutes
- **UI**: Built MemberLayout with bottom navigation (Dashboard, Book, Reservations, Profile)
- **Pages**: Login page with email/phone auth tabs
- **Pages**: Dashboard with next reservation + balance overview
- **Pages**: Profile view (read-only) with membership details
- **Pages**: Placeholder pages for reservations, booking, balance, referrals
- **API**: GET /api/member/profile - Member profile data
- **API**: GET /api/member/balance - Current balance + recent transactions
- **API**: GET /api/member/reservations - Reservations list (upcoming/past)
- **Docs**: Created comprehensive setup guide (MEMBER_PORTAL_SETUP.md)
- **Docs**: Created completion summary (MEMBER_PORTAL_PHASE1_COMPLETE.md)
- **Docs**: Created migration README with verification queries and rollback scripts

**Documentation**: See [Member Portal System](#member-portal-system)

**Files Created**:
- Database migrations: `migrations/member_portal_schema.sql`, `migrations/member_portal_rls_policies.sql`, `migrations/MEMBER_PORTAL_MIGRATION_README.md`
- Context: `src/context/MemberAuthContext.tsx`
- Components: `src/components/member/MemberLayout.tsx`, `src/components/member/MemberNav.tsx`
- Pages: `src/app/member/login/page.tsx`, `src/app/member/dashboard/page.tsx`, `src/app/member/profile/page.tsx` + 4 placeholder pages
- API: `src/app/api/member/profile/route.ts`, `src/app/api/member/balance/route.ts`, `src/app/api/member/reservations/route.ts`
- Docs: `MEMBER_PORTAL_SETUP.md`, `MEMBER_PORTAL_PHASE1_COMPLETE.md`

**Status**: Phase 1 complete and ready for testing
**Next Steps**:
1. Run database migrations in Supabase
2. Configure Supabase Auth (magic link + SMS OTP)
3. Create test member accounts
4. Test locally and deploy to production
5. Begin Phase 2 planning (booking system, payment processing, profile editing)

**Git Commits**: Pending approval from Tim

---

### 2026-01-23 - Brand Agent & Design Approach Documentation

**Changes**:
- Created comprehensive `/brand` slash command (.claude/commands/brand.md) that transforms any AI into an elite membership app designer
- Added detailed member psychology documentation (demographics, drivers, values, pain points)
- Defined 10 future-forward design principles (anticipatory design, gestural minimalism, contextual intelligence, sophisticated gamification, etc.)
- Created component design patterns for membership psychology (buttons, forms, cards, status indicators, navigation, empty states)
- Added "Optional Projects" section to `/brand` command with 4 standby projects:
  1. Member Reservation Flow (the magic moment)
  2. Member Home/Dashboard (first impression)
  3. Member Profile & Status (gamification foundation)
  4. Dark/Light Mode Toggle (theming foundation)
- Enhanced `/start` command with "UI/Design Approach for General AI Agents" section
- Provided 10 practical guidelines with code examples (color palette, mobile-first design, visual feedback, card layouts, spacing, button hierarchy, etc.)
- Added design checklist (13 items) and clear division of labor between general AI and `/brand` agent
- Established workflow: general AI builds functional on-brand components (80%), `/brand` agent elevates to world-class (20%)

**Documentation**: See [Design System & Brand Guidelines](#design-system--brand-guidelines)

**Files Created/Modified**:
- `.claude/commands/brand.md` - New comprehensive brand agent command
- `.claude/commands/start.md` - Enhanced with UI/design approach for general AI

**Status**: Documentation complete, design system ready for implementation
**Next Steps**: AI agents can now build components following Noir design principles from the start

---

### 2026-01-23 - Member Portal System Planning

**Changes**:
- Completed comprehensive planning for Member Portal System
- Defined all features: Account Management, Reservations, Booking, Payments, Private Events, Referral Program, Calendar Integration
- Specified database schema extensions (5 new tables, extended members table)
- Designed complete API structure (`/api/member/*` routes)
- Created phased implementation plan (4 phases: MVP, Core, Enhanced, Polish)
- Documented security considerations, testing strategy, and success metrics
- Outlined future enhancements (push notifications, social features, loyalty program, mobile app)

**Documentation**: See [Member Portal System](#member-portal-system)

**Status**: Planning complete, ready for implementation
**Next Steps**: Begin Phase 1 (Foundation/MVP) - Database setup, auth, basic pages

---

### 2026-01-23 - Updated Documentation and Workflow Commands

**Changes**:
- Added urgent "DO NOT COMMIT" warning to both HOWTO.md and `/start` command
- Updated `/start` command to instruct AI to ask "What's your prompt?" after loading context
- Modified workflow to ensure explicit commit approval required from Tim

**Documentation**: No section changes - workflow/process updates only

**Git Commits**:
- Pending (no commits - documentation-only changes to .claude/ and HOWTO.md)

---

### 2026-01-23 - Initial Design System Documentation

**Changes**:
- Created comprehensive Design System & Brand Guidelines documentation
- Established Noir brand color palette and usage rules
- Defined mobile-first design principles and requirements
- Created `/start` and `/end` slash commands for AI workflow
- Added Changelog & Commit Log section (this section)

**Documentation**: See [Design System & Brand Guidelines](#design-system--brand-guidelines)

**Git Commits**:
- Documentation updates (no code commits yet - design system foundation phase)

### 2026-03-03 - Inventory Management System Implementation

**Summary**: Complete inventory tracking system with customizable settings, stock management, and recipe builder.

**New Features**:
1. **Inventory Management**
   - Full CRUD operations for inventory items
   - Quick stock adjustment buttons (+/-) inline with quantity display
   - Low stock alerts with visual indicators (red dot when below par level)
   - Category and subcategory organization
   - Cost tracking and pricing management

2. **Customizable Settings System**
   - Settings drawer for managing categories and subcategories
   - Dynamic form dropdowns based on custom settings
   - Separate management for inventory and recipe categories
   - Persistent storage in `system_settings` table

3. **Improved UX Design**
   - Moved delete function inside Edit drawer (prevents accidents)
   - Edit button repositioned inline with Par Level (desktop)
   - Edit button on same row as Par Level field (mobile)
   - Removed separate Actions column for cleaner layout
   - Delete requires confirmation dialog

4. **Transaction Tracking**
   - Automatic logging of all stock changes
   - Transaction history with audit trail
   - Timestamps and notes for each change
   - Foundation for History tab reporting

5. **Export & Reporting**
   - CSV export of complete inventory
   - Date-stamped filenames
   - Includes all item details, costs, and stock status

6. **Recipe Builder Foundation**
   - Database tables for recipes and ingredients
   - API endpoints ready for recipe management
   - Cost calculation framework

**Database Changes**:
- Created `inventory_items` table
- Created `inventory_transactions` table for audit trail
- Created `inventory_recipes` and `inventory_recipe_ingredients` tables
- Created `system_settings` table for configuration
- Added RLS policies for all inventory tables
- Migration files: `20240301_create_inventory_tables.sql`, `20240302_create_system_settings_table.sql`

**Components Added**:
- `InventoryList.tsx` - Table and card view with inline stock adjustments
- `InventoryItemDrawer.tsx` - Add/Edit drawer with delete protection
- `InventorySettings.tsx` - Category management interface
- `RecipeBuilder.tsx`, `RecipeDrawer.tsx` - Recipe management (foundation)

**API Endpoints**:
- `/api/inventory` - CRUD operations
- `/api/inventory/transactions` - Transaction logging
- `/api/inventory/recipes` - Recipe management
- `/api/inventory/settings` - Category configuration

**UI/UX Improvements**:
- Fixed drawer z-index positioning
- Mobile-optimized button layouts
- Inline edit buttons for better space utilization
- Danger button styling for destructive actions

**Git Commits**:
- `fa6fd03` - Enhance inventory system with improved UX and customizable settings

---

**Last Updated**: March 3, 2026
**Version**: Inventory System v1.0 - Complete Stock Management with Custom Settings

---

*This document is maintained as the single source of truth for understanding the Noir CRM Dashboard. Update it when making significant changes to the system.*

