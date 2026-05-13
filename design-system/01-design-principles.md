# 01 Design Principles

## Purpose
This document defines the UI and UX principles that all CCM interfaces must follow, independent of feature-specific screens. It provides a common language for design and engineering agents so they can make consistent decisions without inventing behavior.

## Agents that use this document
| Agent | How it is used |
|---|---|
| UX Designer Agent | Creates wireframes, flows, and visual specifications consistent with enterprise standards |
| Frontend Engineer Agent | Implements components and layouts without reinterpreting visual intent |
| Product Owner Agent | Reviews whether proposed UI stays inside phase scope and role intent |
| QA Engineer Agent | Verifies consistency, clarity, and usability heuristics in test reviews |

## Scope guardrail
This document defines **how** interfaces should behave visually and structurally. It does **not** define:
- business workflows,
- field lists,
- page-specific layouts,
- case-specific behavior,
- future-phase UI elements.

The foundational design principles governing the **CCM** application.

---

## 1. Core Philosophy

The CCM application is a **multi-module, multi-brand enterprise DMS** built for automotive dealerships. It spans Service, Finance, Spare Parts, Vehicle, and CRM domains. Every design decision is rooted in:

| Principle | Description |
|-----------|-------------|
| **Consistency** | Shared theme tokens (colors, typography, spacing) ensure visual coherence across 57+ feature modules. |
| **Efficiency** | Mobile-first workflows for field staff (service advisors, technicians, final inspectors) with desktop optimization for back-office users. |
| **Scalability** | Atomic Design architecture (`atoms → molecules → templates`) enables rapid feature development without UI drift. |
| **Brand Flexibility** | Multi-brand theming (Bajaj / Product) via `systemColor.ts` allows the same codebase to serve different OEM brands. |
| **Cross-Platform** | A single React 18 codebase deployable as Web, Android, and iOS apps via Capacitor. |

---

## 2. Design Decision Hierarchy

```
Brand Guidelines (Bajaj / Product)
    └── Design-System Base Theme  (design-system/theme/theme.ts)
        │   Full palette, typography, component overrides, sx token config
        └── Product Extension Theme  (apps/web/src/shared/theme/theme.ts)
            │   createTheme(designSystemTheme, { brand primary, CssBaseline, … })
            └── Design Tokens consumed via sx prop  (colors, typography, spacing, radius)
                └── Atomic Components  (design-system/components/atoms → molecules → templates)
                    └── Feature Components  (apps/web/src/features/<name>/)
```

When making design decisions, always resolve **top-down**:
1. Does the brand guideline mandate a specific style? → Use `systemColor`.
2. Does a design token exist for this value? → Use tokens via `sx` prop from the design-system theme.
3. Does a component override handle this? → It is already in the base theme; do not re-declare.
4. Is this CCM-product-specific? → Add to `apps/web/src/shared/theme/theme.ts` extension only.
5. Does an existing atom/molecule cover this? → Reuse it; don't create a new one.
6. Only then → Create a new component / token.

---

## 3. Multi-Brand Architecture

The system supports two brand profiles configured via the `Module` constant in `src/constants.ts`:

| Aspect | **Bajaj** (`isModuleConfig.Bajaj`) | **Product** (`isModuleConfig.Product`) |
|--------|-------------------------------------|----------------------------------------|
| Primary Color | `#0052FF` (Blue) | `#EB6A2C` (Orange) |
| Secondary Color | `#EB6A2C` (Orange) | `#1B1D21` (Dark) |
| Light Theme Color | `#EEF6FF` | `#FFF7F0` |
| Tertiary Text | `#7AB2FF` | `#A8B5C2` |
| Header Background | `systemColor.primary` | `#4E555B` |

> **Rule**: Never hardcode brand-specific colors in components. Always reference `systemColor` from `src/theme/systemColor.ts` for brand-aware values.

---

## 4. Component Authoring Principles

### 4.1 Follow Atomic Design

| Level | Purpose | Examples |
|-------|---------|----------|
| **Atoms** | Smallest reusable UI elements | `InputBox`, `MuiButton`, `MuiCheckbox`, `MuiAccordion` |
| **Molecules** | Compositions of atoms with local logic | `PopupComponent`, `Loader`, `CustomTab`, `SearchBarByTypes` |
| **Templates** | Page-level scaffolding & layouts | `Header`, `Sidebar`, `Layout` |
| **Common** | Cross-cutting shared components | `CommonHeader`, `PageLayout`, `FormFieldWrapper` |

> **Templates vs Common boundary**: Templates are pure page scaffolding — layouts, headers, sidebars — with no business logic. Common components are cross-cutting wrappers (`PageLayout`, `CommonHeader`, `FormFieldWrapper`) reused across multiple features and modules. When adding a new page-level component, place it in **Common** unless it is purely structural shell with zero feature awareness.

### 4.2 Styling Rules

1. **Never use inline hex colors** — always reference palette tokens (`color="primary"`, `color="text.secondary"`).
2. **Use `sx` prop** for one-off styles; prefer theme overrides for repeatable patterns.
3. **Use custom `fontSize` / `fontWeight` tokens** — the theme extends MUI's `sx` config with `FontSizeVariants` (`xs`, `sm`, `base`, `lg`, `xl`, `xxl`) and `FontWeightVariants` (`normal`, `medium`, `strong`).
4. **Use `BorderRadiusVariants`** via the `borderRadius` sx prop instead of raw pixel values.
5. **Leverage MUI breakpoints** (`xs`, `sm`, `md`, `lg`, `xl`) — avoid custom media queries.

### 4.3 Theme Usage Rule — Use Directly, Never Override

The design-system exports a **complete MUI v6 theme** from `design-system/theme/theme.ts`. This theme IS the CCM theme. Applications use it directly — no extension, no override.

```
design-system/theme/theme.ts   ← THE theme — default export, used as-is
apps/web/src/app/App.tsx       ← <ThemeProvider theme={theme}> — wired directly
```

**Correct usage:**

```ts
// ✅ App.tsx — import and use the design-system theme directly
import theme from '../../../../design-system/theme/theme';
<ThemeProvider theme={theme}>

// ❌ Wrong — creating any override or extension in the app
import { createTheme } from '@mui/material';
export const ccmTheme = createTheme(designSystemTheme, { ... }); // do not do this
```

**When a visual value is wrong or missing — fix it in the design-system:**

| Problem | Fix location |
|---|---|
| Wrong color value | `design-system/theme/colors.ts` |
| Wrong palette mapping (main, light, dark) | `design-system/theme/palette.ts` |
| Wrong component default or style override | `design-system/theme/theme.ts` `components` section |
| Missing or wrong token (fontSize, fontWeight, borderRadius) | `design-system/theme/typography.ts` or `dimensions.ts` |

**Never patch a theme problem in a component file or an app-level file.** The fix must live in the design-system so every component benefits.

### 4.5 TypeScript & Code Standards

- All components are written in **TypeScript** (`.tsx`).
- Prefer **functional components** with hooks.
- Use **React Hook Form** for form state management.
- Use **Zustand** stores for global state (`useInteractionStore`, `useAuthStore`, `useAgentStatusStore`).
- Always assign unique `id` attributes to interactive elements for testing and analytics.

---

## 5. State Management Principles

| Layer | Technology | Scope |
|-------|-----------|-------|
| **Server State** | Axios + `@tanstack/react-query` (or direct Axios calls) | API calls, response data |
| **UI + Interaction State** | Zustand (`useInteractionStore`) | Interaction lifecycle, context, wrapup |
| **Auth State** | Zustand (`useAuthStore`) | User session, CSRF token, roles |
| **Agent Status** | Zustand (`useAgentStatusStore`) | Agent availability status |
| **Form State** | React Hook Form | Per-form validation and field management |
| **Navigation** | React Router v7 | Route definitions, search params |

---

## 6. Performance Principles

1. **Lazy-load images** — all `<Avatar>` and `<img>` tags should use `loading="lazy"`.
2. **Code-split by module** — each feature module is a separate directory under `src/features/`.
3. **Optimize bundle** — Vite build with Rollup; manual chunk splitting configured in `vite.config.ts` (react, mui, router, query, zustand).
4. **Service Worker** — Workbox integration for offline capabilities on mobile.
5. **Wake Lock** — Prevents screen sleep on mobile devices during active workflows.

---

## 7. Accessibility Baseline

- All interactive elements must have **`aria-label`** or visible labels.
- Keyboard navigation supported via MUI's built-in accessibility.
- Color contrast follows the MUI default palette structure (50–900 scale ensures adequate contrast at both ends).
- Disabled states use `secondary[50]` background and `secondary[200]` border — providing visible distinction without relying solely on color.

> For detailed accessibility guidelines, see [06-accessibility.md](./06-accessibility.md).

## Design Decision Checklist

> **Scope rule**: Use only what the active phase requires. Do not introduce future-phase UI assumptions into current deliverables.

Before approving any UI artifact, ask:
1. Does this help the current user complete the current task faster?
2. Is the state explicit?
3. Is the layout consistent with existing CCM structure?
4. Is the interaction safe and reversible where needed?
5. Does it avoid introducing future-phase assumptions?
6. Can the frontend team implement it using system components rather than custom one-offs?

## Interpretation notes for UX + Frontend agents
### UX Designer Agent
- Prefer rule-based specifications over descriptive prose.
- Express spacing, states, and interactions with reusable patterns.
- Annotate why a pattern is used, especially in high-risk workflows.

### Frontend Engineer Agent
- Translate these principles into reusable MUI-based primitives.
- Do not create custom visual behaviors unless the design system lacks coverage.
- When in conflict, prioritize consistency and explicit state communication.