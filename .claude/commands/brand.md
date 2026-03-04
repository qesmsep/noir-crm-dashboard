# Noir CRM Brand Design Guide

This guide defines the visual design system for Noir CRM. Follow these patterns for all UI development to maintain brand consistency.

## 🚫 CRITICAL: NO CHAKRA UI

**NEVER use Chakra UI. Use Shadcn UI only.**

- ❌ **BANNED:** `@chakra-ui/react` (all components)
- ✅ **USE:** Shadcn UI from `@/components/ui/`
- ✅ **STYLE:** Tailwind CSS only

Full guide: `.claude/preferences.md`

## Color Palette

### Primary Colors
- **Cork** (`#A59480`): Primary accent color for CTAs, active states, and key interactions
- **Darker Cork** (`#8C7C6D`): Hover states for cork elements, secondary accents
- **Night Sky** (`#353535`): Dark backgrounds, secondary buttons, high-contrast text
- **Day Break** (`#1F1F1F`): Primary text color, darkest backgrounds

### Neutral Colors
- **Wedding Day** (`#ECEDE8`): Light backgrounds, page backgrounds
- **Greige** (`#ABA8A1`): Neutral accents, disabled states, blocking elements
- **Light Greige** (`#F7F6F2`): Hover backgrounds for white elements
- **Earth Tones** (`#ECEAE5`, `#EFEDE8`, `#DAD7D0`): Borders, dividers, subtle backgrounds

### Text Colors
- Primary: `#1F1F1F` (dayBreak)
- Secondary: `#5A5A5A`
- Tertiary: `#868686`
- Light: `#ffffff`

## Multi-Layer Drop Shadow System

Use 3-layer shadows for depth and sophistication:

### Base Buttons (White/Tertiary)
```css
box-shadow:
  0 1px 2px rgba(165, 148, 128, 0.08),
  0 4px 8px rgba(165, 148, 128, 0.12),
  0 8px 16px rgba(165, 148, 128, 0.08);
```

### Hover State
```css
box-shadow:
  0 2px 4px rgba(165, 148, 128, 0.1),
  0 8px 16px rgba(165, 148, 128, 0.15),
  0 16px 32px rgba(165, 148, 128, 0.12);
```

### Cork Primary Buttons
```css
box-shadow:
  0 1px 2px rgba(165, 148, 128, 0.15),
  0 4px 8px rgba(165, 148, 128, 0.25),
  0 8px 16px rgba(165, 148, 128, 0.18);
```

### Dark Secondary Buttons
```css
box-shadow:
  0 1px 2px rgba(53, 53, 53, 0.15),
  0 4px 8px rgba(53, 53, 53, 0.2),
  0 8px 16px rgba(53, 53, 53, 0.15);
```

### Cards and Containers
```css
box-shadow: 0 4px 12px rgba(165, 148, 128, 0.08);
```

### Card Hover
```css
box-shadow: 0 6px 16px rgba(165, 148, 128, 0.12);
```

## Button Hierarchy

### Primary Button (Cork)
**Use for**: Main CTAs, important actions
```css
background: #A59480;
border: 1px solid #A59480;
color: #ffffff;
font-weight: 600;
padding: 0.5rem 1rem;
border-radius: 10px;
box-shadow: [3-layer cork shadow];
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

**Hover**:
```css
background: #8C7C6D;
border-color: #8C7C6D;
transform: translateY(-2px);
box-shadow: [enhanced 3-layer cork shadow];
```

### Secondary Button (Dark)
**Use for**: Secondary actions, "Today" buttons, navigation
```css
background: #353535;
border: 1px solid #353535;
color: #ffffff;
font-weight: 600;
padding: 0.5rem 1rem;
border-radius: 10px;
box-shadow: [3-layer dark shadow];
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

**Hover**:
```css
background: #1F1F1F;
border-color: #1F1F1F;
transform: translateY(-2px);
box-shadow: [enhanced 3-layer dark shadow];
```

### Tertiary Button (White)
**Use for**: Navigation arrows, filters, less prominent actions
```css
background: white;
border: 1px solid #ECEAE5;
color: #1F1F1F;
font-weight: 600;
padding: 0.5rem 1rem;
border-radius: 10px;
box-shadow: [3-layer cork shadow];
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

**Hover**:
```css
background: #F7F6F2;
border-color: #A59480;
transform: translateY(-2px);
box-shadow: [enhanced 3-layer cork shadow];
```

### Button States

**Active/Pressed**:
```css
transform: translateY(0px);
box-shadow: [reduced shadow - first 2 layers only];
```

**Disabled**:
```css
opacity: 0.4;
cursor: not-allowed;
transform: none;
```

**Focus** (accessibility):
```css
outline: 2px solid #A59480;
outline-offset: 2px;
box-shadow: 0 2px 6px rgba(165, 148, 128, 0.12), 0 0 0 3px rgba(165, 148, 128, 0.1);
```

## Button Groups

For navigation arrows and grouped buttons:
```css
.buttonGroup {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: [3-layer cork shadow];
}

.buttonGroup button {
  border-radius: 0;
  border-right: 1px solid #EFEDE8;
}

.buttonGroup button:first-child {
  border-top-left-radius: 10px;
  border-bottom-left-radius: 10px;
}

.buttonGroup button:last-child {
  border-top-right-radius: 10px;
  border-bottom-right-radius: 10px;
  border-right: none;
}
```

## Spacing & Sizing

### Border Radius
- **Buttons**: `10px`
- **Cards**: `16px`
- **Small elements** (tags, badges, events): `5-6px`
- **Mobile buttons**: `8px`

### Button Sizing
- **Desktop**: `padding: 0.5rem 1rem`, `font-size: 0.875rem`
- **Mobile**: `padding: 0.5rem 1rem`, `font-size: 0.8125rem`
- **Touch targets**: Minimum `44px` width/height on mobile

### Reservation Events
```css
.reservationEvent {
  height: 20px;
  margin: 2px 0; /* vertical breathing room */
  padding: 0 6px;
  border-radius: 5px;
  border: 1px solid #353535;
}

.reservationEvent:hover {
  height: 22px; /* expands on hover */
  margin: 1px 0;
  border-color: #A59480;
  box-shadow: 0 2px 4px rgba(165, 148, 128, 0.2);
}
```

## Information Density

### Dashboard Cards
- **List items**: Show 5 items per card (not 3)
- **Card padding**: `1.25rem` (reduced from 1.5rem for efficiency)
- **Title font**: `0.9375rem` (reduced from 1.125rem)
- **List item header**: `0.8125rem`
- **List item text**: `0.75rem`
- **Grid layout** (desktop 1200px+): `repeat(4, 1fr)` for horizontal card rows

### Mobile Density
- **Event height**: `min-height: 24px`
- **Font size**: `10px` for compact elements
- **Resource area**: `40px` width (reduced from 80px)

## Typography

### Font Families
- **Primary**: `'Montserrat', sans-serif` - Body text, buttons, UI elements
- **Headings**: `'IvyJournal', serif` - Page titles, prominent headings
- **System**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` - Mobile navigation

### Letter Spacing
- **Headings**: `-0.02em`
- **Buttons**: `-0.01em`
- **Body**: Default

### Font Weights
- **Bold**: `700` - Titles, headings
- **Semibold**: `600` - Buttons, labels, subheadings
- **Medium**: `500` - Body text, list items
- **Regular**: `400` - Secondary text

## Transitions & Animations

### Standard Transition
```css
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

### Micro-interactions
- **Hover lift**: `transform: translateY(-2px)`
- **Active press**: `transform: translateY(0px)` or `scale(0.95-0.97)`
- **Card hover**: `transform: translateY(-2px)` + enhanced shadow

### Mobile Touch
```css
-webkit-tap-highlight-color: transparent;
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

## Icon Usage

- **Library**: Lucide React (`lucide-react`)
- **Never use**: Emoji icons (replace with proper SVG icons)
- **Size**: `18-24px` for buttons, `20-28px` for headers
- **Stroke width**: `2` (default)

### Common Icons
- `UserPlus` - New members
- `PartyPopper` - Events
- `Users` - Member lists
- `Calendar` - Reservations
- `DollarSign` - Payments
- `Cake` - Birthdays
- `RefreshCw` - Renewals

## Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 768px) {
  /* Compact layouts, reduced padding, smaller fonts */
}

/* Tablet */
@media (max-width: 1024px) {
  /* Adjusted grid columns */
}

/* Desktop */
@media (min-width: 1200px) {
  /* 4-column card grids, full information density */
}
```

## 🚫 CRITICAL: NO HORIZONTAL SCROLLING ON MOBILE

**ABSOLUTE RULE**: Horizontal scrolling on mobile is FORBIDDEN. Period.

### Why This Matters
- Horizontal scrolling creates a terrible mobile UX
- Users expect to scroll vertically only
- Horizontal scroll indicates poor responsive design
- Makes content difficult to access and frustrating to navigate

### Prevention Strategies

**1. Container Width Control**
```css
/* ALWAYS use these on mobile containers */
.container {
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
  box-sizing: border-box;
}
```

**2. Responsive Text & Content**
```css
/* Text must wrap or truncate, NEVER overflow */
.text {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
}

/* Or truncate with ellipsis */
.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**3. Navigation Patterns - NO HORIZONTAL SCROLL**

**❌ BAD - Horizontal scrolling tabs:**
```css
.tabList {
  display: flex;
  overflow-x: auto; /* FORBIDDEN ON MOBILE */
  white-space: nowrap;
}
```

**✅ GOOD - Wrapping or stacked tabs:**
```css
.tabList {
  display: flex;
  flex-wrap: wrap; /* Wraps to multiple rows */
  gap: 0.5rem;
}

/* Or for icon-based navigation */
.tab {
  display: flex;
  flex-direction: column; /* Icon above text */
  align-items: center;
  padding: 0.5rem;
  min-width: fit-content;
}
```

**4. Tables - MUST Convert to Cards**
- See "Tables → Card View on Mobile" section below
- Tables with 3+ columns ALWAYS become cards on mobile
- NEVER use horizontal scroll for tables

**5. Images & Media**
```css
img, video, iframe {
  max-width: 100%;
  height: auto;
}
```

**6. Fixed Width Elements**
- NEVER use fixed pixel widths wider than 320px on mobile
- Use `max-width` with percentage/vw units instead
- Use `min-width` sparingly, only for touch targets (44px minimum)

**7. Long URLs or Monospace Content**
```css
.url, .code {
  word-break: break-all; /* Break anywhere if needed */
  overflow-wrap: anywhere;
}
```

### Testing for Horizontal Scroll

**Before deploying ANY mobile changes:**
1. Open DevTools mobile emulation at 320px width
2. Scroll entire page vertically
3. Check for ANY horizontal scrollbar or side-to-side movement
4. Test on actual mobile device (iPhone/Android)
5. If horizontal scroll exists → **MUST FIX BEFORE COMMIT**

### Common Causes & Fixes

| Cause | Fix |
|-------|-----|
| Wide tables | Convert to card view on mobile |
| Long text/URLs | Add `word-break: break-word` |
| Fixed width containers | Use `max-width: 100%` instead |
| Tab navigation | Make tabs wrap or stack vertically |
| Images | Add `max-width: 100%` |
| Padding causing overflow | Use responsive padding (`px={{ base: 4, md: 6 }}`) |
| viewport not set | Add `<meta name="viewport" content="width=device-width, initial-scale=1">` |

### Enforcement

**This is a blocking issue:**
- Code reviews MUST check for horizontal scroll on mobile
- Mobile Validator MUST flag horizontal scroll as CRITICAL
- Build should fail if horizontal scroll detected
- NO EXCEPTIONS

### Mobile-Specific Patterns

**Tables → Card View on Mobile**

CRITICAL: On mobile devices (< 768px), tables with multiple columns MUST be converted to card view for readability and touch-friendliness.

**Pattern:**
```jsx
{/* Desktop Table View */}
<TableContainer display={{ base: 'none', md: 'block' }}>
  <Table variant="simple" size="sm">
    {/* Full table with columns */}
  </Table>
</TableContainer>

{/* Mobile Card View */}
<VStack spacing={3} display={{ base: 'flex', md: 'none' }}>
  {items.map((item) => (
    <Box key={item.id} p={4} borderRadius="12px" border="1px solid" borderColor="#ECEAE5" bg="#FBFBFA" w="full">
      {/* Card layout with stacked fields */}
    </Box>
  ))}
</VStack>
```

**When to use:**
- Transaction lists
- Reservation history
- Any data table with 3+ columns
- Lists with multiple attributes per row

**Card styling:**
- Background: `#FBFBFA`
- Border: `1px solid #ECEAE5`
- Border radius: `12px`
- Padding: `16px` (p={4})
- Spacing between cards: `12px`

## Component-Specific Guidelines

### FullCalendar Toolbar
- Apply 3-layer drop shadows to ALL buttons
- Group navigation arrows with seamless borders
- Primary button: Cork for "+ rez"
- Secondary button: Dark for "today"
- Tertiary buttons: White for filters, navigation

### Resource Timeline
- Background: `#ECEDE8` (weddingDay)
- Resource labels: White text on greige background
- Event spacing: 2px margin, 20px height
- Border colors: Earth tones (`#ECEAE5`)

### Mobile Navigation
- Sticky position with `top: 0`, `z-index: 10`
- Background: White with earth-tone border
- Apply drop shadows for depth
- Touch targets: 36-44px minimum

## Loading States

### Skeleton Loaders
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
```

## Empty States

- Include icon (from Lucide)
- Clear message explaining why empty
- CTA button (Cork primary) when applicable
- Example: "No upcoming events. Start by creating your first reservation."

---

**When you're ready to help Tim, respond with: "what are we going brand today?"**
