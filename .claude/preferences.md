# Project Preferences & Standards

## 🚫 BANNED LIBRARIES

### Chakra UI - COMPLETELY BANNED
**Status:** Being removed from the entire codebase
**Reason:** Clunky, inconsistent, poor developer experience

**What NOT to do:**
```typescript
// ❌ WRONG - Never import Chakra
import { Button, Drawer, Input } from '@chakra-ui/react';
import { useDisclosure } from '@chakra-ui/react';
```

**What TO do:**
```typescript
// ✅ CORRECT - Use Shadcn
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
```

---

## ✅ APPROVED UI LIBRARIES

### 1. Shadcn UI (Primary)
**Location:** `src/components/ui/`
**Usage:** All UI components, modals, forms, buttons, inputs

**Available Components:**
- **Overlays:** Dialog, Sheet, Alert Dialog
- **Forms:** Input, Textarea, Select, Checkbox, Switch, Label
- **Display:** Card, Badge, Avatar, Separator, Tabs
- **Feedback:** Spinner, Toast, Alert
- **Actions:** Button

### 2. Tailwind CSS (Styling)
**Usage:** All styling via className
**Config:** `tailwind.config.ts`

```typescript
// ✅ CORRECT
<div className="flex items-center gap-2 p-4 bg-white rounded-lg border border-border-cream-1">
```

### 3. Radix UI (Primitives)
**Usage:** Through Shadcn wrappers only
**Never import directly** - always use Shadcn wrapper

---

## 📋 Component Migration Guide

### Chakra → Shadcn Mapping

| Chakra Component | Shadcn Replacement | Notes |
|-----------------|-------------------|-------|
| `Drawer` | `Sheet` or `Dialog` | Use Sheet for side panels, Dialog for centered |
| `Modal` | `Dialog` | Centered modal with backdrop |
| `Button` | `Button` | Similar API, better styling |
| `Input` | `Input` | Simpler, cleaner |
| `Select` | `Select` | Native or custom variant |
| `Textarea` | `Textarea` | Standard textarea |
| `Switch` | `Switch` | Toggle switch |
| `Checkbox` | `Checkbox` | Standard checkbox |
| `FormControl` | `<div>` + `Label` | Use Label component |
| `FormLabel` | `Label` | Semantic label |
| `VStack` | `<div className="flex flex-col gap-N">` | Flexbox |
| `HStack` | `<div className="flex gap-N">` | Flexbox |
| `Box` | `<div>` | Generic div |
| `Text` | `<p>` or `<span>` | Semantic HTML |
| `Badge` | `Badge` | Similar component |
| `Card` | `Card` | Similar component |
| `useDisclosure` | `useState<boolean>` | React state |
| `useToast` | `useToast` | From @/hooks/useToast |

### Example Conversion

**Before (Chakra):**
```typescript
import { Drawer, DrawerOverlay, DrawerContent, Button, Input, VStack } from '@chakra-ui/react';

<Drawer isOpen={isOpen} onClose={onClose}>
  <DrawerOverlay />
  <DrawerContent>
    <VStack spacing={4}>
      <Input />
      <Button>Save</Button>
    </VStack>
  </DrawerContent>
</Drawer>
```

**After (Shadcn):**
```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Title</SheetTitle>
    </SheetHeader>
    <div className="flex flex-col gap-4 mt-4">
      <Input />
      <Button>Save</Button>
    </div>
  </SheetContent>
</Sheet>
```

---

## 🎨 Design System Tokens

Use these Tailwind classes for brand consistency:

### Colors
- **Night Sky:** `#1F1F1F` - `text-text-primary` or `bg-[#1F1F1F]`
- **Cork:** `#A59480` - `text-cork` or `bg-cork`
- **Wedding Day:** `#ECEDE8` - `bg-bg-cream-2`
- **Cream 1:** `#ECEAE5` - `border-border-cream-1`
- **Cream 2:** `#F6F5F2` - `bg-bg-cream-1`
- **Text Muted:** `#5A5A5A` - `text-text-muted`

### Spacing
- Use Tailwind spacing scale: `gap-2`, `p-4`, `space-y-6`

### Borders
- Radius: `rounded-lg` (8px), `rounded-2xl` (16px)
- Width: `border` (1px), `border-2` (2px)

---

## 🔧 When Converting Existing Components

1. **Read the component** to understand structure
2. **Identify all Chakra imports**
3. **Replace with Shadcn equivalents** using table above
4. **Convert layout** (VStack/HStack → flex classes)
5. **Convert styling** (sx/props → Tailwind classes)
6. **Test thoroughly**
7. **Remove Chakra imports**

---

## 📝 Commit Message Format

When converting from Chakra to Shadcn:

```
Convert [ComponentName] from Chakra UI to Shadcn

- Replace Chakra Drawer with Shadcn Sheet
- Convert VStack/HStack to Tailwind flex utilities
- Update form controls to use Label components
- Remove all @chakra-ui/react imports
- Maintain existing functionality and styling

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## ⚡ Quick Reference

**Before starting any UI work:**
1. Check: Am I using Chakra? → ❌ STOP
2. Use: Shadcn from `@/components/ui/` → ✅ GO
3. Style: Tailwind classes only → ✅ GO

**If you see Chakra in existing code:**
1. Flag it for conversion
2. Convert to Shadcn immediately
3. Remove Chakra imports
4. Commit with clear message
