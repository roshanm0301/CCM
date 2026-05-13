# Activity Flow Configuration — Documentation

It covers:
- **B) Process Documentation**
- **C) Functional Specifications**
- **D) User Stories**

## Scope

### In Scope
1. **Activity Master**
2. **Activity Template**
3. **Template Steps**
4. **Outcome and Routing Configuration**
5. Core validations required to keep a flow usable and safe

### Out of Scope
- Runtime OTP handling
- Parallel routing
- complex conditions
- SLA pause/resume logic
- advanced template versioning
- workload-based assignment
- queue algorithms
- transactional activity execution screens

---

# B) Process Documentation

## Process 1: Create Activity Master Record

### Trigger
Admin selects **Activity Master** in the Activity Flow Configuration module and clicks to add a new activity.

### Inputs
- Code
- Display Name
- Description
- Active / Inactive

### Steps
1. System opens an **Activity drawer**.
2. Admin enters:
   - Code
   - Display Name
   - Description
   - Active / Inactive
3. Admin clicks **Save**.
4. System validates:
   - Code is mandatory
   - Display Name is mandatory
   - Code is unique after trimming spaces and ignoring case
5. If validation passes:
   - record is saved
   - form fields are cleared
   - drawer remains open
   - new record appears in the activity grid
6. Grid displays:
   - Code
   - Display Name
   - Description
   - Active / Inactive
   - Action = Edit
7. On **Edit**, drawer opens with pre-filled data.
8. Admin updates values and clicks **Save**.
9. System updates the record and refreshes the grid.

### Outputs
- New or updated Activity Master record
- Refreshed grid

### Exceptions
- Code missing
- Display Name missing
- Code already exists
- Save/update failure

---

## Process 2: Create Activity Template

### Trigger
Admin chooses to create a new **Activity Template**.

### Inputs
- Template Name
- Applies To
- Department
- Product Type
- Is Active checkbox; Active by default; only Active is usable
- Step definitions

### Steps
1. Admin opens the **Activity Template** screen.
2. Admin enters:
   - Template Name
   - Applies To
   - Department
   - Product Type
3. Admin adds one or more **steps**.
4. For each step, admin enters:
   - Step No.
   - Activity
   - Assigned Role
   - SLA Value
   - SLA Unit
   - Weight %
   - Is Mandatory
   - Is Start Step
5. Admin configures outcomes for each step.
6. Admin saves the template.
7. System validates:
   - only one active template exists for the same applicability combination
   - exactly one Start Step exists
   - every step has at least one outcome
   - Every outcome must result in exactly one of the following: transition to another step (Move Forward), re-create the same step as a new attempt (Loop), or terminate the flow (Close).
   - every step is reachable from the Start Step
   - at least one reachable closure path exists
   - total Weight % = 100
8. If validation passes, template is saved.

### Outputs
- New or updated Activity Template
- Step configuration persisted
- Routing configuration persisted

### Exceptions
- Duplicate active template for same applicability combination
- No Start Step or multiple Start Steps
- One or more steps without outcomes
- Unreachable step exists
- No reachable closure path
- Invalid total Weight %
- Template save failure

---

## Process 3: Add or Update Template Steps

### Trigger
Admin clicks **Add Step** or edits an existing step inside a template.

### Inputs
Per step:
- Step No.
- Activity
- Assigned Role
- SLA Value
- SLA Unit
- Weight %
- Is Mandatory
- Is Start Step

### Steps
1. Admin clicks **Add Step**.
2. System adds a new step row.
3. Admin selects an activity from Activity Master.
4. Admin assigns a role.
5. Admin enters SLA value and selects SLA unit.
6. Admin enters Weight %.
7. Admin marks:
   - Is Mandatory as required
   - Is Start Step where applicable
8. Admin repeats for additional steps.
9. Admin may delete a step if it is not referenced in routing.

### Outputs
- Step rows added, updated, or removed

### Exceptions
- Step deletion blocked if referenced as Next Step in any outcome
- Invalid/missing step data
- More than one Start Step

---

## Process 4: Configure Outcomes and Routing

### Trigger
Admin clicks **Configure Outcomes** for a step.

### Inputs
Per outcome:
- Outcome Name
- Outcome Type
- Next Step
- Role Override
- Requires OTP Verification

### Steps
1. System opens an **Outcome Configuration modal** for the selected step.
2. System shows all existing outcomes for that step.
3. Admin adds, edits, or deletes outcomes.
4. For each outcome, admin enters:
   - Outcome Name
   - Outcome Type = Move Forward / Loop / Close
   - Next Step where required
   - Role Override where needed
   - Requires OTP Verification checkbox
5. System validates outcome rules:
   - Outcome Name is mandatory
   - duplicate outcome names are not allowed within the same step
   - Move Forward requires Next Step
   - Loop requires Next Step = blank
   - Close requires Next Step = blank and flow closure
6. Admin saves the outcome configuration.
7. System stores each outcome as a separate configuration entry.

### Outputs
- Outcome routing rules stored for the selected step

### Exceptions
- Missing outcome name
- Duplicate outcome name within step
- Missing Next Step for Move Forward
- Next Step entered for Loop or Close
- Save failure

---

## Process 5: Delete Step

### Trigger
Admin clicks **Delete Step**.

### Inputs
- Selected step

### Steps
1. System checks whether the step is referenced as **Next Step** in any configured outcome.
2. If not referenced, system removes the step.
3. If referenced, system blocks deletion and shows an error.

### Outputs
- Step deleted if valid

### Exceptions
- Step is being used in outcome routing

---

## Process 6: Template Application in Runtime

### Trigger
A business record requiring activity flow is created or updated in a transaction screen.

### Inputs
- Parent record context
- Applies To
- Department
- Product Type

### Steps
1. System evaluates template applicability based on configured criteria.
2. Only **Active** templates are considered.
3. System identifies the one valid template for the matching applicability combination.
4. System starts the flow from the configured **Start Step**.
5. Runtime activity handling occurs in the transaction layer.

### Outputs
- Applicable template selected
- Start Step identified

### Exceptions
- No active template found
- More than one active template found for the same applicability combination

---

# C) Functional Specifications

## Feature 1: Activity Master

### Purpose
To maintain a reusable list of activities that can be used in Activity Templates.

### Preconditions
- Admin has access to Activity Flow Configuration
- Activity drawer is accessible

### Postconditions
- Activity record is created or updated
- Grid reflects latest saved data

### Field Rules

#### Code
- Type: Text
- Mandatory: Yes
- Must be unique
- Duplicate check must ignore case and leading/trailing spaces

#### Display Name
- Type: Text
- Mandatory: Yes

#### Description
- Type: Text Area
- Mandatory: No

#### Is Active
- Type: TCheckbox
- Mandatory: Yes
- Default: Active (Checked)

### Validation Messages
- `Code is required.`
- `Display Name is required.`
- `Activity code already exists.`

### System Behaviors
- On save success, record is stored and shown in grid
- Form is cleared after save
- Drawer remains open
- Edit opens the drawer with pre-filled values
- Grid refreshes after update

### Error Scenarios
- Save fails due to server issue
- Duplicate code detected
- Mandatory field not entered

---

## Feature 2: Activity Master Grid

### Purpose
To display existing activities and allow editing.

### Preconditions
- At least zero or more activity records may exist

### Postconditions
- Admin can review and edit activity records

### Field Rules
Grid columns:
- Code
- Display Name
- Description
- Status (active/inactive)
- Actions = Edit

### Validation Messages
Not applicable at grid load level beyond generic fetch failures.

### System Behaviors
- Grid must refresh after successful save or update
- Edit action must open pre-filled drawer

### Error Scenarios
- Grid load failure
- Edit fetch failure

---

## Feature 3: Activity Template Header

### Purpose
To define the applicability context for an activity flow.

### Preconditions
- Admin has access to template configuration
- Department values are available from Department Master

### Postconditions
- Template header is saved with applicability values

### Field Rules

#### Template Name
- Type: Text
- Mandatory: Yes

#### Applies To
- Type: Dropdown
- Mandatory: Yes
- Values sourced from document type configuration

#### Department
- Type: Dropdown
- Mandatory: Yes
- Values from Department Master

#### Product Type
- Type: Dropdown
- Mandatory: Yes
- Dropdown values sourced from Product Type master
- Current MVP example includes Vehicle

#### Is active
- Type: Checkbox
- Active by default
- Only Active templates can be applied at runtime

### Validation Messages
- `Template Name is required.`
- `Applies To is required.`
- `Department is required.`
- `Product Type is required.`
- `An active template already exists for the selected applicability combination.`

### System Behaviors
- Only one active template is allowed for the same applicability combination
- Only Active templates are available for runtime application
- Inactive templates remain unavailable for runtime application

### Error Scenarios
- Duplicate active template conflict
- Save failure
- Invalid applicability data

---

## Feature 4: Step Configuration

### Purpose
To define the steps that make up an activity flow.

### Preconditions
- Template header exists or is being created
- Activities exist in Activity Master
- Roles are available for selection

### Postconditions
- Step configuration is stored for the template

### Field Rules

#### Step No.
- Type: Numeric
- Mandatory: Yes
- Must be unique within the template

#### Activity
- Type: Dropdown
- Mandatory: Yes
- Values from Activity Master
- Only active activities should be selectable

#### Assigned Role
- Type: Dropdown
- Mandatory: Yes

#### SLA Value
- Type: Numeric
- Mandatory: No
- `0` means no SLA

#### SLA Unit
- Type: Dropdown
- Mandatory: No
- Values: Hours, Days

#### Weight %
- Type: Numeric
- Mandatory: No
- Template total must equal 100

#### Is Mandatory
- Type: Checkbox
- Mandatory: No
- Meaning: flow cannot close unless this step is completed, if it is part of the reachable path

#### Is Start Step
- Type: Checkbox
- Mandatory: No
- Exactly one step in the template must be marked as Start Step

### Validation Messages
- `Step No. is required.`
- `Step No. must be unique within the template.`
- `Activity is required.`
- `Assigned Role is required.`
- `Only one Start Step is allowed.`
- `Total Weight % must equal 100.`

### System Behaviors
- Admin can add multiple steps
- Admin can delete a step only if it is not referenced by any outcome
- Weight is counted once on first successful non-loop completion of the step in runtime

### Error Scenarios
- Missing role or activity
- Duplicate Step No.
- Multiple Start Steps
- Invalid weight total
- Delete blocked because step is referenced in routing

---

## Feature 5: Outcome and Routing Configuration

### Purpose
To define the allowed outcomes for each step and determine what happens next.

### Preconditions
- Template step exists
- Admin opens Configure Outcomes for a specific step

### Postconditions
- Outcomes and routing rules are saved for the step

### Field Rules

#### Outcome Name
- Type: Text
- Mandatory: Yes
- Must be unique within the same step after trimming spaces and ignoring case

#### Outcome Type
- Type: Dropdown
- Mandatory: Yes
- Values:
  - Move Forward
  - Loop
  - Close

#### Next Step
- Type: Dropdown
- Required only for Move Forward
- Must be blank for Loop and Close

#### Role Override
- Type: Dropdown
- Optional

#### Requires OTP Verification
- Type: Checkbox
- Optional
- Placeholder only in this document
- Runtime OTP handling is not covered here

### Validation Messages
- `Outcome Name is required.`
- `Duplicate outcome name is not allowed within the same step.`
- `Next Step is required for Move Forward outcome.`
- `Next Step must be blank for Loop outcome.`
- `Next Step must be blank for Close outcome.`

### System Behaviors
- Each outcome is stored as a separate configuration entry
- Move Forward routes to selected Next Step
- Loop:
  - completes the current attempt with loop outcome
  - recreates the same step as a new pending attempt
  - does not move to a different step
- Close:
  - closes the flow
  - does not route to another step
- Role Override, if configured, overrides the default Assigned Role of the next step

### Error Scenarios
- Save blocked because of invalid outcome type configuration
- Outcome references invalid or missing next step
- Duplicate outcome names within the same step

---

## Feature 6: Template Integrity Validations

### Purpose
To ensure a template is structurally valid before it becomes usable.

### Preconditions
- Template header, steps, and outcomes exist in editable state

### Postconditions
- Valid template can be saved and activated
- Invalid template is blocked

### Validation Rules
1. Exactly one Start Step must exist
2. Every step must have at least one outcome
3. Every outcome must either:
   - route to another step (move forward)
   - re-create the same step as a new attempt (Loop), or
   - close the flow (close)
4. Every step must be reachable from the Start Step
5. At least one **reachable closure path** must exist from the Start Step
6. Total Weight % must equal 100
7. If a step is referenced by any outcome, it cannot be deleted
8. Only one active template can exist for the same applicability combination

### Validation Messages
- `Exactly one Start Step is required.`
- `Every step must have at least one outcome.`
- `Every step must be reachable from the Start Step.`
- `At least one reachable closure path is required.`
- `Step is being used in outcome routing.`
- `Only one active template is allowed for the selected applicability combination.`

### System Behaviors
- Validation runs on save and/or activate as per implementation
- Runtime application must consider only valid active templates

### Error Scenarios
- Broken routing graph
- orphan step exists
- no closure path
- duplicate active template

---

## Feature 7: Runtime Applicability

### Purpose
To identify which configured template should apply to a transaction record.

### Preconditions
- At least one active template exists
- Parent record provides applicability values

### Postconditions
- Correct template is selected for runtime use
- Start Step is identified

### Field Rules
Applicability keys:
- Applies To
- Department
- Product Type

### Validation Messages
- `No active template found for the selected context.`
- `More than one active template found for the selected context.`

### System Behaviors
- Only Active templates are considered
- Runtime behavior must reject ambiguous template matches
- Start Step is used as the first step of execution

### Error Scenarios
- No matching template
- Multiple matching templates due to bad configuration

---

# D) User Story Format

## Feature: Maintain Activity Master

### User Story
As an **Admin**, I want to create and maintain reusable activities so that I can use them while configuring activity flows across applicable business processes.

### Acceptance Criteria
1. Admin can open an activity drawer from Activity Master.
2. Drawer contains:
   - Code
   - Display Name
   - Description
   - Active / Inactive
   - Cancel
   - Save
3. Code and Display Name are mandatory.
4. Code must be unique after trimming spaces and ignoring case.
5. On successful save:
   - record is stored
   - form clears
   - drawer remains open
   - grid refreshes and shows new record
6. Grid shows:
   - Code
   - Display Name
   - Description
   - Active / Inactive
   - Edit
7. On Edit, drawer opens with pre-filled data.
8. On update save, record is updated and grid refreshes.

### Negative Scenarios
- Admin clicks Save without Code
- Admin clicks Save without Display Name
- Admin enters duplicate Code
- Save fails due to technical issue

### Validation Rules
- Code mandatory
- Display Name mandatory
- Code unique, case-insensitive, trimmed

---

## Feature: Create Activity Template Header

### User Story
As an **Admin**, I want to define the applicability of an activity template so that the right flow can be applied to the right business context.

### Acceptance Criteria
1. Admin can enter Template Name, Applies To, Department, and Product Type.
2. System allows saving template header with valid values.
3. System allows only one active template for the same applicability combination.
4. Only Active templates are eligible for runtime application.

### Negative Scenarios
- Template saved without mandatory header values
- Another active template already exists for same applicability combination
- Template save fails

### Validation Rules
- Template Name mandatory
- Applies To mandatory
- Department mandatory
- Product Type mandatory
- Single active template per applicability combination

---

## Feature: Configure Template Steps

### User Story
As an **Admin**, I want to add and manage steps in a template so that I can define the intended flow structure.

### Acceptance Criteria
1. Admin can add multiple step rows.
2. Each step row contains:
   - Step No.
   - Activity
   - Assigned Role
   - SLA Value
   - SLA Unit
   - Weight %
   - Is Mandatory
   - Is Start Step
3. Step No. is unique within the template.
4. Only one step can be marked as Start Step.
5. Total Weight % across steps must equal 100.
6. Admin can delete a step only if it is not referenced in any outcome routing.
7. Only active activities are available in Activity dropdown.

### Negative Scenarios
- Multiple Start Steps selected
- Step No. duplicated
- Weight total is not 100
- Activity or role missing
- Delete attempted on referenced step

### Validation Rules
- Step No. mandatory and unique within template
- Activity mandatory
- Assigned Role mandatory
- SLA Unit mandatory
- Weight % mandatory
- Exactly one Start Step
- Total Weight % = 100
- Referenced steps cannot be deleted

---

## Feature: Configure Step Outcomes and Routing

### User Story
As an **Admin**, I want to define outcomes for each step so that the flow can move forward, loop, or close based on the selected outcome.

### Acceptance Criteria
1. Configure Outcomes action opens a modal for the selected step.
2. Admin can add, edit, and delete outcomes for that step.
3. Each outcome row contains:
   - Outcome Name
   - Outcome Type
   - Next Step
   - Role Override
   - Requires OTP Verification
4. Move Forward outcome requires Next Step.
5. Loop outcome requires Next Step to remain blank.
6. Close outcome requires Next Step to remain blank and must close the flow.
7. Duplicate outcome names are not allowed within the same step.
8. Each outcome is stored as a separate configuration entry.

### Negative Scenarios
- Outcome saved without name
- Duplicate outcome name entered within same step
- Move Forward selected without Next Step
- Next Step selected for Loop
- Next Step selected for Close

### Validation Rules
- Outcome Name mandatory
- Outcome Name unique within same step, case-insensitive, trimmed
- Next Step mandatory for Move Forward
- Next Step blank for Loop
- Next Step blank for Close

---

## Feature: Validate Template Integrity

### User Story
As a **System**, I want to validate template structure before allowing use so that broken or incomplete flows are not applied in runtime.

### Acceptance Criteria
1. Template must have exactly one Start Step.
2. Every step must have at least one outcome.
3. Every outcome must result in exactly one of the following: transition to another step (Move Forward), re-create the same step as a new attempt (Loop), or terminate the flow (Close).
4. Every step must be reachable from the Start Step.
5. At least one reachable closure path must exist from the Start Step.
6. Template cannot remain active if validation fails.

### Negative Scenarios
- No Start Step exists
- Multiple Start Steps exist
- One or more steps have no outcomes
- Unreachable step exists
- No reachable closure path exists

### Validation Rules
- Exactly one Start Step
- Outcome coverage required for every step
- Reachability validation mandatory
- Reachable closure path mandatory

---

## Feature: Delete Step Safely

### User Story
As an **Admin**, I want the system to prevent deletion of routed steps so that the template structure remains valid.

### Acceptance Criteria
1. System checks whether the selected step is referenced as Next Step in any outcome.
2. If referenced, deletion is blocked.
3. System shows the configured validation message.
4. If not referenced, step is deleted successfully.

### Negative Scenarios
- Admin attempts to delete a step that is used in routing

### Validation Rules
- Referenced step cannot be deleted
- Message: `Step is being used in outcome routing.`

---

## Feature: Apply Active Template in Runtime

### User Story
As a **System**, I want to apply only one active template for the matching context so that runtime activity execution starts from the correct flow.

### Acceptance Criteria
1. System evaluates Applies To, Department, and Product Type.
2. Only Active templates are considered.
3. If exactly one matching active template exists, it is selected.
4. Runtime starts from the configured Start Step.
5. If no matching active template exists, runtime application is blocked.
6. If more than one matching active template exists, runtime application is blocked.

### Negative Scenarios
- No active template found
- Multiple active templates found for same context

### Validation Rules
- One and only one applicable active template at runtime
- Start Step must exist in selected template

---

## Open Notes for Build Team
1. OTP checkbox is only a configuration placeholder in this document.
2. Runtime OTP handling must be defined in the transactional specification.
3. The transactional layer should maintain attempt-level history for Loop outcomes by recreating the same step as a new pending attempt.
4. Progress calculation should count each configured step only once on first successful non-loop completion.
5. Inactive activities should not be selectable for new step configuration.

---
## End of Document
