# 07 Examples

## Purpose
This document shows how the design-system rules should be combined. The examples are deliberately generic and not tied to a specific feature so that they remain reusable across phases.

## Agents that use this document
| Agent | How it is used |
|---|---|
| UX Designer Agent | Creates new screens by combining existing principles, tokens, components, and layout rules |
| Frontend Engineer Agent | Uses these examples as reference compositions for implementation |
| QA Engineer Agent | Uses them as baseline expectations for state handling and consistency |

## Example 1: Generic search workspace
```text
[Page Header]
  Title
  Page-level status

[Search Panel]
  Search Method
  Search Input
  Search Action

[Results Area]
  Loading State
  Result List or Empty State

[Selected Context Area]
  Read-only summary cards

[Sticky Actions]
  Primary Action
  Secondary Action
```

**Why this works**
- clear progression from input to result to confirmation,
- explicit state visibility,
- reusable for multiple identification tasks.

## Example 2: Generic wrap-up form
```text
[Page Header]
  Title
  Current work status

[Wrap-up Section]
  Controlled select field A
  Controlled select field B
  Controlled select field C
  Conditional remarks area

[Validation Summary if needed]

[Sticky Actions]
  Save
  Cancel / Back
```

**Why this works**
- finalization fields are grouped,
- conditional behavior stays localized,
- validation is easy to understand.

## Example 3: Generic list-detail workspace
```text
[Page Header]
  Title
  Summary count
  Filters

[List/Table]
  Result rows

[Right Detail Panel]
  Read-only metadata
  Activity timeline
  Secondary actions
```

**Why this works**
- user can scan multiple items without losing context,
- reusable pattern for work queues or audit views in later phases.

## Example 4: Generic blocking error
```text
[Page Header]

[Blocking Error Panel]
  What happened
  What this impacts
  What the user can do now
  Retry action
  Secondary support path
```

**Why this works**
- problem and recovery are explicit,
- no hidden next step,
- supports operational resilience.

## Example 5: Generic empty state
```text
[Panel Header]
[Empty State]
  Clear title
  Reason in plain language
  Primary next step
  Optional secondary help text
```

**Why this works**
- avoids vague “No data” messaging,
- gives the user a clear recovery or next action.

## Example 6: Wiring the design-system theme (mandatory pattern)

The design-system theme is used **directly** — no override, no extension. The theme IS complete as defined in `design-system/theme/theme.ts`. If anything needs to change, it is changed in that file, not in the application.

```tsx
// apps/web/src/app/App.tsx

import theme from '../../../../design-system/theme/theme';  // ✅ direct import
import { ThemeProvider, CssBaseline } from '@mui/material';

export function App() {
  return (
    <ThemeProvider theme={theme}>  {/* ✅ use as-is — no wrapping, no createTheme() */}
      <CssBaseline />              {/* applies MuiCssBaseline from design-system theme */}
      {/* routes */}
    </ThemeProvider>
  );
}

// ❌ Never do this — overrides break the design-system contract
import { createTheme } from '@mui/material';
const myTheme = createTheme(theme, { palette: { primary: { main: '#somecolor' } } });
```

**All tokens are already in the design-system theme:**

| Token | Value | How to use in `sx` |
|---|---|---|
| Brand orange | `primary[500]` = `#EB6A2C` | `sx={{ color: 'primary.main' }}` |
| Text primary | `secondary[900]` = `#1B1D21` | `sx={{ color: 'text.primary' }}` |
| Background | `secondary[50]` = `#F4F7FA` | `sx={{ bgcolor: 'background.default' }}` |
| Font size base | 14px | `sx={{ fontSize: 'base' }}` |
| Font weight medium | 500 | `sx={{ fontWeight: 'medium' }}` |
| Border radius 2xl | 8px | `sx={{ borderRadius: 2 }}` |

**When something needs to change**

Fix it in the design-system — not in the application:

```
design-system/theme/colors.ts      ← color shade values
design-system/theme/palette.ts     ← semantic palette mapping
design-system/theme/typography.ts  ← font sizes, weights, variants
design-system/theme/dimensions.ts  ← border radius tokens
design-system/theme/theme.ts       ← component overrides, CssBaseline, zIndex
```

**Why this works**
- One source of truth — all components, all screens, all states share the same tokens.
- Fixes in the design-system propagate everywhere automatically.
- No risk of app-level overrides silently diverging from the design-system.

---

## Interpretation notes for UX + Frontend agents
### UX Designer Agent
- Use these as composition references, not final screens.
- Maintain the same structural order unless there is a compelling workflow reason to change it.

### Frontend Engineer Agent
- Map these patterns to reusable layout and component primitives.
- Feature containers can populate content, but should not alter the structural grammar without review.
- Always use Example 6 as the starting point for any new product that consumes this design system.
