# 04 Layout

## Purpose
This document defines the structural layout system for CCM screens. It ensures that all pages follow a stable enterprise workspace pattern suitable for task-heavy operations.

## Agents that use this document
| Agent | How it is used |
|---|---|
| UX Designer Agent | Builds consistent page structures and responsive behavior |
| Frontend Engineer Agent | Implements reusable layout shells and breakpoint behavior |
| QA Engineer Agent | Verifies layout consistency and responsive integrity |

## Layout philosophy
CCM is a workspace application. Layout must support:
- clear task focus,
- contextual awareness,
- low navigation churn,
- scan-first behavior,
- predictable action placement.

## Standard page zones
Every major page should be composed from the following zones where relevant:

1. **Global header**  
   Application identity, user/session status, utility actions.

2. **Primary navigation**  
   Role-based navigation to main work areas.

3. **Page header**  
   Page title, current scope, top-level status, page actions.

4. **Primary work area**  
   Main task surface where the user performs the action.

5. **Secondary context area**  
   Related context, linked data, activity, or metadata.

6. **Sticky action area**  
   Primary and secondary actions that must remain easy to access.

7. **Feedback area**  
   Inline banners, blocking states, recovery guidance.

## Canonical layout patterns

### Pattern A: Single work surface
Use when one focused task dominates the page.
```text
[Global Header]
[Page Header]
[Main Task Surface]
[Sticky Actions]
```

### Pattern B: Split workspace
Use when the user needs active work and contextual reference together.
```text
[Global Header]
[Page Header]
[Primary Work Area | Secondary Context Panel]
[Sticky Actions]
```

### Pattern C: Table with detail panel
Use for list/detail workflows.
```text
[Global Header]
[Page Header]
[Filters]
[Table/List]
[Optional Detail Drawer or Side Panel]
```

### Pattern D: Guided sequence
Use for structured steps with clear progression.
```text
[Global Header]
[Page Header]
[Step Indicator]
[Step Content]
[Sticky Step Actions]
```

## Width and Spacing Rules

- Width is governed by the breakpoint scale in [`02-tokens.md`](./02-tokens.md) §4. Fluid layout that fills available width is the default; constrain content width at the `lg` breakpoint (1200px) and above using theme-aware container wrappers rather than one-off `max-width` values.
- Sidebar widths are fixed tokens: open **264px** (`OpenDrawerWidth`), closed **80px** (`CloseDrawerWidth`) — see [`02-tokens.md`](./02-tokens.md) §8.
- Keep page gutters consistent across breakpoints using spacing tokens from [`02-tokens.md`](./02-tokens.md) §3.
- Separate content blocks with spacing tokens, not ad hoc margins.
- Avoid placing unrelated panels in the same horizontal row unless they serve the same decision.

> Use layout primitives from [`03-components.md`](./03-components.md) §4 (`Header`, `Sidebar`, `Layout`) and §5 (`PageLayout`) to implement these rules — do not recreate structural shells in feature pages.

## Responsive rules
### Desktop
- Primary operating target.
- Prefer split panels where context is frequently referenced.
- Keep high-value metadata visible without excessive scrolling.

### Tablet
- Collapse secondary panels into drawers or stacked sections.
- Keep primary action area reachable without losing context.

### Mobile
Mobile support is allowed but not the primary operational target for dense agent workflows.
- Stack panels vertically.
- Reduce visible metadata to essentials.
- Avoid multi-column forms.

## Sticky behavior
Sticky zones are allowed for:
- page actions,
- persistent filters,
- active status strips,
- context summaries.

Do not overuse sticky behavior. Too many fixed regions reduce usable work height.

## Scroll rules
- Prefer one dominant scroll region per page.
- Avoid nested scrolling except for bounded panels like tables or drawers.
- Ensure headers and action bars do not hide field-level validation or keyboard focus.

## Empty, loading, and error layout treatment
Reserve consistent locations for:
- page-level blocking state,
- panel-level loading,
- empty-state guidance,
- retry actions.

## Interpretation notes for UX + Frontend agents
### UX Designer Agent
- Select the page pattern first, then place components.
- Do not create a unique structure for every screen.

### Frontend Engineer Agent
- Implement layout primitives such as `PageShell`, `PageHeader`, `SplitLayout`, `StickyActionBar`, `ContextPanel`.
- Handle responsive transitions at the layout level, not with repeated one-off page hacks.
