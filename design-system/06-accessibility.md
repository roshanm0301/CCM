# 06 Accessibility

## Purpose
This document sets the accessibility baseline for CCM so that all agents implement usable, keyboard-operable, and assistive-technology-friendly interfaces from the start.

## Agents that use this document
| Agent | How it is used |
|---|---|
| UX Designer Agent | Designs interfaces with accessible states and readable hierarchy |
| Frontend Engineer Agent | Implements semantic markup, keyboard support, and ARIA correctly |
| QA Engineer Agent | Runs accessibility checks as part of functional and regression testing |

## Target standard
Minimum target: **WCAG 2.2 AA** for web application behavior, content contrast, and interaction support.

## Accessibility rules

### 1. Keyboard operability
All interactive controls must be reachable and usable by keyboard.
Requirements:
- logical tab order,
- visible focus indicator,
- no keyboard traps,
- escape support for overlays,
- arrow-key support where standard patterns require it.

### 2. Semantic structure
Use semantic HTML first.
- headings must reflect information hierarchy,
- buttons must be buttons,
- links must be links,
- tables must use table semantics when tabular data is shown,
- lists must use list semantics where appropriate.

### 3. Labels and names
Every form control must have:
- visible label,
- accessible name,
- clear error association,
- helper text association where needed.

### 4. Color and Contrast
- Do not rely on color alone.
- All semantic states must have text/icon/shape support where needed.
- Contrast must meet WCAG AA expectations (minimum 4.5:1 for normal text, 3:1 for large text and UI components).
- Verify contrast ratios for all text-on-background pairings against the palette defined in [`02-tokens.md`](./02-tokens.md) §1 before shipping any new color usage. Pay particular attention to `text.secondary` on `background.secondary` and semantic state colors on their surface counterparts.

### 5. Error handling
Validation must be:
- perceivable,
- specific,
- associated with the correct field,
- programmatically linked where applicable.

### 6. Dynamic content
For asynchronously changing content:
- use ARIA live regions sparingly,
- announce critical state changes,
- avoid excessive chatter for screen reader users.

### 7. Modals and drawers
- focus moves into the container on open,
- focus returns to the trigger on close,
- background content is not interactable,
- dialog purpose is announced clearly.

### 8. Tables and data density
Dense enterprise tables must still support:
- accessible headers,
- row and cell readability,
- keyboard navigation where interactive,
- non-truncated access to full content.

### 9. Responsive zoom and scaling
The UI must remain operable at browser zoom levels typically used for accessibility. Content must not become unusable due to clipping, overlap, or hidden actions.

### 10. Reduced Motion

Respect user preference for reduced motion. Motion should never be required to understand or complete a task.

Implementation: wrap all transitions and animations in a `prefers-reduced-motion` media query. In MUI, override `theme.transitions` to zero durations when the preference is active:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Required engineering checks
- axe or equivalent automated checks in CI
- keyboard smoke test for key workflows
- accessible name verification for controls
- focus order validation on dialogs/drawers/forms
- color contrast review for semantic states

## Interpretation notes for UX + Frontend agents
### UX Designer Agent
- Include focus order and error-state annotations in important flows.
- Do not use placeholder-only input labeling or color-only status communication.

### Frontend Engineer Agent
- Prefer native semantics before custom ARIA.
- Build accessibility into shared components first so feature teams inherit the behavior.
