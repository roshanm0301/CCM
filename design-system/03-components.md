# 03 Components

## Purpose

This document defines the reusable UI component model for CCM. It prevents page-level reinvention and gives UX and engineering agents a controlled component vocabulary.

## Agents That Use This Document

| Agent | How It Is Used |
|---|---|
| UX Designer Agent | Designs using approved component patterns |
| Frontend Engineer Agent | Implements a shared component library on top of MUI |
| QA Engineer Agent | Verifies consistency, state handling, and accessibility |

---

## 1. Architecture Overview

```
design-system/components/
├── atoms/           # ~40 files — smallest reusable elements
├── molecules/       # ~28 files — compositions of atoms
├── templates/       # ~35 files — page scaffolding & layouts
├── common/          # ~10 files — cross-cutting shared components
├── notifications/   # Snackbar & notification system
└── index.ts         # Barrel exports for commonly used components
```

Component overrides are defined in two places:
- **Global overrides**: `design-system/theme/theme.ts` — MUI component defaults (Button, Input, Select, Tabs, etc.)
- **Variant overrides**: `design-system/theme/variants/` — specific component variants (Chip, Button, TextInput)

---

## 2. Atoms

### 2.1 InputBox

Wraps MUI `TextField` with consistent styling.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `name` | `string` | — | Form field name |
| `type` | `string` | `"text"` | HTML input type |
| `size` | `"small" \| "medium"` | — | Maps to theme overrides |
| `error` | `boolean` | — | Activates error styling |
| `helperText` | `string` | — | Help/error message |
| All `TextFieldProps` | — | — | Forwarded to MUI TextField |

**Styling**: Disabled state uses `#F4F7FA` background with `#DEE4EB` border. All inputs use `borderRadius: 8px`.

---

### 2.2 MuiButton

Thin wrapper around MUI `Button`.

**Theme Overrides** (from `theme.ts`):

| Size | Padding | Font Size |
|---|---|---|
| `small` (default) | `8px 12px` | `base` (14px) |
| `medium` | `10px 14px` | `base` (14px) |
| `large` | `10px 16px` | `lg` (16px) |
| `icon` (custom) | `8px` | — |

**Variants**:
- `contained` — Solid fill, white text
- `outlined` — White background, 1px outline using `Colors[color][200]`
- `text` — No background or border

All buttons: `textTransform: none`, `borderRadius: 8px`, `fontWeight: medium`.

---

### 2.3 MuiIconButton

Standard icon button with `20px × 20px` icon defaults.

---

### 2.4 MuiAccordion

Simple MUI Accordion with expand icon.

| Prop | Type | Default |
|---|---|---|
| `title` | `string` | `"Accordion"` |
| `titleVariant` | MUI variant | `"body1"` |
| `children` | `ReactNode` | — |

**Theme Override**: `borderRadius: 2` (8px).

---

### 2.5 Checkbox

MUI Checkbox styled with `secondary[200]` for unchecked/disabled states.

---

### 2.6 DatePicker

MUI X Date Picker integration with Day.js.

---

### 2.7 StatusColor / Chip

Uses `getStatusColor()` to render a Chip with the appropriate semantic color for any business status string.

**Chip Theme** (from `MuiChip.ts`):

| Size | Padding | Font | Line Height |
|---|---|---|---|
| `small` (default) | `2px 8px` | `12px` | `18px` |
| `medium` | `2px 10px` | `14px` | `20px` |
| `large` (custom) | `4px 12px` | `14px` | `20px` |

**Shape variants**: `circular` (pill), `rounded` (6-8px), `square` (0px).

**Color variants**: All 11 color palettes (primary, secondary, error, success, warning, info, aqua, green, mint, purple, rose) have a consistent pattern:
- `color` = `[500]`
- `borderColor` = `[200]`
- `backgroundColor` = `[50]`

---

### 2.8 Other Notable Atoms

| Component | File | Purpose |
|---|---|---|
| `SliderComponent` | `sliderComponent.tsx` | Fuel indicator slider |
| `LogoComponent` | `logoComponent.tsx` | Brand-aware logo rendering |
| `IosSwitch` | `iosSwitch.tsx` | iOS-style toggle switch |
| `ToolTipTypography` | `toolTipTypography.tsx` | Text with tooltip on overflow |
| `Breadcrumb` | `breadcrumb.tsx` | Navigation breadcrumbs |
| `MuiSearchSelect` | `muiSearchSelectComponent.tsx` | Searchable select dropdown |
| `MuiSelect` | `muiSelectComponent.tsx` | Standard select with theme styling |
| `PagingHeader` | `pagingHeader.tsx` | List pagination controls |
| `JobItemsLoader` | `jobItemsLoader.tsx` | Skeleton loader for job items |
| `SliderCarousel` | `sliderCarousel.tsx` | Image carousel viewer |
| `RadioButton` | `radioButtoncomponent.tsx` | Radio button group |
| `DataGrid` | `DataGrid.tsx` | MUI X DataGrid Premium wrapper |

> **DataGrid vs DataGridComponent**: `DataGrid` (atom) is a thin wrapper around MUI X DataGrid Premium with no column or pagination configuration. `DataGridComponent` (molecule, §3.8) builds on top of it, adding CCM-specific column definitions, pagination state, and row selection behavior. Always use `DataGridComponent` in feature pages; use `DataGrid` only when building a new molecule that needs raw grid control.

---

## 3. Molecules

### 3.1 PopupComponent (`MuiPopup`)

Reusable dialog/popup with optional title, close icon, search box, and loader.

| Prop | Type | Description |
|---|---|---|
| `openPopup` | `boolean` | Controls visibility |
| `title` / `subTitle` | `string` | Header text |
| `closeIcon` | `boolean` | Show close button |
| `searchBox` | `boolean` | Include search field |
| `width` | `number` | Dialog width (default: 600) |
| `backdropEnable` | `boolean` | Prevent close on backdrop click |
| `showLoaderOnPopup` | `boolean` | Show inline loader |

---

### 3.2 Loader

Linear progress bar displayed at the top of headers/popups during API calls. Controlled by component-level loading state or Zustand store flags.

---

### 3.3 SearchBarByTypes

Multi-type search with dropdown selector (Reg No., VIN, Mobile, Email).

---

### 3.4 CustomAlertPopup

Alert dialog for confirmations and warnings.

---

### 3.5 UnsavedChangesComponent

Prompts users when navigating away from unsaved forms.

---

### 3.6 CalendarComponent

Wraps `react-big-calendar` for appointment scheduling views.

---

### 3.7 ToasterComponent

Notification toasters with auto-dismiss (success: 1s, error: 10s).

---

### 3.8 Other Notable Molecules

| Component | File | Purpose |
|---|---|---|
| `CustomForm` | `customForm.tsx` | Dynamic form renderer |
| `CustomTab` | `customTab.tsx` | Tab navigation component |
| `DesktopTabComponent` | `desktopTabComponent.tsx` | Desktop-optimized tabs |
| `DataGridComponent` | `dataGridComponent.tsx` | DataGrid with custom config |
| `JobCardProgressStepper` | `jobCardProgressStepper.tsx` | Step progress indicator |
| `StockAvailabilityChip` | `stockAvailabilityChip.tsx` | Stock status indicator |
| `PageHeading` | `pageHeading.tsx` | Standardized page title |
| `AudioComponent` | `audioComponent.tsx` | Audio recording/playback |

---

## 4. Templates

### 4.1 Layout

Root application layout: `Header → Sidebar → Main Content (Outlet)`.

---

### 4.2 Header

Responsive AppBar with:
- Menu toggle for sidebar
- Brand logo (via `LogoComponent`)
- Module switcher (9-dot grid)
- Header menus (notifications, profile, settings)
- Safe area support for iOS

---

### 4.3 Sidebar

Collapsible navigation drawer:
- **Mobile**: Full-width temporary drawer
- **Desktop**: Persistent drawer with open (264px) / collapsed (80px) states
- Smooth transitions via `openedMixin` / `closedMixin` with MUI theme transitions
- Icon mapping system for modules (Dashboard, Workshop, Insights, Vehicle, Inventory, Finance, etc.)

---

### 4.4 HeaderCatalogPage

**File**: `headerCatalogPageUpdated.tsx`

Detailed header for catalog/detail pages with vehicle info, customer context, and action buttons.

---

### 4.5 ListPageHeader

**File**: `listPageHeaderComponent.tsx`

Header for list pages with search, filters, status chips, and view toggles.

---

## 5. Common Components

### 5.1 PageLayout

Full-featured page template with:
- CommonHeader with back navigation
- Search toolbar (Reg No. / VIN) with validation
- Tabbed content area
- Error state indicators on tabs
- Responsive action bar (desktop toolbar / mobile fixed footer)
- Discard/Save with unsaved changes protection
- Recall alert integration

---

### 5.2 CommonHeader

**File**: `src/components/common/CommonHeader/`

Standardized navigation header with back button and title.

---

### 5.3 FormFieldWrapper

Wrapper for form fields with consistent label and layout.

---

### 5.4 ModuleListWrapper

Wrapper for list pages with built-in infinite scrolling.

---

## 5.5 CCM Phase 1 Components

These components are specific to the CCM application and are not part of the shared iDMS design-system library. They live under `apps/web/src/features/`.

| Component | File | Purpose |
|---|---|---|
| `InteractionPanel` | `features/interaction/InteractionPanel.tsx` | Root workspace orchestrator — manages state machine transitions and layout switching |
| `LeftContextPanel` | `features/context/LeftContextPanel.tsx` | 300px left column showing collapsed search summary, context cards, and Start Wrap-up action |
| `CustomerCard` | `features/context/CustomerCard.tsx` | Read-only customer details card with masked mobile and 360 View placeholder |
| `VehicleCard` | `features/context/VehicleCard.tsx` | Read-only vehicle details card with masked chassis and Vehicle history placeholder |
| `DealerCard` | `features/context/DealerCard.tsx` | Read-only dealer details card with Active/Inactive status badge |
| `SearchPanel` | `features/search/SearchPanel.tsx` | Debounced multi-type search with typeahead and result list |
| `WrapupForm` | `features/wrapup/WrapupForm.tsx` | Disposition capture form with conditional remarks validation |
| `AgentStatusWidget` | `features/agent-status/AgentStatusWidget.tsx` | Agent availability status selector (Ready for Calls / Break / Training / Offline) |
| `InteractionMetaBar` | `features/interaction/InteractionMetaBar.tsx` | 48px interaction context bar showing ID, elapsed time, and status badge |
| `IdleWorkspace` | `features/interaction/IdleWorkspace.tsx` | Idle state with Start New Interaction button and status gating |
| `GlobalHeader` | `features/layout/GlobalHeader.tsx` | Application header with agent identity and status |

> These components follow the design principles in `01-design-principles.md` and use tokens from `02-tokens.md`. They use Zustand for state, MUI v6 for rendering, and React Hook Form for the WrapupForm.

---

## 6. Do and Do Not

### Do

- Wrap MUI components so CCM standards are centralized.
- Expose a small, well-documented prop API.
- Support accessibility attributes directly.
- Use composition over inheritance.

### Do Not

- Hard-code page-specific logic in shared components.
- Create duplicate variants for the same semantic purpose.
- Use icon-only controls for critical actions without labels or accessible names.

---

## 7. Interpretation Notes

### UX Designer Agent

- Design with the catalog above before proposing a new component.
- If a new component is necessary, define why existing components fail.

### Frontend Engineer Agent

- Build shared components under a design-system package or folder.
- Ensure all component stories/tests cover states and accessibility.
- Keep feature-specific API adapters out of the component library.
