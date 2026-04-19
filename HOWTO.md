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

**Last Updated**: 2026-03-08

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

**External Services**: OpenPhone (SMS), Stripe (payments), Vercel Analytics

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
- `waitlist` - Member applications and signup tracking
- `questionnaires` - Dynamic form templates for signup flows
- `questionnaire_questions` - Questions for each questionnaire
- `questionnaire_responses` - User responses to questionnaire questions

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

**Terminology Guidelines** ⭐ NEW 2026-03-06:
- **User-facing UI**: Use "Membership" (not "Subscription")
  - Examples: "Membership Card", "Base Membership", "Manage Membership"
- **Backend/code**: Use "Subscription" (for Stripe API compatibility)
  - Variables: `subscriptionData`, `stripe_subscription_id`
  - Database columns: `subscription_status`, `subscription_start_date`
- **Rationale**: "Membership" is friendlier and aligns with business model

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
- **`member_type` (TEXT)** - 'primary' or 'secondary' - Distinguishes main vs additional members
- `photo` (TEXT) - Base64-encoded JPEG profile photo (no index due to 8KB B-tree limit)
- `dob` (DATE) - Date of birth
- `monthly_credit` (DECIMAL) - Current credit balance
- `last_credit_date` (DATE) - Last credit reset
- `credit_renewal_date` (DATE) - Next renewal date
- `deactivated` (BOOLEAN) - Soft delete flag
- `created_at`, `updated_at`

**Notes**:
- `member_type` replaces deprecated `primary` boolean column
- `photo` column has no B-tree index to allow larger base64 images (~50KB max)
- Secondary members add $25/month to account's `monthly_dues`

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

#### `locations`
- `id` (UUID, PK)
- `name` (TEXT, UNIQUE) - Display name (e.g., "Noir KC", "RooftopKC")
- `slug` (TEXT, UNIQUE) - URL-safe identifier (e.g., "noirkc", "rooftopkc")
- `timezone` (TEXT) - IANA timezone (default: 'America/Chicago')
- `address` (TEXT) - Physical location address
- `cover_enabled` (BOOLEAN) - Whether cover charges apply (default: false)
- `cover_price` (INTEGER) - Cover charge amount in dollars (for non-members only, members always free)
- `minaka_ical_url` (TEXT) - Location-specific Minaka calendar feed URL
- `status` (TEXT) - 'active', 'inactive'
- `created_at`, `updated_at`

**Notes**:
- Cover charges are NEVER applied to members (checked via memberId)
- Each location has independent booking windows, hours, and calendar settings
- Minaka iCal URLs are stored per-location for scalability

#### `tables`
- `id` (UUID, PK)
- `table_number` (INTEGER) - Unique per location (composite unique with location_id)
- `location_id` (UUID, FK → locations) - References location
- `seats` (INTEGER) - Table capacity
- `status` (TEXT) - 'active', 'inactive'
- `created_at`, `updated_at`

**Constraints**:
- Composite unique: `(location_id, table_number)` - Allows duplicate table numbers across locations
- Tables are location-specific (e.g., Noir KC has 20 tables, RooftopKC has 17 tables)

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

#### `accounts`
- `account_id` (UUID, PK)
- `stripe_customer_id` (TEXT) - Stripe customer ID
- `stripe_subscription_id` (TEXT) - Stripe subscription ID
- `subscription_status` (TEXT) - 'active', 'canceled', 'past_due', 'paused'
- `subscription_start_date` (DATE)
- `subscription_cancel_at` (DATE)
- `next_billing_date` (DATE) - **Source of truth** for when account should be billed next (used by cron job)
- `monthly_dues` (DECIMAL) - Total MRR including base subscription + additional member fees
- `payment_method_type` (TEXT) - 'card', 'us_bank_account'
- `payment_method_last4` (TEXT) - Last 4 digits of payment method
- `payment_method_brand` (TEXT) - Card brand or bank name
- `credit_card_fee_enabled` (BOOLEAN) - Default: false - When true, adds 4% processing fee to credit card transactions
- `created_at`, `updated_at`

**Notes**:
- Members are linked to accounts via `members.account_id` foreign key
- Multiple members can share one account (primary + secondary members)
- Each additional member adds $25/month to `monthly_dues`
- Credit card fees only apply to card transactions when enabled (ACH/bank transfers exempt)

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

### 1. Reservation System (Multi-Location)

**Location**: `src/app/api/reservations/route.ts`, `src/components/ReservationForm.tsx`

**Flow**:
1. User selects location (Noir KC, RooftopKC)
2. User selects date/time/party size
3. System checks availability (`/api/available-slots`) **filtered by location**
4. **Cover charge logic**: If location has `cover_enabled=true` AND user is not a member, cover charge applies
5. For non-members: Stripe hold created if enabled
6. Reservation created with table assignment
7. SMS confirmation sent
8. Admin notification sent to `admin_notification_phone` (6199713730)
9. Reminders scheduled if enabled

**Key Features**:
- **Multi-location support**: Independent table inventory and availability per location
- **Location-aware availability**: Only checks tables at selected location
- **Cover charges**: Configurable per location, members always bypass
- Automatic table assignment based on capacity
- Alternative time suggestions if requested time unavailable
- Hold fee system for non-members (configurable)
- Check-in tracking
- Multiple sources: website, SMS, manual, RSVP

**Locations**:
- **Noir KC** (`noirkc`): 20 tables, typically no cover
- **RooftopKC** (`rooftopkc`): 17 tables, $20 cover for non-members
- **Future**: Noir OP and additional locations

**Related Files**:
- `src/components/ReservationModalFixed.tsx` - New reservation modal (passes `location_slug`)
- `src/components/member/SimpleReservationRequestModal.tsx` - Member reservation request (cover charge UI)
- `src/components/ReservationsTimeline.tsx` - Location-filtered timeline
- `src/components/FullCalendarTimeline.tsx` - Location-filtered calendar
- `src/pages/admin/reservations.tsx` - Location switcher tabs
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

### 5. Member Signup & Onboarding System

**Location**: `src/app/signup/`, `src/app/skyline/`, `src/app/apply/`, `src/pages/admin/membership.tsx`

**Three Signup Flows**:

1. **MEMBERSHIP Flow (Waitlist)**:
   - User texts "MEMBERSHIP" or "MEMBER" → Receives link to `/apply`
   - Fills out custom AnimatedQuestionnaire (one question per screen)
   - Entry stored in `waitlist` table with status 'review'
   - Admin reviews in `/admin/membership` → Waitlist tab
   - If approved → User receives `/onboard/{token}` link (24hr expiration)
   - Complete: Agreement → Membership Selection → Payment → Profile

2. **INVITATION Flow (Pre-approved Regular Signup)**:
   - User texts "INVITATION" → Receives `/signup/{token}` link (24hr expiration)
   - Fills out AnimatedQuestionnaire with profile photo (REQUIRED)
   - Auto-redirect to `/onboard/{token}`
   - Complete: Agreement → Membership Selection → Payment → Profile

3. **SKYLINE Flow (Pre-approved Skyline Signup)**:
   - User texts "SKYLINE" → Receives `/skyline/{token}` link (24hr expiration)
   - Fills out AnimatedQuestionnaire with Skyline branding
   - Skyline membership pre-selected
   - Auto-redirect to `/onboard/{token}`
   - Complete: Agreement → Payment → Profile

**Key Features**:
- All forms use AnimatedQuestionnaire component (consistent UX)
- One question per screen with smooth animations (Framer Motion)
- Profile photo required on all signup forms
- Token-based security with 24-hour expiration
- Admin-configurable questions via `/admin/membership` → Questionnaires tab
- Status tracking: review, approved, denied, waitlisted
- Automated SMS responses with personalized links

**Database Tables**:
- `waitlist` - Stores all applications (columns: `agreement_token`, `agreement_token_created_at`, `questionnaire_completed_at`, `selected_membership`, `photo_url`)
- `questionnaires` - Form templates (types: 'waitlist', 'invitation', 'skyline')
- `questionnaire_questions` - Dynamic questions for each form
- `questionnaire_responses` - User responses linked to waitlist entries
- `agreements` - Agreement templates with version tracking
- `agreement_signatures` - Digital signatures with IP/timestamp

**Related Files**:
- `src/app/apply/page.tsx` - Waitlist application form
- `src/app/signup/[token]/page.tsx` - INVITATION signup form
- `src/app/skyline/[token]/page.tsx` - SKYLINE signup form
- `src/app/onboard/[token]/page.tsx` - Onboarding wizard (agreement, payment, profile)
- `src/components/AnimatedQuestionnaire.tsx` - Reusable questionnaire component
- `src/components/OnboardingWizard.tsx` - Multi-step onboarding flow
- `src/pages/api/openphoneWebhook.js` - Handles SMS keywords (MEMBERSHIP, INVITATION, SKYLINE)
- `src/pages/api/waitlist.js` - Admin approval endpoint
- `README/WAITLIST_SETUP.md` - Legacy documentation (pre-custom forms)

### 6. Member Management

**Location**: `src/pages/admin/members.tsx`, `src/pages/api/members.js`

**Features**:
- Member profiles with account linking
- Membership types: Skyline, Duo, Solo, Annual
- Balance tracking and ledger
- Monthly credit system (Skyline members)
- Member attributes and notes
- Archive/deactivation support (soft delete)
- Add members to existing accounts (Solo → Duo upgrades)

**Monthly Credits**:
- Skyline members get $100 credit monthly
- Reset based on `join_date`
- Processed via `/api/process-monthly-credits.ts` (cron: 7am CST)
- Overspend automatically charged via Stripe (8am CST)

**API Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/members` | POST | Create new member account (primary + optional secondary) |
| `/api/members` | GET | List all active members (deactivated = false) |
| `/api/members` | PUT | Update member details |
| `/api/members/[memberId]` | DELETE | Archive member (sets deactivated = true) |
| `/api/members/add-to-account` | POST | Add secondary member to existing account |
| `/api/member_attributes` | GET/POST/PUT/DELETE | Manage member custom attributes |
| `/api/member_notes` | GET/POST/PUT/DELETE | Manage member notes |

**Member Type System**:
- `member_type` field distinguishes primary vs secondary members on shared accounts
- **Primary Member**: Main account holder, listed first
- **Secondary Member**: Additional member at $25/month administration fee
- Accounts can have multiple secondary members (no limit)
- Each secondary member adds $25 to `monthly_dues`
- Secondary members can be promoted to primary (demotes current primary)

**Additional Member Pricing**:
- Base subscription (e.g., $100/mo Skyline, $1/mo Host plan)
- Each additional member: +$25/month administration fee
- Total MRR = Base Subscription + (Secondary Member Count × $25)
- Example: Skyline ($100) + 2 additional members = $150/month total

**Example: Add Member to Account (Solo → Duo Upgrade)**
```typescript
// POST /api/members/add-to-account
{
  "account_id": "uuid-here",
  "member_data": {
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "5551234567",
    "dob": "1990-01-01",
    "photo": "base64_or_url", // optional: photo upload/URL
    "member_type": "secondary" // automatically set
  },
  "new_price_id": "price_duo_monthly" // optional: upgrade subscription tier
}

// Response includes updated monthly_dues (+$25)
```

**Photo Upload System**:
- Supports file upload (up to 10MB) or URL input
- Client-side image compression (600×600px @ 75% quality)
- Crop/zoom modal for positioning (drag to reposition, slider for zoom)
- Final output: 400×400px @ 80% quality JPEG
- Stored as base64 data URL in `members.photo` column
- Touch-enabled for mobile devices

**Related Files**:
- `src/components/MemberDetail.tsx` - Member detail view
- `src/pages/admin/members/[accountId].tsx` - Member detail page with inline ledger editing
- `src/components/AddSecondaryMemberModal.tsx` - Add member modal with photo upload
- `src/pages/api/members/add-to-account.ts` - Add to existing account API
- `src/pages/api/member_attributes.js` - Member attributes API
- `src/pages/api/member_notes.js` - Member notes API
- `src/components/pages/MemberLedger.js` - Ledger view
- `src/components/SubscriptionTransactionHistory.tsx` - Stripe invoice history

### 6.1. Subscription Management

**Location**: `src/components/MemberSubscriptionCard.tsx`, `src/pages/api/subscriptions/`

**Overview**: Comprehensive subscription lifecycle management integrated with Stripe billing.

**Features**:
- Create, pause, resume, cancel, and reactivate subscriptions
- Upgrade/downgrade subscription plans with proration
- Payment method management
- Subscription status tracking (active, paused, canceled, past_due, trialing)
- Transaction history (Stripe invoices)
- **MRR Breakdown Display**: Shows base subscription + additional member fees
  - Base Subscription: Fetched from Stripe price.unit_amount (actual plan cost)
  - Additional Members: Dynamic rate based on plan type (see below)
  - Total MRR: Sum displayed with visual hierarchy and divider
- **Credit Card Processing Fee Toggle**: Per-account 4% fee on credit card transactions
  - ACH/bank transfers exempt from fee
  - Stored in `accounts.credit_card_fee_enabled` column
  - Toggle accessible in Payment Settings section
- **Subscription Creation Modal**: Admin can create subscriptions from member detail page
  - Lists all available plans from Stripe
  - Creates subscription with 1-day trial to avoid "incomplete" status
  - Automatically updates account with subscription info
  - Member can add payment method later via member portal

**Subscription States & Actions**:

| Current State | Available Actions | UI Buttons Shown |
|--------------|-------------------|------------------|
| **Active** | Pause, Cancel, Update Plan, Update Payment | Pause · Cancel · Update Plan · Update Payment |
| **Paused** | Resume, Update Plan, Update Payment | Resume Subscription · Update Plan · Update Payment |
| **Scheduled Cancellation** | Reactivate, Update Plan, Update Payment | Reactivate · Update Plan · Update Payment |
| **No Subscription** | Create Subscription | Create Subscription |

**Dynamic Additional Member Fees**:

The system automatically adjusts additional member fees based on the subscription plan:
- **Skyline Membership** ($10/month base): $0 per additional member (free)
- **All other plans**: $25/month per additional member

This is calculated by checking if `base_mrr === 10`, making Skyline a special "unlimited members" tier.

**API Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/subscriptions/create` | POST | Create new subscription for account (adds 1-day trial) |
| `/api/subscriptions/pause` | POST | Pause subscription (stops billing) |
| `/api/subscriptions/resume` | POST | Resume paused subscription |
| `/api/subscriptions/cancel` | PUT | Cancel subscription at end of billing period |
| `/api/subscriptions/reactivate` | POST | Remove scheduled cancellation |
| `/api/subscriptions/update-plan` | POST | Upgrade or downgrade subscription tier |
| `/api/subscriptions/plans` | GET | List all available subscription plans from Stripe |
| `/api/subscriptions/list` | GET | List all Stripe subscriptions with account data |
| `/api/subscriptions/[subscriptionId]` | GET | Get single subscription details |

**Example: Create Subscription**
```typescript
// POST /api/subscriptions/create
{
  "member_id": "uuid-here",  // Primary member ID
  "price_id": "price_xxx"    // Stripe price ID from /api/subscriptions/plans
}

// Response:
{
  "subscription": { /* Stripe subscription object with 1-day trial */ },
  "client_secret": "pi_xxx_secret_yyy" // If payment confirmation needed
}
```

**Example: Pause Subscription**
```typescript
// POST /api/subscriptions/pause
{
  "account_id": "uuid-here",
  "reason": "Temporary travel" // optional
}

// Response:
{
  "subscription": { /* Stripe subscription object */ },
  "message": "Subscription paused successfully"
}
```

**Example: List Subscriptions**
```typescript
// GET /api/subscriptions/list?status=active&limit=50

// Response:
{
  "subscriptions": [
    {
      "stripe_subscription_id": "sub_xxx",
      "account_id": "uuid",
      "status": "active",
      "amount": 150,
      "monthly_dues": 150,
      "current_period_end": 1234567890,
      ...
    }
  ],
  "count": 42,
  "has_more": false
}
```

**Subscription Events Logging**:
All subscription state changes are logged to `subscription_events` table:
- Event types: `subscribe`, `cancel`, `upgrade`, `downgrade`, `pause`, `resume`
- Tracks previous/new MRR, plan changes, effective dates
- Includes metadata (reason, admin who made change, etc.)

**Payment Method Management**:

The payment method system supports two payment types with instant verification for ACH/bank accounts:

1. **Credit/Debit Cards** (4% fee)
   - Traditional card entry via Stripe CardElement
   - Shows "(4% fee)" label on payment type selector
   - Submit form to update default payment method

2. **ACH/Bank Account** (No Fee)
   - **Instant bank verification** via Stripe Financial Connections (Plaid)
   - Click "ACH/Bank" button to **immediately** trigger Stripe's secure bank login flow
   - No manual entry of routing/account numbers required
   - Modal closes automatically and Stripe Financial Connections popup appears
   - User logs into their bank securely for instant verification (no 1-2 day micro-deposit wait)
   - Uses `stripe.collectBankAccountForSetup()` with `financial_connections` enabled

**Technical Implementation**:

- **Setup Intent Configuration**: Server-side Financial Connections enabled via:
  ```typescript
  payment_method_options: {
    us_bank_account: {
      financial_connections: {
        permissions: ['payment_method', 'balances'],
      },
      verification_method: 'instant',
    },
  }
  ```

- **Mobile Positioning Fix**: Body scroll locked at position:fixed top:0 before Stripe initialization to prevent iframe offset issues on mobile
- **Modal Rendering**: UpdatePaymentModal uses React Portal (`createPortal`) to render at `document.body` level, avoiding parent modal transform/positioning conflicts
- **Dual Display**:
  - **Admin Panel** (`/admin/members/[accountId]`): Shows default payment method on subscription card above 4% fee toggle
  - **Member Portal** (`/member/dashboard`): Payment Methods modal lists all saved methods with set default/delete actions

**Important**: ACH button directly triggers bank verification flow - no intermediate explanation screens for streamlined UX. Stripe Financial Connections must be enabled in Stripe Dashboard under Settings → Payment methods → ACH Direct Debit → Link Financial Connections.

**API Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stripe/payment-methods/setup-intent` | POST | Create SetupIntent with Financial Connections for instant ACH or card |
| `/api/stripe/checkout/setup-ach` | POST | Create Stripe Checkout Session for ACH setup (member portal flow) |
| `/api/stripe/payment-methods/set-default` | PUT | Set payment method as default on Stripe customer |
| `/api/stripe/payment-methods/list` | GET | List all payment methods (card + us_bank_account) with default flag |
| `/api/stripe/payment-methods/detach` | DELETE | Remove payment method from Stripe customer |
| `/api/stripe/payment-methods/create-from-fc` | POST | Create PaymentMethod from Financial Connections account |
| `/api/stripe/setup-intents/[id]` | GET | Retrieve SetupIntent with latest_attempt details |
| `/api/accounts/update-credit-card-fee` | PUT | Toggle 4% credit card fee setting for account |

**Member Portal Payment Flow** (2-Step Process):

The member portal uses a simplified two-step flow to avoid Stripe iframe click detection issues:

1. **Payment Type Selection**: User selects "Credit Card" or "US Bank Account"
2. **Payment Method Entry**:
   - **Credit Cards**: CardElement form rendered in-app (no iframe issues, no collapsible options)
   - **ACH/Bank**: Redirects to Stripe Checkout hosted page (avoids iframe entirely)

**Technical Implementation**:
- **MemberSubscriptionCard** (`src/components/MemberSubscriptionCard.tsx`): Main subscription management UI with dynamic fee calculation
- **CreateSubscriptionModal** (`src/components/CreateSubscriptionModal.tsx`): Modal for admin to create new subscriptions with plan selection
- **UpdatePlanModal** (`src/components/UpdatePlanModal.tsx`): Modal for changing subscription plans
- **UpdatePaymentModal** (`src/components/UpdatePaymentModal.tsx`): Modal for updating payment methods with ACH via Financial Connections
- **AddSecondaryMemberModal** (`src/components/AddSecondaryMemberModal.tsx`): Shows dynamic fees ($0 for Skyline, $25 for others)
- **AddPaymentMethodModal** (`src/components/member/AddPaymentMethodModal.tsx`): Two-step modal with payment type selection
- **CardElement API**: Stable, direct integration for cards (no PaymentElement wrapper)
- **Financial Connections ACH**: `collectBankAccountForSetup()` for instant bank verification with fallback PaymentMethod creation from FC account
- **Body Scroll Lock**: Position fixed applied before Stripe initialization to prevent click offset issues
- **Success/Cancel URLs**: Returns to `/member/dashboard?payment_setup=success|cancelled`

**ACH Setup Flow** (UpdatePaymentModal):
1. Create SetupIntent with `payment_method_type: 'us_bank_account'`
2. Call `stripe.collectBankAccountForSetup()` to launch Financial Connections
3. On success, check if `setupIntent.payment_method` exists
4. If not, retrieve full SetupIntent to get `financial_connections_account` ID
5. Create PaymentMethod from FC account via `/api/stripe/payment-methods/create-from-fc`
6. Set PaymentMethod as default on customer and subscription

**Related Files**:
- `src/components/MemberSubscriptionCard.tsx` - Subscription management UI, displays default payment method
- `src/components/SubscriptionTransactionHistory.tsx` - Stripe invoices with "(incl. 4% CC fee)" indicator
- `src/components/UpdatePlanModal.tsx` - Plan upgrade/downgrade modal
- `src/components/UpdatePaymentModal.tsx` - Unified payment method update (Card/ACH with instant verification) - ADMIN PANEL
- `src/components/member/PaymentMethodModal.tsx` - Member portal payment methods list modal
- `src/components/member/AddPaymentMethodModal.tsx` - Member portal add payment method modal (2-step flow)
- `src/components/ui/dialog.tsx` - Base dialog component (flexbox centering, no transforms for Stripe compatibility)
- `src/pages/api/stripe/payment-methods/setup-intent.ts` - Creates SetupIntent with Financial Connections config
- `src/pages/api/stripe/payment-methods/list.ts` - Lists both card and us_bank_account payment methods
- `src/pages/api/stripe/payment-methods/set-default.ts` - Sets default payment method on customer/subscription
- `src/pages/api/stripe/payment-methods/create-from-fc.ts` - Creates PaymentMethod from Financial Connections account
- `src/pages/api/stripe/setup-intents/[id].ts` - Retrieves SetupIntent with latest_attempt details
- `src/pages/api/stripe/checkout/setup-ach.ts` - Creates Stripe Checkout Session for ACH (member portal)
- `src/app/globals.css` - Stripe modal CSS exceptions (body.stripe-ach-active class), scrollbar-hide utility
- `src/styles/UpdatePaymentModal.module.css` - Payment modal styles with mobile responsiveness

### 6.2. Beverage Credit System

**Location**: `.claude/docs/beverage-credit-system.md`

**Overview**: Track member spending at venue separately from subscription billing.

**Design Philosophy**:
- **Two separate systems**: Stripe invoices (subscription billing) vs. Ledger (venue spending)
- **Credits roll over**: Unused beverage credits accumulate month-to-month
- **No pro-rating**: Members get full credit allocation regardless of join date
- **Uses existing ledger**: No database schema changes required

**Current Pricing Structure (March 2026)**:

| Membership Tier | Monthly Fee | Beverage Credit | Admin Fee |
|----------------|------------|----------------|-----------|
| Solo Membership | $150 | $100 | $50 |
| Duo Membership | $175 | $100 | $75 ($25 extra for 2nd member) |
| Daytime Add-on | +$225 | +$225 | $0 (no admin fee on add-on) |

**How It Works**:
1. **Stripe charges subscription** ($150/mo) → Shows in Transaction History
2. **Admin allocates beverage credit** ($100) → Ledger entry with `type: 'payment'`, `note: 'Monthly beverage credit allocation'`
3. **Member makes purchases** → Ledger entry with `type: 'purchase'`, `note: 'Cocktail purchase'`
4. **Running balance** = Sum of all ledger entries (positive for credits, negative for purchases)

**Ledger Entry Types**:
- `'payment'` - Used for beverage credit allocations (positive amount)
- `'purchase'` - Venue purchases (negative amount)
- `'charge'` - Manual charges
- `'refund'` - Refunds

**Example Ledger Flow**:
```
Month 1: +$100 credit, -$30 spent → Balance: $70
Month 2: +$100 credit, -$50 spent → Balance: $120  (credits rolled over!)
Month 3: +$100 credit, -$200 spent → Balance: $20
```

**Future Enhancement (Phase 2)**:
- Automated monthly credit allocation via Stripe webhook (`invoice.paid`)
- Calculate beverage credit based on subscription tier
- Auto-insert ledger entry on subscription renewal

**Related Documentation**:
- `.claude/docs/beverage-credit-system.md` - Complete design document
- Implementation status: Phase 1 (manual allocation) complete
- Phase 2 (automated allocation) pending

### 7. Financial System

**Location**: `src/pages/api/chargeBalance.js`, `src/pages/api/stripe-webhook.js`

**Components**:
- **Ledger**: Transaction history (`ledger` table)
- **Stripe Integration**: Holds, charges, payment methods
- **Balance Tracking**: Per-member balance calculation
- **PDF Generation**: Ledger PDFs (`src/utils/ledgerPdfGenerator.ts`)
- **Quick Actions**: Collapsible card for ledger management on member detail page

**Quick Actions (Member Detail Page)**:
**Location**: `src/pages/admin/members/[accountId].tsx` (lines 1488-1611)

Three quick action types in a single collapsible card interface:

1. **Charge Card** (→ icon, tan button)
   - Processes Stripe payment for custom amount
   - Creates single `payment` entry in ledger (positive amount)
   - Includes confirmation dialog before charging
   - Records `stripe_payment_intent_id` AND `stripe_charge_id` to prevent webhook duplicates
   - Migration added `stripe_charge_id` column: `supabase/migrations/20260305_add_stripe_charge_id_to_ledger.sql`
   - Use case: Partial payments, custom invoices, event fees

2. **Add Credit** (+ icon, green button)
   - Adds ledger-only credit without Stripe charge
   - Creates `payment` entry (positive amount) - reduces balance
   - No payment processing, ledger entry only
   - Use case: Referral bonuses, comp credits, adjustments

3. **Add Purchase** (− icon, red button)
   - Adds ledger-only charge without Stripe payment
   - Creates `purchase` entry (negative amount) - increases balance owed
   - No payment processing, ledger entry only
   - Use case: Event tickets, bar tabs, purchases

**UI Features**:
- Expandable "Quick Actions" card (collapsed by default)
- Mobile-responsive grid layout (90px amount, flexible description, 34px icon button)
- Icon-based buttons for compact, modern design
- Color-coded by action type
- Form validation: requires amount > $0 and description

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
- `src/styles/MemberDetail.module.css` (lines 1488-1677) - Quick Actions styling

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

### 11. Business Dashboard & Analytics

**Location**: `src/pages/admin/business.tsx`, `src/pages/api/admin/business-*`, `src/lib/businessMetrics.ts`

**Overview**: Comprehensive business intelligence dashboard for tracking MRR, member growth, retention, and financial metrics.

**Data Source**: Uses `accounts.monthly_dues` (source of truth) and `member_subscription_snapshots` table for point-in-time historical data.

**Key Metrics**:

1. **Revenue Health**
   - **MRR** (Monthly Recurring Revenue): Sum of all active members' `accounts.monthly_dues`
   - **Net New MRR**: New + Expansion - Contraction - Churned - Paused
   - **ARR** (Annual Recurring Revenue): MRR × 12
   - **Current Month Total Revenue**: All member payments (dues + purchases)
   - **Last Month Total Revenue**: Previous complete month data

2. **MRR Bridge Components**
   - **New MRR**: Members whose `join_date` is in current month with MRR > 0
   - **Expansion MRR**: Existing members who increased MRR OR reactivated (had $0, now >$0, but joined previously)
   - **Contraction MRR**: Members who decreased MRR (but still >$0)
   - **Churned MRR**: Members who went from MRR >$0 to $0 (not paused)
   - **Paused MRR**: Members who went to $0 with status='paused'

3. **Member Counts**
   - Active Members: `members.status='active'` AND `accounts.monthly_dues>0`
   - New Members: Count of members with `join_date` in current month
   - Churned Members: Members who cancelled this month
   - Paused Members: Members with status='paused'

**Snapshot System**:
- Historical data stored in `member_subscription_snapshots` table
- Snapshots capture: member_id, snapshot_month, mrr, subscription_status, signup_date (from join_date)
- Snapshots filter by `join_date <= end_of_month` to ensure historical accuracy
- Monthly snapshots should be generated at month-end and not modified
- "Regenerate Snapshot" button available for backfilling/fixing incorrect data

**API Endpoints**:
- `GET /api/admin/business-summary?month=YYYY-MM-01` - Get single month metrics
- `GET /api/admin/business-series?month=YYYY-MM-01&months=12` - Get time series data
- `GET /api/admin/business-drilldown?type=churned|expansion|attach|new|paused&month=YYYY-MM-01` - Get member lists
- `POST /api/admin/business-snapshot?month=YYYY-MM-01` - Generate/regenerate snapshot

**Important Notes**:
- Uses `accounts.monthly_dues` NOT `members.monthly_dues` (accounts is source of truth)
- New members identified by `signup_date` matching current month
- Reactivations (had $0, now >$0, but signed up earlier) count as Expansion, not New
- MTD (Month-to-Date) label shows for current month
- Month selector limited to October 2025 onwards

**Net New MRR Modal**: Click Net New MRR card to see detailed breakdown with member lists for each component (new, expansion, contraction, churned, paused).

### 12. Inventory Management System

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
- `POST /api/members/[memberId]/mark-incomplete` - Mark pending member as incomplete
- `POST /api/member_attributes` - Member attributes
- `POST /api/member_notes` - Member notes
- `POST /api/chargeBalance` - Charge member balance via Stripe (supports custom amounts)
- `POST /api/process-monthly-credits` - Process monthly credits

**Ledger Management**:
- `GET /api/ledger?account_id={id}` - Get ledger entries for account
- `POST /api/ledger` - Create ledger entry (payment/purchase)
  - Body: `{ account_id, member_id, type: 'payment'|'purchase', amount, note, date }`
  - Used by Quick Actions: Add Credit, Add Purchase
- `POST /api/chargeBalance` - Process Stripe payment and record in ledger
  - Body: `{ account_id, custom_amount?, custom_description? }`
  - If `custom_amount` provided: charges that amount via Stripe
  - If not: charges full outstanding balance
  - Records payment in ledger with `stripe_payment_intent_id` for deduplication

**Waitlist & Onboarding**:
- `GET /api/waitlist` - List waitlist entries
- `PATCH /api/waitlist` - Update waitlist entry status (approve/deny)
- `POST /api/waitlist/submit` - Submit questionnaire response
- `GET /api/onboard/validate?token={token}` - Validate onboarding token
- `POST /api/onboard/complete` - Complete onboarding (create member)

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
- SMS Keywords:
  - "MEMBERSHIP" / "MEMBER" → Sends link to `/apply` (waitlist form)
  - "INVITATION" → Creates approved waitlist entry, sends `/signup/{token}` link (24hr)
  - "SKYLINE" → Creates approved waitlist entry with Skyline pre-selected, sends `/skyline/{token}` link (24hr)
  - "RESERVATION" → Reservation booking via SMS
  - "BALANCE" → Sends ledger PDF
- Reservation booking via SMS with natural language date parsing

**Sending SMS**: `src/utils/openphoneUtils.ts`
- `sendSMS()` function
- Used by campaigns, reminders, notifications

### Stripe Integration

**Purpose**: Payment holds and charges

**Configuration**:
- `STRIPE_SECRET_KEY` - Secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Publishable key

**Webhook**: `src/pages/api/stripe-webhook-subscriptions.ts`
- Handles subscription lifecycle events
- Updates account subscription status and payment info
- Creates ledger entries for subscription payments
- **Critical**: Throws errors on failures instead of silent returns
- Processes events: `customer.subscription.created`, `updated`, `deleted`, `invoice.paid`, `payment_failed`, `payment_method.attached`

**Payment Method Sync**:
- Subscription webhooks automatically sync payment method details from Stripe
- Payment method info stored in accounts table: `payment_method_type`, `payment_method_last4`, `payment_method_brand`
- Bulk sync script available: `scripts/sync-payment-methods.js`
- Supports card and us_bank_account payment types

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
- **Credit Card Fee System** (per-account toggle):
  - Optional 4% processing fee on credit card transactions
  - Controlled by `credit_card_fee_enabled` boolean column on `accounts` table
  - Fee detection: Retrieves payment method type from Stripe
  - ACH/bank transfers are exempt from fees
  - Fee recorded as separate ledger entry: "4% Credit Card Processing Fee"
  - Admin UI toggle in subscription card Payment Settings section
  - Returns breakdown: base amount, fee amount, total charged

### Custom Forms System (AnimatedQuestionnaire)

**Purpose**: Member signup and application forms

**Component**: `src/components/AnimatedQuestionnaire.tsx`
- One question per screen with smooth animations
- Supports: text, email, phone, textarea, file uploads
- Progress bar and navigation
- Mobile-first responsive design
- Framer Motion animations (card flips/slides)

**Admin Management**: `/admin/membership` → Questionnaires tab
- Create/edit questionnaire templates
- Add/remove/reorder questions
- Set question types and validation
- Toggle active status

**Questionnaire Types**:
- `waitlist` - MEMBERSHIP flow (ID: `a201cee3-3e34-459d-83c8-25b073fd26f7`)
- `invitation` - INVITATION flow (ID: `11111111-1111-1111-1111-111111111111`)
- `skyline` - SKYLINE flow (ID: `22222222-2222-2222-2222-222222222222`)

**Database**:
- `questionnaires` - Form templates
- `questionnaire_questions` - Questions with order_index
- `questionnaire_responses` - User answers linked to waitlist_id

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
1. **SMS OTP (One-Time Password)**: Self-service passwordless login ⭐ NEW
   - 6-digit code sent via SMS (OpenPhone integration)
   - Code expires in 10 minutes, single-use only
   - Members can activate their portal without admin intervention
   - Automatic redirect to password setup on first login
   - API: `POST /api/auth/send-phone-otp`, `POST /api/auth/verify-phone-otp`

2. **Phone + Password**: Primary authentication method
   - 10-digit phone number (normalizes +1, spaces, dashes, parentheses)
   - Bcrypt password hashing (10 salt rounds)
   - httpOnly session cookies (7-day expiration)
   - Session stored in `member_portal_sessions` table

3. **Biometric Authentication** (WebAuthn/FIDO2):
   - Face ID, Touch ID, Windows Hello support
   - Platform authenticator only (no security keys)
   - Stored in `biometric_credentials` table
   - Counter-based replay attack prevention
   - Endpoints: `register-challenge`, `register-verify`, `login-challenge`, `login-verify`

**Security Features**:
- **OTP Rate Limiting**: 3 OTP requests per phone per 15 min, 10 per IP per hour ⭐ NEW
- **OTP Account Lockout**: 5 failed verifications in 15 min = 15-min lockout ⭐ NEW
- **OTP Audit Logging**: All OTP requests, verifications, failures logged with IP/user agent ⭐ NEW
- **Rate Limiting**: 10 requests per 15-minute window per IP (password login)
- **Account Lockout**: 5 failed attempts = 15-minute lockout (password login)
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
- Supports both custom sessions (password/biometric/OTP) and Supabase Auth (email magic links)
- Provides hooks: `signInWithPhone`, `verifyOTP`, `signInWithPassword`, `signInWithBiometric`, `registerBiometric`, `signOut`
- OTP methods: `signInWithPhone()` sends code, `verifyOTP()` returns `boolean` indicating if password setup needed

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

-- OTP codes (SMS verification)
phone_otp_codes (
  id UUID PRIMARY KEY,
  phone TEXT,
  code TEXT,
  expires_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
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
- Phone dial pad for 10-digit number entry with checkmark submit button ⭐ UPDATED
- **Two-step login flow** (phone verification first): ⭐ NEW 2026-03-06
  1. **Step 1**: Enter phone → verify phone exists via `/api/member/verify-phone`
  2. **Step 2**: Show personalized "Welcome back, [FirstName]" with login options
- **Login options** (shown after phone verification):
  1. **Password input** - Primary method for returning users (with show/hide toggle)
  2. **"One-Time Password" button** - Request SMS OTP (passwordless)
  3. **Biometric button** - Face ID/Touch ID (if available)
- **First-time user detection**: Green notice box prompts new users to request OTP ⭐ NEW
- **Unrecognized phone handling**: Red error box with support contact (913-777-4488) ⭐ NEW
- **OTP Input View**: 6-digit code entry with resend option
- **Password setup redirect**: First-time OTP users redirected to `/member/change-password` ⭐ NEW
- Redirects to password change if temporary password
- Links to forgot password flow
- Toast notifications for errors/success
- Mobile-first responsive design

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
- **Profile Photo**: Upload/crop with zoom functionality (`PhotoCropUpload` component)
- **Profile Information Card** (compact, small text):
  - View/edit mode toggle with save/cancel icons
  - Editable fields: first name, last name, email, phone
  - Birthday display (if set)
  - Small icons (User, Mail, Phone, Cake)
- **Membership Details Card** (compact):
  - Subscription plan name
  - Member since date
  - Active status
  - Next renewal date
  - Bold headers for fields
- **Other Account Members Card** (if multi-member account):
  - Lists all members on the same account
  - Shows profile photos, names, emails, phones
  - Compact display with small avatars
- **Security Section**:
  - Change Password button (expands to password form)
  - Sign Out button (red text)
  - Password form: current password, new password, confirm password
- **Scrollbar Hidden**: Clean appearance with `.scrollbar-hide` utility

**API**:
- `POST /api/member/verify-phone` - Verifies phone exists, returns member info ⭐ NEW 2026-03-06
- `POST /api/member/update-profile` - Updates member info
- `POST /api/member/set-photo` - Uploads profile photo
- `POST /api/member/change-password` - Changes password (currentPassword optional for first-time setup) ⭐ UPDATED
- `GET /api/member/check-password-status` - Returns `{ has_password: boolean }` ⭐ NEW 2026-03-06
- `GET /api/member/account-members` - Fetches all members on same account
- `GET /api/auth/check-session` - Returns member with `has_password` field ⭐ UPDATED 2026-03-06

**UI/UX Notes**:
- All cards use small font sizes (text-xs) for compact display
- Edit/save icons positioned outside card borders
- No Account Settings card on dashboard - all settings moved to Profile modal
- Password change and sign-out consolidated into Profile modal Security section

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
- **First-time setup mode**: Detects if member has no password via `member.has_password` ⭐ NEW 2026-03-06
  - Shows "Set Your Password" title (instead of "Change Your Password")
  - Blue welcome message: "Welcome! Please create a password..."
  - Hides "Current Password" field entirely
  - Only shows "New Password" and "Confirm Password"
- **Existing user mode**:
  - Shows all 3 fields: Current Password, New Password, Confirm Password
  - Current password verification required
  - Yellow warning alert if using temporary password
- New password requirements: min 8 characters
- Password confirmation validation
- Show/hide password toggles on all fields
- Cannot bypass if `password_is_temporary` is true
- Redirects to dashboard after successful password set

**API**: `POST /api/member/change-password` (currentPassword optional for first-time setup) ⭐ UPDATED

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

### 2026-03-10 - Annual Membership Billing & Display Fixes

**Commits**:
- `b68d1fc` - Fix annual membership billing to charge on anniversary date
- `b673944` - Fix member portal to display annual membership costs correctly

**Problem**: Annual members were incorrectly being charged monthly ($1225) instead of annually ($1500), and their renewal dates were set to next month instead of one year from signup.

**Changes**:

**1. Core Billing Logic**:
- Added `addYears()` helper function to `src/lib/billing.ts`
- Annual memberships now renew exactly 1 year from subscription start date
- Additional member fees for annual plans: $25/month × 12 = $300/year (not $25/month)
- Fixed calculation in `src/pages/api/subscriptions/create.ts` and `src/pages/api/payment/confirm.ts`

**2. Pro-Rating for Mid-Year Additions**:
- `src/pages/api/members/add-to-account.ts` now pro-rates additional member fees for annual plans
- Calculates months remaining until renewal
- Charges immediately: $25 × months remaining
- Updates `monthly_dues` to include full $300/year for next renewal
- Example: Add member 6 months before renewal → Immediate charge: $150, Next renewal increases by $300

**3. Automated Billing Crons**:
- `src/pages/api/cron/monthly-billing.ts` - Respects billing interval when setting next_billing_date
- `src/pages/api/cron/retry-failed-payments.ts` - Respects billing interval when recovering from failures

**4. Admin Dashboard Display** (`src/components/MemberSubscriptionCard.tsx`):
- Removed Stripe subscription logic (all subscriptions now app-managed)
- Shows "Total ARR" for annual plans (not "Total MRR")
- Displays `/yr` suffix for annual plans
- Fixed "PAUSED" status display for app-managed subscriptions
- Annual example: Base $1200/yr + Additional Members (1 × $300) = $1500/yr

**5. Member Portal Display**:
- `src/pages/api/member/account-subscription.ts` - Returns `billingInterval` in API response
- `src/app/member/dashboard/page.tsx` - Displays interval-aware labels (/yr or /mo)
- `src/components/member/SubscriptionModal.tsx` - Shows correct fees in popup modal
- Matches admin portal display exactly

**6. Data Migration**:
- Fixed 2 existing annual members with incorrect data:
  - Member b6a422e0: Assigned to Annual plan, $1500/yr, renewal 2026-05-31 (anniversary)
  - Member 75df2103: Fixed renewal date to 2027-03-10 (anniversary)

**Impact**:
- New annual subscriptions calculate correctly: $1200 base + ($300 × additional members)
- Existing annual members have correct renewal dates and pricing
- All displays (admin + member portal) show consistent annual pricing
- Pro-rating prevents mid-year additions from getting free months

**Testing Recommendations**:
1. Create new annual subscription with additional members → Verify $1500 charged, renewal in 1 year
2. Add member mid-year to annual account → Verify pro-rated charge + next renewal increase
3. Check member portal displays → Verify shows /yr labels and correct amounts
4. Let monthly billing cron run → Verify annual members don't get charged until anniversary

**Files Modified**:
- `src/lib/billing.ts`
- `src/pages/api/subscriptions/create.ts`
- `src/pages/api/payment/confirm.ts`
- `src/pages/api/cron/monthly-billing.ts`
- `src/pages/api/cron/retry-failed-payments.ts`
- `src/pages/api/members/add-to-account.ts`
- `src/components/MemberSubscriptionCard.tsx`
- `src/pages/api/member/account-subscription.ts`
- `src/app/member/dashboard/page.tsx`
- `src/components/member/SubscriptionModal.tsx`

**Files Created**:
- `scripts/fix-existing-annual-members.ts` (data migration script)

---

### 2026-03-09 - Member Account Management Improvements

**Changes**:
- **UI**: Added date input fields to all Quick Actions (Charge Card, Add Credit, Add Purchase)
- **UI**: Updated Quick Actions layout to single-line grid (amount, description, date, button)
- **UI**: Responsive grid columns - Desktop: 90px 2fr 130px auto, Mobile: 70px 1.5fr 110px auto
- **Ledger**: Fixed sorting issue - ledger now stays sorted newest-first after all transactions
- **Ledger**: Created `refreshLedger()` helper function for consistent sorting
- **Balance Display**: Primary member card now shows "Account Balance" (total for all members)
- **Balance Display**: Secondary member cards show "Member Spend" (individual purchases only)
- **Member Cards**: Simplified to show only Sign Up date and Member Spend
- **Member Cards**: Removed Renewal, LTV, and Account Balance from individual member cards
- **Metrics**: Member Spend now correctly calculates sum of purchases (not balance)
- **Metrics**: Created `calculateMemberSpend()` function to track individual member purchases
- **API**: Updated `/api/chargeBalance` to accept optional `custom_date` parameter for backdating transactions
- **Mobile**: Optimized bulk message modal checkbox sizing (18px) with 30px touch targets
- **Mobile**: Positioned bulk message modal below header (100px top padding on mobile)
- **Status**: Show "CANCELLED" badge on MemberSubscriptionCard when `subscription_cancel_at` is set
- **Status**: Show "Cancelled" badge on member detail page for cancelled subscriptions
- **Members Page**: Filter "Select All Active" to exclude cancelled members from bulk messages
- **Data Integrity**: Deactivated duplicate Eric Korth account (subscription already cancelled in Stripe)

**Key Behavioral Changes**:
- Transactions can now be backdated using the date picker in Quick Actions
- Ledger always displays newest-first regardless of how transactions are added
- Account balance is shown only on primary member (represents total account)
- Member Spend shows individual purchases per member for analytics
- Cancelled members (subscription_cancel_at set OR status='canceled') excluded from active member lists
- Member cards simplified to 2-column layout (Sign Up, Member Spend)

**Files Modified**:
- `src/pages/admin/members.tsx` - Added subscription status tracking, filtered cancelled members
- `src/pages/admin/members/[accountId].tsx` - Added date inputs, fixed sorting, updated balance display
- `src/pages/api/chargeBalance.js` - Added custom_date parameter support
- `src/components/MemberSubscriptionCard.tsx` - Show cancelled badge for pending cancellations
- `src/styles/Members.module.css` - Mobile optimizations for bulk message modal
- `src/styles/MemberDetail.module.css` - Quick Actions grid layout updates

**Documentation**: See [Ledger & Financial Management](#ledger--financial-management), [Member Management](#member-management)

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

---

## Utility Scripts

### Payment Method Sync Script

**Purpose**: Bulk sync payment method information from Stripe to database for accounts with active subscriptions

**Location**: `scripts/sync-payment-methods.js`

**Usage**:
```bash
# Dry run (preview changes without applying)
node scripts/sync-payment-methods.js --dry-run

# Execute sync
node scripts/sync-payment-methods.js
```

**What it does**:
1. Finds accounts with active subscriptions missing payment method info
2. Retrieves subscription from Stripe
3. Fetches payment method details (type, last4, brand)
4. Updates accounts table with payment info
5. Supports card and us_bank_account payment types
6. Rate limited (100ms delay between requests)

**Output**:
- ✅ Successfully synced accounts
- ⚠️ Accounts with no payment method attached
- ❌ Errors encountered

**When to use**:
- After webhook failures that didn't sync payment methods
- After bulk subscription imports
- When payment method data is missing for existing subscriptions

---

### 2026-03-06 - Business Dashboard Enhancements & Member Status Cleanup

**Summary**: Comprehensive updates to business dashboard with new revenue tracking metrics, member/account counting improvements, and standardization of member status field as the source of truth.

**New Features**:

1. **Business Dashboard Revenue Metrics**
   - Added "Current Month Total Revenue" card - Shows real-time revenue from all member payments (dues + purchases) for the current month with clickable chart
   - Added "Last Month Total Revenue" card - Displays total revenue from the previous complete month
   - Added "Active Members" card - Count of individual members with status='active'
   - Added "Active Accounts" card - Count of accounts with primary membership as Skyline, Solo, or Duo
   - Removed "Avg Monthly Total Revenue" card (calculation was inaccurate)
   - Interactive modal chart showing 12-month revenue trend with:
     - Y-axis in $3k increments
     - Horizontal gridlines
     - Proper scaling and labels
     - Chronological display (oldest to newest)

2. **Dashboard Data Accuracy Review**
   - Verified all existing dashboard cards pull correct data from database
   - Confirmed MRR, Outstanding Balances, and monthly revenue calculations are accurate
   - Updated business dashboard to use `status='active'` filter instead of `deactivated=false`

3. **Financial Metrics API Enhancements** (`/api/financial-metrics`)
   - Added `ytdRevenue` calculation - Year-to-date total revenue from all payments
   - Added `lastYearRevenue` calculation - Total revenue from previous year
   - Added `averageMonthlyRevenue` - Average of last 3 full months of total revenue
   - Added `monthlyBreakdown` - Last 12 months of revenue data for charting
   - Added `pastDueBalances` calculation - Outstanding balances where payment due date has passed
     - **Logic**: Filters accounts with negative balances (owed to us) where the member's due date (based on join_date) is in the past
     - **Calculation**: Compares current month's due date (day of month from join_date) with today's date
     - **Returns**: Total amount past due, breakdown with member names and amounts, sorted by balance (highest first)
   - All calculations based on ledger transactions with `type='payment'`

4. **Member Status Field Standardization**
   - **Breaking Change**: Standardized on `status` field as the single source of truth for member state
   - Updated `/api/members` to filter by `status='active'` instead of `deactivated=false`
   - Updated business dashboard queries to use `status` field
   - Data cleanup performed:
     - 8 members changed from `status='active', deactivated=true` to `status='deactivated'`
     - 1 duplicate entry changed from `status='pending'` to `status='payment_failed'`
     - 17 members changed from `status='pending'` to `status='active'`

5. **Member Status Values** (Standardized):
   - `active` - Currently paying member (120 members)
   - `pending` - Onboarding/awaiting approval (3 members remaining)
   - `inactive` - No longer active but not formally deactivated (3 members)
   - `deactivated` - Formally deactivated/cancelled (8 members)
   - `payment_failed` - Payment issues (1 member)

6. **Chart Improvements**
   - Enhanced BarChart component with y-axis labels and gridlines
   - Configurable tick increments ($3k for revenue charts)
   - Proper height scaling for modal display (320px)
   - Tooltip hover showing exact values

**Database Insights**:
- Total members in system: 153
- Active members (status='active'): 120
- Member counting now correctly excludes pending/inactive/deactivated members
- `deactivated` field remains as boolean but `status` is authoritative

**API Changes**:
- `GET /api/financial-metrics` - Added new fields: `ytdRevenue`, `lastYearRevenue`, `averageMonthlyRevenue` (with `monthlyBreakdown`), `pastDueBalances` (with breakdown showing member names and amounts past due)
- `GET /api/members` - Changed filter from `deactivated=false` to `status='active'`

**Components Modified**:
- `/admin/business.tsx` - Business dashboard with new revenue cards and modal chart
- `/admin/dashboard.tsx` - Dashboard v1 with YTD/Last Year revenue cards
- `/admin/dashboard-v2.tsx` - Dashboard v2 with revenue tracking and Past Due Balances card (removed Monthly Revenue by Stream and Revenue Progress charts)
- `BarChart` component - Enhanced with y-axis, gridlines, and configurable scaling

**Business Dashboard Updates**:
- Revenue Health section now includes 6 key metrics: MRR, ARR, Current Month, Last Month, Active Members, Active Accounts
- Member Health section displays metrics from business snapshot data
- All revenue metrics include complete transaction data (dues + purchases)
- Clickable revenue cards open modal with 12-month trend visualization

**Future Considerations**:
- Consider migrating `deactivated` field from boolean to timestamp (deactivation date)
- Potential to add `status` enum constraint in database for data integrity
- May want to add status transition history/audit log

**Files Modified**:
- `src/pages/admin/business.tsx`
- `src/pages/admin/dashboard.tsx`
- `src/pages/admin/dashboard-v2.tsx`
- `src/pages/api/financial-metrics.js`
- `src/pages/api/members.js`
- `src/styles/BusinessDashboard.module.css`

**Data Changes** (Direct database updates):
- 8 members updated to `status='deactivated'`
- 1 member updated to `status='payment_failed'`
- 17 members updated to `status='active'`
- 1 member (Maria Rodriguez) updated to `status='active'`

**Testing Recommendations**:
1. Verify business dashboard displays correct member counts
2. Confirm revenue metrics match ledger transactions
3. Test clickable revenue cards and modal chart display
4. Verify members page shows 120 active members (matching business dashboard)
5. Check that pending members (Tessa, Kent, Ka'Von) are correctly excluded from active count

**Status**: Complete and tested
**Git Commits**: Ready for approval

**Git Commits**:
- `fa6fd03` - Enhance inventory system with improved UX and customizable settings

---

### 2026-03-06 - Secure OTP Login with Enterprise-Grade Security

**Summary**: Implemented passwordless SMS OTP login for member portal, enabling self-service account activation and eliminating admin overhead for sending credentials. Includes comprehensive security measures: rate limiting, account lockout, and audit logging.

**New Features**:

1. **SMS OTP Login System**
   - **Self-Service Activation**: Members can activate portal without admin sending passwords
   - **6-digit SMS codes**: Sent via OpenPhone, expire in 10 minutes, single-use
   - **Login Page UI**: Added "Sign in with Code" button and OTP input view
   - **Automatic Password Setup**: First-time OTP users redirected to set permanent password
   - **Multiple Login Options**: Members choose OTP, password, or biometric (Face ID/Touch ID)
   - **Files**: `src/app/member/login/page.tsx`, `src/context/MemberAuthContext.tsx`

2. **Enterprise-Grade Security Measures**

   **Rate Limiting**:
   - 3 OTP requests per phone number per 15 minutes
   - 10 OTP requests per IP address per hour
   - Returns 429 status with retry-after time when exceeded

   **Account Lockout**:
   - 5 failed verification attempts in 15 minutes = account locked
   - Automatic unlock after 15 minutes
   - Lockout applies per phone number (not per individual code)

   **Audit Logging**:
   - OTP requested: logs phone, IP, user agent, timestamp
   - OTP verification success: logs member ID, IP, needs_password flag
   - OTP verification failed: logs phone, IP, attempt count
   - Account locked: logs phone, IP, total failed attempts
   - All logs tagged with `[AUTH-AUDIT]` for easy filtering

   **IP & Device Tracking**:
   - IP address stored with every OTP request
   - User agent stored for forensic analysis
   - Enables detection of suspicious activity patterns

3. **API Enhancements**
   - **`POST /api/auth/send-phone-otp`**: Send 6-digit OTP with rate limiting and tracking
   - **`POST /api/auth/verify-phone-otp`**: Verify OTP with lockout protection, returns `needsPasswordSetup` flag
   - **MemberAuthContext**: Updated `verifyOTP()` to return boolean indicating password setup needed

4. **Database Schema**
   - **`phone_otp_codes` table**: Existing table now stores `ip_address` and `user_agent` for tracking
   - Uses existing rate limiting queries for phone and IP-based limits

**Security Benefits**:
- ✅ Eliminates admin overhead for sending temporary passwords
- ✅ Members can activate accounts instantly via SMS
- ✅ Protected against brute force attacks (rate limiting + lockout)
- ✅ Protected against DoS attacks (IP-based rate limiting)
- ✅ Comprehensive audit trail for security investigations
- ✅ Backup authentication methods (password + biometric)

**User Experience**:
- **First-Time**: OTP → verify → set password → dashboard (no admin action needed)
- **Returning**: Choose OTP (quick) or password (familiar) or biometric (convenient)

**Technical Details**:
- OTP codes: 6 digits, 100,000-999,999 range
- Expiration: 10 minutes from generation
- Max attempts per code: 5 (then require new code)
- Session duration: 7 days (httpOnly cookie)
- Password requirement: Min 8 characters

**Files Modified**:
- `src/app/member/login/page.tsx` - Added OTP input view and handlers
- `src/context/MemberAuthContext.tsx` - Updated verifyOTP return type
- `src/pages/api/auth/send-phone-otp.ts` - Added rate limiting and audit logging
- `src/pages/api/auth/verify-phone-otp.ts` - Added lockout protection and password check

**Testing Notes**:
- Test rate limiting: Request 4 codes quickly (4th should fail)
- Test lockout: Enter wrong code 5 times (should lock account)
- Test first-time flow: OTP login → verify password setup redirect
- Test returning user: OTP login → verify direct to dashboard
- Check logs for `[AUTH-AUDIT]` entries

---

### 2026-03-06 - Webhook Error Handling, Pending Members Management & Payment Method Sync

**Summary**: Fixed critical webhook error handling issues, implemented pending member management system, resolved ledger balance calculation bug, and synced payment method data for 71 accounts.

**Bug Fixes**:

1. **Stripe Webhook Error Handling** (`stripe-webhook-subscriptions.ts`)
   - **Critical Fix**: Changed 9 instances of silent `return;` statements to `throw new Error()`
   - Previously: Webhooks failed silently when account/member not found, marked as processed but didn't update database
   - Now: Properly throws errors, marks webhook as failed, allows retry and debugging
   - Affected scenarios: subscription created, updated, deleted, invoice paid, payment failed
   - **Impact**: Prevents subscription data loss from silent webhook failures

2. **Ledger Balance Calculation** (`admin/members/[accountId].tsx`)
   - Fixed incorrect balance display using `ledger.length - 1` (oldest transaction only)
   - Changed to `calculateRunningBalance(ledger, 0)` (all transactions)
   - Now correctly shows running balance/credit on member detail page

3. **TypeScript Build Error** (`api/member/reservations.ts`)
   - Fixed "Argument of type 'string' is not assignable to parameter of type 'never'" error
   - Added explicit type annotation: `const conditions: string[] = [];`

4. **Multiple Rows API Error** (`api/accounts/[accountId].ts`)
   - Removed `.single()` call causing "JSON object requested, multiple (or no) rows returned" error
   - Added proper handling for 0, 1, or multiple account results

**New Features**:

1. **Pending Members Management System**
   - **New Modal**: `PendingMembersModal.tsx` - View and manage members with status='pending'
   - **New API**: `POST /api/members/[memberId]/mark-incomplete` - Change pending → incomplete
   - **Updated Members Page**:
     - Added "Pending Members" button (clock icon) in header
     - Excluded pending members from main member list
     - Updated active member count to exclude pending status
   - **Updated Business Dashboard**: Active member count now filters by `status='active'`
   - **Workflow**: Admin can review pending signups, mark incomplete if they don't complete onboarding

2. **Payment Method Sync Script** (`scripts/sync-payment-methods.js`)
   - **Purpose**: Bulk sync payment method details from Stripe to database
   - **Features**:
     - Dry-run mode for previewing changes
     - Fetches subscription → payment method → updates account
     - Supports card and us_bank_account payment types
     - Rate limiting (100ms between requests)
     - Progress tracking with success/warning/error counts
   - **Usage**: `node scripts/sync-payment-methods.js [--dry-run]`
   - **Results**: Successfully synced 71 accounts with missing payment method data

3. **Homepage Footer Update** (`src/app/page.js`)
   - Added member login link next to admin link
   - Styled with brand colors (cork accent, hover states)
   - Minimal, elegant design matching landing page aesthetic

**Database Changes** (Not in git):
- Created 2 missing account records for orphaned members (Keaira Emery, Michael Nguyen)
- Marked 3 duplicate/incomplete members as status='incomplete' (Eric Korth, Keaira Emery, Michael Nguyen)
- Synced payment method info for 71 accounts (65 via script, 6 manual verification)

**Components Created**:
- `src/components/PendingMembersModal.tsx` - Pending member management UI
- Uses existing `ArchivedMembersModal.module.css` for consistent styling

**APIs Created**:
- `POST /api/members/[memberId]/mark-incomplete` - Update member status from pending to incomplete
  - Requires member_id in URL
  - Only updates members with status='pending'
  - Returns updated member record

**Files Modified**:
- `src/pages/api/stripe-webhook-subscriptions.ts` - Error handling improvements
- `src/pages/admin/members/[accountId].tsx` - Ledger balance fix
- `src/pages/api/member/reservations.ts` - TypeScript type fix
- `src/pages/api/accounts/[accountId].ts` - Multiple rows error fix
- `src/pages/admin/members.tsx` - Pending members button, filter updates
- `src/pages/admin/business.tsx` - Active member count filter
- `src/app/page.js` - Member login link

**Scripts Created**:
- `scripts/sync-payment-methods.js` - Payment method bulk sync utility

**Troubleshooting Added**:

**Problem**: Subscription exists in Stripe but not showing in database
**Solution**:
1. Check webhook events table for processed events
2. Check if webhook failed silently (processed=true but no account update)
3. Run sync script or manually trigger webhook replay from Stripe dashboard
4. After webhook fix, future events will properly error instead of silently failing

**Problem**: Payment method info missing for accounts
**Solution**: Run `node scripts/sync-payment-methods.js` to bulk sync from Stripe

**Testing Recommendations**:
1. Create new subscription → verify webhook properly syncs payment method
2. Test webhook failure scenarios → verify errors are thrown and logged
3. Test pending member workflow → mark as incomplete → verify exclusion from main list
4. Verify ledger balance displays correctly on member detail pages
5. Test member login link on homepage footer

**Status**: Complete and committed

---

### 2026-03-06 - ACH Payment Method Improvements & Bug Fixes

**Summary**: Enhanced ACH bank account setup flow with fallback PaymentMethod creation, fixed payment method listing to include us_bank_account types, and resolved various API and mobile UX bugs.

**Key Improvements**:

1. **ACH Setup Flow Enhancement** (`UpdatePaymentModal.tsx`)
   - Fixed issue where Financial Connections account wasn't creating PaymentMethod automatically
   - **New Flow**:
     - After `collectBankAccountForSetup()`, check if `setupIntent.payment_method` exists
     - If not, retrieve full SetupIntent to get `financial_connections_account` ID
     - Create PaymentMethod from FC account via new API endpoint
     - Set as default payment method
   - **Impact**: ACH setup now works reliably even when Stripe doesn't auto-create PaymentMethod

2. **Payment Method Listing Fix** (`/api/stripe/payment-methods/list.ts`)
   - **Issue**: API only returned card payment methods, ACH bank accounts weren't visible
   - **Root Cause**: Stripe requires separate API calls for different payment method types
   - **Fix**: Added parallel calls for both `card` and `us_bank_account` types
   - **Added**: Debug logging to troubleshoot missing payment methods
   - **Impact**: Both card and bank account payment methods now visible in admin and member portals

3. **New API Endpoints**:
   - `POST /api/stripe/payment-methods/create-from-fc` - Creates PaymentMethod from Financial Connections account
     - Body: `{ account_id, financial_connections_account_id }`
     - Returns: `{ payment_method_id }`
   - `GET /api/stripe/setup-intents/[id]` - Retrieves SetupIntent with latest_attempt details
     - Used to get Financial Connections account ID when PaymentMethod wasn't auto-created

4. **Payment Method API Fix** (`set-default.ts`)
   - Fixed 405 Method Not Allowed error
   - Changed from POST to PUT (or supports both)
   - Updated frontend to use PUT consistently

**Bug Fixes**:

1. **Mobile Keyboard Issues** (`SimpleReservationRequestModal.tsx`)
   - Added `inputMode="none"` to date picker and time select
   - Prevents keyboard popup on touch devices
   - Improves UX for date/time selection

2. **Mobile Horizontal Scrolling** (`member/profile/page.tsx`)
   - Fixed ability to swipe left/right on profile modal
   - Added `touch-action: none` CSS constraints
   - Width constraints to prevent content overflow

3. **Private Event Blocking Timezone Fix** (`/api/check-date-availability.ts`)
   - **Issue**: Times showed as available during private events in production
   - **Root Cause**: UTC hours returned instead of local timezone hours
   - **Fix**: Added `.setZone('America/Chicago')` to convert event times to local timezone
   - **Example**: 6pm event (stored as 23:00 UTC) now correctly blocks 6pm time slot (18:00 local)

4. **Subscription Pricing Fixes** (`/api/member/account-subscription.ts`)
   - Fixed $0 subscription display in production
   - **Root Cause**: API calling localhost:3000 in serverless environment (ECONNREFUSED)
   - **Fix**: Changed to call Stripe SDK directly instead of internal fetch
   - Removed fallback logic per user preference (returns 500 if Stripe fails)

5. **Backwards Calculation Logic** (`MemberSubscriptionCard.tsx`)
   - **Issue**: Negative base prices displayed
   - **Root Cause**: `baseMRR = monthly_dues - secondaryFees` (backwards!)
   - **Fix**: Use `monthly_dues` directly as base (it's already the base price from Stripe)

6. **Reservation Cancellation 500 Error** (`/api/member/reservations/cancel.ts`)
   - **Issue**: Database error on cancellation
   - **Root Cause**: `status` column didn't exist on reservations table
   - **Fix**: Created migration to add `status` column with default 'confirmed'
   - Created runner script: `run-add-status-column.js`

**Files Created**:
- `src/pages/api/stripe/payment-methods/create-from-fc.ts` - Create PM from FC account
- `src/pages/api/stripe/setup-intents/[id].ts` - Retrieve SetupIntent details
- `migrations/add_reservations_status_column.sql` - Add status column to reservations
- `run-add-status-column.js` - Migration runner script

**Files Modified**:
- `src/components/UpdatePaymentModal.tsx` - ACH setup flow with FC fallback
- `src/pages/api/stripe/payment-methods/list.ts` - Fetch both card and bank account types
- `src/pages/api/stripe/payment-methods/set-default.ts` - Support PUT method
- `src/pages/api/check-date-availability.ts` - Timezone conversion for event blocking
- `src/pages/api/member/account-subscription.ts` - Direct Stripe SDK calls
- `src/components/MemberSubscriptionCard.tsx` - Fix pricing calculation
- `src/components/member/SimpleReservationRequestModal.tsx` - Mobile keyboard fix
- `src/app/member/profile/page.tsx` - Mobile scrolling fix
- `src/pages/api/member/reservations/cancel.ts` - Remove updated_at field
- `src/pages/api/reservations/index.ts` - Remove non-existent status filter

**Known Issues**:
- Some ACH bank accounts may not appear in payment methods list despite being attached to customer in Stripe
- Currently investigating via debug logging to determine if accounts have specific status or are attached differently

**Testing Recommendations**:
1. Test ACH setup flow end-to-end (Financial Connections → PaymentMethod creation → Set as default)
2. Verify both card and bank account payment methods appear in payment methods list
3. Test reservation cancellation with new status column
4. Verify private events block time slots correctly in America/Chicago timezone
5. Test mobile reservation flow (no keyboard popup, no horizontal scrolling)

**Status**: Partially complete - ACH visibility issue still under investigation

---

**Last Updated**: March 6, 2026
**Version**: Webhook Error Handling v2.0 + Pending Members Management + ACH Payment Fixes

---

*This document is maintained as the single source of truth for understanding the Noir CRM Dashboard. Update it when making significant changes to the system.*


---

### 2026-03-06 (PM) - ACH Financial Connections PaymentMethod Creation Fix

**Session Summary**: Fixed critical bug where ACH bank accounts linked via Stripe Financial Connections weren't creating usable PaymentMethods, preventing customers from being charged via ACH.

**Problem**: When users completed ACH setup via `collectBankAccountForSetup`, Stripe created a Financial Connections account but didn't always automatically create a corresponding PaymentMethod. This left ACH accounts visible in Financial Connections dashboard but unusable for charging customers.

**Root Cause**: Stripe's `collectBankAccountForSetup` API doesn't guarantee PaymentMethod creation when using Financial Connections for instant bank verification. The SetupIntent can complete successfully with only a Financial Connections account reference, leaving no attached payment method.

**Solution**: Added automatic fallback logic to detect and handle missing PaymentMethods:
1. After `collectBankAccountForSetup` completes, check if SetupIntent has `payment_method`
2. If missing, retrieve SetupIntent's `latest_attempt.payment_method_details.us_bank_account.financial_connections_account`
3. Create PaymentMethod from Financial Connections account via new API endpoint
4. Attach PaymentMethod to customer and set as default

**Changes**:

1. **UpdatePaymentModal.tsx** (`src/components/UpdatePaymentModal.tsx`)
   - Added fallback logic in `handleAchSubmit()` to detect missing PaymentMethod
   - Calls new API endpoints to retrieve SetupIntent details and create PaymentMethod from Financial Connections
   - Maintains backward compatibility - if PaymentMethod exists, uses it directly

2. **New API: Get SetupIntent Details** (`src/pages/api/stripe/setup-intents/[id].ts`)
   - Retrieves SetupIntent with expanded `latest_attempt` details
   - Extracts Financial Connections account ID from payment method details
   - Returns: `{ id, status, payment_method, financial_connections_account, customer }`

3. **New API: Create PaymentMethod from Financial Connections** (`src/pages/api/stripe/payment-methods/create-from-fc.ts`)
   - Creates `us_bank_account` PaymentMethod from Financial Connections account
   - Automatically attaches to customer
   - Returns: `{ payment_method_id, bank_name, last4 }`

4. **Cleanup** (`src/pages/api/stripe/payment-methods/list.ts`)
   - Removed debug logging added during troubleshooting

**API Endpoints Added**:
- `GET /api/stripe/setup-intents/[id]` - Retrieve SetupIntent with Financial Connections details
- `POST /api/stripe/payment-methods/create-from-fc` - Create PaymentMethod from Financial Connections account
  - Body: `{ account_id, financial_connections_account_id }`
  - Returns: `{ payment_method_id, bank_name, last4 }`

**Files Created**:
- `src/pages/api/stripe/setup-intents/[id].ts` - SetupIntent retrieval endpoint
- `src/pages/api/stripe/payment-methods/create-from-fc.ts` - PaymentMethod creation endpoint

**Files Modified**:
- `src/components/UpdatePaymentModal.tsx` - ACH setup fallback logic
- `src/pages/api/stripe/payment-methods/list.ts` - Debug logging cleanup

**Manual Fix Applied**: Manually created PaymentMethod `pm_1T7trqFdjSPifIH51Kkep2FP` from existing Financial Connections account `fca_1T7tXnFdjSPifIH5rKntHLJk` for customer `cus_SH6Kr9Xkf5cRTj` to resolve immediate issue.

**Testing Recommendations**:
1. Complete ACH setup flow in admin panel → Verify PaymentMethod appears in payment methods list
2. Test with both scenarios:
   - Stripe automatically creates PaymentMethod (normal path)
   - Stripe doesn't create PaymentMethod (fallback path with console logs)
3. Verify ACH shows in subscription card payment method display
4. Test charging ACH payment method via chargeBalance API
5. Verify member portal ACH setup still works (uses different Checkout flow, unaffected by this bug)

**Impact**:
- **Before**: ACH setup completed but customers couldn't be charged (PaymentMethod didn't exist)
- **After**: ACH setup automatically creates usable PaymentMethod, enabling immediate charging
- **Scope**: Affects admin panel ACH setup only (member portal uses Stripe Checkout, which handles this correctly)

**Status**: Complete and committed (commit 11ad328)

---

### 2026-03-06 (PM) - Member Login UX Improvements & First-Time Login Auto-Provisioning

**Session Summary**: Enhanced member login experience with phone verification, personalized messaging, and automatic Supabase Auth user creation on first login.

**Problem**: Members logging in for the first time encountered multiple friction points:
1. No phone verification before showing password screen
2. Generic, impersonal login messages
3. No guidance for first-time users without passwords
4. Members without `auth_user_id` couldn't log in (500 error)
5. Phone dial pad used confusing "phone call" icon instead of submit icon

**Solution**: Implemented comprehensive login flow improvements and automatic user provisioning.

---

#### Login Flow Improvements

**1. Phone Verification Step**
- Added `/api/member/verify-phone` endpoint to validate phone number before showing login options
- Checks if phone exists in members table
- Returns member info (first_name, has_password status) if found
- Shows friendly error if phone not recognized

**2. Personalized Welcome Messages**
- After phone verification, displays: **"Welcome back, [FirstName]"**
- Subtitle: "Please enter your password to access your member portal"
- Creates warm, personalized experience vs generic login screen

**3. First-Time Login Detection**
- System detects if member has never set a password (`password_hash` is null)
- Shows green notice box: "First time logging in?"
- Prompts: "It looks like you haven't logged in yet. Please request a one-time password to get started."
- Provides **"Request One-Time Password"** button for easy activation

**4. Unrecognized Phone Handling**
- Red error box appears if phone number not found
- Message: "Our apologies, but we do not recognize this phone number. Please text us at 913-777-4488 so we can remedy this issue immediately."
- Includes clickable SMS link (`sms:913-777-4488`)

**5. Alternative Login Options**
- After phone verification, show:
  - "Or sign in with" divider
  - **"One-Time Password"** button
  - **"Face ID / Touch ID"** button (if biometric available)
- Previously showed these options immediately after entering 10th digit (confusing UX)

**6. Dial Pad Icon Update**
- Changed submit button from phone icon (🤙) to checkmark icon (✓)
- More intuitive - indicates "confirm/submit" rather than "call"

---

#### Auto-Provisioning: Supabase Auth User Creation

**Critical Fix**: Members without `auth_user_id` could not log in, causing 400/500 errors.

**Root Cause**: The system required members to have a Supabase Auth user linked (`auth_user_id` column), but new members didn't have this set up automatically.

**Solution**: Automatic Auth User Creation on First Login

When a member verifies their OTP for the first time and `auth_user_id` is null:

1. **Create Supabase Auth User**:
   ```javascript
   await supabaseAdmin.auth.admin.createUser({
     email: member.email || `${phone}@noirkc.com`,
     phone: `+1${normalizedPhone}`,
     email_confirm: true,
     phone_confirm: true,
     user_metadata: {
       first_name, last_name, member_id
     }
   });
   ```

2. **Handle Existing Auth Users**:
   - If email already has an auth user registered → Search for existing user by email
   - Link existing auth user to member (prevents duplicate auth accounts)
   - Uses paginated `listUsers()` (100 users at a time, max 10 pages/1000 users)
   - Avoids timeout issues with large user bases

3. **Link Auth User to Member**:
   ```sql
   UPDATE members 
   SET auth_user_id = [new_auth_user_id]
   WHERE member_id = [member_id];
   ```

4. **Create Session & Log In**:
   - Generate session token
   - Set httpOnly cookie with correct domain (`.noirkc.com`)
   - Redirect to member portal

**Impact**:
- **Before**: First-time login failed with "Account not set up for portal access" error
- **After**: Seamless first-time login - auth user created automatically, member logged in immediately
- **Benefits**: Zero manual setup required, members can self-activate portal access

---

#### Cookie Configuration Fixes

**Issue**: Session cookies weren't being set/read properly after successful authentication.

**Cookie Settings** (Production):
```javascript
{
  httpOnly: true,           // Prevent XSS attacks
  secure: true,             // HTTPS only
  sameSite: 'lax',          // CSRF protection
  domain: '.noirkc.com',    // Works on all subdomains (CRITICAL FIX)
  path: '/',                // Available everywhere
  maxAge: 7 * 24 * 60 * 60  // 7 days
}
```

**Key Fix**: Added explicit `domain: '.noirkc.com'` in production to ensure cookie works across:
- `noirkc.com`
- `www.noirkc.com`
- Any subdomain

**Logging**: Added detailed cookie setting logs to troubleshoot issues:
```javascript
console.log('[VERIFY-OTP] Setting cookie:', {
  name: 'member_session',
  options: cookieOptions,
  cookieString: cookie.split(';').slice(0, 2).join(';')
});
```

---

#### SMS Message Update

**OTP SMS Message**:
```
Your One Time Password to access your member portal for Noir is: [code]

This code expires in 10 minutes.
```

More descriptive than previous "Your Noir verification code is: [code]"

---

#### Database Schema Update

**Added Columns to `phone_otp_codes` Table**:
```sql
ALTER TABLE phone_otp_codes 
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX idx_phone_otp_codes_ip_address 
ON phone_otp_codes(ip_address, created_at);
```

**Purpose**: Enables IP-based rate limiting for OTP requests (10 per IP per hour).

---

#### API Endpoints

**Multi-Location Endpoints**:

`GET /api/tables?location=<slug>`
- **Purpose**: Fetch tables filtered by location
- **Query Params**: `location` (optional) - Location slug (e.g., "noirkc", "rooftopkc")
- **Returns**:
  ```javascript
  {
    data: [
      {
        id: string,
        table_number: string,  // Zero-padded (e.g., "01", "15")
        seats: number,
        location_id: string,
        location_slug: string
      }
    ]
  }
  ```
- **Filtering**: Fetches location ID from `locations` table by slug, then filters tables by `location_id`

`GET /api/private-events?location=<slug>&startDate=<iso>&endDate=<iso>`
- **Purpose**: Fetch private events filtered by location and date range
- **Query Params**:
  - `location` (optional) - Location slug
  - `startDate`, `endDate` (optional) - ISO date strings
- **Returns**: Array of private events for the specified location
- **Filtering**: Uses location ID lookup, then filters by `location_id` and date range

`GET /api/minaka-events?location=<slug>`
- **Purpose**: Fetch Minaka calendar events for a specific location
- **Query Params**: `location` (required) - Location slug
- **Returns**:
  ```javascript
  {
    data: [
      {
        id: string,
        title: string,
        start_time: string,  // ISO UTC
        end_time: string,    // ISO UTC
        description?: string,
        guest_count?: number,
        client_name?: string,
        client_email?: string,
        location?: string,
        minaka_url?: string,
        source: 'minaka'
      }
    ]
  }
  ```
- **How it works**: Fetches `minaka_ical_url` from `locations` table, parses iCal feed, returns events
- **Scalability**: Each location has its own Minaka iCal feed URL stored in database

`POST /api/reservations` (Updated)
- **New Fields**:
  - `location_slug` (string) - Location identifier for availability check
  - `cover_charge_applied` (boolean) - Whether cover charge applies to this reservation
  - `cover_price` (number) - Cover charge amount (only if non-member at location with cover enabled)
- **Availability Check**: Now location-aware
  - Fetches location ID from `location_slug`
  - Only checks tables belonging to that location
  - Prevents cross-location booking conflicts
- **Cover Charge Logic**:
  - Applied only if `cover_enabled=true` for location AND no `memberId`
  - Members ALWAYS bypass cover charges regardless of location

---

**New Endpoint**: `POST /api/member/verify-phone`
- **Purpose**: Verify phone number exists and return member info
- **Body**: `{ phone: string }`
- **Returns**:
  ```javascript
  {
    exists: boolean,
    member?: {
      first_name: string,
      member_id: string,
      has_password: boolean  // For first-time login detection
    },
    message: string
  }
  ```

**Updated Endpoints**:
- `POST /api/auth/verify-phone-otp` - Now auto-creates Supabase Auth users on first login
- `POST /api/auth/login-phone-password` - Updated cookie settings with explicit domain
- `POST /api/auth/send-phone-otp` - Updated SMS message text

---

#### UI Components Updated

**`src/app/member/login/page.tsx`**:
- Added phone verification step before showing password/OTP options
- Personalized welcome message with member's first name
- First-time login detection with OTP prompt
- Unrecognized phone error with support contact
- Alternative login options moved to password screen
- State management for `memberInfo`, `phoneNotRecognized`

**`src/components/member/PhoneDialPad.tsx`**:
- Changed submit button icon from `Phone` to `Check`
- Updated button label comment from "Call Button" to "Submit Button"
- Larger, bolder checkmark (w-7 h-7 stroke-[3])

---

#### Files Created

- `src/pages/api/member/verify-phone.ts` - Phone verification endpoint (76 lines)

#### Files Modified

- `src/app/member/login/page.tsx` - Login flow improvements (256 insertions, 80 deletions)
- `src/components/member/PhoneDialPad.tsx` - Icon change (6 changes)
- `src/pages/api/auth/verify-phone-otp.ts` - Auto-provisioning + error handling (94 insertions, 14 deletions)
- `src/pages/api/auth/login-phone-password.ts` - Cookie domain fix (19 insertions, 7 deletions)
- `src/pages/api/auth/send-phone-otp.ts` - SMS message update (2 changes)

---

#### Testing Recommendations

1. **First-Time Login Flow**:
   - Enter phone number of member without `auth_user_id` → Should see "First time logging in?" prompt
   - Request OTP → Enter code → Should auto-create auth user and log in successfully
   - Check database: `auth_user_id` should now be populated

2. **Returning Member Flow**:
   - Enter phone number → Should see "Welcome back, [FirstName]"
   - Enter password → Should log in successfully
   - Try "One-Time Password" option → Should work as alternative

3. **Error Cases**:
   - Enter unrecognized phone → Should see error with support contact
   - Enter wrong password → Should show "Invalid phone number or password"
   - Try OTP with used code → Should prompt for new code

4. **Cookie Persistence**:
   - Log in successfully → Close browser → Reopen → Should still be logged in
   - Check browser DevTools → Cookie should have `domain=.noirkc.com`

5. **Existing Auth User Handling**:
   - Member with email already in auth.users → Should link to existing auth user, not error
   - Check logs for "[VERIFY-OTP] Found existing auth user by email"

---

#### Commits (9 total)

1. `25d787e` - Improve member login experience with phone verification and personalized flow
2. `e5ba6f3` - Add debug logging to OTP verification endpoint
3. `486d652` - Fix cookie settings for member authentication
4. `4301fb6` - Auto-create Supabase Auth user on first OTP login
5. `1e2d60b` - Handle existing auth users when linking members on first login
6. `7b0a611` - Replace listUsers with efficient getUserByEmail/getUserByPhone lookups
7. `51a138c` - Fix: Use correct Supabase Admin API with pagination for user lookup
8. `5764604` - Fix TypeScript error in user lookup
9. `fe47aba` - Fix TypeScript destructuring and type inference issues

---

#### Impact

**User Experience**:
- ✅ Personalized, welcoming login experience
- ✅ Clear guidance for first-time users
- ✅ Helpful error messages with support contact
- ✅ Intuitive dial pad icon (checkmark vs phone)
- ✅ Alternative login methods shown at appropriate time

**Technical**:
- ✅ Zero-touch member activation (auto-provisioning)
- ✅ Proper cookie domain handling for multi-subdomain setup
- ✅ Efficient user lookup (pagination prevents timeouts)
- ✅ Handles edge cases (existing auth users, null emails, duplicate prevention)

**Before vs After**:
| Aspect | Before | After |
|--------|--------|-------|
| Phone verification | None - directly show password | Verify phone first, personalized welcome |
| First-time login | 500 error: "Account not set up" | Auto-create auth user, seamless login |
| Error messaging | Generic errors | Helpful, actionable error messages |
| UX flow | Confusing - all options shown at once | Clear 2-step flow with guidance |
| Cookie domain | Implicit (may not work on subdomains) | Explicit `.noirkc.com` (works everywhere) |
| Dial pad icon | Phone icon (confusing) | Checkmark (intuitive) |

**Status**: Complete and deployed (commit fe47aba)


---

## Session: March 13, 2026 - Beverage Credit & Admin Fee Tracking

### Overview

Implemented subscription plan fee breakdown to track beverage credits separately from administrative fees. When members pay $150/month, the system now properly tracks that $100 goes toward beverage credit and $50 is an administration fee.

---

### Feature: Subscription Plan Beverage Credit Tracking

**Problem**: All membership fees were treated as 100% beverage credit. No way to track administrative fees or non-beverage portions of membership dues.

**Solution**: Added `beverage_credit` field to subscription plans with automatic ledger entry creation for admin fees.

**How It Works**:
1. Admin sets subscription plan price (e.g., $150/month)
2. Admin sets beverage credit amount (e.g., $100/month)
3. System calculates admin fee automatically ($150 - $100 = $50)
4. When payment is processed:
   - **Credit entry**: +$150 (full payment)
   - **Admin fee charge**: +$50 (non-beverage portion)
   - **CC fee charge**: +$6 (if 4% processing fee enabled)
   - **Net beverage credit**: $100 available for purchases

**Database Changes**:
```sql
-- Added to subscription_plans table
ALTER TABLE subscription_plans
ADD COLUMN beverage_credit DECIMAL(10, 2) DEFAULT 0;

-- All existing plans backfilled with beverage_credit = monthly_price
-- (assuming 100% went to beverage credit previously)
```

**Files Created**:
- `migrations/add_beverage_credit_to_subscription_plans.sql` - Database migration
- `scripts/add-beverage-credit.ts` - Migration script with verification

**Files Modified**:
- `src/types/index.ts` - Added `beverage_credit?: number` to SubscriptionPlan interface
- `src/pages/api/admin/subscription-plans.ts` - POST/PUT endpoints handle beverage_credit field
- `src/components/admin/SubscriptionPlansManager.tsx` - Admin UI for setting beverage credit
- `src/lib/billing.ts` - Updated `logPaymentToLedger()` to create admin fee charge entries
- `src/pages/api/cron/monthly-billing.ts` - Fetches beverage_credit from plan during billing
- `src/pages/api/payment/confirm.ts` - Onboarding payments create admin fee ledger entries

**Admin UI Features**:
- Input field for beverage credit amount (adapts to Monthly/Yearly based on interval)
- Real-time admin fee calculation display: "Admin fee: $50.00"
- Plan cards show breakdown:
  - 💳 Beverage Credit: $100.00
  - ⚙️ Admin Fee: $50.00

**Ledger Entry Logic** (applies to all payment flows):

Before (old behavior):
```
Payment: +$150 (credit)
CC Fee: +$6 (charge)
Net: $144 beverage credit ❌ INCORRECT
```

After (new behavior):
```
Payment: +$150 (credit)
Admin Fee: +$50 (charge)
CC Fee: +$6 (charge)
Net: $100 beverage credit ✅ CORRECT
```

**Applies To**:
- Monthly billing cron (`/api/cron/monthly-billing`)
- Subscription creation (`/api/subscriptions/create`)
- Payment retries (`/api/subscriptions/retry-payment`)
- Failed payment retry cron (`/api/cron/retry-failed-payments`)
- Onboarding payments (`/api/payment/confirm`)

**Impact**:
- Accurate beverage credit tracking for all membership plans
- Proper accounting separation of admin fees vs beverage credits
- Financial reporting can distinguish revenue sources
- Supports flexible pricing models (e.g., $150 fee with $100 credit)

**Example Use Cases**:
1. **Price increase with partial credit**: Raise dues from $100 to $150, but only increase beverage credit to $125 (add $25 admin fee)
2. **Premium tiers**: Skyline at $200/month with $150 beverage credit ($50 admin fee for premium perks)
3. **Break-even pricing**: Annual plan $1200/year with $1000 beverage credit ($200/year admin fee)

---

## Session: March 10, 2026 - Payment & Billing System Fixes

### Overview

Major improvements to payment processing, membership status tracking, and referral link handling for app-managed subscriptions.

---

### 1. Payment Method Management Fixes

**Problem**: Members couldn't set ACH/bank accounts as default payment method due to Stripe subscription conflicts.

**Solution**: Removed legacy Stripe subscription updates from payment method APIs since all subscriptions are now app-managed.

**Files Modified**:
- `src/pages/api/stripe/payment-methods/set-default.ts` - Removed Stripe subscription update that was failing
- `src/pages/api/stripe/payment-methods/list.ts` - Now only checks Stripe customer's default payment method (not subscription)

**Impact**: Members can now successfully set ACH bank accounts as their default payment method.

---

### 2. Retry Payment Feature for Past Due Subscriptions

**Problem**: No way for admins to manually retry failed payments when members updated payment methods.

**Solution**: Created retry payment system with full ACH support and processing status tracking.

**New API Endpoint**: `POST /api/subscriptions/retry-payment`
- **Purpose**: Manually retry payment for past_due subscriptions
- **Body**: `{ account_id: string }`
- **Returns**:
  ```javascript
  {
    success: boolean,
    message: string,
    payment_intent_id?: string
  }
  ```

**Files Created**:
- `src/pages/api/subscriptions/retry-payment.ts` - Retry payment endpoint with ACH mandate handling

**Files Modified**:
- `src/lib/billing.ts`:
  - Added support for `us_bank_account` payment method type
  - Added `payment_method_types: ['card', 'us_bank_account']` to PaymentIntent creation
  - Handle ACH mandate_data for off-session payments
  - Accept `processing` status as success (ACH takes 3-5 days to clear)
- `src/components/MemberSubscriptionCard.tsx`:
  - Added "🔄 Retry Payment" button for past_due subscriptions
  - Added "ACH PROCESSING" status badge (green)
  - Hide retry button when payment is already processing
  - Added `handleRetryPayment()` function

**Database Changes**:
- Added `'processing'` to accounts.subscription_status allowed values
- Column tracks ACH payments that are clearing (3-5 business days)

**Workflow**:
1. Admin clicks "Retry Payment" on past_due subscription
2. System charges using account's default payment method (card or ACH)
3. For ACH: Status set to 'processing', badge shows "ACH PROCESSING"
4. For Cards: Status set to 'active' immediately
5. Ledger entry created immediately for both types
6. Billing date moved forward by 1 month/year
7. Retry count reset to 0

**Impact**: 
- Admins can retry failed payments without waiting for cron job
- ACH payments properly supported with mandate handling
- Clear visual feedback on payment processing status
- Immediate ledger entries for accounting accuracy

---

### 3. Membership Plan Assignment Backfill

**Problem**: 110 accounts had NULL `membership_plan_id` after migration to app-managed subscriptions, causing "No active membership" display issues.

**Solution**: Backfilled all accounts based on monthly_dues amount.

**Database Updates**:
```sql
-- Assigned plan IDs based on dues amount:
-- $100 or $125 → Solo plan (Duo = Solo + 1 additional member)
-- $10 or $1 → Skyline plan  
-- $1200 → Annual plan
```

**Accounts Fixed**: 105 accounts (95 Solo, 10 Skyline)

**Files Modified**:
- Manual database update via SQL (no code changes)

**Impact**: All active memberships now display correctly in admin UI.

---

### 4. Membership Status Display Improvements

**Problem**: Membership card only showed subscriptions with status='active', hiding past_due/processing subscriptions.

**Solution**: Display memberships for all non-canceled statuses.

**Files Modified**:
- `src/components/MemberSubscriptionCard.tsx`:
  - Changed condition from `subscription_status === 'active'` to exclude only 'canceled'
  - Now shows: active, past_due, processing, paused subscriptions
  - Added status-specific badges with appropriate styling

**Impact**: Admins can see and manage subscriptions that need attention (past_due, processing).

---

### 5. Referral Link Tracking Improvements

**Problem**: Referral links created blank waitlist entries immediately on click, cluttering admin waitlist with incomplete leads.

**Solution**: Track referral clicks as separate status, update entry when form is submitted.

**Files Modified**:
- `src/pages/api/referral/create-onboard.ts`:
  - Creates waitlist entry with status `'link_clicked'`
  - Sets `form_step = 0` to track progress
  - Records referrer information
- `src/pages/api/referral/submit.ts`:
  - Finds existing `link_clicked` entry and updates it
  - Changes status to `'submitted'` with complete data
  - Sets `form_step = 5` (completed)
  - No duplicate entries created

**Database Changes**:
- Added `form_step INTEGER DEFAULT 0` column to waitlist table
- Tracks user progress through referral form (0-5)

**New Statuses**:
- `link_clicked` - User clicked referral link but hasn't submitted form
- `submitted` - User completed and submitted referral form

**Impact**: 
- Clean admin waitlist (only see completed applications)
- Track referral link effectiveness and drop-off rates
- See which step users abandoned the form
- No more blank entries with only "Referred by [Name]"

---

### API Endpoints Added

#### POST /api/subscriptions/retry-payment
Manually retry payment for past_due subscription using account's default payment method.

**Request**:
```json
{
  "account_id": "uuid"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Payment successful - subscription reactivated",
  "payment_intent_id": "pi_xxx"
}
```

**Response (ACH Processing)**:
```json
{
  "success": true,
  "message": "Payment successful - subscription reactivated",
  "payment_intent_id": "pi_xxx"
}
```
Note: Subscription status set to 'processing' for ACH, 'active' for cards.

**Response (Error)**:
```json
{
  "success": false,
  "message": "Payment failed",
  "error": "Error message from Stripe"
}
```

**Features**:
- Supports both card and ACH payment methods
- Handles ACH mandates for off-session payments
- Creates immediate ledger entry
- Moves billing date forward
- Resets retry count
- Sends success notification SMS

---

### Database Schema Changes

#### accounts table
```sql
-- Added new subscription status
ALTER TABLE accounts DROP CONSTRAINT accounts_subscription_status_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_subscription_status_check 
  CHECK (subscription_status = ANY (ARRAY[
    'active'::text, 
    'canceled'::text, 
    'past_due'::text, 
    'unpaid'::text, 
    'paused'::text, 
    'trialing'::text,
    'processing'::text  -- NEW: For ACH payments clearing
  ]));
```

#### waitlist table
```sql
-- Added form progress tracking
ALTER TABLE waitlist ADD COLUMN form_step INTEGER DEFAULT 0;

-- New status values (not enforced by constraint):
-- 'link_clicked' - Referral link clicked but form not submitted
-- 'submitted' - Referral form completed and submitted
-- 'pending' - Regular waitlist application
-- 'approved' - Approved for membership
```

---

### Testing Performed

✅ Local build completed successfully (exit code 0)
✅ All TypeScript errors resolved
✅ Manual database updates verified
✅ ACH payment method tested (shows as default in UI)
✅ Retry payment workflow tested (creates ledger entry, updates status)

---

### Commits (7 total)

1. `d250f90` - Fix membership card to display past_due and paused subscriptions
2. `35420a0` - Fix set-default payment method API for app-managed subscriptions  
3. `f926b19` - Fix payment methods list to show correct default for app-managed subscriptions
4. `5c290bc` - Add retry payment functionality with ACH support and processing status
5. `bc77d07` - Fix logPaymentToLedger function call signature
6. `99464b4` - Fix referral links creating blank waitlist entries (REVERTED)
7. `8c4b7d4` - Fix TypeScript error in retry-payment - convert dates to strings
8. `eb84156` - Track referral link clicks and form progress in waitlist
9. `2b1d68a` - Fix sendPaymentSuccessNotification function call

---

### Key Technical Decisions

1. **ACH Support**: Added `payment_method_types: ['card', 'us_bank_account']` to all PaymentIntent creation to support both payment methods.

2. **Processing Status**: Created new 'processing' subscription status for ACH payments that take 3-5 days to clear, allowing immediate subscription reactivation while payment processes.

3. **Mandate Handling**: For ACH off-session payments, provide `mandate_data` with customer acceptance info since Stripe requires explicit authorization.

4. **Referral Tracking**: Track link clicks separately from form submissions to measure funnel effectiveness without cluttering admin UI.

5. **No Stripe Subscription Updates**: Since migrating to app-managed billing, removed all Stripe subscription updates from payment method management APIs.

---

### Future Enhancements Discussed

- Could add step-by-step progress tracking in referral form (update form_step on each page)
- Could add webhook handler to automatically set subscription to 'active' when ACH payment succeeds
- Could add partial data capture (save form fields as user progresses through steps)

---

## Multi-Location Settings Management

**Added**: 2026-04-15

### Admin Settings Page (`/admin/settings`)

**Location**: `src/pages/admin/settings.tsx`

The settings page now features a tabbed interface for managing global and location-specific settings.

#### Tabs

1. **General Settings** - Global system settings (booking windows, hours, admin notifications, hold fees)
2. **Noir KC** - Location-specific settings for Noir KC
3. **RooftopKC** - Location-specific settings for RooftopKC

#### Location-Specific Settings (Per Tab)

Each location tab includes:

**Booking Window** (Coming Soon)
- Currently shows global settings
- Will support location-specific booking windows

**Base Hours** (Coming Soon)
- Currently shows global settings
- Will support location-specific operating hours

**Custom Open/Closed Days** ✅ Fully Functional (As of 2026-04-18)
- Location-specific exceptional closures
- Each location maintains independent closed days
- Component: `CalendarAvailabilityControl.tsx` with `locationSlug` prop
- Saves to: `venue_hours.location_id`
- Migration: `migrations/20260418_add_location_id_to_venue_hours.sql`

**Timezone**
- Display only (America/Chicago)
- Per-location timezone support planned

**Cover Charge Settings** ✅ Fully Functional
- **Toggle**: Enable/disable cover charges for the location
- **Price Input**: Set cover amount ($0-$100) with +/- controls
- **Business Rule**: Cover charges apply ONLY to non-members. Members always bypass cover charges.
- **Saves to**: `locations.cover_enabled`, `locations.cover_price`
- **UI**: Cork-branded with 3-layer drop shadows, number input with increment buttons

**Minaka Calendar Integration** ✅ Fully Functional (As of 2026-04-18)
- **iCal URL Input**: Add Minaka calendar feed URL per location
- **Saves to**: `locations.minaka_ical_url`
- **Purpose**: Sync external events from Minaka to location-specific calendar
- **Format**: `https://www.minaka.app/api/user/calendar/feed.ics?token=...`

**Current Configuration**:
- **Noir KC**: Cover charges typically disabled
- **RooftopKC**: $20 cover for non-members (configurable)

#### Design System Applied

The settings page now follows Noir brand guidelines:

**Colors**:
- Primary buttons: Cork (#A59480)
- Switches: Cork when active
- Backgrounds: Wedding Day (#ECEDE8)
- Text: Day Break (#1F1F1F)

**Shadows**:
- Cards: `0 4px 12px rgba(165, 148, 128, 0.08)`
- Buttons: 3-layer drop shadow system
- Hover: Enhanced shadows with lift effect

**Typography**:
- Headings: IvyJournal serif
- UI Elements: Montserrat sans-serif

**Spacing**:
- Border radius: 16px (cards), 10px (buttons)
- Responsive padding: 1rem mobile → 3rem desktop
- Card hover: `translateY(-2px)` lift effect

**Mobile Optimized**:
- Responsive breakpoints: 768px, 1024px
- Touch targets ≥ 44px
- No horizontal scrolling
- Font sizes ≥ 12px minimum

**Files**:
- Component: `src/pages/admin/settings.tsx`
- Styles: `src/styles/Settings.module.css`

---

