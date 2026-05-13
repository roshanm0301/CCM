# Non-Functional Requirements

## Purpose
This document defines the measurable quality bars for CCM implementation. It applies across phases unless a later approved decision supersedes a target.

## Agents that use this document
| Agent | How it is used |
|---|---|
| Product Owner Agent | Decides release readiness beyond feature completeness |
| Solution Architect Agent | Designs for performance, resilience, security, and scale |
| Frontend Engineer Agent | Implements client-side budgets and usability safeguards |
| Backend Engineer Agent | Meets API, persistence, and resilience targets |
| QA Engineer Agent | Converts each target into verification criteria |
| DevOps Engineer Agent | Configures infrastructure, deployment, and monitoring thresholds |

## Scope rule
These are platform quality targets. They must not be interpreted as business features.

## NFR catalog

### 1. Availability
| Area | Target |
|---|---|
| Production monthly availability for core CCM application | 99.5% minimum |
| Planned maintenance | announced and controlled |
| Graceful degradation | required for non-critical upstream failures |

### 2. Performance
#### User-facing targets
| Capability | Target |
|---|---|
| Initial authenticated workspace load (excluding first login redirect) | p95 <= 3 seconds |
| Start manual interaction API | p95 <= 1 second |
| Search response with healthy upstream dependency | p95 <= 3 seconds |
| Context load after selection | p95 <= 2 seconds |
| Wrap-up save / close interaction | p95 <= 1.5 seconds |

#### Backend targets
| Metric | Target |
|---|---|
| Standard API response time under normal load | p95 <= 500 ms excluding upstream wait |
| Health endpoint response | <= 200 ms |
| Audit event write | synchronous or durable queued persistence within 5 seconds |

### 3. Scalability
The architecture must support horizontal scaling of stateless application containers.

Initial design target:
- at least 500 concurrent authenticated users at the platform level without architectural redesign,
- capacity planning must be configurable through infrastructure rather than code rewrites.

### 4. Reliability and resilience
Requirements:
- no silent data loss for interaction lifecycle updates,
- idempotent handling for retried close or wrap-up requests where feasible,
- retry policy for transient integration failures,
- circuit-breaker or fail-fast protection for repeatedly failing upstreams,
- durable audit/event capture for key workflow transitions.

### 5. Security
Minimum requirements:
- TLS in transit for all external communication,
- role-based access control,
- secret storage outside source code,
- strong input validation,
- dependency vulnerability scanning,
- masked sensitive data in UI and logs,
- audit trail for sensitive workflow actions.

### 6. Privacy and data protection
Requirements:
- minimize personal data copied from source systems,
- store only what is required for the CCM workflow,
- retain snapshots only with purpose and retention policy,
- mask sensitive identifiers where full display is unnecessary,
- define retention and purge policies before production launch.

### 7. Observability
Requirements:
- structured logs,
- correlation IDs,
- API metrics,
- error rate tracking,
- dashboard coverage for availability and latency,
- alerting on core workflow failures.

### 8. Maintainability
Requirements:
- TypeScript strict mode,
- automated tests in CI,
- documented module boundaries,
- lint and formatting gates,
- architecture decision visibility,
- versioned environment configuration.

### 9. Usability
Requirements:
- keyboard-operable primary workflows,
- consistent validation behavior,
- readable enterprise density,
- clear empty/loading/error states,
- no future-phase placeholders on current-phase screens.

### 10. Accessibility
Target: WCAG 2.2 AA baseline for supported web behavior.

### 11. Auditability
Requirements:
- every critical interaction event must be attributable to actor and timestamp,
- event capture must support reconstruction of key workflow decisions,
- audit storage failure must be detectable and actionable.

### 12. Deployability
Requirements:
- all application components required for local/dev/test execution must be containerizable,
- Docker Compose must support a complete local stack,
- CI pipeline must produce immutable versioned artifacts.

## Verification matrix
| NFR category | Primary verification method |
|---|---|
| Availability | monitoring dashboards, uptime checks |
| Performance | load tests, synthetic tests, API benchmarks |
| Security | SAST, dependency scanning, secrets checks, pen test where required |
| Accessibility | automated tooling + manual keyboard/screen reader review |
| Reliability | failure injection, retry behavior tests, resilience tests |
| Auditability | event trail verification and tamper review |
| Deployability | container build tests, environment smoke tests |

## Release gates
A release is not ready if any of the following is true:
1. Critical workflow data can be lost.
2. Core API endpoints fail defined error-budget thresholds.
3. RBAC or masking controls are bypassable.
4. Observability cannot identify production failures quickly.
5. Deployment cannot be repeated consistently from source-controlled configuration.

## Phase evolution rule
Future phases may add stricter targets, but should not weaken these baseline standards without explicit approval and documented rationale.
