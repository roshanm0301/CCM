# Case Creation Workspace — Process Documentation, Functional Specs, and User Stories (MVP)

## Scope Statement
This document defines the build-ready MVP requirements for the **Case Creation Workspace** in the Call Center Management application.

The scope includes:
- Case history display
- New case creation
- Dealer selection for case routing
- Duplicate case validation
- Post-submit behavior

## Applied Decisions from Review
The following reviewed decisions are treated as final in this document:

1. **No interaction-only record will be created when a case is not registered.**
2. **Case History will show only registered cases.**
3. **On customer reselection, the case panel resets in all scenarios and the latest selected customer context is loaded.**
4. **If customer exists but no install-base vehicle is available, case creation is still allowed.**
5. **In the no-install-base scenario, Product Type is shown in the case form for manual selection.**
6. **Dealer filtering depends on Product Type, whether derived from vehicle or selected manually.**
7. **If zero active mapped dealers are available, case creation is blocked with an operational message.**
8. **Duplicate validation runs only after the required combination becomes complete, and re-runs only when one of those fields changes after completion.**
9. **Dialer sync failure handling is out of current scope and deferred.**

## Assumptions
- Case Nature, Department, Priority and other dropdowns are sourced from configurable masters or picklists.
- Product Type values used in case creation are aligned with the Case Category master and dealer mapping logic.
- The application stores standard audit fields at platform/database level.
- Case ID generation logic is configured separately and is not redefined here.
- This document is functional scope, not telephony vendor contract documentation.

---

# B) Process Documentation

## Process 1 — Customer Reselection

### Trigger
Agent selects a different customer after one customer has already been selected.

### Inputs
- Previously selected customer context
- Newly selected customer context
- Current case panel state

### Steps
1. Override existing customer selection with the newly selected customer.
2. Replace:
   - Contact Details Card
   - Vehicle Details Card
   - Dealer Details Card
   - Case History
3. Reset the case panel completely, regardless of whether the case registration form was opened.
4. Load case history for the newly selected customer.
5. Display system feedback indicating context update.

### Outputs
- Latest selected customer becomes active context
- Old in-progress case registration form data is cleared
- Latest customer case history is displayed

### Exceptions
- If new context cannot be loaded, preserve no stale case form data.
- Show user-friendly error if dependent services fail to load.

---

## Process 2 — Open New Case Form

### Trigger
Agent clicks **New Case**.

### Inputs
- Selected customer context
- Vehicle context, if available
- Configured case form masters

### Steps
1. Open Case Registration form on the same screen.
2. Move Case History section below the form.
3. Display case form fields.
4. Initialize dependent fields:
   - Case Category disabled by default
   - Case Subcategory disabled by default
5. If vehicle-derived Product Type is unavailable, display Product Type field in the case form for manual selection.

### Outputs
- Case form visible
- Form ready for entry
- Product Type source determined as either:
  - derived from vehicle
  - selected manually by agent

### Exceptions
- If agent closes the form before case registration:
  - form may retain entered values during the same context/session, unless customer reselection occurs
- If customer reselection occurs:
  - form must reset completely

---

## Process 3 — Complete Case Form and Run Duplicate Check

### Trigger
Agent enters case details.

### Inputs
- Case Nature
- Department
- Priority
- Product Type (derived or manual)
- Case Category
- Case Subcategory
- Customer Remarks
- Agent Remarks

### Steps
1. Agent selects Case Nature.
2. Agent selects Department.
3. If no install-base vehicle exists, agent manually selects Product Type in the form.
4. System enables Case Category after required prerequisites are satisfied.
5. System displays category values applicable to the selected combination.
6. Agent selects Case Category.
7. System enables and filters Case Subcategory.
8. Agent selects Case Subcategory.
9. Once the required duplicate-check combination becomes complete, system performs duplicate validation.
10. If no duplicate is found, agent continues.
11. If duplicate is found, system displays duplicate case popup.
12. If agent changes any duplicate-driving field after completion, system re-runs duplicate validation once the changed state is complete again.

### Outputs
- Completed case form
- Duplicate validation outcome available
- Agent can proceed to dealer selection or view existing case

### Exceptions
- Category remains unavailable if prerequisites are incomplete.
- If no mapped categories are available, submission is blocked.
- If no mapped subcategories are available for selected category, submission is blocked.
- Duplicate modal must not interrupt intermediate partial entry states.

---

## Process 4 — Dealer Selection

### Trigger
Agent clicks **Assign Dealer**.

### Inputs
- Product Type
- Dealer mapping data
- Dealer master data
- Optional filters:
  - search keyword
  - state
  - city
  - pin code

### Steps
1. Open Dealer Search modal.
2. Load only dealers mapped to the applicable Product Type.
3. Derive dealer fields from company/branch master.
4. Allow optional filtering by search and geography.
5. Refresh dealer cards dynamically on filter changes.
6. Show active dealers as selectable.
7. Show inactive dealers as non-selectable.
8. Agent selects one dealer.
9. Populate selected dealer in the case form.

### Outputs
- One dealer selected for the case
- Dealer reference visible in case form

### Exceptions
- If no matching dealers are found after filter application, show: **“No dealers found.”**
- If zero active mapped dealers exist for the selected Product Type, block case creation and show operational message.
- Only one dealer can be selected at a time.

---

## Process 5 — Register Case

### Trigger
Agent clicks **Register Case**.

### Inputs
- All mandatory case form data
- Selected dealer
- Selected customer
- Selected vehicle if applicable

### Steps
1. Validate all mandatory fields.
2. Validate character limits and field dependencies.
3. Ensure duplicate outcome does not require diversion to existing case.
4. Save case data.
5. Generate Document Name / Case ID.
6. Create new case record.
7. Associate case with:
   - selected customer
   - selected vehicle, if applicable
   - selected dealer
8. Display success toaster.
9. Show Document Name and Registered Date & Time in read-only mode at the top of the form.
10. Lock the case form in read-only mode.
11. Refresh Case History for the selected customer.

### Outputs
- New case created successfully
- Read-only case view displayed
- Case history updated
- Open case count updated

### Exceptions
- If mandatory fields are missing, show inline field errors and do not submit.
- If no dealer is selected, block submission.
- If no active mapped dealer exists, block submission with operational message.
- If system save fails, do not create partial case and show failure message.

---

## Process 6 — Reset Case Form

### Trigger
Agent clicks **Reset** before successful case registration.

### Inputs
- Current case form state

### Steps
1. Clear all entered case form values.
2. Return fields to default state.
3. Re-disable dependent fields where applicable.
4. Clear selected dealer.

### Outputs
- Blank case form
- Default field state restored

### Exceptions
- Reset does not alter selected customer context.
- Reset is not available after successful registration because the form is read-only.

---

# C) Functional Specs

## Feature 1 — Customer Reselection Handling

### Purpose
Ensure that switching customer context never leaves stale case data on screen.

### Preconditions
- One customer is already selected.
- Agent selects another customer.

### Postconditions
- New customer context replaces previous context.
- Case registration form is reset.
- New customer case history is loaded.

### Field Rules
On reselection, system must replace:
- Contact Details Card
- Vehicle Details Card
- Dealer Details Card
- Case History

On reselection, system must reset:
- Entire case registration form
- Selected dealer
- Product Type manual selection, if any
- All remarks entered in the case registration form

### Validation Messages
- Feedback message: **“Customer and vehicle details updated based on search selection.”**

### System Behaviors
- Reselection is allowed before or after opening the case registration form
- Reselection does not preserve partially entered case form values

### Error Scenarios
- Partial data loads from the new context
- New context services fail; no old case form data should remain on screen as if still valid

---

## Feature 2 — Case History

### Purpose
Provide visibility into previously registered cases for the selected customer.

### Preconditions
- Customer has been selected.

### Postconditions
- Case history grid is loaded automatically.

### Field Rules
#### Scope of records
- Show only **registered cases**
- Do not show interaction-only rows
- Grid is non-editable and view-only

#### Sorting
- Descending by Date & Time
- Latest first

#### Columns
- Document Name
- Date & Time
- Case Nature
- Case Status
- Activity Status
- Action (View)

#### Open Cases Count
- Count only cases with Case Status:
  - Open
  - Pending Verification
- Exclude:
  - Closed – Verified
  - Closed – Not Verified

### Validation Messages
- **“No case history available.”**
- **“Unable to load case history. Please try again.”**

### System Behaviors
- Case history loads automatically on customer selection
- Case history refreshes when a new case is registered
- Case history refreshes on customer reselection
- View action opens case details in read-only mode, with interaction section editable only if that behavior exists in the application

### Error Scenarios
- Case history service failure
- Duplicate case records returned by source; duplicates must not be rendered

---

## Feature 3 — Case Registration Form

### Purpose
Allow the agent to register a new case for the selected customer.

### Preconditions
- Customer is selected.
- New Case action has been invoked.

### Postconditions
- Case is either:
  - validated and submitted successfully, or
  - kept open with inline validation errors

### Field Rules
#### Case Nature
- Mandatory dropdown
- Values from Case Nature picklist

#### Department
- Mandatory dropdown
- Values from Department master

#### Priority
- Optional dropdown for MVP
- Values from priority picklist

#### Product Type
- Hidden if derived from selected vehicle/install base
- Visible and mandatory only when no vehicle-derived Product Type is available
- Source indicator should be stored:
  - Derived
  - Manually Selected

#### Case Category
- Mandatory dropdown
- Disabled by default
- Enabled after Case Nature and Department selection
- Values sourced from Case Category Master
- Values shown only when applicable to selected:
  - Case Nature
  - Department
  - Product Type

#### Case Subcategory
- Mandatory dropdown
- Disabled by default
- Enabled after Case Category selection
- Values sourced from Case Category Master and filtered by selected category

#### Customer Remarks
- Mandatory free text
- Max 1000 characters

#### Agent Remarks
- Mandatory free text
- Max 1000 characters

#### Dealer
- Mandatory for submission
- Selected via dealer modal
- Only one dealer allowed per case

### Validation Messages
- **“Case Nature is a mandatory field.”**
- **“Department is a mandatory field.”**
- **“Case Category is a mandatory field.”**
- **“Case subcategory is a mandatory field.”**
- **“Customer Remarks is a mandatory field.”**
- **“Agent Remarks is a mandatory field.”**
- **“Customer remarks cannot exceed 1000 characters.”**
- **“Agent remarks cannot exceed 1000 characters.”**
- **“No case categories are configured for the selected combination.”**
- **“No case subcategories are configured for the selected category.”**
- **“Dealer assignment is mandatory.”**
- **“No active dealer is mapped to the selected product type. Case cannot be created. Please contact your supervisor or admin.”**

### System Behaviors
- New Case opens the form on the same screen
- Case History moves below the form
- Close (X) hides the form
- Form values may persist on close/reopen within the same selected customer context
- If customer is reselected, form resets fully

### Error Scenarios
- Mandatory field missing
- Character limit exceeded
- No applicable category
- No applicable subcategory
- Dealer not selected
- No active mapped dealer

---

## Feature 4 — Field Dependency and Reset Logic

### Purpose
Keep dependent values accurate and prevent stale selections.

### Preconditions
- Agent is entering data in the case form.

### Postconditions
- Downstream fields stay synchronized with upstream changes.

### Field Rules
#### If Case Nature changes
Clear:
- Department
- Product Type manual selection, if applicable
- Case Category
- Case Subcategory

Preserve:
- Customer Remarks
- Agent Remarks
- Selected Dealer

#### If Department changes
Clear:
- Case Category
- Case Subcategory

Preserve:
- Customer Remarks
- Agent Remarks
- Selected Dealer

#### If Product Type changes
Clear:
- Case Category
- Case Subcategory
- Selected Dealer

Preserve:
- Customer Remarks
- Agent Remarks

#### If Case Category changes
Clear:
- Case Subcategory

Preserve:
- Customer Remarks
- Agent Remarks
- Selected Dealer

### Validation Messages
No separate messages required beyond field-level mandatory validation.

### System Behaviors
- Dependent dropdown values re-evaluate immediately after parent change
- Dealer selection must always remain aligned to current Product Type

### Error Scenarios
- Stale category or dealer remains selected after upstream change
- Product type source changes but dependent values are not reset

---

## Feature 5 — Duplicate Case Validation

### Purpose
Prevent accidental creation of duplicate open cases for the same issue context.

### Preconditions
- Customer context is selected.
- Required duplicate-check fields are complete:
  - Case Nature
  - Department
  - Case Category
  - Case Subcategory

### Postconditions
- Agent is either routed to existing case or allowed to proceed.

### Field Rules
Duplicate criteria:
- Customer
- Vehicle, if applicable
- Case Nature
- Department
- Case Category
- Case Subcategory
- Case Status in:
  - Open
  - Pending Verification

### Validation Messages
No inline error on no-duplicate scenario.

### System Behaviors
- Do not trigger duplicate popup during intermediate partial entry states
- Run duplicate check only after required combination becomes complete
- Re-run only when one of the duplicate-driving fields changes after completion
- If duplicate found, show popup "Open Case Found. A case with the same Case Nature, Department, Category and Subcategory is already open for this customer and vehicle" with:
  - Registered Date & Time
  - Case Nature
  - Document Name
  - Document Status

#### Duplicate Popup Actions
- **View Existing Case**
- **Cancel**

#### View Existing Case
- Open case detail screen
- Existing case is read-only except follow up section

#### Cancel
- Close popup
- Return agent to case registration form

### Error Scenarios
- Duplicate check service unavailable
- Wrong duplicate because stale customer/vehicle context was used
- Repetitive popup firing during incomplete edits; not allowed

---

## Feature 6 — Dealer Selection Modal

### Purpose
Allow the agent to select the correct active dealer for case routing.

### Preconditions
- Product Type is available, either derived or manually selected.
- Agent opens dealer selection modal.

### Postconditions
- One dealer is selected or the form remains unsubmitted.
- Selected dealer is displayed in the case registration form screen.

### Field Rules
#### Default Dataset
- Show only dealers mapped to current Product Type

#### Filters
- Search keyword: optional
- State: optional
- City: optional
- Pin Code: optional

#### Cascading Geography Logic
- State filters available City and Pin Code values
- City further filters Pin Code values
- Changing State clears City and Pin Code
- Changing City clears Pin Code

#### Dealer Card Fields
- Branch Name
- Branch Code
- Dealer Name
- Dealer Code
- Contact
- Address
- Active/Inactive badge

#### Selection Rules
- Only active dealers are selectable
- Only one dealer may be selected per case
- Selected dealer is displayed below in the case registration form
- Agent can remove the selected dealer before case registration
- After removal, agent can re-open modal and select a new dealer


### Validation Messages
- **“No dealers found.”**
- **“Dealer assignment is mandatory.”**
- **“No active dealer is mapped to the selected product type. Case cannot be created. Please contact your supervisor or admin.”**

### System Behaviors
- Dealer list refreshes on filter change, filter removal, and search/filter combination
- Combined filtering uses AND logic across all applied filters
- Selected dealer value populates in case form
- Agent can change selected dealer before submission

### Error Scenarios
- No mapped dealers
- Only inactive dealers exist
- Dealer data service unavailable

---

## Feature 7 — Register Case and Post-Submit State

### Purpose
Validate, create, and lock the case record after successful registration.

### Preconditions
- All mandatory fields are completed.
- Dealer is selected.
- Duplicate validation permits continuation.

### Postconditions
- New case exists.
- Case form is converted to read-only state.
- Case history refreshes.

### Field Rules
Mandatory fields for submission:
- Case Nature
- Department
- Product Type when manual selection path applies
- Case Category
- Case Subcategory
- Customer Remarks
- Agent Remarks
- Dealer

Fields shown after success:
- Document Name (Case ID) — read-only
- Registered Date & Time — read-only

### Validation Messages
- Success toaster: **“Success – [Document Name] registered successfully.”**
- Inline error messages under each missing field

### System Behaviors
- Save all entered data
- Generate configured case ID
- Create new case record
- Associate case with:
  - selected customer
  - selected vehicle, if applicable
  - selected dealer
- Prevent further edits in case regostration form after success
- Prevent changing customer, vehicle and dealer after success within that displayed case view
- Refresh case history and open-case count
- Set Activity status to fresh by default, and case status to open by default

### Error Scenarios
- Save failure
- Case ID generation failure
- Partial submission must not occur

---

## Feature 8 — Reset Action

### Purpose
Allow the agent to clear pre-submit form data and start over within the same customer context.

### Preconditions
- Case form is open.
- Case is not yet registered.

### Postconditions
- All form fields are cleared and returned to default state.

### Field Rules
Reset clears:
- Case Nature
- Department
- Priority
- Product Type manual selection, if applicable
- Case Category
- Case Subcategory
- Customer Remarks
- Agent Remarks
- Dealer selection

### Validation Messages
None required.

### System Behaviors
- Reset does not change selected customer context
- Reset does not alter cards or case history
- Reset re-applies default disabled state for dependent fields

### Error Scenarios
- Reset leaves stale dependent values
- Reset not applied consistently across all fields

---

# D) User Story Format

## Feature: Customer Reselection

### User Story
As a call center agent, I want the workspace to reset case-entry state when I select another customer so that I do not accidentally create a case against the wrong customer context.

### Acceptance Criteria
1. Selecting a different customer replaces the previous customer context.
2. Contact, vehicle, dealer, and case history data update to the latest selected customer.
3. Any entered case registration form data is cleared on reselection.
4. The latest selected customer's case history is shown.

### Negative Scenarios
- Old case data remains after reselection
- Old selected dealer remains after reselection
- New customer cards load but old case form remains

### Validation Rules
- No previously entered case form data may survive customer reselection.
- No stale dealer, category, or remarks values may remain.

---

## Feature: Case History

### User Story
As a call center agent, I want to see the selected customer's previous registered cases so that I can understand existing and past case activity before creating a new case.

### Acceptance Criteria
1. Case history loads automatically on customer selection.
2. History shows only registered cases.
3. Grid is view-only.
4. History is sorted by latest date/time first.
5. Open case count includes only Open and Pending Verification statuses.
6. View action opens case details.

### Negative Scenarios
- No history exists
- History load fails
- Duplicate case records are returned from source

### Validation Rules
- Interaction-only rows must not be shown.
- Duplicate records must not be rendered.
- Open case badge must exclude closed statuses.

---

## Feature: Open New Case Form

### User Story
As a call center agent, I want to open a new case form within the current workspace so that I can register a customer issue without leaving the screen.

### Acceptance Criteria
1. Clicking New Case opens the form on the same screen.
2. Case History moves below the form.
3. Case Category and Case Subcategory are disabled initially.
4. Product Type appears in the form only when it is not available from vehicle context.
5. Closing the form hides it without submitting.

### Negative Scenarios
- Form opens without customer context
- Product Type is missing and the form does not expose manual selection
- Form retains data after customer reselection

### Validation Rules
- Product Type manual selection must become available only in the no-install-base/no-derived-product-type path.
- Form must reset fully on customer reselection.

---

## Feature: Case Registration Field Dependencies

### User Story
As a call center agent, I want dependent fields to update correctly when I change upstream values so that I cannot submit stale or mismatched case data.

### Acceptance Criteria
1. Case Category enables only after required prerequisite values are available.
2. Case Subcategory enables only after Case Category is selected.
3. Changing Case Nature clears downstream selections.
4. Changing Department clears downstream selections.
5. Changing Product Type clears downstream selections.
6. Changing Case Category clears Case Subcategory.
7. Customer Remarks and Agent Remarks are preserved on upstream dependency changes, but not on customer reselection.

### Negative Scenarios
- Stale category remains after department change
- Stale subcategory remains after category change
- Dealer remains selected after product type change

### Validation Rules
- Dependent values must be cleared immediately when parent values change.
- Dealer selection must always align with current Product Type.

---

## Feature: Duplicate Case Validation

### User Story
As a call center agent, I want the system to warn me when an open duplicate case already exists so that I do not create redundant case records.

### Acceptance Criteria
1. Duplicate validation runs only when Case Nature, Department, Case Category, and Case Subcategory are all selected.
2. Validation checks selected customer and vehicle context where applicable.
3. If duplicate exists in Open or Pending Verification status, a duplicate popup is shown.
4. Popup displays configured case summary details.
5. Agent can either view the existing case or cancel and return to the form.
6. Duplicate check re-runs only when a duplicate-driving field changes after completion.

### Negative Scenarios
- Popup appears during incomplete entry
- Duplicate service fails
- Duplicate check uses stale customer context

### Validation Rules
- Duplicate popup must not fire repeatedly during intermediate form editing.
- Only Open and Pending Verification cases qualify as duplicates.

---

## Feature: Dealer Selection

### User Story
As a call center agent, I want to select the correct dealer for the case so that the case is routed to the correct service provider.

### Acceptance Criteria
1. Clicking Select Dealer opens dealer search modal.
2. Dealers are filtered by current Product Type.
3. Geographic filters and keyword search are optional.
4. Only active dealers are selectable.
5. One dealer can be selected per case.
6. Selecting another dealer replaces the previous selection.
7. If no dealers match filters, the modal shows `No dealers found`.

### Negative Scenarios
- No mapped dealers for Product Type
- Only inactive dealers available
- Dealer data service failure

### Validation Rules
- Case submission must not proceed without a dealer.
- If zero active mapped dealers exist, submission must be blocked with operational message.

---

## Feature: Register Case

### User Story
As a call center agent, I want to register a case with validated details so that the customer issue is formally recorded and routed.

### Acceptance Criteria
1. Register Case validates all mandatory fields.
2. System saves the case only when validation passes.
3. System generates Document Name / Case ID.
4. New case is associated with selected customer, selected vehicle if applicable, and selected dealer.
5. Success toaster is shown after successful save.
6. Document Name and Registered Date & Time appear at the top of the form after save.
7. Form becomes read-only after successful registration.
8. Case History refreshes after registration.
9. Activity status is set to fresh by default, and case status is set to open by default

### Negative Scenarios
- Mandatory field missing
- No dealer selected
- No active mapped dealer exists
- Save fails
- Partial case creation occurs

### Validation Rules
- Submission must be blocked until all mandatory values are valid.
- Post-submit edit must not be allowed.
- Partial save is not allowed.

---

## Feature: Reset Form

### User Story
As a call center agent, I want to reset the case form before submission so that I can start over without changing the selected customer context.

### Acceptance Criteria
1. Reset clears all entered case form values.
2. Dependent fields return to default disabled state where applicable.
3. Selected dealer is cleared.
4. Customer, vehicle, dealer cards, and case history remain unchanged.

### Negative Scenarios
- Reset leaves old dependent values in place
- Reset changes selected customer context
- Reset remains available after successful registration

### Validation Rules
- Reset applies only before successful submission.
- Reset must clear all case-entry values consistently.

---

## Open Implementation Notes
1. Product Type source should be stored for audit/reporting:
   - Derived from vehicle/install base
   - Manually selected by agent
2. Category applicability must stay aligned with the latest Case Category Master behavior.
3. Error and operational messages should be implemented as configurable UI text where possible.
4. Case History and Case Registration must remain case-only constructs; they must not create or display synthetic interaction records in this workflow.

