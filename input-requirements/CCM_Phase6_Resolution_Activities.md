# Post Case Registration — MVP Documentation

## Document Purpose
This document converts the approved **Post Case Registration** scope into build-ready documentation.

This document covers:
1. Post-registration case view
2. Dealer catalog view
3. Resolution tab behavior
4. Follow Up tab behavior

---

# B) Process Documentation

## Process 1: Open Registered Case After Registration

### Trigger
A saved case is opened again by a logged-in user.

### Preconditions
1. Case is already registered.
2. User has access to view the case.

### Inputs
1. Case identifier
2. Logged-in user persona
3. Logged-in user role

### Steps
1. System opens the case detail screen.
2. System displays the following cards in the **Left Panel** in read-only mode:
   - Customer Details Card
   - Vehicle Details Card
   - Dealer Details Card
3. System displays tabs:
   - Case
   - Follow Up
   - Resolution
4. System opens the **Case** tab by default.
5. System displays all Case Tab fields in read-only mode.
6. System displays Assigned Dealer in read-only mode.
7. System evaluates persona-based editability:
   - Follow Up tab is editable only for Agent persona.
   - Follow Up tab is read-only for Dealer persona.
   - Resolution tab is editable only for the assigned role.
8. If case status is Closed, system disables editing in:
   - Follow Up tab
   - Case Tab
   - Current Activity section in Resolution tab

### Outputs
1. Read-only case view is displayed.
2. Tabs are displayed with persona-based access.
3. Editability is applied based on persona, assigned role, and case status.

### Exceptions
1. If case is closed, Follow Up creation button is disabled.
2. If case is closed, Resolution tab is read-only.
3. If user is not the assigned role, Resolution current activity is read-only.

---

## Process 2: Dealer Catalog View of Assigned Cases

### Trigger
Dealer user opens the catalog view screen.

### Preconditions
1. Dealer user is logged in.
2. Cases are registered against the dealer.

### Inputs
1. Dealer user identity
2. Dealer mapping
3. Optional selected filters
4. Optional sort selection

### Steps
1. System loads all cases registered against the dealer.
2. System displays a grid with these columns:
   - Document Name
   - Registered Date Time
   - Department
   - Case Nature
   - Case Category
   - Case Subcategory
   - Customer Name
   - Customer Mobile Number
   - Current Assigned Role
   - Activity Status
   - Case Status
3. System displays latest cases first using descending Registered Date Time.
4. System keeps the grid in view-only mode.
5. System provides a Filters button:
   - On click, system opens a right side drawer.
6. System displays the following multi-select filters inside the drawer:
   - Department
   - Case Nature
   - Case Category
   - Case Subcategory
   - Activity Status
   - Case Status
   - Registered Date (From Date and To Date)
6. System allows user to select one or more values in each filter.
7. System applies filters only when user clicks Apply:
   - System validates date range (if provided).
   - System applies all selected filters simultaneously.
   - System refreshes the grid based on selected filters.
   - System closes the drawer.
   - System persists the applied filter state.
8. System resets filter selections when user clicks Reset:
   - All selected values (including date range) are cleared.
   - Grid remains unchanged until Apply is clicked.
9. System handles drawer close (Cross button) as follows:
   - If user clicks Cross before Apply:
      - System discards all temporary selections.
      - Grid remains unchanged.
   - If user clicks Cross after Apply:
      - System closes the drawer.
      - Applied filters and grid remain unchanged.
10. System supports sorting on Registered Date Time in ascending order and descending order.
11. User clicks on document name on a row.
12. System opens the detailed case screen.
13. System opens the Case tab by default.
14. Dealer user can click on resolution tab to navigate to Resolution tab to perform activities.

### Outputs
1. Dealer sees assigned cases in latest-first order.
2. Dealer can filter and sort the grid.
3. Dealer can open case details and navigate to Resolution tab.

### Exceptions
1. If no cases exist for the dealer, grid displays empty state as per implementation standard.
2. If no new case is assigned, auto-refresh does not change current data set.

---

## Process 3: Initial Load of Resolution Tab

### Trigger
Dealer user opens the Resolution tab for a registered case.

### Preconditions
1. Case is registered.
2. Dealer user has opened a case detail screen.
3. Case has Case Nature, Department, and Product Type values available.

### Inputs
1. Case Nature
2. Department
3. Product Type

### Steps
1. System loads the Resolution tab.
2. System loads the Resolution History grid.
3. System identifies the applicable activity template using:
   - Case Nature
   - Department
   - Product Type
4. If exactly one template is found, system loads the template.
5. If no saved outcome exists for the case, system auto-populates Current Activity using the activity mapped to the Start Step.
6. System displays the Current Activity section at the top.
7. System displays these fields in Current Activity section:
   - Activity Name
   - Step Number
   - Assigned Role
   - Outcome
   - Remarks
   - Attachments
8. System ensures only one current activity is displayed at any time.
9. System allows editing only when:
   - case is not closed
   - user role matches Assigned Role
   - or user role matches Role Override
10. System loads only outcomes configured for the current step into the Outcome dropdown.
11. System loads past saved activity entries into Resolution History grid.
12. System shows latest activity first in Resolution History grid.

### Outputs
1. Current Activity section is displayed.
2. Resolution History grid is displayed.
3. Applicable outcomes are loaded for the active step.

### Exceptions
1. If no template is found, system displays: **No activity templates configured for this case.**
2. If multiple templates are found, system displays: **Multiple activity templates found. Contact admin.**
3. If no activities exist, grid displays: **No activity has been performed yet.**

---

## Process 4: Save Resolution Activity

### Trigger
Dealer user selects an outcome and clicks Save in the Current Activity section.

### Preconditions
1. User is authorized to act on the current activity.
2. Current step is active.
3. Case is not closed.
4. Outcome belongs to the current step.
5. Mandatory inputs are entered.

### Inputs
1. Selected Outcome
2. Remarks
3. Optional Attachments

### Steps
1. User selects an outcome from the Outcome dropdown.
2. User enters remarks.
3. User optionally uploads attachments.
4. User clicks Save.
5. System validates:
   - user authorization
   - active step
   - outcome validity
   - remarks
   - attachment type
   - attachment size
6. System saves:
   - Outcome
   - Remarks
   - Timestamp
   - Performed By
   - Role
   - Attachments
7. System adds the new entry at the top of Resolution History grid.
8. System evaluates Outcome Type.

### Outputs
1. New entry is saved.
2. Resolution History grid is updated.
3. Activity Status is updated in:
   - Call History grid
   - Dealer Catalog View grid

### Exceptions
1. If user is unauthorized, save is blocked.
2. If submitted step is stale, save is blocked.
3. If duplicate submission occurs, only one request is processed.
4. If validation fails, data is not saved.

---

## Process 5: Handle Loop Outcome

### Trigger
Saved outcome type is **Loop**.

### Preconditions
1. Current activity is saved successfully.
2. Selected outcome is configured with Outcome Type = Loop.

### Inputs
1. Current activity step
2. Current step outcome mapping

### Steps
1. System records the saved entry in history.
2. System keeps the same activity in the Current Activity section.
3. System keeps the Outcome dropdown mapped to the same step.
4. System allows dealer to select another outcome for the same activity.

### Outputs
1. Same activity remains current.
2. Dealer can continue on the same activity.

### Exceptions
1. If current case is closed, current activity is not editable.

---

## Process 6: Handle Move Forward Outcome

### Trigger
Saved outcome type is **Move Forward**.

### Preconditions
1. Current activity is saved successfully.
2. Selected outcome is configured with Outcome Type = Move Forward.

### Inputs
1. Current step
2. Next step configuration
3. Optional role override

### Steps
1. System records the saved activity entry in history.
2. System determines the next step from configuration.
3. System updates Current Activity section with:
   - new Activity
   - new Step Number
   - new Assigned Role
4. System loads Outcome dropdown values mapped to the new step.
5. System applies role override when configured.

### Outputs
1. Current Activity moves to next step.
2. Allowed outcomes are refreshed for next step.
3. Assigned role is updated for next step.

### Exceptions
1. If next step is missing or invalid, system displays: **Next step configuration is invalid.**

---

## Process 7: Handle Close Outcome

### Trigger
Saved outcome type is **Close**.

### Preconditions
1. Current activity is saved successfully.
2. Selected outcome is configured with Outcome Type = Close.

### Inputs
1. Current step
2. Mandatory step completion status

### Steps
1. System validates that all mandatory steps are completed.
2. If validation passes, system marks the case as Closed.
3. System makes the entire Resolution tab read-only.
4. System prevents further outcome selection.
5. System prevents further edits.

### Outputs
1. Case is closed.
2. Resolution tab becomes read-only.

### Exceptions
1. If mandatory steps are not completed, system displays: **Mandatory steps are not completed. Cannot close case.**
2. If validation fails, case remains open.
3. If validation fails, current activity remains unchanged.

---

## Process 8: Add Follow Up

### Trigger
Agent clicks **Add Follow Up** in Follow Up tab.

### Preconditions
1. Logged-in user persona is Agent.
2. Case status is not Closed.

### Inputs
1. Customer Remarks
2. Agent Remarks

### Steps
1. Agent opens Follow Up tab.
2. System displays Add Follow Up action only for Agent persona.
3. Agent clicks Add Follow Up.
4. System opens Follow Up input section.
5. Agent enters:
   - Customer Remarks
   - Agent Remarks
6. Agent clicks Save.
7. System trims both fields before validation.
8. System validates both fields.
9. System saves the follow-up entry.
10. System captures:
    - Date and Time
    - Agent Name
11. System converts the new entry into read-only mode.
12. System displays the saved entry in Follow Up History.
13. System displays latest follow-up first.

### Outputs
1. Follow-up entry is saved.
2. Follow-up entry is shown in read-only history.
3. Agent sees latest entry at top.

### Exceptions
1. If case is Closed, Add Follow Up button is disabled.
2. Dealer persona cannot create follow-up.
3. If validation fails, follow-up is not saved.

---

## Process 9: View Follow Up History

### Trigger
Any user opens Follow Up tab.

### Preconditions
1. Case is registered.

### Inputs
1. Case identifier

### Steps
1. System loads all saved follow-up entries for the case.
2. System displays entries in read-only mode.
3. Each entry shows:
   - Customer Remarks
   - Agent Remarks
   - Date and Time
   - Agent Name
   - Call Recording Link, when available
4. System sorts entries in descending Date and Time order.
5. If no follow-ups exist, system displays empty state message.

### Outputs
1. Follow-up history is visible to all users.
2. Data is displayed in latest-first order.

### Exceptions
1. If no follow-up exists, system displays: **No follow-ups have been added yet.**

---

# C) Functional Specifications

## Feature 1: Post Case Registration Screen

### Purpose
Display the registered case in a structured read-only layout with controlled access to Follow Up and Resolution actions.

### Preconditions
1. Case is registered.
2. User opens saved case.
3. User has permission to view the case.

### Postconditions
1. Left panel is displayed in read-only mode.
2. Case tab is displayed in read-only mode.
3. Follow Up and Resolution tab editability is controlled by persona, role, and case status.

### Field Rules
#### Left Panel
- Customer Details Card: Read-only
- Vehicle Details Card: Read-only
- Dealer Details Card: Read-only

#### Tabs
- Case: Read-only
- Assigned Dealer in Case Tab: Read-only
- Follow Up: Editable only for Agent persona when case is not Closed
- Resolution: Editable only for assigned role when case is not Closed

### Validation Messages
No direct field validation in this feature.

### System Behaviors
1. Case tab opens by default.
2. Follow Up tab is read-only for Dealer persona.
3. Resolution current activity is disabled when case is Closed.
4. Follow Up add action is disabled when case is Closed.

### Error Scenarios
1. User without edit eligibility sees read-only tab behavior.

---

## Feature 2: Dealer Catalog View Screen

### Purpose
Allow dealer user to view assigned cases and navigate to case details for resolution work.

### Preconditions
1. Dealer user is logged in.
2. Cases are assigned to the dealer.

### Postconditions
1. Dealer sees the case grid.
2. Dealer can filter, sort, and open case details.
3. Dealer can navigate to Resolution tab from case details.

### Field Rules
#### Grid Columns
- Document Name
- Registered Date Time
- Department
- Case Nature
- Case Category
- Case Subcategory
- Customer Name
- Customer Mobile Number
- Activity Status
- Case Status

#### Grid Rules
- Grid is read-only
- Default sort is Registered Date Time descending
- Data source is saved documents

#### Filters
- Filters are accessed via a Filters button
- On click, a right-side drawer opens. The drawer contains:
- Department: Multiselect
- Case Nature: Multiselect
- Case Category: Multiselect
- Case Subcategory: Multiselect
- Activity Status: Multiselect
- Case Status: Multiselect
- Registered Date: From Date and To Date
- Users can select one or more values in each filter
- All selections remain temporary until Apply is clicked

#### Filter Controls
- Apply button
   - Applies all selected filters simultaneously
   - Validates date range (if provided)
   - Refreshes grid based on selected filters
   - Closes drawer
   - Persists applied filter state
- Reset button
   - Clears all selected values (including date range)
   - Does NOT refresh grid until Apply is clicked
- Close button
   - If clicked before Apply:
   - Discards all temporary selections
   - Closes drawer
   - Grid remains unchanged
   - If clicked after Apply:
   - Closes drawer
   - Applied filters and grid remain unchanged

#### Sorting
- Registered Date Time supports ascending
- Registered Date Time supports descending

### Validation Messages
- From date cannot be after To date 

### System Behaviors
1. Grid auto-refreshes when a new case is assigned to dealer.
2. Multiple filters can be applied simultaneously only on Apply action.
3. Grid refreshes after filter application.
4. Clicking View opens detailed case screen.
5. Case tab opens by default on detailed screen.

### Error Scenarios
1. No assigned case results in empty grid state as per implementation standard.

---

## Feature 3: Resolution History Grid

### Purpose
Show the full saved resolution history for the case in read-only mode.

### Preconditions
1. Case is registered.
2. Resolution tab is opened.

### Postconditions
1. Resolution history grid is displayed.
2. New activity entry appears at top after save.

### Field Rules
#### Grid Columns
- Activity
- Outcome
- Remarks
- Date and Time
- Performed By
- Role
- Attachments

#### History Grid Rules
- Read-only
- Latest first by Date and Time descending
- Attachments column shows clickable image links when available
- Attachments column remains blank when no attachment exists

### Validation Messages
No direct field validation in this feature.

### System Behaviors
1. Clicking attachment link opens file in new tab.
2. Attachment file is automatically downloaded.
3. Empty grid message is displayed when no activity exists.

### Error Scenarios
1. If no activities exist, system displays: **No activity has been performed yet.**

---

## Feature 4: Resolution Current Activity Section

### Purpose
Allow the authorized dealer role to perform the current activity for the case.

### Preconditions
1. Applicable template is resolved successfully.
2. Current step is active.
3. Case is not Closed.
4. User role matches Assigned Role, or user role matches Role Override.

### Postconditions
1. Saved activity is added to history.
2. Current activity state is updated based on outcome type.
3. Resolution tab becomes read-only after close.

### Field Rules
#### Read-only Fields
- Activity Name
- Step Number
- Assigned Role

#### Editable Fields
- Outcome: Dropdown, mandatory
- Remarks: Textarea, mandatory
- Attachments: Optional upload

#### Outcome Rules
- Only outcomes configured for current step are displayed
- Outcomes from other steps must not be displayed
- Submitted outcome must belong to current step

#### Remarks Rules
- Mandatory
- Trim before validation
- Max 500 characters

#### Attachment Rules
- Optional
- Supported file formats:
  - PDF
  - JPG
  - PNG
  - JPEG
- Maximum file size: 5 MB

### Validation Messages
- Invalid outcome selected.
- Please enter remarks.
- Remarks cannot exceed 500 characters.
- File size exceeds limit.
- Unsupported file type.
- You are not authorized to perform this action.
- This activity is no longer active. Please refresh.

### System Behaviors
1. Only one current activity is shown at a time.
2. If no outcome was previously saved, Start Step activity is auto-populated.
3. Save captures:
   - Outcome
   - Remarks
   - Timestamp
   - Performed By
   - Role
   - Attachments
4. Save adds entry to the top of Resolution History grid.
5. Duplicate submissions are prevented.
6. Only one request is processed for duplicate attempts.
7. Activity Status is updated in:
   - Call History grid
   - Dealer Catalog View grid

### Error Scenarios
1. Unauthorized user attempts save.
2. Submitted step is no longer active.
3. Invalid outcome is submitted.
4. Unsupported attachment type is uploaded.
5. Attachment size exceeds limit.
6. Duplicate save request is sent.

---

## Feature 5: Resolution Template Resolution

### Purpose
Resolve the correct activity template for the case before runtime execution.

### Preconditions
1. Case has values for:
   - Case Nature
   - Department
   - Product Type

### Postconditions
1. Exactly one applicable template is loaded into Resolution runtime.

### Field Rules
Template resolution is based on:
- Case Nature
- Department
- Product Type

### Validation Messages
- No activity flow configured for this case.
- Multiple activity flows found. Contact admin.

### System Behaviors
1. Template lookup occurs when Resolution tab loads.
2. Start Step activity is loaded when no previous outcome exists.

### Error Scenarios
1. No matching template exists.
2. More than one matching template exists.

---

## Feature 6: Outcome Type Handling

### Purpose
Move the current activity flow correctly after save based on configured outcome type.

### Preconditions
1. Current activity save is successful.

### Postconditions
1. Loop keeps same current activity.
2. Move Forward updates current activity to next step.
3. Close closes the case when mandatory steps are completed.

### Field Rules
#### Loop
- Same activity remains current
- Outcome dropdown remains mapped to same step

#### Move Forward
- Next step must be valid
- Assigned Role updates from next step configuration
- Role Override applies when configured

#### Close
- Mandatory steps must be completed before close

### Validation Messages
- Next step configuration is invalid.
- Mandatory steps are not completed. Cannot close case.

### System Behaviors
1. Loop keeps current activity on same step.
2. Move Forward replaces current activity with next step.
3. Close marks case as Closed and locks Resolution tab.

### Error Scenarios
1. Invalid next step mapping exists for Move Forward.
2. Close attempted before all mandatory steps are completed.

---

## Feature 7: Follow Up Add Action

### Purpose
Allow agents to add immutable follow-up records against a case.

### Preconditions
1. User persona is Agent.
2. Case is not Closed.

### Postconditions
1. Follow-up is saved.
2. Follow-up becomes read-only after save.
3. Follow-up history is updated.

### Field Rules
#### Add Follow Up Visibility
- Visible only to Agent persona
- Disabled when case status is Closed

#### Fields
- Customer Remarks: Mandatory, textarea, max 500 characters, trim before validation
- Agent Remarks: Mandatory, textarea, max 500 characters, trim before validation

### Validation Messages
- Please enter customer remarks.
- Please enter agent remarks.
- Remarks cannot exceed 500 characters.

### System Behaviors
1. On save, system captures:
   - Date and Time
   - Agent Name
2. Saved entry is converted into read-only mode.
3. Latest follow-up is displayed first.

### Error Scenarios
1. Dealer persona attempts creation.
2. Closed case follow-up creation attempted.
3. One or both remarks are empty.
4. One or both remarks exceed 500 characters.

---

## Feature 8: Follow Up History

### Purpose
Display all saved follow-up entries in read-only mode to all users.

### Preconditions
1. Case is registered.

### Postconditions
1. Follow-up history is visible.
2. Saved follow-ups are displayed latest first.

### Field Rules
#### History Fields
- Customer Remarks
- Agent Remarks
- Date and Time
- Agent Name
- Call Recording Link, when available

#### History Rules
- Read-only for all users
- Latest first using Date and Time descending

### Validation Messages
No direct field validation in this feature.

### System Behaviors
1. Dealer persona can view all follow-ups.
2. Call recording link is shown when available.
3. Empty state message is displayed when no follow-ups exist.

### Error Scenarios
1. If no follow-ups exist, system displays: **No follow-ups have been added yet.**

---

# D) User Stories

## Feature: View Post Case Registration Screen

### User Story
As a user, I want to open a registered case and view all post-registration sections so that I can review case information and perform only allowed actions.

### Acceptance Criteria
1. System displays Customer Details Card in read-only mode.
2. System displays Vehicle Details Card in read-only mode.
3. System displays Dealer Details Card in read-only mode.
4. System displays Case tab in read-only mode.
5. System displays Assigned Dealer in read-only mode.
6. System opens Case tab by default.
7. System displays Follow Up tab.
8. System displays Resolution tab.
9. Follow Up tab is editable only for Agent persona when case is not Closed.
10. Follow Up tab is read-only for Dealer persona.
11. Resolution tab is editable only for the assigned role when case is not Closed.
12. Resolution tab current activity is read-only when case is Closed.

### Negative Scenarios
1. Dealer persona attempts to edit Follow Up.
2. User who is not the assigned role attempts to edit Resolution.
3. Closed case is opened for editing.

### Validation Rules
1. Edit access for Follow Up is based on persona.
2. Edit access for Resolution is based on assigned role.
3. Closed case blocks post-registration editing.

---

## Feature: Dealer Catalog View

### User Story
As a dealer, I want to see all cases assigned to my dealership so that I can open them and work on resolution activities.

### Acceptance Criteria
1. System displays a view-only grid of assigned dealer cases.
2. Grid contains:
   - Document Name
   - Registered Date Time
   - Department
   - Case Nature
   - Case Category
   - Case Subcategory
   - Customer Name
   - Customer Mobile Number
   - Activity Status
   - Case Status
3. Grid displays latest cases first.
4. System provides a Filters button. On click, a right-side drawer opens
5. System supports multi-select filters inside the drawer:
   - Department
   - Case Nature
   - Case Category
   - Case Subcategory
   - Activity Status
   - Case Status
   - Registered Date (From Date and To Date)
6. User can select one or more values in each filter.
7. System applies filters only when user clicks Apply.
   - All selected filters are applied simultaneously
   - Date range is validated (if provided)
   - Grid refreshes based on selected filters
   - Drawer closes
   - Applied filter state is persisted
8. System supports Reset:
   - Clears all selected filter values (including date range)
   - Does NOT refresh grid until Apply is clicked
9. System handles drawer close (Cross button):
   - If clicked before Apply:
   - Discards all temporary selection
   - Closes drawer
   - Grid remains unchanged
   - If clicked after Apply:
   - Closes drawer
   - Applied filters and grid remain unchanged
10. Registered Date Time supports ascending sort and descending sort.
11. Grid auto-refreshes when a new case is assigned.
12. Clicking View opens detailed case screen.
13. Case tab opens by default on detailed screen.
14. Dealer can navigate to Resolution tab.

### Negative Scenarios
1. Dealer has no assigned cases.
2. Dealer applies filters that return no results.

### Validation Rules
1. Grid remains read-only.
2. Data source is saved documents.
3. Default order is Registered Date Time descending.
4. Date validation: **From date cannot be after To date** 

---

## Feature: Load Resolution Tab

### User Story
As a dealer, I want the system to load the correct current activity and history so that I can continue work on the case.

### Acceptance Criteria
1. System identifies applicable template using Case Nature, Department, and Product Type.
2. If exactly one template is found, system loads it.
3. If no outcome is previously selected, system auto-populates activity mapped to Start Step.
4. System displays Current Activity section at the top.
5. System displays Resolution History grid.
6. Current Activity section contains:
   - Activity Name
   - Step Number
   - Assigned Role
   - Outcome
   - Remarks
   - Attachments
7. Only one current activity is displayed at a time.
8. Resolution History grid shows latest records first.
9. If no activities exist, system displays empty state message.

### Negative Scenarios
1. No matching template exists.
2. More than one matching template exists.

### Validation Rules
1. Template resolution uses Case Nature, Department, and Product Type.
2. Start Step applies when no prior outcome exists.

---

## Feature: Save Resolution Activity

### User Story
As an authorized dealer role, I want to save an activity outcome with remarks and optional attachments so that the case progresses with full audit history.

### Acceptance Criteria
1. Outcome dropdown is mandatory.
2. Outcome dropdown shows only outcomes configured for the current step.
3. Remarks field is mandatory.
4. Remarks field is trimmed before validation.
5. Remarks field supports maximum 500 characters.
6. Attachments are optional.
7. Supported attachment types are PDF, JPG, PNG, and JPEG.
8. Maximum file size is 5 MB.
9. On Save, system stores:
   - Outcome
   - Remarks
   - Timestamp
   - Performed By
   - Role
   - Attachments
10. System adds saved entry to top of Resolution History grid.
11. System updates Activity Status in Call History grid.
12. System updates Activity Status in Dealer Catalog View grid.
13. Only one save request is processed when duplicate submission happens.

### Negative Scenarios
1. User is not authorized to save.
2. Current step is no longer active.
3. Outcome does not belong to current step.
4. Remarks are blank.
5. Remarks exceed limit.
6. Unsupported attachment type is uploaded.
7. File size exceeds limit.
8. User submits Save twice.

### Validation Rules
1. Submitted role must match Assigned Role or Role Override.
2. Submitted outcome must belong to current step.
3. Current step must still be active at submit time.

---

## Feature: Handle Loop Outcome

### User Story
As a dealer, I want the same activity to stay active after a loop outcome so that I can continue the same step with another valid outcome later.

### Acceptance Criteria
1. Activity entry is saved in history.
2. Same activity remains in Current Activity section.
3. Outcome dropdown remains mapped to same step.
4. Dealer can submit another outcome for the same activity.

### Negative Scenarios
1. Dealer tries to edit looped activity after case is Closed.

### Validation Rules
1. Loop outcome must be configured for current step.

---

## Feature: Handle Move Forward Outcome

### User Story
As a dealer, I want the workflow to move to the next configured step after save so that the correct next activity becomes current.

### Acceptance Criteria
1. Activity entry is saved in history.
2. System determines next step from configuration.
3. System updates Current Activity with next Activity Name.
4. System updates Step Number.
5. System updates Assigned Role from next step configuration.
6. System applies Role Override when configured.
7. Outcome dropdown reloads with values for the new step.

### Negative Scenarios
1. Next step configuration is missing.
2. Next step configuration is invalid.

### Validation Rules
1. Move Forward outcome must have valid next step.

---

## Feature: Handle Close Outcome

### User Story
As a dealer, I want the case to close only after required steps are completed so that closure happens in a controlled way.

### Acceptance Criteria
1. System validates that all mandatory steps are completed.
2. When validation passes, system marks case as Closed.
3. System makes entire Resolution tab read-only.
4. System prevents further outcome selection.
5. System prevents further edits.

### Negative Scenarios
1. Close is selected before mandatory steps are completed.

### Validation Rules
1. Close outcome is allowed only after mandatory step completion validation succeeds.

---

## Feature: Add Follow Up

### User Story
As an agent, I want to add follow-up entries so that all customer interactions are recorded and visible.

### Acceptance Criteria
1. Add Follow Up action is visible only to Agent persona.
2. Add Follow Up action is disabled when case is Closed.
3. Agent can enter Customer Remarks.
4. Agent can enter Agent Remarks.
5. Both fields are mandatory.
6. Both fields are trimmed before validation.
7. Both fields support maximum 500 characters.
8. On Save, system stores:
   - Customer Remarks
   - Agent Remarks
   - Date and Time
   - Agent Name
9. Saved entry becomes read-only.
10. Saved entry appears in Follow Up History.
11. Latest follow-up appears first.

### Negative Scenarios
1. Dealer persona attempts to add follow-up.
2. Closed case follow-up add attempted.
3. Customer Remarks are blank.
4. Agent Remarks are blank.
5. Remarks exceed limit.

### Validation Rules
1. Only Agent persona can create follow-up.
2. Case must not be Closed.
3. Both remarks are mandatory.
4. Both remarks must be within 500 characters after trim.

---

## Feature: View Follow Up History

### User Story
As a user, I want to view all saved follow-ups in read-only mode so that I can understand case interactions.

### Acceptance Criteria
1. System displays all saved follow-ups in read-only mode.
2. Each entry shows:
   - Customer Remarks
   - Agent Remarks
   - Date and Time
   - Agent Name
   - Call Recording Link when available
3. Latest follow-up is displayed first.
4. Dealer persona can view all follow-ups.
5. If no follow-up exists, system displays empty state message.

### Negative Scenarios
1. No follow-up entries exist.

### Validation Rules
1. Follow-up history is immutable after save.
2. Follow-up history is visible to all users with case access.

---

## End of Document
