# 02 Tokens

## Purpose

This document defines the design tokens used by CCM so all agents work from a single visual and semantic system. Tokens must be implemented in a theme layer and consumed by components, not hard-coded inside pages.

## Agents That Use This Document

| Agent | How It Is Used |
|---|---|
| UX Designer Agent | Specifies UI using token names instead of ad hoc values |
| Frontend Engineer Agent | Maps tokens into MUI theme, spacing, typography, elevation, and semantic state usage |
| QA Engineer Agent | Verifies that pages use the defined theme system consistently |

## Token Governance Rules

1. Use semantic tokens in product code.
2. Do not hard-code colors, spacing, shadows, or radii in feature components.
3. Add new tokens only when a repeated need appears across multiple screens.
4. Alias MUI theme values to CCM semantic names where practical.
5. Keep dark mode compatibility possible even if phase 1 launches light mode first.

---

## 1. Color Palette

All colors use a **50 → 900 shade scale** (inspired by Tailwind/Ant Design). Each palette has 10 shades.

### 1.1 Semantic Colors

| Token | 50 | 100 | 200 | 300 | 400 | 500 (Main) | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| **primary** | `#e6f2ff` | `#a3cdff` | `#7ab2ff` | `#5294ff` | `#2974ff` | `#0052ff` | `#003dd9` | `#002db3` | `#001e8c` | `#001366` |
| **secondary** | `#f4f7fa` | `#eff2f5` | `#dee4eb` | `#c3ccd6` | `#a8b5c2` | `#8593a3` | `#6a7682` | `#505862` | `#353b41` | `#1b1d21` |
| **error** | `#fff1f0` | `#ffccc7` | `#ffa39e` | `#ff7875` | `#ff4d4f` | `#f5222d` | `#cf1322` | `#a8071a` | `#820014` | `#5c0011` |
| **success** | `#f6ffed` | `#d9f7be` | `#b7eb8f` | `#95de64` | `#73d13d` | `#52c41a` | `#389e0d` | `#237804` | `#135200` | `#092b00` |
| **warning** | `#fff7e5` | `#ffeecc` | `#ffdd99` | `#ffcd66` | `#ffbc33` | `#ffab00` | `#cc7a00` | `#995200` | `#663000` | `#331400` |
| **info** | `#eef6ff` | `#d7eaff` | `#afd5ff` | `#87c0ff` | `#5eacff` | `#3697ff` | `#2b79cc` | `#215a99` | `#163c66` | `#0b1e33` |

> **CCM brand note**: CCM runs as the **Product** brand. The effective primary action color is `#EB6A2C` (orange) from `systemColor.primary`, not the `primary[500]` blue which belongs to the Bajaj brand profile.

### 1.2 Extended Colors

| Token | 50 | 500 (Main) | Usage |
|---|---|---|---|
| **aqua** | `#eafcff` | `#1dc8df` | Highlights, badges |
| **green** | `#e8faf1` | `#24d07a` | Custom success states |
| **mint** | `#e9fffc` | `#2dd6c0` | Alternate success |
| **purple** | `#f6f3ff` | `#7d5efa` | Special categories |
| **rose** | `#fff0f4` | `#ff4671` | Emphasis, alerts |

### 1.3 Overlay Colors

| Token | Value | Usage |
|---|---|---|
| `overlay.black` | `#1b1d2199` | Dialog/drawer backdrops |
| `overlay.white` | `#ffffff66` | Light overlay on images |

### 1.4 Text Colors

| Token | Value | Usage |
|---|---|---|
| `text.primary` | `secondary[900]` = `#1b1d21` | Main body text |
| `text.secondary` | `secondary[600]` = `#6a7682` | Supporting text, labels |
| `text.tertiary` | `secondary[500]` = `#8593a3` | Placeholder, captions |
| `text.disabled` | `secondary[300]` = `#c3ccd6` | Disabled state text |

### 1.5 Background Colors

| Token | Value | Usage |
|---|---|---|
| `background.default` | `secondary[50]` = `#f4f7fa` | Outermost page background — the root canvas |
| `background.paper` | `#ffffff` | Card / surface background — sits above `default` |
| `background.secondary` | `secondary[50]` = `#f4f7fa` | Nested panels, sidebar sections, filter areas — visually recedes from `paper`; shares the same value as `default` today but is a distinct semantic slot that will diverge in dark mode |

---

## 2. Typography

### 2.1 Font Family

| Font File | Mapped Name | Usage |
|---|---|---|
| `NotoSans-Regular.ttf` | `NotoSans-Regular` | Body text, default |
| `NotoSans-Medium.ttf` | `NotoSans-Medium` | Labels, subtitles |
| `NotoSans-SemiBold.ttf` | `NotoSans-Semibold` | Headings, emphasis |

> Font files are located at `src/assets/fonts/`.

### 2.2 Font Weight Tokens

Use via `sx={{ fontWeight: 'normal' }}` — the theme's `unstable_sxConfig` maps these to the appropriate font family.

| Token | Font Family | Numeric Weight |
|---|---|---|
| `normal` | `NotoSans-Regular` | 400 |
| `medium` | `NotoSans-Medium` | 500 |
| `strong` | `NotoSans-Semibold` | 600 |

### 2.3 Font Size Tokens

Use via `sx={{ fontSize: 'base' }}` — the theme's `unstable_sxConfig` maps these to `fontSize` + `lineHeight` pairs.

| Token | Font Size | Line Height | Usage |
|---|---|---|---|
| `xs` | `10px` | `16px` | Micro labels, badges |
| `sm` | `12px` | `18px` | Captions, subtitles |
| `base` | `14px` | `20px` | Default body text |
| `lg` | `16px` | `24px` | Input fields, nav items |
| `xl` | `18px` | `28px` | Section headings |
| `xxl` | `20px` | `28px` | Page headings |

### 2.4 MUI Typography Variants

| Variant | Size | Font | Responsive |
|---|---|---|---|
| `h1` | `20px` | Semibold | — |
| `h2` | `18px` | Medium | — |
| `h3` | `16px` | Medium | — |
| `h4` | `16px` | Regular | — |
| `h5` | `14px` → `12px` (mobile) | Semibold | ✅ `sm` breakpoint |
| `h6` | `14px` → `12px` (mobile) | Regular | ✅ `sm` breakpoint |
| `subtitle1` | `12px` | Semibold | — |
| `subtitle2` | `12px` | Medium | — |
| `body1` | `14px` | Regular | — |
| `body2` | `16px` | Regular | — |
| `caption` | `12px` | Regular | — |

---

## 3. Spacing

MUI's default spacing unit is **8px**. Use the `sx` prop with multiples:

| `sx` Value | Pixels | Usage Example |
|---|---|---|
| `0.5` | `4px` | Tight gaps, icon margins |
| `1` | `8px` | Standard inner padding |
| `1.5` | `12px` | Card/form padding (mobile) |
| `2` | `16px` | Card/form padding (desktop) |
| `2.5` | `20px` | Section spacing |
| `3` | `24px` | Page-level padding |

---

## 4. Breakpoints

| Token | Value | Target |
|---|---|---|
| `xs` | `0px` | Mobile portrait |
| `sm` | `600px` | Mobile landscape |
| `md` | `900px` | Tablet / iPad |
| `lg` | `1200px` | Desktop |
| `xl` | `1536px` | Large desktop |

**Usage:**

```tsx
// In sx prop
sx={{ padding: { xs: '16px', sm: '16px 24px' } }}

// In theme overrides
[theme.breakpoints.down('sm')]: { fontSize: '12px' }
```

---

## 5. Border Radius

Radius is expressed in **multiples of `theme.shape.borderRadius`** (base = 4px by default).

| Token | Multiplier | Computed | Usage |
|---|---|---|---|
| `xxs` | `0.25` | ~1px | Minimal rounding |
| `xs` | `0.5` | ~2px | Subtle rounding |
| `sm` | `0.75` | ~3px | Small elements |
| `md` | `1.0` | 4px | Default |
| `lg` | `1.25` | ~5px | — |
| `xl` | `1.5` | 6px | Dialogs |
| `2xl` | `2.0` | 8px | Cards, buttons, inputs |
| `3xl` | `2.5` | 10px | Large cards |
| `4xl` | `3.0` | 12px | Drawers, modals |
| `full` | `999` | Pill/circle | Chips, avatars |

**Usage:** `sx={{ borderRadius: 2 }}` → 8px (uses `BorderRadiusVariants` via `unstable_sxConfig`).

---

## 6. Elevation / Shadows

The application uses minimal shadow levels:

| Context | Shadow Value |
|---|---|
| Input outline | `0px 1px 2px 0px #1018280D` |
| Input focus ring | `0px 0px 0px 4px ${info[500]}3D` |
| Input error ring | `0px 0px 0px 4px ${error[500]}3D` |
| Dropdown/Menu | `0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08)` |
| AppBar | None (flat) |

---

## 7. Z-Index

| Layer | Value | Source |
|---|---|---|
| Modal / Dialog | `1200` | `theme.zIndex.modal` |
| Drawer | `1200` | `theme.zIndex.drawer` |
| Notification snackbar | `1400` | `NOTIFICATION_Z_INDEX` |
| Popup close button | `9999` | Inline |

---

## 8. Layout Dimensions

| Token | Value | Source |
|---|---|---|
| Sidebar Width (Open) | `264px` | `OpenDrawerWidth` |
| Sidebar Width (Closed) | `80px` | `CloseDrawerWidth` |
| Filter Panel Width | `240px` | `FilterComponentWidth` |
| Header Height | `64px` | Toolbar `minHeight` |
| Toolbar Height (Page) | `68px` | `PageLayout` toolbar |
| Left Context Panel Width | `300px` | CCM Interaction workspace (CONTEXT_CONFIRMED state) |
| NavRail Width | `56px` | CCM collapsed navigation rail |

> **CCM note**: The iDMS platform sidebar (264px / 80px) is not used in CCM. CCM uses a narrow NavRail (56px) and a left context panel (300px) when interaction context is confirmed.

---

## 9. Status Color Mapping

Business statuses are mapped to semantic Chip colors:

| Color | Statuses |
|---|---|
| **info** (blue) | draft, open, inward, assigned, required, awaiting, final inspection, invoiced, inspection started, started |
| **warning** (amber) | in progress, rework, scheduled, rescheduled, created, pending, waiting, work in progress, new |
| **error** (red) | error, cancelled, delay, rejected, expired, fail, pause |
| **success** (green) | ready for work, work completed, inspection completed, ready for invoice, delivered, confirmed, completed, approved, accepted, active, pass, issued |
| **primary** (brand) | start |

Use the utility function `getStatusColor(status)` to resolve any status string to its `ChipProps`.

---

## 10. Token Usage Rules

### UX Designer Agent

- Reference token names in specifications.
- Avoid inventing new visual values for single screens.
- Define semantic intent, not just appearance.

### Frontend Engineer Agent

- Expose tokens through a single theme source.
- Consume tokens through MUI theme or design-system wrappers.
- Reject PRs that introduce visual literals into feature code.

---

## 11. Example Semantic Mapping

| Situation | Token to Use |
|---|---|
| Selected active work item | `primary[50]` (surface) + `primary[500]` (main) |
| Inline validation error | `error[500]` + `error[50]` (error surface) |
| Read-only metadata label | `text.secondary` = `secondary[600]` |
| Divider / subtle border | `secondary[200]` |
| Keyboard focus ring | `info[500]` (see §6 focus ring shadow) |