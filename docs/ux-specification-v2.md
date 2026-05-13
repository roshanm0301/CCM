# CCM Phase 1 — UX Specification v2

**Document owner:** UX Designer Agent
**Status:** Authoritative — frontend implementation source of truth
**Phase:** Phase 1 (Agent Interaction Foundation) only
**Last updated:** 2026-03-22

---

## How to Read This Document

Every section follows this structure:

1. UX objective
2. Consumed source constraints
3. Information hierarchy
4. Interaction states
5. Component mapping to design system
6. Accessibility notes
7. Frontend handoff notes

Token names are referenced exactly as defined in `design-system/02-tokens.md`. No hex values appear in component specifications; all colors are expressed as token names. Hex values appear only in the Color/Token Map table that cross-references the token name to its computed value for the frontend engineer's convenience.

Phase 1 scope is enforced throughout. Features marked as Phase 2+ in the task brief are explicitly noted as excluded and must not be implemented in any screen.

---

## Global Token Reference

The following tokens are used repeatedly across all screens. The frontend engineer must configure them in the MUI theme before implementing any screen.

### Color Tokens

| Token Name | Computed Hex | Usage |
|---|---|---|
| `secondary[900]` | `#1B1D21` | Global header background; primary dark text |
| `secondary[600]` | `#6A7682` | Supporting text, metadata labels, icon fills |
| `secondary[500]` | `#8593A3` | Placeholder text, captions |
| `secondary[300]` | `#C3CCD6` | Disabled text |
| `secondary[200]` | `#DEE4EB` | Dividers, subtle borders |
| `secondary[100]` | `#EFF2F5` | Hover states on dark surfaces |
| `secondary[50]` | `#F4F7FA` | Page background, nested panels |
| `background.paper` | `#FFFFFF` | Card and surface backgrounds |
| `warning[600]` | `#CC7A00` | Phone/call status icon color |
| `warning[400]` | `#FFBC33` | Status border for "Ready for Calls" chip |
| `warning[200]` | `#FFDD99` | Status chip background variant |
| `warning[50]` | `#FFFAEB` | Pending announcement badge background |
| `warning[300]` | `#FEC84B` | Pending announcement badge border |
| `warning[700]` | `#B54708` | Pending announcement badge text |
| `success[500]` | `#52C41A` | Ready for Calls dot; acknowledged badge text |
| `success[50]` | `#ECFDF3` | Acknowledged announcement badge background |
| `success[200]` | `#ABEFC6` | Acknowledged announcement badge border |
| `success[600]` | `#067647` | Acknowledged announcement badge text |
| `error[500]` | `#F5222D` | Break dot indicator |
| `info[500]` | `#3697FF` | Training dot indicator; keyboard focus ring |
| `primary[500]` | `#EB6A2C` | Brand orange — primary buttons, CTAs, active nav, links |
| `primary[200]` | `#F4B07D` | Status chip border (Ready for Calls), outlined button border |
| `primary[50]` | `#FFF7F0` | Announcement modal content body background |

### Typography Tokens

| Token | Value | Usage |
|---|---|---|
| `fontSize: 'xxl'` | 20px / 28px | Page headings |
| `fontSize: 'xl'` | 18px / 28px | Section headings |
| `fontSize: 'lg'` | 16px / 24px | Nav items, input fields |
| `fontSize: 'base'` | 14px / 20px | Body text, table data |
| `fontSize: 'sm'` | 12px / 18px | Captions, metadata, badge labels |
| `fontSize: 'xs'` | 10px / 16px | Micro labels |
| `fontWeight: 'normal'` | NotoSans-Regular 400 | Default body |
| `fontWeight: 'medium'` | NotoSans-Medium 500 | Labels, nav items |
| `fontWeight: 'strong'` | NotoSans-Semibold 600 | Headings, emphasis |

### Spacing Tokens (MUI `sx` values)

| `sx` Value | Pixels |
|---|---|
| `0.5` | 4px |
| `1` | 8px |
| `1.5` | 12px |
| `2` | 16px |
| `2.5` | 20px |
| `3` | 24px |

### Border Radius Tokens

| Usage | `sx` Value | Computed |
|---|---|---|
| Buttons, inputs, cards | `2` | 8px |
| Modal container | `4` | 12px (using `borderRadius: '4xl'`) |
| Inner content cards | `2` | 8px |
| Chips / avatars | `'full'` | pill |

### Layout Dimension Tokens

| Token | Value |
|---|---|
| Global header height | `64px` |
| Left nav rail width (collapsed) | `80px` (`CloseDrawerWidth`) |
| Left nav rail width (open) | `264px` (`OpenDrawerWidth`) |
| Call status bar height | `48px` |

---

## Screen 1: Login Page

### UX Objective

Provide a focused, distraction-free authentication entry point that preserves all existing login logic while adopting the brand visual language: dark brand strip at top, centered card, `secondary[900]` background area, orange primary action.

### Consumed Source Constraints

- `apps/web/src/pages/LoginPage.tsx` — all business logic is preserved unchanged
- `design-system/02-tokens.md` §1, §2, §5
- `design-system/06-accessibility.md` §1, §3, §5
- Phase 1 scope: no SSO, no "Forgot Password" link, no multi-factor step

### Layout Pattern

Pattern A: Single work surface — no header, no navigation.

### Page Zones

| Zone | Content |
|---|---|
| 1. Global header | Not rendered on this screen |
| 2. Primary navigation | Not rendered on this screen |
| 3. Page header | Not rendered — brand identity sits inside the card |
| 4. Primary work area | Centered login card |
| 5. Secondary context area | Not rendered |
| 6. Sticky action area | Sign In button (inside card, not sticky) |
| 7. Feedback area | Session-expired alert, API error alert, field-level helper text |

### Information Hierarchy

1. 4px brand color strip fixed at top of viewport (desktop only)
2. Full-viewport background: `background.default` (`secondary[50]`)
3. Centered card: `background.paper`, `borderRadius: 2` (8px), `elevation: 0`, `variant="outlined"`, border `secondary[200]`
4. Inside card top-to-bottom:
   - Brand mark: 48x48 circular avatar, background `primary[500]`, white "CCM" text, `fontWeight: 'strong'`
   - App title: `h1`, `fontSize: 'xl'` (18px), `fontWeight: 'medium'`, `text.primary`, centered
   - Session-expired alert (conditional): MUI `Alert` `severity="warning"` `variant="outlined"`
   - API error alert (conditional): MUI `Alert` `severity="error"` `variant="outlined"`, `role="alert"`
   - User ID field: MUI `TextField` `size="small"`, label "User ID", `autoFocus`
   - Password field: MUI `TextField` `size="small"`, label "Password", visibility toggle
   - Sign In button: MUI `Button` `variant="contained"` `color="primary"` `size="large"` `fullWidth`
5. Linear progress bar at card top edge during submission

### Component Specification Table

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Page background | MUI `Box` `component="main"` | `bgcolor: 'background.default'`, `minHeight: '100vh'`, flex center | — | `role="main"` implicit from `component="main"` |
| Brand strip | CSS `::before` pseudo | `height: 4px`, `bgcolor: 'primary.main'`, `position: fixed`, `top: 0`, `display: {xs: 'none', lg: 'block'}` | — | `aria-hidden` via pseudo-element |
| Login card | MUI `Card` | `elevation={0}` `variant="outlined"`, `width: {xs:'100%', md:400}`, `borderRadius: 2`, `border: 1px solid secondary[200]` | Default | — |
| Loading bar | MUI `LinearProgress` | `sx={{height: 3}}`, shown when `submitting === true` | Visible / hidden | `aria-label="Signing in"` |
| Brand mark | MUI `Box` (circle) | 48x48, `borderRadius: 'full'`, `bgcolor: 'primary.main'` | — | `aria-hidden="true"` |
| App title | MUI `Typography` `variant="h2"` `component="h1"` | "Call Centre Management", `fontSize: 'xl'`, `fontWeight: 'medium'`, `color: 'text.primary'`, centered | — | `h1` — only heading on page |
| Session expired alert | MUI `Alert` | `severity="warning"` `variant="outlined"`, shown when `?reason=session_expired` and no API error | Visible / hidden | `role="alert"` |
| API error alert | MUI `Alert` | `severity="error"` `variant="outlined"` | Visible / hidden | `role="alert"` |
| User ID field | MUI `TextField` | `id="login-username"`, `label="User ID"`, `size="small"`, `autoComplete="username"`, `autoFocus`, `fullWidth`, `required` | Default / Error / Disabled | `aria-describedby="username-error"` when error; `FormHelperText` `id="username-error"` `role="alert"` |
| Password field | MUI `TextField` | `id="login-password"`, `label="Password"`, `type="password"`, `size="small"`, `autoComplete="current-password"`, `fullWidth`, `required` | Default / Error / Disabled / Show-password | `aria-describedby="password-error"` when error; `FormHelperText` `id="password-error"` `role="alert"` |
| Password toggle | MUI `IconButton` | `tabIndex={-1}`, `edge="end"`, `size="small"`, `aria-label="Toggle password visibility"` | Toggled / Default | `aria-label` dynamically reflects state |
| Sign In button | MUI `Button` | `id="login-submit"`, `variant="contained"`, `color="primary"`, `size="large"`, `fullWidth`, `type="submit"` | Default / Loading / Disabled | `aria-label="Sign in to CCM"` |

### Color / Token Map

| Element | Token |
|---|---|
| Page background | `background.default` |
| Card background | `background.paper` |
| Card border | `secondary[200]` |
| Brand strip | `primary[500]` |
| Brand mark circle | `primary[500]` |
| Brand mark text | `#FFFFFF` (white, semantic "on-primary") |
| App title text | `text.primary` |
| Sign In button background | `primary[500]` |
| Sign In button text | `#FFFFFF` |
| Error alert border/icon | `error[500]` |
| Warning alert border/icon | `warning[500]` |
| Field error text | `error[500]` |
| Disabled field background | `secondary[50]` |
| Disabled field border | `secondary[200]` |

### Responsive Behavior

| Breakpoint | Changes |
|---|---|
| `xs` (0px+) | Card: full width, padding `sx={p: 2}`, brand strip hidden |
| `md` (900px+) | Card: `maxWidth: 400px`, padding `sx={p: 3}` |
| `lg` (1200px+) | Brand strip visible at top |

### State Table

| State | What Renders |
|---|---|
| Default (fresh load) | Card with brand mark, title, User ID field focused, empty fields, Sign In button enabled |
| Session expired redirect | Yellow warning alert visible above form |
| Field validation error | Red helper text beneath failing field; focus moved to first failing field |
| Submitting | LinearProgress at card top, Sign In button disabled with label "Signing in…", all fields disabled |
| API error | Red error alert above form; focus returned to User ID field |
| Already authenticated | Redirects to `/workspace` immediately (no flash of login card) |

### Accessibility

- Focus order: User ID field (auto-focused) → Password field → Sign In button → Password toggle (tabIndex=-1, excluded from natural tab order)
- `Enter` on any field submits the form (`form onSubmit`)
- All errors announce via `role="alert"` on `FormHelperText` and `Alert`
- Errors are `aria-describedby`-linked to their field
- `prefers-reduced-motion`: `LinearProgress` animation should respect `@media (prefers-reduced-motion: reduce)`
- Color contrast: `primary[500]` text on `background.paper` meets 3:1 for large text; white text on `primary[500]` button meets 4.5:1

### Frontend Handoff Notes

- The app title must read "Call Centre Management" (matching reference Screen 1 header) not the current "CCM — Customer Contact Management". Update the `Typography` content in `LoginPage.tsx`.
- The brand mark circle should contain "CCM" in white text using `fontWeight: 'strong'` and `fontSize: 'sm'` (12px).
- No other logic changes. All API calls, error handling, navigation, and validation remain exactly as in the current `LoginPage.tsx`.
- The brand strip `::before` pseudo is desktop-only (`display: { xs: 'none', lg: 'block' }`).

---

## Screen 2: Global Header

### UX Objective

Implement a dark `secondary[900]` (`#1B1D21`) application bar that matches reference Screen 3 exactly, replacing the current light `background.paper` header. The header contains: app grid icon (9-dot), app title "Call Centre Management", agent name + location, notification bell, announcements megaphone icon, and agent avatar. The header is persistent on all authenticated screens.

### Consumed Source Constraints

- `apps/web/src/shared/components/GlobalHeader.tsx` — current implementation to be updated
- `design-system/reference-ux/3-agent.md` §2A — header breakdown
- `design-system/reference-ux/3.Agent.png` — visual reference
- `design-system/02-tokens.md` §1.4, §8
- Phase 1 scope: no live call controls (mic, pause, keypad, end call), no incoming number, no call timer

### Layout Pattern

MUI `AppBar` `position="fixed"` `component="header"`.

### Page Zones

| Zone | Content |
|---|---|
| 1. Global header | This entire screen |

### Information Hierarchy

Left-to-right layout within the 64px-tall AppBar:

1. App grid icon (9-dot, `GridViewOutlined`) — module switcher placeholder, icon-only, white
2. App title: "Call Centre Management" — white text, `fontSize: 'lg'`, `fontWeight: 'strong'`
3. Flexible spacer (`flex: 1`)
4. Agent name ("Jethalal Gada" / `user.displayName`) — white, `fontSize: 'sm'`
5. Agent location (sub-line beneath name) — `secondary[400]` / light grey, `fontSize: 'xs'`
6. Notification bell icon — white, MUI `NotificationsOutlined`
7. Announcements megaphone icon — white, use custom SVG `announcement-02.svg` or MUI `CampaignOutlined`
8. Agent avatar — 32x32 circular, image or initials fallback

### Component Specification Table

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| AppBar | MUI `AppBar` | `position="fixed"`, `component="header"`, `elevation={0}`, `sx={{ bgcolor: 'secondary[900]', height: 64, borderBottom: 'none' }}` | — | — |
| Toolbar | MUI `Toolbar` | `sx={{ height: 64, minHeight: '64px !important', px: { xs: 1.5, md: 2 }, gap: 1.5 }}` | — | — |
| App grid icon | MUI `IconButton` | `icon: GridViewOutlined`, `size="small"`, `sx={{ color: '#FFFFFF' }}` | Default / Hover | `aria-label="App menu"` |
| App title | MUI `Typography` | `"Call Centre Management"`, `component="span"`, `sx={{ color: '#FFFFFF', fontSize: 'lg', fontWeight: 'strong', display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}` | — | — |
| Spacer | MUI `Box` | `sx={{ flex: 1 }}` | — | `aria-hidden="true"` |
| Agent identity block | MUI `Box` | flex column, `alignItems: 'flex-end'`, `display: { xs: 'none', md: 'flex' }` | — | — |
| Agent name | MUI `Typography` | `user.displayName`, `sx={{ color: '#FFFFFF', fontSize: 'sm', fontWeight: 'medium', lineHeight: '18px' }}` | — | `aria-label="Signed in as {displayName}"` |
| Agent location | MUI `Typography` | Static text "Inbound Queue" or user's queue assignment, `sx={{ color: 'secondary[400]', fontSize: 'xs', lineHeight: '16px' }}` | — | `aria-hidden="true"` |
| Notification bell | MUI `IconButton` | `icon: NotificationsOutlined`, `size="small"`, `sx={{ color: '#FFFFFF' }}` | Default / Active (with badge dot) | `aria-label="Notifications"` |
| Announcements icon | MUI `IconButton` | `icon: CampaignOutlined` or `announcement-02.svg`, `size="small"`, `sx={{ color: '#FFFFFF' }}` | Default | `aria-label="Announcements"` |
| Agent avatar | MUI `Avatar` | `sx={{ width: 32, height: 32, fontSize: 'sm', bgcolor: 'primary[500]' }}`, initials from `displayName` if no image, `loading="lazy"` | Default | `aria-label="Agent profile"` |

### Color / Token Map

| Element | Token |
|---|---|
| AppBar background | `secondary[900]` |
| App title text | `#FFFFFF` (on-dark) |
| Agent name text | `#FFFFFF` |
| Agent location text | `secondary[400]` |
| All icon fills | `#FFFFFF` |
| Agent avatar background (fallback) | `primary[500]` |
| Agent avatar text (initials) | `#FFFFFF` |
| AppBar bottom border | None — flat |

### Responsive Behavior

| Breakpoint | Changes |
|---|---|
| `xs` (0px+) | App title hidden, agent identity block hidden, show only grid icon + bell + announcements + avatar |
| `sm` (600px+) | App title visible |
| `md` (900px+) | Agent identity block (name + location) visible |

### State Table

| State | What Renders |
|---|---|
| Authenticated, idle | Full header: grid icon, title, spacer, agent name+location, bell, megaphone, avatar |
| Authenticated, interaction active | Same header |
| Logging out | Header remains visible during logout POST; clears after navigation to `/login` |
| `xs` mobile | Grid icon + bell + megaphone + avatar only; title and agent name truncated |

### Accessibility

- AppBar is `role="banner"` (implicit from `<header>`)
- Keyboard: Tab stops at grid icon, bell, megaphone, avatar — all `IconButton` components
- Agent name `Typography` is not a Tab stop; it is descriptive text
- Focus ring: `info[500]` with 4px box-shadow (theme default)
- Screen reader: agent identity announced via `aria-label` on the avatar

### Frontend Handoff Notes

- Replace the current `GlobalHeader.tsx` entirely. The `bgcolor` changes from `background.paper` to `secondary[900]`.
- Remove the `LogoutIcon` / Sign Out button from the header. Logout moves to the agent avatar dropdown menu (click avatar → menu with "Sign out" option) — this keeps the header visually clean and consistent with the reference.
- The `AgentStatusWidget` moves out of the global header and into the Call Status Bar (Screen 3, zone 3).
- The current header shows "CCM" as the app title; update to "Call Centre Management".
- Use `sx={{ color: '#FFFFFF' }}` for icons — do not use `color="inherit"` as it will inherit dark context text in some contexts.
- The header height token `64px` is a layout constraint used by all screens' `pt` offset calculations.
- All `IconButton` components receive `size="small"` (20px icon).
- The announcements megaphone click handler should open the Announcements popup (Screen 5). Wire this after Screen 5 is implemented.

---

## Screen 3: Left Navigation Rail

### UX Objective

Implement a narrow, icon-only navigation strip on the left edge of all authenticated screens, matching the visual style of reference Screen 3. The rail is 80px wide (collapsed state) and contains stacked module icons with the active state indicated by a `primary[500]` left-edge vertical bar. The brand logo mark appears at the bottom.

### Consumed Source Constraints

- `design-system/reference-ux/3-agent.md` §2B
- `design-system/reference-ux/3.Agent.png` — left edge rail visible
- `design-system/02-tokens.md` §8 (`CloseDrawerWidth = 80px`)
- `design-system/03-components.md` §4.3 Sidebar
- Phase 1: only the single active module (CCM workspace) is present — no other modules are navigable

### Layout Pattern

Persistent left drawer (collapsed state always) — 80px wide, full viewport height minus header (64px).

### Page Zones

| Zone | Content |
|---|---|
| 2. Primary navigation | This entire screen |

### Information Hierarchy

Top-to-bottom layout within the 80px rail:

1. Top section: stacked icon buttons — Home (active in idle state), workspace icon
2. Bottom section: brand logo mark (circular, orange/dark stripes, or "CCM" monogram)

For Phase 1, the rail contains only the workspace home icon. The active icon is visually distinguished with a `primary[500]` 3px left-edge bar and a `primary[50]` background tile.

### Component Specification Table

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Rail container | MUI `Drawer` `variant="permanent"` | `sx={{ width: 80, flexShrink: 0 }}`, `PaperProps={{ sx: { width: 80, bgcolor: 'secondary[900]', borderRight: 'none', pt: '64px' } }}` | — | `aria-label="Primary navigation"` on inner `nav` |
| Nav wrapper | HTML `nav` | `role="navigation"`, `aria-label="Primary navigation"` | — | — |
| Icon list | MUI `List` | `sx={{ p: 0 }}` | — | — |
| Home icon button | MUI `ListItemButton` | `sx={{ justifyContent: 'center', py: 1.5, position: 'relative' }}`, `selected` boolean drives active style | Default / Active | `aria-label="Home workspace"`, `aria-current="page"` when active |
| Active left bar | MUI `Box` | `position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: 'primary[500]'`, visible only when `selected` | Active only | `aria-hidden="true"` |
| Home icon | MUI `HomeOutlined` or custom `home-05.svg` | `sx={{ color: active ? 'primary[500]' : 'secondary[400]', fontSize: 22 }}` | Active / Inactive | `aria-hidden="true"` (label is on `ListItemButton`) |
| Brand logo | MUI `Box` at bottom | `position: 'absolute', bottom: 16`, circular 36x36, `bgcolor: 'primary[500]'`, "CCM" monogram, or use `LogoComponent` | — | `aria-label="CCM brand mark"`, `aria-hidden="true"` if purely decorative |

### Color / Token Map

| Element | Token |
|---|---|
| Rail background | `secondary[900]` |
| Inactive icon fill | `secondary[400]` |
| Active icon fill | `primary[500]` |
| Active left bar | `primary[500]` |
| Active icon tile background | `primary[50]` at 10% opacity |
| Brand logo background | `primary[500]` |
| Brand logo text | `#FFFFFF` |

### Responsive Behavior

| Breakpoint | Changes |
|---|---|
| `xs` (0px+) | Rail hidden — navigation not shown on mobile (mobile targets not in Phase 1 scope for dense agent workflows) |
| `md` (900px+) | Rail visible, 80px wide, permanent |

### State Table

| State | What Renders |
|---|---|
| Idle workspace | Home icon active (left bar + `primary[500]` icon fill) |
| Interaction in progress | Home icon remains active |
| No other navigation items in Phase 1 | Rail shows only Home icon |

### Accessibility

- `<nav>` element with `aria-label="Primary navigation"` wraps the icon list
- Active item: `aria-current="page"` on the `ListItemButton`
- Each icon button has a descriptive `aria-label` — never icon-only without an accessible name
- Keyboard: Tab reaches the nav rail; arrow keys move between items within the list
- Focus ring: `info[500]` 4px ring (theme default), visible on dark background — ensure `outline-offset: -2px` on dark surfaces for visibility

### Frontend Handoff Notes

- Implement as a MUI `Drawer variant="permanent"` with `PaperProps` setting `bgcolor: 'secondary[900]'`.
- The `pt: '64px'` on the Paper ensures content starts below the fixed `AppBar`.
- For Phase 1, a single `ListItemButton` is sufficient — no dynamic routing needed beyond the workspace route.
- The rail does not open or expand in Phase 1 — it is always 80px (collapsed). Do not implement the open state until Phase 2 requires it.
- The main content area must apply `ml: '80px'` on `md+` to offset the permanent rail.
- Reference the `home-05.svg` asset from `design-system/reference-ux/1-Landing-screen.md` §2.1. If that SVG is unavailable, use MUI `HomeOutlined`.

---

## Screen 4: Landing Screen (Idle Workspace)

### UX Objective

Replace the current minimal `IdleWorkspace.tsx` centered card with a full-layout landing screen matching reference Screen 1. The screen has three structural columns: (a) narrow left nav rail (Screen 3), (b) main content area with call status bar, performance overview section, and announcements feed, (c) right agent profile sidebar. Phase 2+ features (real performance metrics with live data, WebSocket queue counter) are replaced with Phase 1-safe static/mock treatments.

### Consumed Source Constraints

- `design-system/reference-ux/1.Landing-screen.png` — primary visual reference
- `design-system/reference-ux/1-Landing-screen.md` — annotated breakdown
- `apps/web/src/features/workspace/IdleWorkspace.tsx` — interaction start logic preserved
- `apps/web/src/features/agent-status/AgentStatusWidget.tsx` — status widget logic preserved
- `design-system/02-tokens.md`, `04-layout.md`, `05-ux-patterns.md`
- Phase 1 exclusions: no real-time WebSocket for queue counter, no live performance metrics with real data (display static "—" placeholders for calls handled / AHT), no CTI

### Layout Pattern

Pattern B: Split workspace — `[Nav Rail] | [Main Content] | [Agent Sidebar]`

### Page Zones

| Zone | Content |
|---|---|
| 1. Global header | Screen 2 — `secondary[900]` dark header |
| 2. Primary navigation | Screen 3 — 80px left rail |
| 3. Page header | Call Status Bar (sticky, 48px, below global header) |
| 4. Primary work area | Announcements section (scrollable center column) |
| 5. Secondary context area | Agent profile sidebar (right, fixed width 280px) |
| 6. Sticky action area | Start New Interaction button within Agent Sidebar |
| 7. Feedback area | Error Alert if interaction start fails |

### Information Hierarchy

**Call Status Bar (Zone 3 — sticky, 48px height):**
1. Phone icon (`warning[600]` color) + status text: "Waiting For Incoming Call!" or "Interaction in Progress"
2. Calls in queue counter label: "Calls are in queue" + count badge "04" (Phase 1: static mock value, no WebSocket)
3. "Update Status" label
4. `AgentStatusWidget` dropdown (styled with `primary[200]` border)

**Main Content Area (Zone 4 — scrollable):**
1. Performance Overview sub-section header with time filter dropdown
   - "Calls Handled" card: large metric display — Phase 1 shows "—" (em dash placeholder)
   - "Average Handle Time" card: Phase 1 shows "—" placeholder
   - Note for frontend: render the card shells but display "—" and a `Typography` caption "Data not available in Phase 1"
2. Announcements section:
   - Section icon + "Announcements" heading
   - Tabs: All (N) / Pending (N) / Acknowledged (N)
   - Announcement card list (scrollable)

**Agent Sidebar (Zone 5 — right, 280px, fixed):**
1. Agent name: `user.displayName`
2. Agent ID: `user.username` or ID (e.g., "ES-1199")
3. Queue assignment: "Inbound Queue" (static Phase 1)
4. Time Tracker: segmented horizontal bar (color-coded segments per status)
5. Status legend + time log list

### Component Specification Table

#### Call Status Bar

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Status bar container | MUI `Box` `component="div"` | `position: 'sticky'`, `top: 64`, `zIndex: theme.zIndex.appBar - 1`, `height: 48`, `bgcolor: 'background.paper'`, `borderBottom: '1px solid secondary[200]'`, `display: 'flex'`, `alignItems: 'center'`, `px: 2`, `gap: 2` | — | `role="status"` `aria-label="Call status bar"` |
| Phone icon | MUI `PhoneInTalkOutlined` | `sx={{ color: 'warning[600]', fontSize: 20 }}` | — | `aria-hidden="true"` |
| Status text | MUI `Typography` | `"Waiting For Incoming Call!"` or `"Interaction in Progress"` based on `interactionId` in store, `fontSize: 'sm'`, `fontWeight: 'medium'`, `color: 'text.primary'` | Idle / Active | `aria-live="polite"` `aria-atomic="true"` |
| Sub-text | MUI `Typography` | `"You will be automatically connected to the next available caller"` (static Phase 1), `fontSize: 'xs'`, `color: 'text.secondary'` | — | — |
| Queue counter | MUI `Box` | `display: {xs: 'none', md: 'flex'}`, `alignItems: 'center'`, `gap: 0.5` | — | `aria-label="Calls in queue"` |
| Queue count badge | MUI `Chip` | Static "04" mock value, `color: "default"`, `size: "small"`, `variant: "outlined"` | — | — |
| Queue label | MUI `Typography` | `"Calls are in queue"`, `fontSize: 'sm'`, `color: 'text.secondary'` | — | — |
| Update status label | MUI `Typography` | `"Update status:"`, `fontSize: 'sm'`, `color: 'text.secondary'`, `display: {xs: 'none', md: 'block'}` | — | — |
| Agent status widget | `AgentStatusWidget` | Restyled: chip `border: '1.5px solid primary[200]'`, `bgcolor: 'background.paper'`, dropdown opens below | Default / Updating | See Screen 4 AgentStatusWidget restyling |

#### Performance Overview (Phase 1 placeholder only)

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Section header | MUI `Typography` | `"Performance overview"`, `variant="h3"`, `fontSize: 'base'`, `fontWeight: 'strong'`, `color: 'text.primary'` | — | `component="h2"` |
| Metric cards row | MUI `Box` | `display: 'flex'`, `gap: 2`, `flexWrap: 'wrap'` | — | — |
| Calls Handled card | MUI `Card` | `elevation={0}` `variant="outlined"`, `borderRadius: 2`, `p: 2`, `minWidth: 160` | — | — |
| Calls Handled value | MUI `Typography` | `"—"`, `fontSize: 'xxl'`, `fontWeight: 'strong'`, `color: 'text.primary'` | Phase 1 placeholder | `aria-label="Calls handled: data not available"` |
| Calls Handled label | MUI `Typography` | `"Calls Handled"`, `fontSize: 'xs'`, `color: 'text.secondary'` | — | — |
| AHT card | Same structure | `"—"` placeholder | Phase 1 placeholder | `aria-label="Average handle time: data not available"` |
| Phase 1 note | MUI `Typography` | `"Live data available in a future phase"`, `fontSize: 'xs'`, `color: 'text.tertiary'`, `fontStyle: 'italic'` | — | — |

#### Announcements Section

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Section container | MUI `Box` `component="section"` | `bgcolor: 'background.secondary'` (`secondary[50]`), `borderRadius: 2`, `p: 2` | — | `aria-label="Announcements"` |
| Section header row | MUI `Box` | `display: 'flex'`, `alignItems: 'center'`, `gap: 1`, `mb: 1.5` | — | — |
| Announcement icon | Custom SVG `announcement-02.svg` or MUI `CampaignOutlined` | `sx={{ color: 'secondary[600]', fontSize: 20 }}` | — | `aria-hidden="true"` |
| Section title | MUI `Typography` | `"Announcements"`, `variant="h3"`, `fontSize: 'base'`, `fontWeight: 'strong'`, `color: 'text.primary'`, `component="h2"` | — | — |
| Category tabs | MUI `Tabs` | `value={activeTab}`, `onChange={handleTabChange}`, `sx={{ mb: 1.5, borderBottom: '1px solid secondary[200]' }}` | All / Pending / Acknowledged | `aria-label="Announcement categories"` |
| Tab: All | MUI `Tab` | `label="All (5)"`, `value="all"` | Selected / Default | `id="tab-all"` `aria-controls="tabpanel-all"` |
| Tab: Pending | MUI `Tab` | `label="Pending (1)"`, `value="pending"` | Selected / Default | `id="tab-pending"` `aria-controls="tabpanel-pending"` |
| Tab: Acknowledged | MUI `Tab` | `label="Acknowledged (4)"`, `value="acknowledged"` | Selected / Default | `id="tab-acknowledged"` `aria-controls="tabpanel-acknowledged"` |
| Tab panel | MUI `Box` | `role="tabpanel"`, `aria-labelledby="tab-{value}"`, `id="tabpanel-{value}"` | — | — |
| Announcement card | MUI `Card` | `elevation={0}` `variant="outlined"`, `borderRadius: 2`, `p: 2`, `mb: 1.5`, `bgcolor: 'background.paper'` | Pending / Acknowledged | — |
| Status badge: Pending | MUI `Chip` | `label="Pending"`, `size="small"`, `sx={{ bgcolor: 'warning[50]', border: '1px solid warning[300]', color: 'warning[700]', borderRadius: 'full' }}` | — | — |
| Status badge: Acknowledged | MUI `Chip` | `label="Acknowledged"`, `size="small"`, `sx={{ bgcolor: 'success[50]', border: '1px solid success[200]', color: 'success[600]', borderRadius: 'full' }}` | — | — |
| Card title | MUI `Typography` | `"New Recall Campaign Launched"`, `fontSize: 'sm'`, `fontWeight: 'medium'`, `color: 'text.primary'` | — | — |
| Card body | MUI `Typography` | Body preview text, `fontSize: 'sm'`, `color: 'text.secondary'`, `noWrap` truncated to 2 lines via CSS `WebkitLineClamp: 2` | — | — |
| Action: Review & Acknowledge | MUI `Button` | `variant="contained"`, `color="primary"`, `size="small"`, `sx={{ bgcolor: 'primary[500]', color: '#FFFFFF', borderRadius: 2 }}` | Default / Loading | `aria-label="Review and acknowledge: {announcement title}"` |
| Action: Review | MUI `Button` | `variant="outlined"`, `size="small"`, `sx={{ bgcolor: 'background.paper', borderColor: 'primary[200]', color: 'primary[500]', borderRadius: 2 }}` | Default | `aria-label="Review: {announcement title}"` |

#### Agent Profile Sidebar

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Sidebar container | MUI `Box` `component="aside"` | `width: 280`, `flexShrink: 0`, `bgcolor: 'background.paper'`, `borderLeft: '1px solid secondary[200]'`, `p: 2`, `display: { xs: 'none', lg: 'flex' }`, `flexDirection: 'column'`, `gap: 2`, `position: 'sticky'`, `top: 112`, `height: 'calc(100vh - 112px)'`, `overflowY: 'auto'` | — | `role="complementary"` `aria-label="Agent profile"` |
| Agent name | MUI `Typography` | `user.displayName`, `fontSize: 'base'`, `fontWeight: 'strong'`, `color: 'text.primary'` | — | — |
| Agent ID | MUI `Typography` | `user.username` (e.g., "ES-1199"), `fontSize: 'xs'`, `color: 'text.secondary'` | — | — |
| Queue label | MUI `Typography` | `"Inbound Queue"`, `fontSize: 'xs'`, `color: 'text.secondary'` | — | — |
| Time tracker label | MUI `Typography` | `"Time tracker"`, `fontSize: 'xs'`, `fontWeight: 'medium'`, `color: 'text.secondary'`, `mt: 1` | — | `id="time-tracker-label"` |
| Time tracker bar | MUI `Box` | `height: 8`, `borderRadius: 'full'`, `display: 'flex'`, `overflow: 'hidden'` — segments sized proportionally to time spent per status | — | `aria-label="Time tracker"` `aria-describedby="time-tracker-label"` `role="img"` |
| Segment: Ready | MUI `Box` | `bgcolor: 'success[500]'`, `flex: {readyMinutes}` | — | — |
| Segment: Break | MUI `Box` | `bgcolor: 'error[500]'`, `flex: {breakMinutes}` | — | — |
| Segment: Training | MUI `Box` | `bgcolor: 'info[500]'`, `flex: {trainingMinutes}` | — | — |
| Segment: Offline | MUI `Box` | `bgcolor: 'secondary[400]'`, `flex: {offlineMinutes}` | — | — |
| Status legend list | MUI `List` `dense` | `sx={{ p: 0 }}` | — | `aria-label="Status time log"` |
| Legend item: Ready | MUI `ListItem` | Dot (`success[500]`) + "Ready for calls" + "HH:MM:SS" | — | — |
| Legend item: Break | MUI `ListItem` | Dot (`error[500]`) + "Break" + "HH:MM:SS" | — | — |
| Legend item: Training | MUI `ListItem` | Dot (`info[500]`) + "Training" + "HH:MM:SS" | — | — |
| Legend item: Offline | MUI `ListItem` | Dot (`secondary[400]`) + "Offline" + "HH:MM:SS" | — | — |
| Start Interaction button | MUI `Button` from existing `IdleWorkspace` logic | `variant="contained"`, `color="primary"`, `size="medium"`, `fullWidth`, `sx={{ mt: 'auto' }}` — migrated from centered card into sidebar bottom | Default / Loading / Disabled | `aria-label="Start a new interaction"` |
| Interaction start error | MUI `Alert` | `severity="warning"` or `severity="error"`, inline below button | Visible / hidden | `role="alert"` |

### Color / Token Map

| Element | Token |
|---|---|
| Call status bar background | `background.paper` |
| Call status bar bottom border | `secondary[200]` |
| Phone icon | `warning[600]` |
| Status text | `text.primary` |
| Queue counter | `text.secondary` |
| Status chip border | `primary[200]` |
| Main content background | `background.default` |
| Announcements section background | `background.secondary` |
| Announcement card background | `background.paper` |
| Announcement card border | `secondary[200]` |
| Pending badge background | `warning[50]` |
| Pending badge border | `warning[300]` |
| Pending badge text | `warning[700]` |
| Acknowledged badge background | `success[50]` |
| Acknowledged badge border | `success[200]` |
| Acknowledged badge text | `success[600]` |
| "Review & Acknowledge" button | `primary[500]` fill, white text |
| "Review" button | `background.paper` fill, `primary[200]` border, `primary[500]` text |
| Agent sidebar background | `background.paper` |
| Agent sidebar border | `secondary[200]` |
| Ready segment | `success[500]` |
| Break segment | `error[500]` |
| Training segment | `info[500]` |
| Offline segment | `secondary[400]` |

### Responsive Behavior

| Breakpoint | Changes |
|---|---|
| `xs` (0px+) | Agent sidebar hidden, queue counter hidden, left nav hidden. Main content full width. |
| `md` (900px+) | Left nav rail visible (80px), queue counter visible, update status label visible |
| `lg` (1200px+) | Agent sidebar visible (280px), main content constrained to `calc(100% - 80px - 280px)` |

### State Table

| State | What Renders |
|---|---|
| Idle, no active interaction | "Waiting For Incoming Call!" in status bar; Start New Interaction button enabled in sidebar |
| Interaction in progress | "Interaction in Progress" in status bar; Start New Interaction button disabled with `aria-disabled` |
| Interaction start loading | Button shows "Starting…" with LinearProgress |
| Interaction start error (409) | Warning Alert: "You already have an open interaction." |
| Interaction start error (other) | Error Alert: "Unable to start interaction. Please try again." |
| Announcements tab: All | All announcement cards displayed |
| Announcements tab: Pending | Only pending cards |
| Announcements tab: Acknowledged | Only acknowledged cards |
| No announcements in filtered view | Empty state: `CampaignOutlined` icon + "No announcements in this category" text |

### Accessibility

- Focus order: Call status bar (non-interactive, skipped) → Tab navigation into main content → Announcements tabs (arrow keys within) → Announcement cards and their buttons → Agent sidebar (if visible)
- Tabs component: arrow keys navigate between All / Pending / Acknowledged tabs
- Each announcement action button includes the announcement title in its `aria-label` for unambiguous identification
- Time tracker bar uses `role="img"` with `aria-label` describing the distribution; legend list provides textual equivalent
- Status text in call bar has `aria-live="polite"` to announce changes without interrupting screen reader flow
- "Start New Interaction" button: when `disabled`, use `aria-disabled="true"` and keep the element in the DOM (do not use `disabled` attribute which removes from accessibility tree)
- Performance overview placeholders: use `aria-label` on the value `Typography` explaining the placeholder

### Frontend Handoff Notes

- The existing `IdleWorkspace.tsx` centered card is dismantled. Its interaction start logic (POST `/api/v1/interactions`, error handling, `setInteraction`) is migrated into the agent sidebar's Start New Interaction button.
- The `AgentStatusWidget` is removed from `GlobalHeader` and placed in the Call Status Bar.
- The AgentStatusWidget chip requires restyling: add `border: '1.5px solid'`, `borderColor: 'primary[200]'` to the chip `sx` to match the reference orange-bordered dropdown.
- Announcement data is Phase 1 mock/static: define a `MOCK_ANNOUNCEMENTS` array of 5 items (1 pending, 4 acknowledged) directly in the component. No announcements API exists in Phase 1.
- The time tracker bar segments use `flex` proportional sizing. Phase 1 mock data: Ready=45min, Break=2min, Training=50min, Offline=62min. Actual tracking is out of scope for Phase 1 — the bar is a static visualization seeded from mock data.
- Status time values in the legend are formatted `HH:MM:SS` — Phase 1 static mock strings.
- The "Performance overview" section renders two metric cards with "—" placeholder values and an italic Phase 1 note. The time filter dropdown is rendered but disabled (non-functional in Phase 1).
- The sidebar `position: 'sticky'` + `top: 112px` keeps it in view as main content scrolls, where `112px = 64px header + 48px call status bar`.
- Left main content padding: `pt: '112px'` (64 header + 48 call status bar), `pl: '80px'` (nav rail), `pr: '280px'` (sidebar) on `lg`; adjust with responsive sx at each breakpoint.

---

## Screen 5: Announcements Popup (Modal)

### UX Objective

Implement a center-aligned blocking modal that presents a single announcement for review and acknowledgement. The modal launches from the megaphone icon in the global header. It enforces a sequential review workflow: agent must acknowledge mandatory announcements before proceeding to ready status. Phase 1 uses static mock data.

### Consumed Source Constraints

- `design-system/reference-ux/2.Important-Announcements-popup.png` — primary visual reference
- `design-system/reference-ux/2-important-announcements-popup.md` — annotated breakdown
- `design-system/03-components.md` §3.1 `PopupComponent (MuiPopup)`
- `design-system/02-tokens.md` §7 (z-index modal: 1200)
- `design-system/06-accessibility.md` §7 (modal focus management)
- Phase 1: static mock announcement content; no real announcements API

### Layout Pattern

Pattern A (single surface) applied to modal overlay.

### Page Zones

| Zone | Content |
|---|---|
| 1–6. | All background zones are visually dimmed by backdrop |
| 7. Feedback area | The modal itself |

### Information Hierarchy

1. Backdrop: `overlay.black` (`secondary[900]` at ~60% opacity) — dims background
2. Modal container: `background.paper`, `borderRadius: '4xl'` (12px), `width: { xs: '90vw', md: 480 }`, `maxHeight: '80vh'`
3. Inside modal top-to-bottom:
   - Header row: announcement icon (circular badge, `secondary[50]` bg, `secondary[600]` icon) + title "Important Announcements" + close X icon
   - Sub-text: "Please review & acknowledge before going available"
   - Content body: `primary[50]` (`#FFF7F0`) background, `borderRadius: 2` (8px), `p: 1.5` — contains subject line (bold) + body text
   - Footer: right-aligned "Acknowledge" button (`primary[500]` fill)

### Component Specification Table

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Dialog | MUI `Dialog` | `open={open}`, `onClose={handleClose}`, `maxWidth="sm"`, `fullWidth`, `PaperProps={{ sx: { borderRadius: '12px', overflow: 'hidden' } }}`, `BackdropProps={{ sx: { bgcolor: 'overlay.black' } }}` | Open / Closed | `aria-labelledby="announcements-dialog-title"` `aria-describedby="announcements-dialog-desc"` |
| Dialog content box | MUI `DialogContent` | `sx={{ p: 2 }}` | — | — |
| Header row | MUI `Box` | `display: 'flex'`, `alignItems: 'center'`, `gap: 1.5`, `mb: 1` | — | — |
| Icon badge | MUI `Box` | 36x36 circular, `bgcolor: 'secondary[50]'`, `border: '1px solid secondary[200]'`, `borderRadius: 'full'`, contains `CampaignOutlined` icon `sx={{ color: 'secondary[600]', fontSize: 18 }}` | — | `aria-hidden="true"` |
| Modal title | MUI `Typography` | `id="announcements-dialog-title"`, `"Important Announcements"`, `fontSize: 'lg'`, `fontWeight: 'strong'`, `color: 'text.primary'` | — | `component="h2"` |
| Close button | MUI `IconButton` | `sx={{ ml: 'auto', color: 'secondary[600]' }}`, `icon: CloseOutlined` (`x-close.svg`), `size="small"`, `onClick={onClose}` | Default / Hover | `aria-label="Close announcements dialog"` |
| Sub-text | MUI `Typography` | `id="announcements-dialog-desc"`, `"Please review & acknowledge before going available"`, `fontSize: 'sm'`, `color: 'text.secondary'`, `mb: 1.5` | — | — |
| Content body | MUI `Box` | `bgcolor: 'primary[50]'`, `borderRadius: 2`, `p: 1.5` | — | — |
| Subject line | MUI `Typography` | `"New Recall Campaign Launched"` (mock), `fontSize: 'sm'`, `fontWeight: 'strong'`, `color: 'text.primary'`, `mb: 1` | — | — |
| Body text | MUI `Typography` | Long body text (mock), `fontSize: 'sm'`, `color: 'text.primary'`, `lineHeight: '20px'` — scrollable within modal | — | — |
| Dialog actions | MUI `DialogActions` | `sx={{ px: 2, pb: 2, pt: 1 }}` | — | — |
| Acknowledge button | MUI `Button` | `variant="contained"`, `color="primary"`, `size="medium"`, `sx={{ borderRadius: 2 }}`, `onClick={handleAcknowledge}` | Default / Loading | `aria-label="Acknowledge this announcement"` |

### Color / Token Map

| Element | Token |
|---|---|
| Backdrop | `overlay.black` |
| Modal background | `background.paper` |
| Modal border radius | `borderRadius: '4xl'` (12px) |
| Icon badge background | `secondary[50]` |
| Icon badge border | `secondary[200]` |
| Icon fill | `secondary[600]` |
| Close icon | `secondary[600]` |
| Title text | `text.primary` |
| Sub-text | `text.secondary` |
| Content body background | `primary[50]` |
| Subject line text | `text.primary` |
| Body text | `text.primary` |
| Acknowledge button background | `primary[500]` |
| Acknowledge button text | `#FFFFFF` |

### Responsive Behavior

| Breakpoint | Changes |
|---|---|
| `xs` (0px+) | Modal width: `90vw`; content body scrollable within `maxHeight: calc(80vh - 160px)` |
| `md` (900px+) | Modal width: `480px` (MUI `maxWidth="sm"` default) |

### State Table

| State | What Renders |
|---|---|
| Open, unacknowledged | Full modal with Acknowledge button enabled |
| Acknowledging (loading) | Acknowledge button shows "Acknowledging…", disabled, LinearProgress at modal top |
| Acknowledged successfully | Modal closes; announcement card on Landing Screen updates to "Acknowledged" badge |
| Dismiss via X | Modal closes without acknowledging (only allowed for non-mandatory announcements) |
| Mandatory announcement | X close button hidden; agent must acknowledge before closing |

### Accessibility

- `Dialog` component: MUI Dialog provides `role="dialog"` `aria-modal="true"` automatically
- Focus moves to modal container (`Dialog`) on open — MUI Dialog handles this
- Focus returns to the megaphone `IconButton` in the header on close
- Escape key closes modal (MUI Dialog default) — unless mandatory, in which case `disableEscapeKeyDown={true}` and `onClose` is no-op
- `aria-labelledby="announcements-dialog-title"` links to the `<h2>` title
- `aria-describedby="announcements-dialog-desc"` links to the sub-text
- Tab trap: MUI Dialog handles focus trap within the modal boundary
- Body text that overflows within the modal: the content area is scrollable (`overflowY: 'auto'`), and scroll is announced implicitly by viewport change

### Frontend Handoff Notes

- Use MUI `Dialog` component directly — this is the design system `MuiPopup` / `PopupComponent` equivalent.
- Phase 1 mock: hardcode one announcement item with subject "New Recall Campaign Launched" and body lorem ipsum text. No API call in Phase 1.
- For Phase 1, the modal opens when the megaphone `IconButton` in the header is clicked. Wire `onClick` on the header announcements icon to a `useState` boolean controlling `Dialog open`.
- The modal is not a workflow blocker in Phase 1 (mandatory blocking requires a real announcements API). Render the X close button always in Phase 1.
- Animation: MUI `Dialog` provides fade-in by default. If `prefers-reduced-motion` is active, the animation is suppressed via theme `transitions` override (see `design-system/06-accessibility.md §10`).
- Acknowledge button: POST to `/api/v1/announcements/:id/acknowledge` — since this API does not exist in Phase 1, stub the handler to update local state only (mark the mock announcement as acknowledged and close the modal).
- Inner content body (`bgcolor: 'primary[50]'`) matches the reference cream/beige area (`#FFF7F0`). Use `primary[50]` token, which maps to `#FFF7F0`.

---

## Screen 6: Interaction Workspace (Active)

### UX Objective

Implement the full active interaction workspace matching reference Screen 3 layout, within Phase 1 constraints. The workspace has two columns: left column (search panel + collapsed search summary) and center column (context cards). The right column (AI suggestions / SOP) present in the reference is excluded entirely — Phase 2+. The center column expands to fill the space vacated by the excluded right column.

### Consumed Source Constraints

- `design-system/reference-ux/3.Agent.png` — primary visual reference (left + center columns only)
- `design-system/reference-ux/3-agent.md` §2C — contextual information panel
- `apps/web/src/features/interaction/InteractionPanel.tsx` — orchestration logic preserved
- `apps/web/src/features/search/SearchPanel.tsx` — all search logic preserved
- `apps/web/src/features/context/ContextCards.tsx` — all context card logic preserved
- `design-system/04-layout.md` Pattern B (split workspace)
- Phase 1 exclusions: no case history table, no New Case button, no AI Suggestions panel

### Layout Pattern

Pattern B: Split workspace — `[Left: Search Panel] | [Center: Context Cards]`

### Page Zones

| Zone | Content |
|---|---|
| 1. Global header | Screen 2 — dark header |
| 2. Primary navigation | Screen 3 — left rail |
| 3. Page header | Interaction Meta Bar (sticky, 48px) |
| 4. Primary work area | Center column — context cards |
| 5. Secondary context area | Left column — search panel |
| 6. Sticky action area | "Start Wrap-up" button in sticky bottom bar |
| 7. Feedback area | Search errors, context load errors, interaction errors |

### Information Hierarchy

**Interaction Meta Bar (sticky, 48px, below global header):**
Preserved from current `InteractionMetaBar` component — shows interaction ID, elapsed timer, and status. Restyled to match the brand: `background.paper`, `borderBottom: 1px solid secondary[200]`, timer in `text.primary`, status chip using `getStatusColor()`.

**Left Column (Search Panel — 300px fixed width on `lg`):**
Matches reference Screen 3 left column exactly:
1. "Search" heading with collapse arrow
2. Search type dropdown (Mobile, Registration Number, Customer Name, Email)
3. Search text input
4. Search button (`primary[500]`)
5. Results list (when results exist)
6. Collapsed summary view (when `CONTEXT_CONFIRMED` state)

**Center Column (Context Cards — fills remaining width):**
Matches reference Screen 3 center column:
1. Customer Details card — customer name as card heading + "360 View" action link
2. Vehicle Details card — registration number as heading + "Vehicle history" link
3. Dealer Details card — dealer name as heading + "Active" status badge
4. Sticky action bar at bottom with "Start Wrap-up" button

### Component Specification Table

#### Interaction Meta Bar

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Meta bar container | MUI `Box` `component="div"` | `position: 'sticky'`, `top: 64`, `height: 48`, `bgcolor: 'background.paper'`, `borderBottom: '1px solid secondary[200]'`, `display: 'flex'`, `alignItems: 'center'`, `px: 2`, `gap: 2`, `zIndex: theme.zIndex.appBar - 1` | — | `role="status"` `aria-label="Interaction status"` |
| Interaction ID | MUI `Typography` | `"IXN-{interactionId}"` or formatted ID, `fontSize: 'sm'`, `color: 'text.secondary'` | — | — |
| Elapsed timer | MUI `Typography` | Formatted `HH:MM:SS` from `startedAt`, `fontSize: 'sm'`, `fontWeight: 'medium'`, `color: 'text.primary'` | Running / Stopped | `aria-live="off"` (timer should not announce every second) |
| Status chip | MUI `Chip` | Status from `interactionStatus`, uses `getStatusColor(status)`, `size="small"` | IDENTIFYING / CONTEXT_CONFIRMED / WRAPUP | `aria-label="Interaction status: {status}"` |

#### Left Column — Search Panel (IDENTIFYING state)

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Left column container | MUI `Box` | `width: { lg: 300 }`, `flexShrink: 0` | — | — |
| Search panel card | MUI `Card` | `elevation={0}`, `variant="outlined"`, `borderRadius: 2`, `border: '1px solid secondary[200]'` | — | — |
| Search heading row | MUI `Box` | `display: 'flex'`, `alignItems: 'center'`, `justifyContent: 'space-between'`, `mb: 1.5` | — | — |
| Search heading | MUI `Typography` | `"Search"`, `fontSize: 'base'`, `fontWeight: 'strong'`, `color: 'text.primary'`, `component="h2"` | — | — |
| Collapse arrow | MUI `IconButton` | `ExpandMoreOutlined` or `ExpandLessOutlined`, `size="small"`, collapse/expand the search controls | Expanded / Collapsed | `aria-label="Collapse search panel"` / `"Expand search panel"` `aria-expanded={!collapsed}` |
| Search type dropdown | MUI `Select` + `FormControl` | `label="Search by"`, options: Mobile / Registration Number / Customer Name / Email, `size="small"`, `fullWidth` | Default / Error | `aria-label="Search filter type"` |
| Search text input | MUI `TextField` | Dynamic label from selected filter, `size="small"`, `fullWidth`, auto-uppercase for Registration Number | Default / Error / Disabled | `aria-describedby` linked to error helper text |
| Search button | MUI `Button` | `variant="contained"`, `color="primary"`, `size="small"`, `startIcon={SearchIcon}`, `disabled` until ≥3 chars | Default / Disabled / Loading | `aria-disabled` mirrored |
| Results list | `SearchResults` sub-component | List of result cards, each selectable | — | `aria-live="polite"` announcement region |
| No results | MUI `Typography` | `"No results found."`, `fontSize: 'sm'`, `color: 'text.secondary'` | — | `aria-live="polite"` |
| Search error | MUI `Alert` | `severity="error"`, inline | — | `role="alert"` |
| Linear progress | MUI `LinearProgress` | At card top edge, `height: 3` | Searching | `aria-label="Searching"` |

#### Left Column — Collapsed Search Summary (CONTEXT_CONFIRMED state)

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Collapsed container | MUI `Box` | `width: { lg: 300 }`, `flexShrink: 0`, `display: { xs: 'none', lg: 'block' }` | — | — |
| Panel card | MUI `Card` | Same card styling as search card | — | — |
| Search label | MUI `Typography` | `"Search"`, `fontSize: 'sm'`, `fontWeight: 'medium'`, `color: 'text.secondary'` | — | — |
| Filter + value | MUI `Typography` | `"{filter}: {inputValue}"`, `fontSize: 'xs'`, `color: 'text.secondary'` | — | — |
| Change button | MUI `Button` | `variant="outlined"`, `size="small"`, `sx={{ borderColor: 'secondary[200]', color: 'text.secondary' }}`, `onClick={onChangeSelection}` | Default | `aria-label="Change selected customer — returns to search results"` |

#### Center Column — Context Cards

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Center column container | MUI `Box` | `flexGrow: 1`, `display: 'flex'`, `flexDirection: 'column'`, `gap: 2` | — | `component="section"` `aria-label="Context Confirmed"` |
| Customer Details card | MUI `Card` | `elevation={0}`, `variant="outlined"`, `borderRadius: 2`, `p: 2` | Loaded / Loading / Error / Empty | — |
| Customer card heading row | MUI `Box` | `display: 'flex'`, `justifyContent: 'space-between'`, `alignItems: 'center'`, `mb: 1` | — | — |
| Customer name | MUI `Typography` | `customerContext.contactName`, `fontSize: 'base'`, `fontWeight: 'strong'`, `color: 'text.primary'` | — | `component="h3"` |
| "360 View" link | MUI `Link` or `Button` `variant="text"` | `"360 View"`, `fontSize: 'sm'`, `color: 'primary[500]'` | Default | `aria-label="360 View for {contactName}"` — Phase 1: non-functional, renders as disabled link |
| Customer fields | MUI `Grid2` 2-col | Label (`text.secondary`, `fontSize: 'xs'`) + Value (`text.primary`, `fontSize: 'sm'`) rows: Contact, Email, Address | — | — |
| Vehicle Details card | Same card structure | `registrationNumber` as heading, "Vehicle history" action link | Loaded / Loading / Error / Empty | Same pattern |
| "Vehicle history" link | MUI `Button` `variant="text"` | Phase 1: non-functional, `aria-disabled="true"` | Disabled Phase 1 | `aria-label="Vehicle history for {registrationNumber}"` |
| Vehicle fields | Label + value rows: Model, Variant, Chassis no., Engine no., Date of sale, Last service date | — | — | — |
| Dealer Details card | Same card structure | Dealer name as heading | Loaded / Loading / Error / Empty | — |
| Dealer status badge | MUI `Chip` | `"Active"`, `size="small"`, `sx={{ bgcolor: 'success[50]', borderColor: 'success[200]', color: 'success[600]' }}` | Active / Inactive | — |
| Dealer fields | Label + value rows: Code, Dealer Type, Branch Name, ASC, Contact, Address | — | — | — |
| Card loading state | MUI `Skeleton` | `variant="rectangular"`, `height: 80`, `borderRadius: 2` | Loading | `aria-busy="true"` on card container |
| Card error state | MUI `Alert` inline | `severity="error"`, `"Could not load {Customer/Vehicle/Dealer} details"` | Error | `role="alert"` |
| Card empty state | MUI `Typography` | `"No {customer/vehicle/dealer} data found"`, `fontSize: 'sm'`, `color: 'text.secondary'` | Empty | — |
| Sticky action bar | MUI `Box` `role="toolbar"` | `position: 'sticky'`, `bottom: 0`, `bgcolor: 'background.paper'`, `borderTop: '1px solid secondary[200]'`, `px: 2`, `py: 1.5`, `display: 'flex'`, `justifyContent: { xs: 'stretch', md: 'flex-end' }` | — | `aria-label="Interaction actions"` |
| Start Wrap-up button | MUI `Button` | `variant="contained"`, `color="primary"`, `size="large"`, `ref={startWrapupRef}` | Default / Loading / Disabled | `aria-label="Start wrap-up for this interaction"` |
| Wrap-up loading indicator | MUI `LinearProgress` | `position: 'absolute'`, `top: 0`, `left: 0`, `right: 0`, `height: 3` | Loading | `aria-label="Starting wrap-up"` |

### Color / Token Map

| Element | Token |
|---|---|
| Main workspace background | `background.default` |
| Card backgrounds | `background.paper` |
| Card borders | `secondary[200]` |
| Card heading text | `text.primary` |
| Card label text | `text.secondary` |
| Card value text | `text.primary` |
| Action links ("360 View", "Vehicle history") | `primary[500]` |
| Active dealer badge background | `success[50]` |
| Active dealer badge border | `success[200]` |
| Active dealer badge text | `success[600]` |
| Start Wrap-up button | `primary[500]` fill, white text |
| Sticky action bar background | `background.paper` |
| Sticky action bar border | `secondary[200]` |
| Search panel heading | `text.primary` |
| Search button | `primary[500]` fill, white text |
| Change button border | `secondary[200]` |
| Change button text | `text.secondary` |

### Responsive Behavior

| Breakpoint | Changes |
|---|---|
| `xs` (0px+) | Single-column layout, search panel full width, context cards stacked, left nav hidden |
| `md` (900px+) | Left nav visible; context cards 2-column grid (customer + vehicle on one row, dealer below) |
| `lg` (1200px+) | Left column (300px search) + center column (remaining width), 3 context cards side-by-side |

### State Table

| State | What Renders |
|---|---|
| `IDENTIFYING` | Left column: full SearchPanel. Center column: empty (no context cards). |
| `CONTEXT_CONFIRMED` | Left column: collapsed search summary + Change button. Center column: all 3 context cards + sticky "Start Wrap-up" bar. |
| `WRAPUP` | Full-width WrapupForm (left and center columns replaced). See Screen 7. |
| `CLOSED` or `INCOMPLETE` | InteractionActions screen (closure confirmation). |

### Accessibility

- Focus order in `IDENTIFYING`: Search type dropdown → Search text input → Search button → Results list items (first result auto-focused on search completion)
- Focus order in `CONTEXT_CONFIRMED`: Change button (left) → Customer card → Vehicle card → Dealer card → Start Wrap-up button (auto-focused on context load)
- "360 View" and "Vehicle history" action links: Phase 1 — use `Button variant="text"` with `aria-disabled="true"` and `tabIndex={-1}` so they are present in DOM but not reachable by keyboard (non-functional in Phase 1)
- Search status announced via `aria-live="polite"` region (already implemented in `SearchPanel.tsx`)
- Card loading: `aria-busy="true"` on card container; `Skeleton` components provide visual loading state
- `Start Wrap-up` receives programmatic focus (`ref.current.focus()`) after context cards render

### Frontend Handoff Notes

- The overall page layout is a horizontal flex container: `[left col: 300px] [center col: flex-grow-1]`. The AI right column from reference Screen 3 is NOT implemented.
- The `InteractionPanel.tsx` orchestration logic is preserved. Only layout and visual styling change.
- Card field layout: use a two-column key/value grid pattern. Left column = label `Typography` (`text.secondary`, `fontSize: 'xs'`), right column = value `Typography` (`text.primary`, `fontSize: 'sm'`). Use MUI `Grid2` `container spacing={0.5}` with 5-col label / 7-col value proportions.
- The `CustomerCard`, `VehicleCard`, and `DealerCard` sub-components (already in `ContextCards.tsx`) need restyling to the above specification. Their data props and API calls are unchanged.
- "360 View" and "Vehicle history" links: render as `<Button variant="text" size="small" sx={{ color: 'primary[500]', p: 0, minWidth: 0, textDecoration: 'none' }} aria-disabled="true" tabIndex={-1}>` to match reference but signal non-functional state clearly. Add a `Tooltip title="Available in a future phase"` on hover.
- The page top offset is `pt: '112px'` (64px header + 48px meta bar).

---

## Screen 7: Wrapup Form

### UX Objective

Preserve all existing `WrapupForm.tsx` business logic unchanged. Apply visual restyling to match the brand language: card with `borderRadius: 2`, field sizing consistent with the design system, primary brand orange button, consistent typography scale, and proper density for an enterprise form.

### Consumed Source Constraints

- `apps/web/src/features/wrapup/WrapupForm.tsx` — all logic preserved exactly
- `design-system/02-tokens.md` §2, §3
- `design-system/05-ux-patterns.md` §3 (Progressive wrap-up), §5 (Validation and recovery)
- `design-system/06-accessibility.md` §3, §5

### Layout Pattern

Pattern A: Single work surface — WrapupForm replaces the center+left columns of the interaction workspace.

### Page Zones

| Zone | Content |
|---|---|
| 1. Global header | Screen 2 — dark header |
| 2. Primary navigation | Screen 3 — left rail |
| 3. Page header | Interaction Meta Bar (sticky) |
| 4. Primary work area | WrapupForm card |
| 5. Secondary context area | Not rendered |
| 6. Sticky action area | Save Wrap-up button (inside card, not sticky); post-save: Close / Mark Incomplete buttons |
| 7. Feedback area | Field errors, save error alert, save success alert, close error alert |

### Information Hierarchy

1. Section heading: "Wrap-up" — `h2`, `fontSize: 'xl'`, `fontWeight: 'strong'`
2. Loading state: `LinearProgress` + "Loading form…" caption (during master data fetch)
3. Master data error: `Alert severity="error"` blocking the form
4. Form fields (2-column at `lg`, 1-column at `xs`):
   - Contact Reason (required select)
   - Identification Outcome (required select)
   - Interaction Disposition (required select, full width)
   - Remarks (optional textarea, conditional required when disposition triggers it)
5. Character counter: right-aligned below Remarks field (`{n} / 1000`)
6. Save Wrap-up button
7. Post-save success alert + Close Interaction or Mark Incomplete button

### Component Specification Table

| Zone | Component | Props / Behavior | States | ARIA |
|---|---|---|---|---|
| Section container | MUI `Box` `component="section"` | `aria-label="Interaction wrap-up"`, `p: { xs: 2, md: 3 }` | — | `aria-label="Interaction wrap-up"` |
| Live announcer | MUI `Box` | `aria-live="polite"` `aria-atomic="true"`, visually hidden, announces remarks-required change | — | Off-screen via `position: absolute; left: -9999px` |
| Form card | MUI `Card` | `elevation={0}`, `variant="outlined"`, `borderRadius: 2`, `maxWidth: { md: 600, lg: 640 }`, `mx: 'auto'` | — | — |
| Loading indicator | MUI `LinearProgress` | At card top edge, `height: 3` | Loading | `aria-label="Loading form options"` |
| Form `CardContent` | MUI `CardContent` `component="form"` | `aria-label="Interaction wrap-up"`, `p: { xs: 2, md: 3 }` | — | — |
| Heading | MUI `Typography` | `"Wrap-up"`, `variant="h3"`, `component="h2"`, `fontSize: 'xl'`, `fontWeight: 'strong'`, `color: 'text.primary'`, `mb: 3` | — | — |
| Contact Reason field | MUI `FormControl` + `Select` | `id="contact-reason"`, `label="Contact Reason"`, `size="small"`, `fullWidth`, `required`, items from master data | Default / Error / Disabled (post-save) | `aria-required="true"`, `aria-describedby="contact-reason-error"` when error, `FormHelperText id="contact-reason-error" role="alert"` |
| Identification Outcome field | MUI `FormControl` + `Select` | `id="identification-outcome"`, `label="Identification Outcome"`, `size="small"`, `fullWidth`, `required` | Default / Error / Disabled | Same pattern |
| Interaction Disposition field | MUI `FormControl` + `Select` | `id="interaction-disposition"`, `label="Interaction Disposition"`, `size="small"`, `fullWidth`, `required` | Default / Error / Disabled | Same pattern |
| Remarks field | MUI `TextField` | `id="remarks"`, `label="Remarks"` (+ conditional asterisk when required), `multiline`, `rows={4}`, `fullWidth`, `maxLength={1000}` | Default / Conditionally Required / Error / Disabled | `aria-required={remarksRequired}`, `aria-describedby="remarks-error"` or `"remarks-counter"` |
| Remarks counter | `FormHelperText` | `"{n} / 1000"`, right-aligned, `aria-live="off"` | Active | `id="remarks-counter"` |
| Conditional required border | Inline `sx` on TextField | `borderColor: 'warning.main'` on `MuiOutlinedInput-root fieldset` when `remarksRequired && !remarksError` | Triggered | Visual cue only — `aria-live` region announces the state change |
| Save error | MUI `Alert` | `severity="error"`, `role="alert"`, `mt: 2` | Visible / Hidden | — |
| Save Wrap-up button | MUI `Button` | `id="save-wrapup-btn"`, `variant="contained"`, `color="primary"`, `size="large"`, `mt: 3`, `width: { xs: '100%', md: 'auto' }` | Default / Loading / Hidden (post-save) | `aria-label="Save wrap-up"` |
| Save success alert | MUI `Alert` | `severity="success"`, contextual message per disposition, `mb: 2` | Post-save | `aria-live="polite"` via `tabIndex={-1}` focus on container |
| Close error | MUI `Alert` | `severity="error"`, `role="alert"`, `mb: 2` | Visible / Hidden | — |
| Close Interaction button | MUI `Button` | `id="close-interaction-btn"`, `variant="contained"`, `color="primary"`, `size="medium"`, `width: { xs: '100%', md: 'auto' }` | Default / Loading | `aria-label="Close this interaction"` |
| Mark Incomplete button | MUI `Button` | `id="mark-incomplete-btn"`, `variant="contained"`, `color="secondary"`, `size="medium"`, `width: { xs: '100%', md: 'auto' }` | Default / Loading | `aria-label="Mark this interaction as incomplete"` |

### Color / Token Map

| Element | Token |
|---|---|
| Form card background | `background.paper` |
| Form card border | `secondary[200]` |
| Section heading | `text.primary` |
| Field labels | `text.primary` (inside `InputLabel`) |
| Field values | `text.primary` |
| Field border (default) | `secondary[300]` (MUI TextField default) |
| Field border (focused) | `primary[500]` (via `primary.main` theme) |
| Field border (error) | `error[500]` |
| Field border (conditional remarks) | `warning[500]` |
| Field background (disabled) | `secondary[50]` |
| Field text (disabled) | `secondary[300]` |
| Save button background | `primary[500]` |
| Save button text | `#FFFFFF` |
| Close Interaction button | `primary[500]` fill, white text |
| Mark Incomplete button | `secondary[900]` fill, white text |
| Success alert background | `success[50]` |
| Error alert | `error[500]` color |
| Remarks counter text | `text.secondary` |

### Responsive Behavior

| Breakpoint | Changes |
|---|---|
| `xs` (0px+) | Single-column form, all fields full width, buttons full width |
| `lg` (1200px+) | Contact Reason + Identification Outcome on one row (6+6 columns), Disposition full width, button `width: 'auto'` |

### State Table

| State | What Renders |
|---|---|
| Master data loading | `LinearProgress` + "Loading form…" caption; form not shown |
| Master data error | `Alert severity="error"` with retry message; no form |
| Form default | All fields empty, no errors, Save button enabled |
| Field validation error | Error helper text under failing field, focus on first failing field |
| Remarks conditionally required | Warning border on Remarks field, `aria-live` region announces; `*` appended to label |
| Saving | `LinearProgress` at card top, Save button shows "Saving…" and disabled, all fields disabled |
| Save error | Error Alert below fields; form re-enabled |
| Saved (disposition = incomplete) | Success alert "Wrap-up saved. Mark the interaction as incomplete."; Mark Incomplete button |
| Saved (disposition = other) | Success alert "Wrap-up saved. You can now close the interaction."; Close Interaction button |
| Closing | Action button shows "Closing…" / "Saving…" and disabled |
| Close error | Error Alert; buttons re-enabled |

### Accessibility

- Focus order: Contact Reason → Identification Outcome → Interaction Disposition → Remarks → Save Wrap-up button
- On validation failure: focus moves to first failing field's native input element
- Post-save: `tabIndex={-1}` `div` with `aria-live="polite"` receives programmatic focus to announce the success state to screen readers
- Remarks required change announced via off-screen `aria-live="polite"` region
- `FormHelperText` error messages use `role="alert"` for immediate announcement
- All `Select` components: MUI provides keyboard navigation within the dropdown (arrow keys, Enter to select, Escape to close)
- Remarks character counter: `aria-live="off"` — it must not announce on every keystroke

### Frontend Handoff Notes

- No logic changes to `WrapupForm.tsx`. Only `sx` prop styling updates required.
- Update the heading from current `variant="h3" component="h2"` with `color="text.primary"` to also include `fontSize: 'xl'` and `fontWeight: 'strong'` (these tokens may already match `h3` in the theme — verify against theme config).
- The `secondary` color on "Mark Incomplete" button: use `color="secondary"` with `variant="contained"`. Verify that the theme's `secondary.main` maps to `secondary[900]` (`#1B1D21`) — this produces a dark button, distinguishing it visually from the orange "Close Interaction" primary button.
- Card `maxWidth: { md: 600, lg: 640 }` centers the form on wide screens; keep the existing `mx: 'auto'`.
- `LinearProgress` at card top edge uses `position: 'absolute'` or is placed as first child of `Card` (before `CardContent`) at `height: 3`.

---

## Cross-Screen Specifications

### AgentStatusWidget Restyling

The existing `AgentStatusWidget.tsx` logic is unchanged. The following visual updates apply:

**Chip styling (matching reference Screen 1 orange-bordered dropdown):**
```
sx={{
  bgcolor: 'background.paper',
  border: '1.5px solid',
  borderColor: 'primary[200]',     // #F4B07D — orange tint border
  cursor: updating ? 'not-allowed' : 'pointer',
  ...
}}
```

**Status dot colors (matching reference):**

| Status | Dot token | Label |
|---|---|---|
| READY_FOR_CALLS | `success[500]` | "Ready for calls" |
| BREAK | `error[500]` | "Break" |
| OFFLINE | `secondary[400]` | "Offline" |
| TRAINING | `info[500]` | "Training" |

Replace the current hard-coded hex values in `STATUS_CONFIG` with theme tokens via `theme.palette`:
- `dotColor` → resolved via `theme.palette.success[500]` etc.
- `chipBgColor` → `background.paper` (white)
- `chipBorderColor` → `primary[200]`

This makes all status chips consistent in border color while the dot indicates specific status.

### Interaction Error Boundary

The existing `InteractionErrorBoundary` in `InteractionPanel.tsx` is preserved. Its error display needs no visual change — it is rarely surfaced.

### ToasterComponent (Error Toast)

All error toasts use MUI `Snackbar` positioned `{ vertical: 'bottom', horizontal: 'center' }`, `autoHideDuration: 10000`. This is correct per `design-system/03-components.md §3.7` (error: 10s auto-dismiss).

### Focus Ring

All interactive elements use MUI's default focus ring: `outline: none; box-shadow: 0 0 0 4px {info[500]}3D`. On the dark `secondary[900]` header and nav rail, the focus ring must be visible. Ensure `outline-offset: 2px` is applied on the dark surface icon buttons so the ring appears outside the icon boundary.

### Reduced Motion

Apply the following global CSS:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Additionally, override `theme.transitions` duration to `0` when `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is true. This suppresses MUI Dialog fade-in, Drawer slide animation, and all `LinearProgress` animations.

### i18n

All user-facing string literals must be wrapped in `t()` from `i18next`. Current implementation uses literal strings — the frontend engineer should add `t()` wrappers during the restyling pass. Suggested i18n key pattern: `ccm.{screen}.{element}` (e.g., `ccm.login.title`, `ccm.landing.waitingForCall`).

---

## Implementation Order Recommendation

The frontend engineer should implement screens in this order to minimize rework:

1. **Token and theme configuration** — register all tokens in the MUI theme; configure `secondary[900]` header background, `primary[500]` brand orange, typography variants, border radii.
2. **Screen 2: Global Header** — dark header replaces existing light header; all other screens depend on this.
3. **Screen 3: Left Navigation Rail** — permanent `Drawer` added to app shell.
4. **Screen 1: Login Page** — minimal changes (title text, background color already correct).
5. **Screen 4: Landing Screen** — most complex; build call status bar, main content, agent sidebar; migrate interaction start button.
6. **Screen 5: Announcements Popup** — `Dialog` component, triggered from header megaphone.
7. **Screen 6: Interaction Workspace** — restyle `InteractionPanel` layout; update context cards visual treatment.
8. **Screen 7: Wrapup Form** — mostly `sx` prop updates; logic unchanged.

---

## Phase 2+ Exclusion Record

The following elements visible in reference Screen 3 are explicitly excluded from Phase 1 implementation:

| Feature | Reference Location | Phase |
|---|---|---|
| Incoming caller number display | Header center | Phase 2 (CTI) |
| Live call timer (01:32 min) | Header center | Phase 2 (CTI) |
| "Connected" status badge on call | Header center | Phase 2 (CTI) |
| Mic mute button | Header right | Phase 2 (CTI) |
| Pause button | Header right | Phase 2 (CTI) |
| Keypad/dialer button | Header right | Phase 2 (CTI) |
| End Call button | Header right | Phase 2 (CTI) |
| Case history table | Center column | Phase 2 |
| New Case button | Center column | Phase 2 |
| AI Suggestions panel | Right column | Phase 2 |
| SOP document list | Right column | Phase 2 |
| AI language selector | Right column | Phase 2 |
| Live calls-in-queue WebSocket counter | Call status bar | Phase 2 |
| Live performance metrics (Calls Handled, AHT) | Landing screen | Phase 2 |
| Real announcements API | Landing screen + popup | Phase 2 |
| Real time-tracker WebSocket | Agent sidebar | Phase 2 |

No placeholder skeleton, disabled button, or "coming soon" badge is required for any Phase 2+ exclusion unless explicitly noted in the State Table for a specific screen. For Phase 1, excluded features are simply absent.

---

## Appendix A: Component Restyling Summary

This table guides the frontend engineer on what changes versus what stays in each existing component.

| File | Changes Required | Logic Changes |
|---|---|---|
| `LoginPage.tsx` | Title text "Call Centre Management", brand strip `::before` already present, `bgcolor` already `background.default` | None |
| `GlobalHeader.tsx` | Full visual redesign: dark `secondary[900]` background, white text/icons, remove logout button from header, add agent identity block, add bell + megaphone icons, add avatar | Move logout to avatar dropdown menu |
| `IdleWorkspace.tsx` | Dismantle centered card layout; migrate button + error handling into agent sidebar of Landing screen | None — logic migrates, not refactored |
| `AgentStatusWidget.tsx` | Update `STATUS_CONFIG` hex values to theme tokens; update chip `borderColor` to `primary[200]`; move placement from header to call status bar | None |
| `InteractionPanel.tsx` | Add left column fixed width container, ensure no AI right column is rendered | None |
| `SearchPanel.tsx` | Update card `borderRadius: 2`, heading typography scale, button color to `color="primary"` (already correct) | None |
| `ContextCards.tsx` | Restyle cards to use `borderRadius: 2`, action links with `primary[500]` color, field label/value typography | "360 View" and "Vehicle history" links become `aria-disabled` with Phase 1 tooltip |
| `WrapupForm.tsx` | Update heading `fontSize: 'xl'`, card `borderRadius: 2`, verify button colors | None |

---

## Appendix B: New Components Required

These components do not exist yet and must be created:

| Component | File Path (suggested) | Description |
|---|---|---|
| `CallStatusBar` | `apps/web/src/shared/components/CallStatusBar.tsx` | 48px sticky bar with phone icon, status text, queue counter (static), AgentStatusWidget |
| `AgentSidebar` | `apps/web/src/features/workspace/AgentSidebar.tsx` | Right sidebar: agent profile, time tracker bar, status legend, start interaction button |
| `AnnouncementsSection` | `apps/web/src/features/announcements/AnnouncementsSection.tsx` | Tabs + announcement card list with mock data |
| `AnnouncementsModal` | `apps/web/src/features/announcements/AnnouncementsModal.tsx` | MUI Dialog for single announcement review + acknowledge |
| `TimeTrackerBar` | `apps/web/src/features/agent-status/TimeTrackerBar.tsx` | Segmented horizontal bar with status color segments |
| `LeftNavRail` | `apps/web/src/shared/components/LeftNavRail.tsx` | Permanent 80px dark nav rail with home icon |
| `LandingScreen` | `apps/web/src/features/workspace/LandingScreen.tsx` | Full landing layout composing CallStatusBar + AnnouncementsSection + AgentSidebar |

---

*End of UX Specification v2*
