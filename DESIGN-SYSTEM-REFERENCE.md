# CCM Design System Reference

**Version**: 1.0  
**Last Updated**: April 30, 2026  
**Framework**: React 18 + Material-UI (MUI) v6  
**Target Platforms**: Web, Android, iOS (via Capacitor)

---

## Table of Contents

1. [Overview & Philosophy](#1-overview--philosophy)
2. [Architecture](#2-architecture)
3. [Multi-Brand Support](#3-multi-brand-support)
4. [Design Tokens](#4-design-tokens)
5. [Component Library](#5-component-library)
6. [Layout System](#6-layout-system)
7. [UX Patterns](#7-ux-patterns)
8. [Accessibility](#8-accessibility)
9. [Usage Guidelines](#9-usage-guidelines)
10. [File Structure](#10-file-structure)

---

## 1. Overview & Philosophy

### 1.1 Purpose

The CCM Design System is a comprehensive UI/UX framework for building a **multi-module, multi-brand enterprise Dealer Management System (DMS)** for automotive dealerships. It spans Service, Finance, Spare Parts, Vehicle, and CRM domains across 57+ feature modules.

### 1.2 Core Principles

| Principle | Description |
|-----------|-------------|
| **Consistency** | Shared theme tokens (colors, typography, spacing) ensure visual coherence across all modules |
| **Efficiency** | Mobile-first workflows for field staff with desktop optimization for back-office users |
| **Scalability** | Atomic Design architecture enables rapid feature development without UI drift |
| **Brand Flexibility** | Multi-brand theming allows the same codebase to serve different OEM brands |
| **Cross-Platform** | Single React 18 codebase deployable as Web, Android, and iOS apps |
| **Accessibility** | WCAG 2.2 AA compliance for keyboard navigation, screen readers, and reduced motion |

### 1.3 Design Decision Hierarchy

When making design decisions, resolve **top-down**:

1. **Brand Guidelines** → Does the brand guideline mandate a specific style? Use `systemColor`
2. **Design Tokens** → Does a design token exist? Use tokens via `sx` prop
3. **Component Overrides** → Is it already in the base theme? Don't re-declare
4. **Product Extensions** → Is this CCM-specific? Add to `apps/web/src/shared/theme/theme.ts`
5. **Atomic Components** → Does an existing atom/molecule cover this? Reuse it
6. **New Components** → Only then create a new component/token

---

## 2. Architecture

### 2.1 Technology Stack

- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI) v6
- **Styling**: MUI's `sx` prop + theme overrides
- **Icons**: Custom SVG icon library (300+ icons)
- **Font**: Noto Sans (Regular, Medium, SemiBold)
- **State Management**: React Context + hooks
- **Form Handling**: React Hook Form + Zod validation

### 2.2 Atomic Design Structure

```
design-system/
├── components/
│   ├── atoms/           # ~40 files — smallest reusable elements
│   ├── molecules/       # ~28 files — compositions of atoms
│   ├── templates/       # ~35 files — page scaffolding & layouts
│   ├── common/          # ~10 files — cross-cutting shared components
│   ├── notifications/   # Snackbar & notification system
│   └── index.ts         # Barrel exports
├── theme/
│   ├── theme.ts         # Main theme configuration
│   ├── colors.ts        # Color palette
│   ├── typography.ts    # Font scale & weights
│   ├── breakpoints.ts   # Responsive breakpoints
│   ├── dimensions.ts    # Spacing, border radius
│   ├── palette.ts       # MUI palette mapping
│   ├── statusColors.ts  # Status-specific colors
│   └── variants/        # Component variant overrides
├── icons/               # 300+ categorized SVG icons
└── [01-07]-*.md        # Design documentation
```

### 2.3 Theme Inheritance

```
Brand Guidelines (Bajaj / Product)
    └── Design-System Base Theme (design-system/theme/theme.ts)
        │   Full palette, typography, component overrides, sx token config
        └── Product Extension Theme (apps/web/src/shared/theme/theme.ts)
            │   Brand-specific primary color, CssBaseline overrides
            └── Design Tokens consumed via sx prop
                └── Atomic Components (design-system/components/)
                    └── Feature Components (apps/web/src/features/)
```

---

## 3. Multi-Brand Support

The system supports two brand profiles configured via `Module` constant in `src/constants.ts`:

### 3.1 Brand Configurations

| Aspect | **Bajaj** | **Product** (Current) |
|--------|-----------|----------------------|
| Primary Color | `#0052FF` (Blue) | `#EB6A2C` (Orange) |
| Secondary Color | `#EB6A2C` (Orange) | `#1B1D21` (Dark) |
| Light Theme Color | `#EEF6FF` | `#FFF7F0` |
| Tertiary Text | `#7AB2FF` | `#A8B5C2` |
| Header Background | `systemColor.primary` | `#4E555B` |

### 3.2 Usage Rule

**Never hardcode brand-specific colors in components.** Always reference `systemColor` from `src/theme/systemColor.ts` for brand-aware values.

```tsx
// ❌ Wrong
<Box sx={{ backgroundColor: '#EB6A2C' }}>

// ✅ Correct
import { systemColor } from '@/theme/systemColor';
<Box sx={{ backgroundColor: systemColor.primary }}>
```

---

## 4. Design Tokens

### 4.1 Color Palette

All colors use a **50 → 900 shade scale** (10 shades per palette).

#### Semantic Colors

| Token | Main (500) | Usage |
|-------|-----------|-------|
| **primary** | `#EB6A2C` (Orange) | Brand identity, primary actions, focus states |
| **secondary** | `#8593A3` (Gray) | Supporting UI, backgrounds, dividers |
| **error** | `#F5222D` (Red) | Errors, destructive actions, validation failures |
| **success** | `#52C41A` (Green) | Success states, confirmations, positive feedback |
| **warning** | `#FFAB00` (Amber) | Warnings, caution states, important notices |
| **info** | `#3697FF` (Blue) | Informational messages, hints, neutral notices |

#### Extended Colors

| Token | Main (500) | Usage |
|-------|-----------|-------|
| **aqua** | `#1DC8DF` | Highlights, badges |
| **green** | `#24D07A` | Custom success states |
| **mint** | `#2DD6C0` | Alternate success |
| **purple** | `#7D5EFA` | Special categories |
| **rose** | `#FF4671` | Emphasis, alerts |

#### Text Colors

| Token | Value | Usage |
|-------|-------|-------|
| `text.primary` | `#1B1D21` | Main body text |
| `text.secondary` | `#6A7682` | Supporting text, labels |
| `text.tertiary` | `#8593A3` | Placeholder, captions |
| `text.disabled` | `#C3CCD6` | Disabled state text |

#### Background Colors

| Token | Value | Usage |
|-------|-------|-------|
| `background.default` | `#F4F7FA` | Outermost page background |
| `background.paper` | `#FFFFFF` | Card/surface background |
| `background.secondary` | `#F4F7FA` | Nested panels, sidebar sections |

### 4.2 Typography

#### Font Family

| Font File | Mapped Name | Weight | Usage |
|-----------|-------------|--------|-------|
| `NotoSans-Regular.ttf` | `NotoSans-Regular` | 400 | Body text, default |
| `NotoSans-Medium.ttf` | `NotoSans-Medium` | 500 | Labels, subtitles |
| `NotoSans-SemiBold.ttf` | `NotoSans-Semibold` | 600 | Headings, emphasis |

#### Font Weight Tokens

Use via `sx={{ fontWeight: 'token' }}`:

| Token | Font Family | Numeric Weight |
|-------|-------------|----------------|
| `normal` | `NotoSans-Regular` | 400 |
| `medium` | `NotoSans-Medium` | 500 |
| `strong` | `NotoSans-Semibold` | 600 |

#### Font Size Tokens

Use via `sx={{ fontSize: 'token' }}`:

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `xs` | 12px | 18px | Small labels, captions |
| `sm` | 13px | 20px | Secondary text |
| `base` | 14px | 22px | Body text (default) |
| `lg` | 16px | 24px | Emphasized text, subheadings |
| `xl` | 18px | 28px | Section headings |
| `xxl` | 20px | 32px | Page headings |

### 4.3 Spacing Scale

Based on 8px baseline grid. Use via `sx={{ p: 1, m: 2 }}` or specific properties:

| Token | Value | Usage |
|-------|-------|-------|
| `0` | 0px | No spacing |
| `0.5` | 4px | Minimal gap |
| `1` | 8px | Tight spacing |
| `1.5` | 12px | Small gap |
| `2` | 16px | Standard gap |
| `3` | 24px | Medium gap |
| `4` | 32px | Large gap |
| `5` | 40px | Extra large gap |
| `6` | 48px | Section spacing |

### 4.4 Border Radius

Use via `sx={{ borderRadius: 'token' }}`:

| Token | Value | Usage |
|-------|-------|-------|
| `1` | 4px | Subtle rounding |
| `2` | 8px | Standard (buttons, cards) |
| `3` | 12px | Prominent |
| `4` | 16px | Very rounded |
| `full` | 9999px | Pill shape |

### 4.5 Breakpoints

| Token | Min Width | Usage |
|-------|-----------|-------|
| `xs` | 0px | Mobile (default) |
| `sm` | 600px | Large mobile |
| `md` | 900px | Tablet |
| `lg` | 1200px | Desktop |
| `xl` | 1536px | Large desktop |

### 4.6 Shadows (Elevation)

MUI's default elevation scale (0-24) is used. Common values:

| Level | Usage |
|-------|-------|
| `0` | No shadow |
| `1` | Subtle elevation (cards) |
| `2` | Card hover state |
| `4` | Dropdown menus |
| `8` | Modals |
| `16` | Drawers |

---

## 5. Component Library

### 5.1 Atoms (40+ components)

Smallest reusable UI elements.

#### InputBox
Wraps MUI `TextField` with consistent styling.

**Props:**
- `name: string` — Form field name
- `type: string` — HTML input type (default: "text")
- `size: "small" | "medium"` — Size variant
- `error: boolean` — Activates error styling
- `helperText: string` — Help/error message
- All `TextFieldProps` forwarded

**Styling:**
- Disabled: `#F4F7FA` background with `#DEE4EB` border
- Border radius: `8px`

#### MuiButton
Thin wrapper around MUI `Button`.

**Size Variants:**
- `small` (default): `8px 12px` padding, `14px` font
- `medium`: `10px 14px` padding, `14px` font
- `large`: `10px 16px` padding, `16px` font
- `icon` (custom): `8px` padding

**Variants:**
- `contained` — Solid fill, white text
- `outlined` — White background, 1px outline
- `text` — No background or border

**Common Styles:**
- `textTransform: none`
- `borderRadius: 8px`
- `fontWeight: medium`

#### Checkbox
MUI Checkbox with `secondary[200]` for unchecked/disabled states.

#### MuiIconButton
Standard icon button with `20px × 20px` icon defaults.

#### MuiAccordion
Simple accordion with expand icon.

**Props:**
- `title: string` — Accordion title (default: "Accordion")
- `titleVariant: string` — MUI typography variant (default: "body1")
- `children: ReactNode` — Content

#### RadioButton
MUI Radio with consistent styling.

#### Slider
MUI Slider with theme-consistent colors.

#### IOSSwitch
iOS-style toggle switch.

#### MuiSearchSelect
Searchable select/autocomplete component.

#### MultipleSelect
Select component with multiple selection support.

#### Skeleton
Loading placeholder components.

#### Breadcrumb
Breadcrumb navigation component.

#### ToolTipTypography
Typography with tooltip support.

### 5.2 Molecules (28+ components)

Compositions of atoms with local logic.

#### PopupComponent
Modal/dialog wrapper with consistent styling.

#### Loader
Loading spinner/indicator.

#### CustomTab
Tab component with custom styling.

#### SearchBarByTypes
Multi-type search bar with dropdown selection.

#### CustomAlertPopup
Confirmation and warning dialog.

**Usage:** Use for all destructive or irreversible actions.

#### ImageDialogBox
Image viewer modal.

#### ViewAllImagePopUp
Gallery viewer for multiple images.

#### AccordionWithBadge
Accordion with badge indicator.

#### BorderBottom
Visual separator component.

#### LoaderButton
Button with integrated loading state.

#### StackComponent
Flexible stack layout wrapper.

### 5.3 Templates & Common (45+ components)

Page-level scaffolding and cross-cutting components.

#### Header
Global application header.

#### Sidebar
Navigation sidebar (open: 264px, closed: 80px).

#### Layout
Main application layout container.

#### PageLayout
Standard page structure with header and content area.

#### CommonHeader
Reusable page header component.

#### FormFieldWrapper
Consistent form field layout wrapper.

### 5.4 Notifications

#### NotificationProvider
Context provider for notifications.

#### useNotification
Hook to trigger notifications.

#### MuiStackedSnackbar
Stacked snackbar component for multiple notifications.

**Usage:**
```tsx
const { showNotification } = useNotification();
showNotification('Success!', 'success');
```

---

## 6. Layout System

### 6.1 Layout Philosophy

CCM is a workspace application. Layout must support:
- Clear task focus
- Contextual awareness
- Low navigation churn
- Scan-first behavior
- Predictable action placement

### 6.2 Standard Page Zones

1. **Global Header** — App identity, user/session status, utilities
2. **Primary Navigation** — Role-based main navigation
3. **Page Header** — Page title, scope, status, actions
4. **Primary Work Area** — Main task surface
5. **Secondary Context Area** — Related context, metadata
6. **Sticky Action Area** — Persistent primary/secondary actions
7. **Feedback Area** — Inline banners, errors, recovery guidance

### 6.3 Layout Patterns

#### Pattern A: Single Work Surface
Use for focused single-task pages.
```
[Global Header]
[Page Header]
[Main Task Surface]
[Sticky Actions]
```

#### Pattern B: Split Workspace
Use when context and work area needed together.
```
[Global Header]
[Page Header]
[Primary Work Area | Secondary Context Panel]
[Sticky Actions]
```

#### Pattern C: Table with Detail Panel
Use for list/detail workflows.
```
[Global Header]
[Page Header]
[Filters]
[Table/List]
[Optional Detail Drawer or Side Panel]
```

#### Pattern D: Guided Sequence
Use for multi-step workflows.
```
[Global Header]
[Page Header]
[Step Indicator]
[Step Content]
[Sticky Step Actions]
```

### 6.4 Width and Spacing Rules

- **Fluid layout** by default; constrain at `lg` breakpoint (1200px+)
- **Sidebar widths**: Open `264px`, Closed `80px`
- **Page gutters**: Use spacing tokens consistently
- **Content separation**: Use spacing tokens, not ad-hoc margins

### 6.5 Responsive Rules

#### Desktop (Primary Target)
- Prefer split panels for frequent context reference
- Keep metadata visible without excessive scrolling
- Support keyboard shortcuts

#### Tablet
- Allow panel collapse/expansion
- Maintain full functionality
- Optimize for touch + keyboard

#### Mobile
- Single-column layouts
- Bottom-sheet patterns for secondary panels
- Thumb-friendly action placement

---

## 7. UX Patterns

### 7.1 Search and Select

**When:** User must find and choose a record.

**Pattern:**
1. User selects search method
2. User enters value
3. System validates before execution
4. System shows loading state
5. System returns results/empty state/error
6. User explicitly selects (no auto-select on ambiguity)
7. System confirms active context visibly

**Rules:**
- Don't auto-select when ambiguous
- Preserve search input
- Show active selection clearly
- Support retry and reselection

### 7.2 Context Confirmation

**When:** Selected context must be visible before proceeding.

**Pattern:**
- Show read-only summary of active record(s)
- Highlight user selections vs. system-derived data
- Indicate missing/unavailable linked data

### 7.3 Progressive Wrap-Up

**When:** Task ends with controlled metadata capture.

**Pattern:**
1. User finishes main task
2. UI transitions to wrap-up state
3. Required closing fields shown together
4. Conditional remarks appear when triggered
5. Save only when required data complete

### 7.4 Validation and Recovery

**Rules:**
- Field-level issues appear next to field
- Form-level issues in summary (when needed)
- Every error tells user what to do next
- Preserve user-entered data where safe

### 7.5 Destructive Actions

Use confirmation dialogs **only when:**
- Action is irreversible
- Action causes state loss
- Action affects shared operational record

**Don't** confirm routine/frequent safe actions.

**Component:** Use `CustomAlertPopup` for all confirmations.

---

## 8. Accessibility

### 8.1 Target Standard

**WCAG 2.2 AA** compliance for:
- Keyboard operability
- Content contrast
- Screen reader support
- Reduced motion preference

### 8.2 Key Requirements

#### Keyboard Operability
- Logical tab order
- Visible focus indicator
- No keyboard traps
- Escape support for overlays
- Arrow-key support where standard

#### Semantic Structure
- Use semantic HTML first
- Proper heading hierarchy
- Buttons are buttons, links are links
- Tables use table semantics
- Lists use list semantics

#### Labels and Names
Every form control must have:
- Visible label
- Accessible name
- Clear error association
- Helper text association

#### Color and Contrast
- Don't rely on color alone
- Semantic states need text/icon/shape support
- Minimum contrast ratios:
  - 4.5:1 for normal text
  - 3:1 for large text and UI components

#### Error Handling
Validation must be:
- Perceivable
- Specific
- Associated with correct field
- Programmatically linked

#### Modals and Drawers
- Focus moves into container on open
- Focus returns to trigger on close
- Background not interactable
- Dialog purpose announced clearly

#### Reduced Motion

Respect `prefers-reduced-motion` preference.

**Implementation:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

This is implemented globally in `MuiCssBaseline` styleOverrides.

---

## 9. Usage Guidelines

### 9.1 Component Authoring Rules

1. **Never use inline hex colors** — Reference palette tokens
2. **Use `sx` prop** for one-off styles
3. **Use theme overrides** for repeatable patterns
4. **Use font tokens** — `fontSize` and `fontWeight` from theme
5. **Use `borderRadius` tokens** — Don't use raw pixel values
6. **Leverage MUI breakpoints** — Avoid custom media queries

### 9.2 Styling Examples

#### ❌ Wrong
```tsx
<Box 
  style={{ 
    color: '#EB6A2C',
    fontSize: '14px',
    borderRadius: '8px',
    padding: '16px'
  }}
>
```

#### ✅ Correct
```tsx
<Box 
  sx={{ 
    color: 'primary.main',
    fontSize: 'base',
    borderRadius: 2,
    p: 2
  }}
>
```

### 9.3 Import Patterns

```tsx
// Import atoms/molecules
import { MuiButton, InputBox, Checkbox } from '@/design-system/components';

// Import theme tokens
import { theme } from '@/design-system/theme';

// Import brand colors
import { systemColor } from '@/theme/systemColor';

// Use theme in sx prop
<Box sx={{ 
  color: 'text.primary',
  backgroundColor: 'background.paper',
  p: 2,
  borderRadius: 2
}}>
```

### 9.4 Theme Extension

To extend the theme in application code:

```tsx
// apps/web/src/shared/theme/theme.ts
import { createTheme } from '@mui/material';
import { designSystemTheme } from '@/design-system/theme';

export const appTheme = createTheme(designSystemTheme, {
  palette: {
    primary: {
      main: systemColor.primary,
    },
  },
  components: {
    // App-specific overrides
  },
});
```

### 9.5 Icon Usage

300+ icons organized by category in `design-system/icons/`:
- Alerts & feedback
- Arrows
- Charts
- Communication
- Development
- Editor
- Education
- Files
- Finance & eCommerce
- General
- Images
- Layout
- Maps & travel
- Media & devices
- Security
- Shapes
- Time
- Users
- Weather

**Usage:**
```tsx
import SearchIcon from '@/design-system/icons/General/search.svg';

<img src={SearchIcon} alt="Search" width={20} height={20} />
```

---

## 10. File Structure

```
design-system/
├── 01-design-principles.md      # Core philosophy & hierarchy
├── 02-tokens.md                 # Color, typography, spacing tokens
├── 03-components.md             # Component documentation
├── 04-layout.md                 # Layout patterns & responsive rules
├── 05-ux-patterns.md            # Interaction patterns
├── 06-accessibility.md          # WCAG 2.2 AA requirements
├── 07-examples.md               # Code examples & recipes
│
├── components/
│   ├── atoms/
│   │   ├── input.tsx
│   │   ├── buttonComponent.tsx
│   │   ├── checkBox.tsx
│   │   ├── accordion.tsx
│   │   ├── radioButtoncomponent.tsx
│   │   ├── sliderComponent.tsx
│   │   ├── iosSwitch.tsx
│   │   └── ... (40+ files)
│   │
│   ├── notifications/
│   │   ├── useNotification.tsx
│   │   └── MuiStackedSnackbar.tsx
│   │
│   └── index.ts                 # Barrel exports
│
├── theme/
│   ├── theme.ts                 # Main theme configuration
│   ├── colors.ts                # Full color palette (50-900 scale)
│   ├── typography.ts            # Font scale & weight tokens
│   ├── breakpoints.ts           # Responsive breakpoints
│   ├── dimensions.ts            # Spacing, radius tokens
│   ├── palette.ts               # MUI palette mapping
│   ├── statusColors.ts          # Status-specific colors
│   ├── augmentations.ts         # Theme type augmentations
│   └── variants/
│       ├── index.ts
│       ├── MuiChipTheme.ts
│       ├── MuiButtonTheme.ts
│       └── MuiTextInputTheme.ts
│
├── icons/
│   ├── Alerts & feedback/
│   ├── Arrows/
│   ├── Charts/
│   ├── Communication/
│   ├── customIcons/
│   ├── Development/
│   ├── Editor/
│   ├── Education/
│   ├── Files/
│   ├── Finance & eCommerce/
│   ├── General/
│   ├── Images/
│   ├── Layout/
│   ├── Maps & travel/
│   ├── Media & devices/
│   ├── Security/
│   ├── Shapes/
│   ├── Time/
│   ├── Users/
│   └── Weather/
│
└── reference-ux/
    ├── 1-Landing-screen.md
    ├── 2-important-announcements-popup.md
    └── 3-agent.md
```

---

## Quick Reference

### Common Color Usage
```tsx
// Brand primary
color: 'primary.main'           // #EB6A2C (orange)

// Text hierarchy
color: 'text.primary'           // #1B1D21 (main text)
color: 'text.secondary'         // #6A7682 (supporting text)
color: 'text.tertiary'          // #8593A3 (placeholder)

// Backgrounds
backgroundColor: 'background.default'     // #F4F7FA (page background)
backgroundColor: 'background.paper'       // #FFFFFF (cards)
backgroundColor: 'background.secondary'   // #F4F7FA (nested panels)

// Semantic colors
color: 'error.main'             // #F5222D (red)
color: 'success.main'           // #52C41A (green)
color: 'warning.main'           // #FFAB00 (amber)
color: 'info.main'              // #3697FF (blue)
```

### Common Spacing
```tsx
p: 1    // 8px padding
p: 2    // 16px padding
p: 3    // 24px padding
m: 2    // 16px margin
gap: 2  // 16px gap
```

### Common Typography
```tsx
fontSize: 'base'         // 14px (body text)
fontSize: 'lg'           // 16px (emphasis)
fontSize: 'xl'           // 18px (subheadings)
fontWeight: 'normal'     // 400
fontWeight: 'medium'     // 500
fontWeight: 'strong'     // 600
```

### Common Border Radius
```tsx
borderRadius: 1          // 4px
borderRadius: 2          // 8px (standard)
borderRadius: 3          // 12px
borderRadius: 'full'     // pill shape
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | April 30, 2026 | Initial consolidated design system reference |

---

## Additional Resources

- **Design Principles**: `design-system/01-design-principles.md`
- **Token Reference**: `design-system/02-tokens.md`
- **Component Details**: `design-system/03-components.md`
- **Layout Patterns**: `design-system/04-layout.md`
- **UX Patterns**: `design-system/05-ux-patterns.md`
- **Accessibility**: `design-system/06-accessibility.md`
- **Code Examples**: `design-system/07-examples.md`

---

**Maintained by**: CCM Development Team  
**Questions?** Refer to individual design system documents or consult the frontend architecture lead.
