# Case Category & Case Subcategory Master — MVP Documentation

**Document Type:** Process Documentation + Functional Specification + User Stories  
**Module:** Case Management  
**Prepared For:** Builder output based on reviewed source files and confirmed decisions in discussion  
**Date:** 2026-03-25

---

## 1. Scope and Assumptions

### 1.1 Scope
This document defines the MVP requirements for the **Case Category Master** and **Case Subcategory Master** used during **case creation and case maintenance**.

### 1.2 In Scope
- Case Category catalog view
- Create, edit, activate, and inactivate Case Categories
- Create, edit, activate, and inactivate Case Subcategories
- Parent-child linking between Category and Subcategory
- Applicability mapping using:
  - Department
  - Case Nature
  - Product Type
- Agent-side filtering of categories and subcategories during case handling
- Validation, error handling, and behavior for inactive values

### 1.3 Out of Scope
- Lead management
- SLA, queue routing, escalation configuration
- Case triage rules beyond Category/Subcategory selection
- Effective From / Effective To dates
- Manual version management screens

### 1.4 Confirmed Business Decisions Incorporated
1. A **Case** is not limited to Complaint. Case Nature can include values such as **Complaint, Query, Suggestion, Feedback**.
2. **Leads are separate**, but Lead flow is out of scope.
3. **Department, Case Nature, and Product Type are multi-select fields** on Case Category.
4. `Name` and `Description` are corrected semantically as:
   - **Display Name** = agent-facing label
   - **Definition** = admin-facing explanation
5. Audit/versioning is assumed to be handled by the platform/database layer; no Effective From / To fields are added in this spec.
6. If an active Category is later inactivated:
   - it is not available for future selection
   - linked Subcategories are also inactivated by cascade
   - on open cases where the value was already selected, Category/Subcategory will display as **blank**
   - historical cases must continue to show the originally stored value
7. If a parent Category is reactivated, linked Subcategories that were inactivated due to parent cascade must auto-reactivate.
8. Product Type values are displayed in this master as **Product Type**, but the lookup source entity is the **Category master**.

### 1.5 Implementation Assumptions Requiring Validation
1. **Category Code** is globally unique across all Case Categories.
2. **Subcategory Code** is globally unique across all Case Subcategories.
3. **Category Display Name** is globally unique.
4. **Subcategory Display Name** is unique within its parent Category.
5. Duplicate checks are **case-insensitive** and ignore leading/trailing spaces.
6. Controlled special characters are allowed in Display Name and Definition: `& / - ( ) , .`
7. Product Type is derived during agent case handling from case/customer context and is not manually entered by the agent unless the broader case process allows it.

---

# B) Process Documentation

## Process 1: Create Case Category

### Trigger
Admin clicks **Create Case Category** from the Case Category catalog screen.

### Inputs
- Category Code
- Category Display Name
- Category Definition
- Department(s)
- Case Nature(s)
- Product Type(s)
- Is Active

### Steps
1. Admin opens the Case Category catalog.
2. Admin clicks **Create Case Category**.
3. System opens the Case Category detail form.
4. Admin enters all mandatory fields.
5. Admin selects one or more values for:
   - Department
   - Case Nature
   - Product Type
6. Admin optionally updates Is Active. Default is **Active**.
7. Admin clicks **Save**.
8. System validates mandatory fields, length, format, and uniqueness.
9. System saves the Category.
10. System returns the user to detail view or list view with success confirmation.

### Outputs
- New Case Category record is created.
- Category becomes available for Subcategory creation.
- If active, it becomes eligible for agent consumption when applicability conditions match.

### Exceptions
- Mandatory field blank
- Duplicate code
- Duplicate display name
- Invalid character / length violation
- Save failure due to system or database issue

---

## Process 2: Edit Case Category

### Trigger
Admin clicks **Edit** on an existing Case Category.

### Inputs
- Existing Category record
- Updated field values

### Steps
1. Admin opens an existing Category from catalog.
2. Admin modifies allowed fields.
3. Admin clicks **Save**.
4. System validates updated values.
5. System saves changes.
6. System updates future agent dropdown behavior based on revised applicability and status.

### Outputs
- Updated Case Category record
- Revised applicability mapping for future case interactions

### Exceptions
- Duplicate code or display name after edit
- Invalid multi-select combination not permitted by lookup source
- Save failure

---

## Process 3: Add Case Subcategory

### Trigger
Admin clicks **Add Case Subcategory** from an already saved Case Category.

### Inputs
- Parent Category ID
- Subcategory Code
- Subcategory Display Name
- Subcategory Definition
- Is Active

### Steps
1. Admin opens an existing Category in edit mode.
2. Admin clicks **Add Case Subcategory**.
3. System opens the Subcategory modal.
4. Admin enters mandatory details.
5. Admin clicks **Save**.
6. System validates mandatory fields, uniqueness, format, and parent availability.
7. System auto-links the Subcategory to the current Category.
8. System displays the Subcategory in the Subcategory grid under that Category.

### Outputs
- New Subcategory created and linked to the selected parent Category
- Subcategory available in agent flow only when:
  - parent Category is selected
  - subcategory is active
  - parent Category is active

### Exceptions
- Parent Category not yet saved
- Mandatory field blank
- Duplicate code
- Duplicate display name within parent
- Save failure

---

## Process 4: Edit / Inactivate / Reactivate Case Subcategory

### Trigger
Admin edits an existing Subcategory directly from the parent Category screen.

### Inputs
- Existing Subcategory record
- Updated field values
- Updated status

### Steps
1. Admin opens parent Category.
2. Admin views the linked Subcategory list.
3. Admin selects **Edit** for a Subcategory.
4. Admin updates values or status.
5. Admin clicks **Save**.
6. System validates and persists changes.

### Outputs
- Updated Subcategory record
- Revised visibility in agent dropdowns for future case activity

### Exceptions
- Duplicate validation failure
- Mandatory field blank
- Parent Category inactive
- Save failure

---

## Process 5: Inactivate / Reactivate Case Category

### Trigger
Admin changes the status of a Category from Active to Inactive or Inactive to Active.

### Inputs
- Category status change request
- Existing linked Subcategories

### Steps — Inactivate
1. Admin opens the Category.
2. Admin changes **Is Active = false**.
3. Admin clicks **Save**.
4. System marks the Category inactive.
5. System cascades inactivation to linked Subcategories.
6. System removes the Category and linked Subcategories from future agent dropdowns.
7. For open cases where these values were already selected, system displays Category/Subcategory as blank.
8. Historical cases continue to show stored original values.

### Steps — Reactivate
1. Admin opens the inactive Category.
2. Admin changes **Is Active = true**.
3. Admin clicks **Save**.
4. System marks the Category active.
5. System auto-reactivates Subcategories that were inactivated by parent cascade.
6. System restores future eligibility in agent dropdowns when applicability criteria match.

### Outputs
- Status updated
- Agent-side availability recalculated

### Exceptions
- Save failure
- Inconsistent child state
- Parent-child status reconciliation issue

### Special Handling Rule
To support correct auto-reactivation behavior, the system should distinguish whether a Subcategory was:
- explicitly inactivated by admin, or
- inactivated due to parent cascade

Both the types should auto-reactivate when the parent is reactivated.

---

## Process 6: Agent Consumption During Case Handling

### Trigger
Agent creates or updates a Case and reaches Category/Subcategory selection.

### Inputs
- Selected Department
- Selected Case Nature
- Resolved Product Type from Product Type Master
- Active Category and Subcategory masters

### Steps
1. Agent selects Case Nature.
2. Agent selects Department.
3. System derives Product Type from the Product Type Master
4. System fetches all active Categories where:
   - selected Department is included in the Category’s Department set
   - selected Case Nature is included in the Category’s Case Nature set
   - derived Product Type is included in the Category’s Product Type set
5. System displays only matching Categories.
6. Agent selects a Category.
7. System fetches active Subcategories linked to the selected Category.
8. System displays only active linked Subcategories.

### Outputs
- Valid Category/Subcategory stored against the Case
- Controlled classification for downstream reporting

### Exceptions
- No matching Category found
- Selected Category becomes inactive before save
- Selected Subcategory becomes inactive before save
- Existing open case displays blank because stored value is now inactive

---

# C) Functional Specs

## FS-01: Case Category Catalog View

### Purpose
Provide admins a searchable/manageable list of all Case Categories with quick access to View and Edit.

### Preconditions
- Admin user is authenticated and authorized for master maintenance.
- Case Category module is enabled.

### Postconditions
- Admin can view Category records and navigate to create or edit flows.

### Field Rules
| Field | Rule |
|---|---|
| Grid Columns | Code, Display Name, Definition, Department(s), Case Nature(s), Product Type(s), Status, Actions |
| Actions | View, Edit |
| Create Button | Visible to authorized admin users |

### Validation Messages
- Not applicable at grid load level unless filter input validation is introduced.

### System Behaviors
- Display all saved Categories.
- Multi-select values should render as chips.
- Status must show Active / Inactive.
- Clicking View or Edit opens detail screen.

### Error Scenarios
- Grid load failure
- Unauthorized access
- Lookup rendering issue for multi-select labels

---

## FS-02: Create / Edit Case Category

### Purpose
Allow admins to create and maintain Category records used in Case classification.

### Preconditions
- Admin has create/edit permission.
- Department, Case Nature, and Product Type lookups are available.

### Postconditions
- Category record is created or updated successfully.
- Record becomes eligible for downstream use based on status and applicability.

### Field Rules
| Field | Type | Mandatory | Rule |
|---|---|---:|---|
| Category Code | Text | Yes | Max 30 chars; unique; uppercase or configurable standard; trimmed before save |
| Category Display Name | Text | Yes | Max 100 chars; agent-facing; controlled special characters allowed |
| Category Definition | Textarea | Yes | Max 500 chars; admin-facing explanation; not shown in agent dropdown |
| Department(s) | Multi-select lookup | Yes | Values from Department master |
| Case Nature(s) | Multi-select lookup | Yes | Values from Case Nature picklist |
| Product Type(s) | Multi-select lookup | Yes | Values from Category master; label shown as Product Type |
| Is Active | Checkbox | No | Default true on create |

### Validation Messages
- `Mandatory fields cannot be blank.`
- `Code already exists. Please enter a unique code.`
- `Display Name already exists. Please enter a unique name.`
- `Code cannot exceed 30 characters.`
- `Display Name cannot exceed 100 characters.`
- `Definition cannot exceed 500 characters.`
- `Invalid characters entered. Please review the value.`
- `Please select at least one value for Department.`
- `Please select at least one value for Case Nature.`
- `Please select at least one value for Product Type.`

### System Behaviors
- On create, Is Active defaults to true.
- System trims leading/trailing spaces before validation and save.
- Duplicate validation must be case-insensitive.
- Selected multi-value applicability is stored as part of the Category record.
- A Category must be saved before Subcategory can be added.
- Edits affect future agent visibility immediately after successful save.

### Error Scenarios
- Duplicate code
- Duplicate display name
- Lookup service unavailable
- Save transaction failure

---

## FS-03: Add / Edit Case Subcategory

### Purpose
Allow admins to create and maintain Subcategories under a saved Category.

### Preconditions
- Parent Category exists.
- Admin has permission to modify the Category.
- Parent Category detail screen is open.

### Postconditions
- Subcategory is created/updated and linked to the parent Category.

### Field Rules
| Field | Type | Mandatory | Rule |
|---|---|---:|---|
| Subcategory Code | Text | Yes | Max 30 chars; unique globally; trimmed before save |
| Subcategory Display Name | Text | Yes | Max 100 chars; unique within parent Category |
| Subcategory Definition | Textarea | Yes | Max 500 chars; admin-facing explanation |
| Is Active | Checkbox | No | Default true on create |

### Validation Messages
- `Mandatory fields cannot be blank.`
- `Code already exists. Please enter a unique code.`
- `Display Name already exists under this category. Please enter a unique name.`
- `Code cannot exceed 30 characters.`
- `Display Name cannot exceed 100 characters.`
- `Definition cannot exceed 500 characters.`
- `Unable to add subcategory. Please try again.`

### System Behaviors
- Subcategory is always created in the context of a saved parent Category.
- No separate parent mapping is required.
- On save, system auto-links the Subcategory to the current Category.
- If parent Category is inactive, Subcategory cannot be selected by agents.
- If parent Category is inactivated, linked Subcategories are also inactivated by cascade.

### Error Scenarios
- Attempt to add Subcategory before parent save
- Duplicate code
- Duplicate display name within parent
- Parent-child linkage save failure
- Modal save failure

---

## FS-04: Activation / Inactivation Behavior

### Purpose
Control future selection eligibility of Category/Subcategory values without deleting historical data.

### Preconditions
- Category or Subcategory exists.
- Admin has edit permission.

### Postconditions
- Status is updated and reflected in future dropdown behavior.

### Field Rules
| Object | Status Rule |
|---|---|
| Category | Active values are eligible for future agent selection if applicability matches |
| Category | Inactive values are excluded from future agent selection |
| Subcategory | Inactive values are excluded from future agent selection |
| Category → Subcategory | Parent inactivation cascades to linked children |
| Reactivation | Child Subcategories inactivated by parent cascade auto-reactivate |

### Validation Messages
- `Unable to update status. Please try again.`

### System Behaviors
- No hard delete in MVP.
- Historical cases continue to show stored original values.
- Open cases with previously selected values that are now inactive display blank for Category/Subcategory.
- Status changes apply to future dropdowns immediately after save.
- Cascade source should be tracked for correct reactivation behavior.

### Error Scenarios
- Partial cascade failure
- Child records not synced with parent state
- Save or transaction rollback failure

---

## FS-05: Agent-Side Category and Subcategory Selection

### Purpose
Ensure agents can select only valid Category/Subcategory combinations during case handling.

### Preconditions
- Agent is on case form.
- Department and Case Nature are available for selection.
- Product Type is available from case/customer context.
- Active master data exists.

### Postconditions
- Selected Category/Subcategory is valid for the case context and saved.

### Field Rules
| Field | Rule |
|---|---|
| Category dropdown | Show only active Categories matching Department + Case Nature + Product Type |
| Subcategory dropdown | Show only active Subcategories linked to selected Category |
| Existing open case with inactive value | Display blank as per confirmed business rule |
| Historical case with inactive value | Continue showing stored original value |

### Validation Messages
- `No category is available for the selected combination.`
- `Selected category is no longer active. Please select another category.`
- `Selected subcategory is no longer active. Please select another subcategory.`

### System Behaviors
- System evaluates:
  - Department selected by agent
  - Case Nature selected by agent
  - Product Type resolved from Product Type Master
- Subcategory list is dependent on selected Category.
- If Category changes, any already selected Subcategory must be cleared and reselected.

### Error Scenarios
- No matching Categories
- Category inactivated after load but before save
- Subcategory inactivated after load but before save
- Case context missing Product Type

---

# D) User Story Format

## Story 1 — Create Case Category

### Feature
Case Category Master

### User Story
As an **admin user**, I want to create a Case Category with applicability against Department, Case Nature, and Product Type so that only relevant categories are available during case handling.

### Acceptance Criteria
1. Admin can open the Create Case Category screen from the catalog.
2. Admin can enter Category Code, Display Name, Definition, Department(s), Case Nature(s), Product Type(s), and Is Active.
3. Department, Case Nature, and Product Type support multi-select.
4. Is Active defaults to true on create.
5. System validates mandatory fields, length, uniqueness, and allowed characters.
6. On successful save, the Category is created and visible in the catalog.
7. Subcategory creation is enabled only after parent Category is saved.

### Negative Scenarios
- Admin leaves one or more mandatory fields blank.
- Admin enters a duplicate Category Code.
- Admin enters a duplicate Category Display Name.
- Admin exceeds field length.
- Lookup values fail to load.

### Validation Rules
- Code is required, trimmed, max 30, unique.
- Display Name is required, max 100, unique.
- Definition is required, max 500.
- At least one Department, one Case Nature, and one Product Type must be selected.

---

## Story 2 — Edit Case Category

### Feature
Case Category Master Maintenance

### User Story
As an **admin user**, I want to edit an existing Case Category so that applicability and labels can be maintained over time.

### Acceptance Criteria
1. Admin can open an existing Category from the catalog.
2. Admin can update all editable fields.
3. System validates all updated values before save.
4. On successful save, changes are reflected in the catalog.
5. Updated applicability affects future agent dropdowns.

### Negative Scenarios
- Edited Code conflicts with an existing record.
- Edited Display Name conflicts with an existing record.
- Multi-select values are removed entirely, leaving mandatory fields empty.
- Save fails due to transaction error.

### Validation Rules
- Same as create validations.
- Duplicate check excludes the current record being edited.

---

## Story 3 — Add Case Subcategory

### Feature
Case Subcategory Master

### User Story
As an **admin user**, I want to add a Subcategory under a saved Category so that cases can be classified with more detail.

### Acceptance Criteria
1. Admin can add a Subcategory only from a saved parent Category.
2. System opens a modal or dedicated child form for Subcategory creation.
3. Admin can enter Subcategory Code, Display Name, Definition, and Is Active.
4. On save, the Subcategory is automatically linked to the current parent Category.
5. The saved Subcategory appears in the linked Subcategory list.

### Negative Scenarios
- Admin tries to add Subcategory before saving the parent Category.
- Duplicate Subcategory Code is entered.
- Duplicate Subcategory Display Name is entered under the same parent.
- Mandatory fields are blank.
- Save fails.

### Validation Rules
- Subcategory Code is required, max 30, unique.
- Subcategory Display Name is required, max 100, unique within parent.
- Definition is required, max 500.

---

## Story 4 — Inactivate / Reactivate Category with Cascade

### Feature
Status Management for Category and Subcategory

### User Story
As an **admin user**, I want status changes on Category to cascade correctly to linked Subcategories so that future selection is controlled centrally.

### Acceptance Criteria
1. Admin can mark a Category inactive.
2. When a Category is inactivated, linked Subcategories are also inactivated.
3. Inactive Category/Subcategory values are not available for future agent selection.
4. Historical cases continue to show originally stored values.
5. Open cases with already selected inactive values display blank.
6. When the Category is reactivated, Subcategories inactivated by parent cascade auto-reactivate.

### Negative Scenarios
- Cascade update fails for one or more children.
- Reactivation occurs but child state is inconsistent.
- Status update fails due to transaction or concurrency error.

### Validation Rules
- Status update must commit atomically for parent and impacted children, or roll back.
- Cascade-source flag must be maintained for correct reactivation behavior.

---

## Story 5 — Agent Sees Only Applicable Categories

### Feature
Agent Case Classification

### User Story
As an **agent**, I want to see only Categories and Subcategories relevant to the current case context so that I can classify the case accurately and quickly.

### Acceptance Criteria
1. Agent selects Department and Case Nature on the Case form.
2. System resolves Product Type from the case/customer/product context.
3. System shows only active Categories where:
   - Department contains the selected Department
   - Case Nature contains the selected Case Nature
   - Product Type contains the resolved Product Type
4. After Category selection, system shows only active linked Subcategories.
5. Selected Category and Subcategory are saved with the Case.

### Negative Scenarios
- No matching Categories exist.
- Category becomes inactive after load and before save.
- Subcategory becomes inactive after load and before save.
- Product Type is unavailable in case context.

### Validation Rules
- Category cannot be saved unless it is active and applicable at save time.
- Subcategory cannot be saved unless it is active and linked to the selected Category.
- Changing Category clears previously selected Subcategory.

---

## Story 6 — Existing Case Handling When Master Values Become Inactive

### Feature
Case Form Behavior for Inactive Master Values

### User Story
As a **case handler**, I want the case form to follow the defined inactive-value behavior so that the system behaves consistently after master changes.

### Acceptance Criteria
1. If Category/Subcategory becomes inactive after being selected on an open case, those fields display blank on the open case.
2. Those inactive values are not selectable again for future updates.
3. Historical cases continue to display the stored original values.

### Negative Scenarios
- Open case still displays inactive value when it should be blank.
- Historical case loses stored original value.
- Subcategory remains displayed even when parent is inactivated.

### Validation Rules
- Open-case rendering must use current active state.
- Historical case rendering must use stored snapshot/original value logic per platform design.

---

## 2. Open Items for Final Confirmation
1. Confirm exact allowed character pattern for Code.
2. Confirm whether Category Display Name uniqueness should be global or constrained by applicability.
3. Confirm whether Subcategory Code uniqueness should remain global or be scoped by parent.
4. Confirm whether Product Type is always system-derived on agent form or can also be agent-selected in some flows.

---

## 3. Recommended MVP Build Notes
- Prefer soft status control over deletion.
- Store multi-select applicability in a way that supports efficient membership filtering.
- Maintain child inactivation source to support correct auto-reactivation.
- Keep audit/versioning dependent on platform-managed metadata.
- Keep Definition internal; only Display Name should be shown in agent dropdowns.
