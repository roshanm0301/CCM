# Testing Strategy

## Purpose
This document defines how CCM quality is verified across unit, integration, end-to-end, non-functional, and release testing.

## Agents that use this document
| Agent | How it is used |
|---|---|
| QA Engineer Agent | Creates the overall test strategy and release gates |
| Frontend Engineer Agent | Implements component and UI interaction tests |
| Backend Engineer Agent | Implements service, repository, and contract tests |
| Solution Architect Agent | Ensures testing covers architectural risk |
| DevOps Engineer Agent | Automates quality gates in CI/CD |

## Testing principles
1. Test the highest-risk behavior earliest.
2. Prefer many fast tests plus a focused set of end-to-end workflows.
3. Validate both happy paths and controlled failures.
4. Test interfaces between modules, not only modules in isolation.
5. Non-functional requirements are testable requirements, not aspirations.

## Test pyramid
```text
          [Few]   End-to-End / Journey Tests
        [More]    Integration / Contract / Module Tests
      [Many]      Unit / Component / Utility Tests
```

## Test layers

### 1. Unit tests
Purpose:
- verify isolated logic quickly.

Examples:
- input normalization,
- validation rules,
- state transition guards,
- mapper logic,
- UI formatting helpers.

### 2. Component tests
Purpose:
- verify reusable UI component behavior.

Cover:
- rendering states,
- keyboard support,
- validation display,
- loading/disabled behavior,
- accessibility roles and names.

### 3. Module/service integration tests
Purpose:
- verify backend application services with real or realistic persistence.

Cover:
- interaction creation,
- wrap-up persistence,
- audit event creation,
- transaction boundaries,
- repository behavior.

### 4. API contract tests
Purpose:
- verify request/response contracts remain stable.

Requirements:
- validate status codes,
- error envelopes,
- required fields,
- schema compatibility,
- versioning behavior.

### 5. Frontend-backend integration tests
Purpose:
- verify the UI can consume API responses correctly, especially for:
  - loading,
  - empty results,
  - partial data,
  - validation errors,
  - unavailable upstream context.

### 6. End-to-end tests
Purpose:
- verify critical user journeys in a running environment.

Initial Phase 1 candidate journeys:
- sign in and load workspace,
- start manual interaction,
- execute valid search,
- resolve selection ambiguity,
- save wrap-up,
- close interaction,
- mark incomplete interaction,
- handle empty search result,
- handle upstream retrieval failure.

### 7. Non-functional tests
Required categories:
- performance/load tests for core APIs,
- resilience tests for upstream failures/timeouts,
- accessibility tests,
- security scanning,
- container startup/smoke tests,
- backup/restore validation where applicable.

## Test data strategy
- seed deterministic data for local/dev/test
- separate test fixtures from production-like masked datasets
- avoid brittle dependence on live external systems
- use mocks/stubs for upstream systems in automated suites unless explicitly testing adapter integration

## Environment strategy
| Environment | Purpose |
|---|---|
| Local | fast developer feedback |
| CI ephemeral | automated verification on each change |
| Integration/Test | combined stack and contract verification |
| UAT/Staging | business and release validation |
| Production | monitored runtime verification only |

## Automation expectations
### CI required checks
- lint
- type check
- unit/component tests
- module/integration tests
- build
- security scans
- container build validation

### Pre-release checks
- end-to-end regression pack
- accessibility review on changed workflows
- performance smoke or benchmark
- migration verification
- rollback readiness check

## Defect handling priorities
### P0
- data loss
- security bypass
- inability to perform core workflow
- audit trail failure for critical actions

### P1
- major workflow impairment with workaround absent or unsafe
- serious performance or stability issue
- accessibility block in core workflow

### P2
- non-critical functional inconsistency
- moderate usability issue
- non-blocking UI defect

## Exit criteria
A release candidate is acceptable only when:
1. All critical and agreed high-priority tests pass.
2. No open P0 defects exist.
3. Any accepted P1/P2 issues are explicitly documented.
4. Observability and rollback checks are complete.
5. Schema/database changes are validated against deployment and rollback plans.

## Agent-specific notes
### QA Engineer Agent
- Derive cases from both functional docs and non-functional requirements.
- Verify negative paths, not only success paths.

### Frontend Engineer Agent
- Write tests for loading, error, empty, disabled, and keyboard states.
- Ensure shared components are covered before page-level tests.

### Backend Engineer Agent
- Test services against repositories and audit behavior together where risk is high.
- Add contract tests when changing request/response schemas.
