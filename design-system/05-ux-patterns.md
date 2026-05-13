# 05 UX Patterns

## Purpose
This document defines the cross-screen interaction patterns that CCM must use repeatedly. These are not feature requirements; they are reusable behavioral patterns for enterprise workflows.

## Agents that use this document
| Agent | How it is used |
|---|---|
| UX Designer Agent | Specifies flows using approved interaction patterns |
| Frontend Engineer Agent | Builds reusable interaction structures with predictable behavior |
| QA Engineer Agent | Tests consistency of search, selection, validation, and recovery patterns |

## Pattern catalog

### 1. Search and select
Use when the user must find and choose a record from structured sources.

**Pattern**
1. User selects one search method.
2. User enters a value.
3. System validates basic input before execution.
4. System shows loading state.
5. System returns result list, empty state, or error.
6. User explicitly selects one result when ambiguity exists.
7. System confirms active context visibly.

**Rules**
- Do not auto-select when ambiguity exists.
- Preserve search input until the user changes it.
- Show the active selection clearly.
- Support retry and reselection.

### 2. Context confirmation
Use when selected context must be visible before the user proceeds.

**Pattern**
- Show a read-only summary of the active record(s).
- Highlight what was selected by the user versus what was derived by the system.
- Clearly indicate missing or unavailable linked data.

### 3. Progressive wrap-up
Use when a task ends with controlled metadata capture.

**Pattern**
1. User finishes the main task.
2. UI transitions into wrap-up state.
3. Required closing fields are shown together.
4. Conditional remarks appear only when triggered.
5. User can save only when required data is complete.

### 4. Explicit reselection
Use when a user may need to replace current context without restarting the whole page.

**Rules**
- Make reselection possible from the same workspace.
- Warn only if data loss risk exists.
- Refresh dependent panels immediately after reselection.

### 5. Validation and recovery
Use for user-correctable issues.

**Rules**
- Field-level issues appear next to the field.
- Form-level issues appear in a summary only when needed.
- Every blocking error must tell the user what to do next.
- Preserve user-entered data where safe.

### 6. Unavailable data
Use when linked data is missing or upstream systems fail.

**Rules**
- Distinguish:
  - no data exists,
  - data could not be loaded,
  - user has no access,
  - data is intentionally masked.
- Do not show the same empty-state message for all causes.

### 7. Activity trace
Use when historical or audit context supports a current task.

**Rules**
- Use chronological ordering.
- Show event name, time, actor, and concise description.
- Secondary detail can expand on demand.

### 8. Destructive or Irreversible Action

Use confirmation dialogs only when:
- action is irreversible,
- action causes state loss,
- action affects a shared operational record.

Do not confirm routine actions that happen frequently and safely.

> **Component**: Use `CustomAlertPopup` (see [`03-components.md`](./03-components.md) §3.4) for all confirmation and warning dialogs. Do not build one-off alert modals.

## Pattern Anti-Rules

Do not use:
- hidden mandatory fields,
- ambiguous save actions,
- silent failures,
- decorative motion,
- overloaded forms with unrelated decisions,
- one-off validation messaging styles,
- toasts for critical or persistent errors — toasts are for ephemeral confirmation only (auto-dismiss: success **1s**, error **10s**; see [`03-components.md`](./03-components.md) §3.7).

## Interpretation notes for UX + Frontend agents
### UX Designer Agent
- Express these patterns in task flows and screen annotations.
- Reuse the same interaction grammar across phases.

### Frontend Engineer Agent
- Implement patterns as reusable containers or hooks where practical.
- Keep error/loading/empty handling standardized.
