# Noir CRM Brand Design Guide

This guide defines the visual design system for Noir CRM. Follow these patterns for all UI development to maintain brand consistency.

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
