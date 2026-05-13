# CCM Phase 1 Documentation — Agent Interaction Foundation

## 1. Scope

This document covers **CCM Phase 1 — Agent Interaction Foundation**.

### In scope
- Agent login and access to the CCM workspace
- Manual inbound interaction handling
- Customer search using supported search filters
- Customer, vehicle, and dealer context retrieval
- Search result selection and disambiguation
- Structured interaction logging
- Structured interaction disposition and closure
- Incomplete interaction handling
- Interaction event logging

### Out of scope
- Case creation
- Follow-up tasks
- Resolution activities
- SLA tracking
- Escalation handling
- Supervisor workflow
- Dealer workflow
- Head Office workflow
- CTI integration
- Sales enquiry workflow
- Contact creation in CCM
- Case history
- Customer 360
- Dialer-based performance metrics

---

## 2. Master and Controlled Values

### 2.1 Search Filter Master
- Mobile
- Registration Number
- Customer Name
- Email

### 2.2 Contact Reason Master
- Complaint
- Query
- Suggestion
- Feedback
- Other

### 2.3 Identification Outcome Master
- Customer and Vehicle Identified
- Customer Identified, Vehicle Unresolved
- Vehicle Identified, Customer Partially Resolved
- No Verified Match
- Multiple Matches Resolved by Agent

### 2.4 Interaction Disposition Master
- Information Provided
- Information Captured
- No Match Found
- Wrong Number
- Silent Call
- Abusive Caller
- Technical Issue
- Transferred Outside CCM
- Incomplete Interaction
- Others

### 2.5 Agent Status Master
- Ready for Calls
- Break
- Offline
- Training

**Default status on login:** `Offline`
The system must load `Offline` as the agent's status when the workspace is first loaded after login. The agent must explicitly change their status to `Ready for Calls` before handling contacts.

---

# B) Process Documentation

## B1. Process: Agent Login and Workspace Access

### Trigger
The Agent opens CCM and submits valid login credentials.

### Inputs
- User credentials
- User status record
- Role mapping

### Steps
1. The system validates the user credentials.
2. The system validates that the user is an active Agent user.
3. The system creates a user session.
4. The system loads the Agent workspace.
5. The system loads the default Agent status as `Offline`.
6. The system displays the manual interaction workspace.

### Outputs
- Active user session
- Agent workspace loaded
- Agent status visible

### Exceptions
- Invalid credentials
- Inactive user
- User role is not Agent
- Session creation failure
- Workspace load failure

---

## B2. Process: Start Manual Interaction

### Trigger
The Agent starts handling a customer contact from the manual workspace.

### Inputs
- Active Agent session
- Agent identity
- Current timestamp

### Steps
1. The Agent selects the action to start an interaction.
2. The system checks that the Agent does not have an existing open interaction (status not `Closed` and not `Incomplete`). If one exists, the system blocks creation.
3. The system creates an Interaction record with status `New`.
4. The system stores the channel as `Voice`.
5. The system stores the mode as `Manual`.
6. The system stores the interaction start timestamp.
7. The system moves the interaction to status `Identifying`.
8. The system enables the search panel.

### Outputs
- Interaction ID created
- Interaction status set to `Identifying`
- Search panel enabled

### Exceptions
- Interaction creation failure
- Session timeout
- Agent does not have create interaction permission
- Agent already has an open interaction (concurrent interaction blocked)

---

## B3. Process: Search Customer Context

### Trigger
The Agent enters a value in one search filter and meets the minimum search threshold.

### Inputs
- Interaction ID
- Search filter
- Search value
- Search source connectors

### Steps
1. The Agent selects one search filter.
2. The Agent enters a search value.
3. The system validates the value based on the selected filter.
4. The system stores the raw search value.
5. The system stores the normalized search value.
6. The system searches Install Base first.
7. The system searches Customer Master if Install Base does not return a usable result.
8. The system displays the search results list.
9. The system logs the search attempt.

### Outputs
- Search result list
- Search source result marker
- Search attempt log

### Exceptions
- Invalid search value
- Search value is below minimum length
- Install Base not reachable
- Customer Master not reachable
- No results found
- Partial results returned

---

## B4. Process: Select Search Result and Resolve Ambiguity

### Trigger
The Agent selects one search result from the result list.

### Inputs
- Interaction ID
- Search result list
- Selected search result

### Steps
1. The system validates that one result is selected.
2. The system loads the selected customer context.
3. The system loads the linked vehicle context if available.
4. The system loads the linked dealer context if available.
5. The system checks whether more than one vehicle is linked to the selected customer.
6. The system requires explicit vehicle selection if more than one vehicle exists.
7. The system stores the selected customer reference.
8. The system stores the selected vehicle reference if available.
9. The system stores the dealer reference if available.
10. The system updates the interaction status to `Context Confirmed` when a usable context is selected.

### Outputs
- Selected customer context
- Selected vehicle context
- Selected dealer context
- Updated interaction status

### Exceptions
- Result selection is empty
- Selected record cannot be loaded
- Vehicle list cannot be loaded
- Dealer context cannot be loaded
- More than one vehicle exists and no selection is made

---

## B5. Process: Reselect Search Result

### Trigger
The Agent selects a different result after a previous result is already active.

### Inputs
- Current Interaction ID
- Existing selected context
- New selected result

### Steps
1. The system records that reselection has been initiated.
2. The system replaces the existing customer context with the new customer context.
3. The system replaces the existing vehicle context with the new vehicle context.
4. The system replaces the existing dealer context with the new dealer context.
5. The system logs the reselection event.
6. The system displays the updated context cards.

### Outputs
- Updated customer context
- Updated vehicle context
- Updated dealer context
- Reselection event log

### Exceptions
- New selected result cannot be loaded
- Reselection event cannot be stored
- Updated context cards cannot be rendered

---

## B6. Process: Capture Interaction Disposition

### Trigger
The Agent moves the interaction to wrap-up.

### Inputs
- Interaction ID
- Contact Reason
- Identification Outcome
- Interaction Disposition
- Agent remarks

### Steps
1. The system moves the interaction to status `Wrap-up`.
2. The Agent selects one Contact Reason.
3. The Agent selects one Identification Outcome.
4. The Agent selects one Interaction Disposition.
5. The system checks whether remarks are mandatory.
6. The Agent enters remarks when required.
7. The system validates the wrap-up data.
8. The system stores the wrap-up data.

### Outputs
- Interaction wrap-up saved
- Interaction ready for closure

### Exceptions
- Contact Reason is not selected
- Identification Outcome is not selected
- Interaction Disposition is not selected
- Mandatory remarks are blank
- Wrap-up save failure

---

## B7. Process: Close Interaction

### Trigger
The Agent submits a valid wrap-up.

### Inputs
- Interaction ID
- Saved wrap-up data

### Steps
1. The system validates that wrap-up data is complete.
2. The system stores the interaction end timestamp.
3. The system marks the interaction as completed.
4. The system updates the interaction status to `Closed`.
5. The system writes the interaction closure event.

### Outputs
- Closed interaction
- Interaction closure event
- Interaction available in history

### Exceptions
- Wrap-up data is incomplete
- End timestamp cannot be stored
- Closure event cannot be written

---

## B8. Process: Mark Interaction as Incomplete

### Trigger
The interaction cannot be closed with a valid outcome.

### Inputs
- Interaction ID
- Incomplete reason
- Agent remarks

### Steps
1. The Agent selects `Incomplete Interaction` as the disposition.
2. The system requires remarks.
3. The Agent enters remarks.
4. The system stores the incomplete outcome.
5. The system updates the interaction status to `Incomplete`.
6. The system stores the interaction end timestamp.
7. The system writes the incomplete event.

### Outputs
- Incomplete interaction
- Incomplete event log

### Exceptions
- Incomplete remarks are blank
- Incomplete outcome cannot be saved
- Interaction status cannot be updated

---

# C) Functional Specs

## C1. Feature: Agent Login and Workspace Access

### Purpose
To allow a valid Agent user to access the Phase 1 CCM workspace.

### Preconditions
- The user account exists.
- The user account is active.
- The user is mapped to the Agent persona.

### Postconditions
- The Agent session is active.
- The Agent workspace is displayed.
- The default status is loaded.

### Field Rules
| Field | Rule |
|---|---|
| User ID | Mandatory |
| Password | Mandatory |
| Role | Must be Agent |
| Status | Must be Active |

### Validation Messages
- `Enter User ID.`
- `Enter Password.`
- `You are not authorized for Agent workspace.`
- `Your account is inactive.`
- `Unable to sign in. Please try again.`

### System Behaviors
- The system must authenticate the user before loading the workspace.
- The system must block access for non-Agent roles.
- The system must create a session only after successful authentication.

### Error Scenarios
- Authentication service failure
- Session creation failure
- Workspace rendering failure

---

## C2. Feature: Start Manual Interaction

### Purpose
To create a Phase 1 interaction record before customer search begins.

### Preconditions
- Agent session is active.
- Agent is on the workspace.

### Postconditions
- Interaction record exists.
- Interaction status is `Identifying`.
- Search panel is enabled.

### Field Rules
| Field | Rule |
|---|---|
| Interaction ID | System generated |
| Channel | Fixed value `Voice` |
| Mode | Fixed value `Manual` |
| Start Timestamp | System generated |
| Status | Initial value `New`, then `Identifying` |

### Concurrent Interaction Rule
An Agent may only have one open interaction at a time. An interaction is considered open when its status is not `Closed` and not `Incomplete`. The system must block interaction creation if the Agent already has an open interaction. Validation message: `You already have an open interaction. Please close it before starting a new one.`

### Validation Messages
- `Unable to start interaction. Please try again.`
- `Your session has expired. Please sign in again.`
- `You already have an open interaction. Please close it before starting a new one.`

### System Behaviors
- The system must create an interaction before any search result is selected.
- The system must log the interaction creation event.
- The system must enable search only after interaction creation succeeds.
- The system must enforce the one-open-interaction-per-agent constraint at the API level.

### Error Scenarios
- Interaction ID generation failure
- Session expiry during interaction creation
- Permission failure
- Concurrent open interaction exists for the agent

---

## C3. Feature: Search Customer

### Purpose
To allow the Agent to search customer context using controlled filters.

### Preconditions
- Interaction exists.
- Interaction status is `Identifying` or `Active`.

### Postconditions
- Search results are displayed.
- Search audit data is stored.

### Field Rules
| Field | Rule |
|---|---|
| Search Filter | Mandatory. One filter only |
| Search Value | Mandatory |
| Mobile | Numeric only |
| Registration Number | Alphanumeric only. Convert to uppercase |
| Customer Name | Alphabets and spaces only |
| Email | Must match email format |
| Minimum Length | At least 3 characters |

### Validation Messages
- `Select one search filter.`
- `Enter a search value.`
- `Enter at least 3 characters.`
- `Enter a valid mobile number.`
- `Enter a valid registration number.`
- `Enter a valid customer name.`
- `Enter a valid email address.`
- `No results found.`

### System Behaviors
- The system must permit only one active filter at a time.
- The system must store raw and normalized search values.
- The system must search Install Base first.
- The system must search Customer Master if Install Base does not return a usable result.
- The system must display result rows with key identifying fields.
- The system must log every search attempt.

### Error Scenarios
- Install Base is unavailable
- Customer Master is unavailable
- Search connector timeout
- Search returns partial data

---

## C4. Feature: Search Result Selection and Disambiguation

### Purpose
To resolve customer context safely when search returns one result or more than one result.

### Preconditions
- Search results are displayed.
- Interaction is active.

### Postconditions
- Customer context is selected.
- Vehicle context is selected when available.
- Dealer context is loaded when available.
- Interaction status is updated to `Context Confirmed` when usable context exists.

### Field Rules
| Field | Rule |
|---|---|
| Selected Result | Mandatory when results exist |
| Vehicle Selection | Mandatory when more than one linked vehicle exists |
| Customer Match Status | System derived |
| Vehicle Match Status | System derived |
| Dealer Resolution Status | System derived |

### Validation Messages
- `Select one customer record.`
- `Select one vehicle record.`
- `Dealer details are unavailable for the selected record.`
- `Vehicle details are unavailable for the selected record.`

### System Behaviors
- The system must not auto-select when more than one result exists.
- The system must treat a single registration number result as a high-confidence match.
- The system must permit customer-only context when no vehicle is linked.
- The system must not block the interaction when dealer data is missing.
- The system must log customer selection and vehicle selection events.

### Error Scenarios
- Selected record cannot be loaded
- Vehicle list cannot be retrieved
- Dealer context cannot be retrieved
- Context cards fail to render

---

## C5. Feature: Reselect Search Result

### Purpose
To allow the Agent to correct the active customer context within the same interaction.

### Preconditions
- An interaction exists.
- A customer result is already selected.
- A different result is available for selection.

### Postconditions
- Existing context is replaced with the new context.
- Reselection event is logged.

### Field Rules
| Field | Rule |
|---|---|
| New Selected Result | Mandatory |
| Reselection Event | System generated |

### Validation Messages
- `Select a different result to update the context.`
- `Unable to update customer context. Please try again.`

### System Behaviors
- The system must replace customer, vehicle, and dealer cards with the new selection.
- The system must not preserve case data because case creation is out of scope.
- The system must log the reselection timestamp and user.

### Error Scenarios
- Updated context load failure
- Reselection event storage failure
- Card refresh failure

---

## C6. Feature: Contact, Vehicle, and Dealer Context Cards

### Purpose
To display the selected context in a structured, read-only format.

### Preconditions
- A customer result is selected.

### Postconditions
- Context cards are visible with available data.
- Missing data is shown clearly.

### Field Rules
| Card | Fields |
|---|---|
| Contact Details | Contact Name, Primary Mobile Number, Secondary Mobile Number, Email ID, Address |
| Vehicle Details | Vehicle Model Name, Variant, Registration Number, Chassis Number Masked, Sold On Date, Last Service Date |
| Dealer Details | Dealer Name, Dealer Code, Branch Name, ASC, City, Address, Pin Code, Dealer Type, Dealer Active Status |

### Validation Messages
- `Customer details are unavailable.`
- `Vehicle details are unavailable.`
- `Dealer details are unavailable.`

### System Behaviors
- The system must display read-only data only.
- The system must mask sensitive chassis information.
- The system must show unavailable state when linked data does not exist.
- The system must refresh all cards after reselection.

### Error Scenarios
- Card data fetch failure
- Masking failure
- UI rendering failure

---

## C7. Feature: Capture Interaction Disposition

### Purpose
To capture the structured end state of the interaction.

### Preconditions
- Interaction exists.
- The Agent has completed handling the contact.

### Postconditions
- Wrap-up data is stored.
- Interaction is ready for closure.

### Field Rules
| Field | Rule |
|---|---|
| Contact Reason | Mandatory |
| Identification Outcome | Mandatory |
| Interaction Disposition | Mandatory |
| Remarks | Mandatory for `No Match Found`, `Technical Issue`, `Abusive Caller`, `Incomplete Interaction`, `Others` |
| Remarks | Maximum length: 1000 characters |

### Validation Messages
- `Select Contact Reason.`
- `Select Identification Outcome.`
- `Select Interaction Disposition.`
- `Enter remarks for the selected disposition.`
- `Unable to save interaction wrap-up. Please try again.`

### System Behaviors
- The system must move the interaction to `Wrap-up` before saving the disposition.
- The system must enforce mandatory remarks for configured values.
- The system must store the selected master values and remarks.
- The system must log the disposition save event.

### Error Scenarios
- Wrap-up save failure
- Master value not available
- Remarks field save failure

---

## C8. Feature: Close Interaction

### Purpose
To complete the interaction after a valid wrap-up is captured.

### Preconditions
- Wrap-up is saved successfully.

### Postconditions
- Interaction status is `Closed`.
- End timestamp is stored.
- Closure event is stored.

### Field Rules
| Field | Rule |
|---|---|
| End Timestamp | System generated |
| Interaction Completion Flag | Set to `Yes` on successful closure |

### Validation Messages
- `Complete wrap-up before closing the interaction.`
- `Unable to close interaction. Please try again.`

### System Behaviors
- The system must not close an interaction without valid wrap-up data.
- The system must write the closure event.
- The closed interaction must become available in history.

### Error Scenarios
- End timestamp save failure
- Closure event write failure
- History write failure

---

## C9. Feature: Mark Interaction as Incomplete

### Purpose
To close an interaction that cannot be completed with a valid productive outcome.

### Preconditions
- Interaction exists.
- The Agent selects `Incomplete Interaction`.

### Postconditions
- Interaction status is `Incomplete`.
- End timestamp is stored.
- Incomplete event is stored.

### Field Rules
| Field | Rule |
|---|---|
| Interaction Disposition | Fixed value `Incomplete Interaction` |
| Remarks | Mandatory |
| Remarks | Maximum length: 1000 characters |

### Validation Messages
- `Enter remarks for incomplete interaction.`
- `Unable to mark interaction as incomplete. Please try again.`

### System Behaviors
- The system must require remarks.
- The system must set the interaction completion flag to `No`.
- The system must write the incomplete event.

### Error Scenarios
- Incomplete state update failure
- Remarks save failure
- Event write failure

---

## C10. Feature: Interaction Event Logging

### Purpose
To provide auditability for all key interaction events.

### Preconditions
- Interaction exists.

### Postconditions
- Key events are stored with timestamp and actor.

### Field Rules
| Event | Rule |
|---|---|
| interaction_created | Mandatory |
| search_started | Mandatory when search occurs |
| search_result_returned | Mandatory when search result is received |
| customer_selected | Mandatory when customer is selected |
| vehicle_selected | Mandatory when vehicle is selected |
| dealer_loaded | Mandatory when dealer context is loaded |
| customer_reselected | Mandatory when reselection happens |
| disposition_saved | Mandatory when wrap-up is saved |
| interaction_closed | Mandatory when interaction is closed |
| interaction_marked_incomplete | Mandatory when interaction is marked incomplete |

### Validation Messages
- `Unable to store interaction event.`

### System Behaviors
- The system must store event name, interaction ID, actor, and timestamp.
- The system must not block the main flow for non-critical event display issues.
- The system must log failures for event storage.

### Error Scenarios
- Event write failure
- Event timestamp failure
- Audit store unavailable

---

## C11. Feature: Agent Status Management

### Purpose
To allow an Agent to view and change their operational status from the workspace.

### Preconditions
- Agent session is active.
- Agent is on the workspace.

### Postconditions
- Agent status is updated to the selected value.
- Status change is audit logged.

### Field Rules
| Field | Rule |
|---|---|
| Agent Status | Mandatory. Must be one of the four Agent Status Master values: `Ready for Calls`, `Break`, `Offline`, `Training` |
| Default Status on Login | `Offline` — loaded automatically when the workspace is first displayed |
| Status Change Event | System generated: actor, old status, new status, timestamp |

### Status Transition Rules
- All four status transitions are permitted in any direction. There are no restricted transition paths.
- Status change is not permitted while the API call to update is still in flight (prevent double-submission).
- The system must wait for API confirmation before updating the UI status display (no optimistic update).

### Validation Messages
- `Unable to update status. Please try again.`

### System Behaviors
- The system must display the current agent status at all times in the workspace header.
- The system must write a status change event on every successful status update. Event fields: actor user ID, old status, new status, changed at timestamp.
- The status change event is stored in the `interaction_events` table with event name `agent_status_changed`. Interaction ID is null for status change events (they are not tied to a specific interaction).
- The "Start New Interaction" button must be enabled only when the agent's current status is `Ready for Calls`. When the agent status is `Break`, `Offline`, or `Training`, the button must be rendered in a disabled state with a tooltip: "Set your status to Ready for Calls to start an interaction". *(Amended from original informational-only rule — effective from 2026-03-23.)*

### Error Scenarios
- Status update API call failure
- Status change event write failure

---

# D) User Story Format

## D1. Feature: Agent Login and Workspace Access

### User Story
As an Agent, I want to sign in to CCM so that I can access the manual interaction workspace.

### Acceptance Criteria
1. Given valid Agent credentials, when the Agent signs in, then the system loads the Agent workspace.
2. Given an inactive user, when the user signs in, then the system blocks access.
3. Given a non-Agent user, when the user signs in, then the system blocks access to the Agent workspace.

### Negative Scenarios
- Invalid password is submitted.
- User account is inactive.
- User role is not Agent.
- Session cannot be created.

### Validation Rules
- User ID is mandatory.
- Password is mandatory.
- User role must be Agent.
- User account must be active.

---

## D2. Feature: Start Manual Interaction

### User Story
As an Agent, I want to start a manual interaction before I search for the customer so that the contact is auditable from the beginning.

### Acceptance Criteria
1. Given an active Agent session, when the Agent starts an interaction, then the system creates an Interaction ID.
2. When the interaction is created, then the system sets channel to `Voice`.
3. When the interaction is created, then the system sets mode to `Manual`.
4. When the interaction is created, then the system moves the interaction to `Identifying`.

### Negative Scenarios
- Session expires before interaction creation.
- Interaction creation fails.
- Agent does not have permission.
- Agent already has an open interaction (concurrent interaction blocked).

### Validation Rules
- Agent session must be active.
- Agent status must be `Ready for Calls` to initiate a new interaction. The "Start New Interaction" button is disabled for all other statuses.
- Interaction ID must be system generated.
- Search must not start before interaction creation.
- Only one open interaction per agent is permitted at any time.

---

## D3. Feature: Search Customer

### User Story
As an Agent, I want to search using one supported filter so that I can identify the customer context accurately.

### Acceptance Criteria
1. Given a valid search filter and valid value, when the Agent searches, then the system validates the input.
2. When the search is valid, then the system searches Install Base first.
3. Given no usable Install Base result, when the search continues, then the system searches Customer Master.
4. When results are returned, then the system displays the result list.
5. When no result is returned, then the system displays `No results found.`

### Negative Scenarios
- No search filter is selected.
- Search value is blank.
- Search value is shorter than 3 characters.
- Mobile contains non-numeric characters.
- Email format is invalid.
- Search services are unavailable.

### Validation Rules
- One search filter only.
- Search value is mandatory.
- Minimum length is 3 characters.
- Mobile must be numeric.
- Registration Number must be alphanumeric and uppercase.
- Customer Name must contain alphabets and spaces.
- Email must match email format.

---

## D4. Feature: Select Search Result and Resolve Ambiguity

### User Story
As an Agent, I want to select the correct result from the search list so that the interaction is linked to the correct customer and vehicle context.

### Acceptance Criteria
1. Given a single result, when the Agent selects it, then the system loads the context cards.
2. Given more than one result, when the Agent views the results, then the system requires explicit selection.
3. Given more than one linked vehicle, when the Agent selects a customer, then the system requires explicit vehicle selection.
4. Given missing dealer data, when the system loads the context, then the interaction remains usable.

### Negative Scenarios
- Agent does not select a customer result.
- Agent does not select a vehicle when more than one vehicle exists.
- Selected record cannot be loaded.
- Dealer details are missing.

### Validation Rules
- One customer result must be selected when multiple results exist.
- One vehicle must be selected when multiple linked vehicles exist.
- Dealer data is optional for interaction completion.

---

## D5. Feature: Reselect Search Result

### User Story
As an Agent, I want to replace the active customer context when I selected the wrong result so that the interaction reflects the correct customer.

### Acceptance Criteria
1. Given an active customer context, when the Agent selects another result, then the system replaces the customer, vehicle, and dealer cards.
2. When reselection happens, then the system logs the reselection event.
3. When reselection succeeds, then the updated context is visible immediately.

### Negative Scenarios
- New result cannot be loaded.
- Updated cards cannot be rendered.
- Reselection event cannot be written.

### Validation Rules
- A new result must be selected.
- Reselection must overwrite the prior selected context.
- Case data must not be preserved because case creation is out of scope.

---

## D6. Feature: View Contact, Vehicle, and Dealer Context Cards

### User Story
As an Agent, I want to view customer, vehicle, and dealer details in read-only cards so that I can handle the interaction with the correct context.

### Acceptance Criteria
1. Given a selected customer, when context data is available, then the system shows the Contact Details Card.
2. Given linked vehicle data, when the card is loaded, then the system shows the Vehicle Details Card.
3. Given linked dealer data, when the card is loaded, then the system shows the Dealer Details Card.
4. Given missing linked data, when the card is loaded, then the system shows that the data is unavailable.

### Negative Scenarios
- Customer details are unavailable.
- Vehicle details are unavailable.
- Dealer details are unavailable.
- Chassis number masking fails.

### Validation Rules
- Cards are read-only.
- Chassis number must be masked.
- Missing data must be shown explicitly.

---

## D7. Feature: Capture Interaction Disposition

### User Story
As an Agent, I want to capture a structured disposition so that every interaction ends with a governed outcome.

### Acceptance Criteria
1. Given an active interaction, when the Agent starts wrap-up, then the system moves the interaction to `Wrap-up`.
2. When the Agent selects valid values for Contact Reason, Identification Outcome, and Interaction Disposition, then the system saves the wrap-up.
3. Given a disposition that requires remarks, when the Agent leaves remarks blank, then the system blocks save.
4. When wrap-up is saved, then the system logs the disposition event.

### Negative Scenarios
- Contact Reason is not selected.
- Identification Outcome is not selected.
- Interaction Disposition is not selected.
- Mandatory remarks are blank.
- Wrap-up save fails.

### Validation Rules
- Contact Reason is mandatory.
- Identification Outcome is mandatory.
- Interaction Disposition is mandatory.
- Remarks are mandatory for `No Match Found`, `Technical Issue`, `Abusive Caller`, `Incomplete Interaction`, and `Others`.

---

## D8. Feature: Close Interaction

### User Story
As an Agent, I want to close the interaction after valid wrap-up so that the interaction record is completed and auditable.

### Acceptance Criteria
1. Given valid wrap-up data, when the Agent closes the interaction, then the system stores the end timestamp.
2. When the interaction is closed, then the system updates the status to `Closed`.
3. When the interaction is closed, then the system stores the closure event.

### Negative Scenarios
- Wrap-up is incomplete.
- End timestamp cannot be stored.
- Closure event cannot be written.

### Validation Rules
- Interaction cannot close without valid wrap-up.
- End timestamp must be system generated.
- Closure event must be stored.

---

## D9. Feature: Mark Interaction as Incomplete

### User Story
As an Agent, I want to mark an interaction as incomplete when the contact cannot be completed properly so that the outcome is still recorded with auditability.

### Acceptance Criteria
1. Given the Agent selects `Incomplete Interaction`, when remarks are entered, then the system saves the incomplete outcome.
2. When the incomplete outcome is saved, then the system sets status to `Incomplete`.
3. When the incomplete outcome is saved, then the system stores the end timestamp and event log.

### Negative Scenarios
- Remarks are blank.
- Incomplete state cannot be saved.
- Event cannot be written.

### Validation Rules
- `Incomplete Interaction` requires remarks.
- End timestamp must be system generated.
- Incomplete event must be stored.

---

## D10. Feature: Interaction Event Logging

### User Story
As a product owner, I want key interaction events to be logged so that Phase 1 interactions are auditable and traceable.

### Acceptance Criteria
1. When an interaction is created, then the system stores `interaction_created`.
2. When a search starts, then the system stores `search_started`.
3. When a result is selected, then the system stores customer and vehicle selection events.
4. When wrap-up is saved, then the system stores `disposition_saved`.
5. When the interaction ends, then the system stores `interaction_closed` or `interaction_marked_incomplete`.

### Negative Scenarios
- Event store is unavailable.
- Event timestamp cannot be written.
- Event type is missing.

### Validation Rules
- Event name is mandatory.
- Interaction ID is mandatory.
- Actor is mandatory.
- Timestamp is mandatory.

---

## D11. Feature: Agent Status Management

### User Story
As an Agent, I want to view and change my operational status from the workspace so that my availability is accurately reflected and auditable.

### Acceptance Criteria
1. Given an active Agent session, when the workspace loads, then the system displays `Offline` as the default status.
2. Given the Agent selects a different status, when the API call succeeds, then the workspace displays the new status.
3. When the status changes, then the system stores the status change event with actor, old status, new status, and timestamp.
4. Given the status update API call fails, when the agent attempts to change status, then the system displays the error message and does not update the displayed status.

### Negative Scenarios
- Status update API call fails.
- Agent selects a value not in the Agent Status Master.
- Status change event cannot be written.

### Validation Rules
- Permitted status values: `Ready for Calls`, `Break`, `Offline`, `Training`.
- No other values may be submitted.
- Status change must be confirmed by the API before the UI reflects the new status.
- Every successful status change must produce an audit event.
