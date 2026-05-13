# CCM Phase 1 — Test Coverage Plan

**Version:** 1.0
**Date:** 2026-03-22
**Authority:** QA Engineer Agent
**Phase:** Phase 1 — Agent Interaction Foundation

---

## 1. Test Pyramid Counts

| Layer | Count | Location |
|---|---|---|
| Unit tests | 75 | `src/modules/**/__tests__/*.test.ts` |
| Integration tests | 60 | `src/__tests__/*.integration.test.ts` |
| End-to-end tests | 0 | Deferred — see gaps section |
| **Total** | **135** | |

### Unit test breakdown

| File | Scope | Test count |
|---|---|---|
| `search/__tests__/search.service.test.ts` | `normalizeSearchValue`, `maskChassisNumber` | 28 |
| `interaction/__tests__/interaction.service.test.ts` | All 5 service functions | 28 |
| `auth/__tests__/auth.service.test.ts` | `loginService`, `getMeService` | 11 |
| `agent-status/__tests__/agent-status.service.test.ts` | `getAgentStatusService`, `updateAgentStatusService` | 16 |
| `integration/__tests__/MockInstallBaseAdapter.test.ts` | Adapter search + chassis masking | 19 |

### Integration test breakdown

| File | Scope | Test count |
|---|---|---|
| `auth.integration.test.ts` | Login, /me, logout | 13 |
| `interaction.integration.test.ts` | Full interaction lifecycle | 17 |
| `search.integration.test.ts` | Search endpoint | 13 |
| `agent-status.integration.test.ts` | GET and PATCH status | 12 |
| `security.integration.test.ts` | Auth guard, CSRF guard, error envelope | 13 |
| `audit.integration.test.ts` | Audit event verification for all 10 event types | 16 |

---

## 2. Phase 1 Feature Traceability

All 11 Phase 1 features are traced below to at least one test case. Test names are prefixed with the test file abbreviation.

| Feature | Source ref | Test file(s) | Covered scenarios |
|---|---|---|---|
| **C1** Agent Login and Workspace Access | §B1, §C1, §D1 | `auth.service.test.ts`, `auth.integration.test.ts` | Valid login, wrong password, unknown user, inactive user, no-agent-role, CSRF exemption on login, session cookie set |
| **C2** Start Manual Interaction | §B2, §C2, §D2 | `interaction.service.test.ts`, `interaction.integration.test.ts` | Creates IDENTIFYING status, concurrent guard 409, interaction_created event written, 401 without auth |
| **C3** Search Customer | §B3, §C3, §D3 | `search.service.test.ts`, `search.integration.test.ts`, `MockInstallBaseAdapter.test.ts` | All 4 filters, min 3 chars, mobile non-digit rejection, email format, registration uppercase, fallback adapter, 401 without auth, 403 without CSRF |
| **C4** Search Result Selection | §B4, §C4, §D4 | `interaction.service.test.ts`, `interaction.integration.test.ts`, `audit.integration.test.ts` | Context update from IDENTIFYING, CONTEXT_CONFIRMED; blocks from WRAPUP/CLOSED/INCOMPLETE; customer_selected/vehicle_selected/dealer_loaded events |
| **C5** Reselect Search Result | §B5, §C5, §D5 | `interaction.service.test.ts`, `audit.integration.test.ts` | customer_reselected event written when isReselection=true |
| **C6** Context Cards (chassis masking) | §C6, §D6 | `search.service.test.ts`, `MockInstallBaseAdapter.test.ts`, `search.integration.test.ts` | maskChassisNumber standard length, short chassis, null/empty, masked value in search response |
| **C7** Capture Interaction Disposition | §B6, §C7, §D7 | `interaction.service.test.ts`, `interaction.integration.test.ts`, `audit.integration.test.ts` | Wrapup from CONTEXT_CONFIRMED/WRAPUP/IDENTIFYING; blocks from CLOSED/INCOMPLETE; all 5 mandatory-remarks dispositions; disposition_saved event |
| **C8** Close Interaction | §B7, §C8, §D8 | `interaction.service.test.ts`, `interaction.integration.test.ts`, `audit.integration.test.ts` | Close from WRAPUP; blocks from all other states; interaction_closed event; second close = controlled error not 500 |
| **C9** Mark Interaction Incomplete | §B8, §C9, §D9 | `interaction.service.test.ts`, `interaction.integration.test.ts`, `audit.integration.test.ts` | Incomplete from WRAPUP with correct disposition and remarks; blocks from non-WRAPUP; blocks when disposition is not incomplete_interaction; interaction_marked_incomplete event |
| **C10** Interaction Event Logging | §C10, §D10 | `audit.integration.test.ts` | All 10 event names verified; actor_user_id, event_at, correlation_id present; agent_status_changed has null interaction_id |
| **C11** Agent Status Management | §C11, §D11 | `agent-status.service.test.ts`, `agent-status.integration.test.ts`, `audit.integration.test.ts` | GET returns current status; all 4 valid statuses; offline default after login; invalid status 422; 403 without CSRF; agent_status_changed event with null interaction_id |

---

## 3. Negative Scenario Inventory

### Role and permission failures

| Scenario | Expected | Test file | Test name pattern |
|---|---|---|---|
| Request without session cookie | 401 | `security.integration.test.ts` | "should return 401 on ... without cookie" |
| CSRF token missing on mutation | 403 | `security.integration.test.ts` | "should return 403 on ... without CSRF" |
| CSRF token mismatches cookie | 403 | `security.integration.test.ts` | "CSRF token mismatch" |
| User without agent role attempts login | 403 | `auth.integration.test.ts` | "does not have agent role" |
| Agent attempts to access another agent's interaction | 403 | `interaction.service.test.ts` | "different user attempts to update the context" |

### Authentication failures

| Scenario | Expected | Test file |
|---|---|---|
| Wrong password | 401, same message as unknown user | `auth.service.test.ts`, `auth.integration.test.ts` |
| Unknown username | 401, same message as wrong password | `auth.service.test.ts`, `auth.integration.test.ts` |
| Inactive user account | 403 | `auth.service.test.ts` |
| Malformed JWT cookie | 401 | `auth.integration.test.ts` |

### Validation failures (422)

| Scenario | Expected | Test file |
|---|---|---|
| Search value fewer than 3 characters | 422 | `search.service.test.ts`, `search.integration.test.ts` |
| Mobile with non-digit characters | 422 | `search.service.test.ts`, `search.integration.test.ts` |
| Invalid email format | 422 | `search.service.test.ts`, `search.integration.test.ts` |
| Customer name with digits or special chars | 422 | `search.service.test.ts`, `search.integration.test.ts` |
| Registration number with spaces/special chars | 422 | `search.service.test.ts` |
| Wrapup save: mandatory remarks blank (no_match_found) | 422 | `interaction.service.test.ts`, `interaction.integration.test.ts` |
| Wrapup save: mandatory remarks blank (technical_issue) | 422 | `interaction.service.test.ts` |
| Wrapup save: mandatory remarks blank (abusive_caller) | 422 | `interaction.service.test.ts` |
| Wrapup save: mandatory remarks blank (incomplete_interaction) | 422 | `interaction.service.test.ts` |
| Wrapup save: mandatory remarks blank (others) | 422 | `interaction.service.test.ts` |
| Agent status: invalid enum value | 422 | `agent-status.service.test.ts`, `agent-status.integration.test.ts` |
| Agent status: empty string | 422 | `agent-status.integration.test.ts` |
| Agent status: missing from body | 422 | `agent-status.integration.test.ts` |
| Interaction ID is not a UUID | 422 | `search.integration.test.ts` |

### State machine violations (422)

| Scenario | Expected | Test file |
|---|---|---|
| Update context from WRAPUP | 422 | `interaction.service.test.ts`, `interaction.integration.test.ts` |
| Update context from CLOSED | 422 | `interaction.service.test.ts` |
| Update context from INCOMPLETE | 422 | `interaction.service.test.ts` |
| Update context from NEW | 422 | `interaction.service.test.ts` |
| Close from IDENTIFYING | 422 | `interaction.service.test.ts`, `interaction.integration.test.ts` |
| Close from CONTEXT_CONFIRMED | 422 | `interaction.service.test.ts` |
| Close from CLOSED (second call) | 422 (or 200 idempotent) | `interaction.integration.test.ts` |
| Mark incomplete from IDENTIFYING | 422 | `interaction.service.test.ts`, `interaction.integration.test.ts` |
| Mark incomplete when disposition is not incomplete_interaction | 422 | `interaction.service.test.ts`, `interaction.integration.test.ts` |
| Mark incomplete with blank remarks (defense-in-depth) | 422 | `interaction.service.test.ts` |
| Wrapup save from CLOSED | 422 | `interaction.service.test.ts`, `interaction.integration.test.ts` |
| Wrapup save from INCOMPLETE | 422 | `interaction.service.test.ts`, `interaction.integration.test.ts` |

### Concurrency

| Scenario | Expected | Test file |
|---|---|---|
| Same agent creates second interaction while first is open | 409 CONFLICT | `interaction.service.test.ts`, `interaction.integration.test.ts` |

### Resilience (service failures)

| Scenario | Expected | Test file |
|---|---|---|
| Audit event write fails during login | Login still succeeds | `auth.service.test.ts` |
| Audit event write fails during status update | Status update still succeeds | `agent-status.service.test.ts` |

---

## 4. Known Test Gaps with Explicit Rationale

### Gap 1: End-to-end (browser) tests

**What is not tested:** Full browser-driven journeys (sign-in through close interaction).
**Rationale for deferral:** E2E tests require a running Docker Compose stack with seeded DB plus a deployed frontend. Phase 1 delivery is backend-first. Frontend build is in progress. E2E tests will be added in the next iteration once the frontend workspace is testable.
**Risk:** Rendering failures and frontend-to-backend contract breaks are not caught by current tests. Mitigated by API integration tests covering the same flows.

### Gap 2: Frontend component tests

**What is not tested:** React component rendering, form validation display, loading/error/disabled states.
**Rationale for deferral:** Delegated to the frontend-engineer. This is by design per CLAUDE.md — component tests are the frontend-engineer's scope.
**Risk:** UI regression on validation messages or disabled states. Mitigated by manual smoke testing on every frontend build.

### Gap 3: Context endpoint tests

**What is not tested:** `GET /api/v1/context/:type/:ref` endpoints for customer, vehicle, and dealer context retrieval.
**Rationale for deferral:** Context endpoints call `MockContextAdapter` which is not a primary test risk — the data shape is deterministic. The context service is covered functionally by interaction context update tests. Dedicated context endpoint tests will be added when the adapter is replaced by real HTTP calls.
**Risk:** Low for Phase 1 since the context data is mock-seeded and the endpoint has no business logic beyond adapter call + masking.

### Gap 4: Master data endpoint tests

**What is not tested:** `GET /api/v1/master-data/:referenceType` endpoints.
**Rationale for deferral:** Master data endpoints are read-only, authenticated GET requests returning reference_values rows. There is no business logic. The data is seeded deterministically in migration 011. Adding integration tests for these endpoints adds coverage of a trivial path. Will be added as part of the frontend form binding verification pass.
**Risk:** Very low. A broken master data endpoint would surface immediately during manual testing.

### Gap 5: Performance and load tests

**What is not tested:** Response time under concurrent agent load, DB pool behaviour under stress.
**Rationale for deferral:** Per testing-strategy.md §7, performance/load tests are listed as non-functional tests in the pre-release checklist. They require a dedicated environment and load tool (k6 or similar). Phase 1 is not yet in pre-release.
**Risk:** Documented in NFRs. Acceptable for Phase 1 development iteration.

### Gap 6: Expired JWT token behaviour

**What is not tested:** System response when a JWT expires mid-session.
**Rationale for deferral:** Testing requires either clock manipulation or issuing a token with a 1-second TTL. The code path is covered: `authenticate.ts` explicitly handles `jwt.TokenExpiredError` and returns 401 with `TOKEN_EXPIRED` code. An explicit test with a short-lived token will be added to `auth.integration.test.ts` in the next iteration.
**Risk:** Low. The error handler path is exercised by unit-level auth middleware inspection.

### Gap 7: Concurrent search stress

**What is not tested:** Two simultaneous search requests on the same interaction.
**Rationale for deferral:** The search endpoint is stateless — it reads interaction status and writes events. No locking is required per architecture. Concurrent write to `search_attempts` is safe due to the RETURNING clause. Not a priority gap.

---

## 5. Release Gate Requirements

The following requirements must be met before a Phase 1 release candidate is declared, per `testing-strategy.md`:

### CI required checks

| Gate | Pass criterion |
|---|---|
| lint | Zero ESLint warnings (`--max-warnings 0`) |
| type check | Zero TypeScript errors (`tsc --noEmit`) |
| unit tests | All unit tests pass (`vitest --project unit`) |
| integration tests | All integration tests pass against test DB (`vitest --project integration`) |
| build | `tsc --project tsconfig.json` exits with 0 |
| coverage | Lines >= 80%, branches >= 75% on services and validators |

### Pre-release additional checks

| Gate | Pass criterion |
|---|---|
| No open P0 defects | Zero data loss, security bypass, audit trail failure, or core workflow failure bugs open |
| Security CSRF check | All mutation endpoints return 403 without `X-CSRF-Token` (verified by `security.integration.test.ts`) |
| Audit trail completeness | All 10 interaction event types verified in `audit.integration.test.ts` |
| No stack traces in responses | Verified by `security.integration.test.ts` "no stack trace" assertions |
| No enumeration vulnerability | Login returns identical message for wrong password and unknown user — verified in `auth.integration.test.ts` |
| Rollback readiness | Migration rollback scripts reviewed and tested |
| Schema migration verified | All 14 migrations run cleanly against the test database |

### Test data seeding requirement

Integration tests depend on the following test data being present:
- Users seeded by migration 012: `agent1` (role: agent) and `noaccess` (no role)
- Reference values seeded by migration 011
- Agent statuses table created by migration 013

If `TEST_DATABASE_URL` points to a fresh database, all migrations must be run before integration tests can pass.

---

## 6. Coverage Configuration

Coverage is configured in `apps/api/vitest.config.ts` with the following targets:

- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

Coverage is measured over service, repository, validator, middleware, and error modules. Infrastructure files (`main.ts`, `app.ts`, config, logging, database pool) are excluded from coverage measurement.

Run with: `npx vitest run --coverage`
